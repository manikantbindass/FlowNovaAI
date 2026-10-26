import {getIronSession} from 'iron-session';
import {cookies} from 'next/headers';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {start,getRun} from 'workflow/api';
import {executeGraph} from '@/workflows/execute';
import {graphSchema,type Workflow,type Graph} from '../model';
import {DomainError,fail,isObject,redact,validate,SUPPORTED,type Json} from './graph';
import {readWorkspace,mutateWorkspace,audit,event,terminal,type StoredRun,type StoredWorkflow,type WorkspaceData} from './store';

type Identity={authenticated?:boolean;username?:string;csrf?:string;workspaces?:Record<string,string>};
const PUBLIC_USERS=['demo','viewer','other'];
const plain=(f:StoredWorkflow):Workflow=>({id:f.id,workspaceId:f.workspaceId,name:f.name,description:f.description,graph:f.graph,revision:f.revision,publishedVersion:f.publishedVersion,updatedAt:f.updatedAt});
const workflow=(data:WorkspaceData,id:string)=>data.workflows.find(f=>f.id===id)||fail(404,'Workflow not found');
const run=(data:WorkspaceData,id:string)=>data.runs.find(r=>r.execution.id===id)||fail(404,'Execution not found');
function saveBody(body:unknown){if(!isObject(body)||typeof body.name!=='string'||!body.name.trim()||body.name.length>100||typeof body.description!=='string'||body.description.length>500||JSON.stringify(body.graph??null).length>131072)fail(400,'Provide a name, description and graph within allowed limits');let graph:Graph;try{graph=graphSchema.parse((body as Record<string,unknown>).graph);}catch{return fail(400,'Malformed graph or unsupported schema. Import a supported v1 graph.');}return{name:String((body as Record<string,unknown>).name).trim(),description:String((body as Record<string,unknown>).description),graph,revision:Number((body as Record<string,unknown>).revision)};}
function checkRevision(f:StoredWorkflow,value:unknown){if(f.revision!==value)fail(409,'This draft changed elsewhere. Reload before saving.');}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Request-ID':randomUUID()}});

export async function hostedApi(request:NextRequest):Promise<Response>{
 try{
 const secret=process.env.SESSION_SECRET||process.env.BLOB_READ_WRITE_TOKEN;if(!secret)throw new DomainError(503,'Hosted storage/session configuration is incomplete. The project owner must connect the private Blob store.');
 const session=await getIronSession<Identity>(await cookies(),{cookieName:'flownova_hosted',password:createHash('sha256').update('flownova-session-v1:'+secret).digest('hex'),ttl:60*60*24*7,cookieOptions:{secure:process.env.NODE_ENV==='production',httpOnly:true,sameSite:'lax',path:'/'}});
 const path=request.nextUrl.pathname.slice('/api/v1/'.length).split('/').filter(Boolean).map(decodeURIComponent);const method=request.method;
 if(path.join('/')==='auth/session'&&method==='GET'){
  if(!session.csrf){session.csrf=randomUUID();session.workspaces??={};await session.save();}
  return json({authenticated:!!session.authenticated,username:session.username||'',mode:'vercel',csrf:session.csrf,csrfHeader:'X-CSRF-TOKEN'});
 }
 if(method!=='GET'){
  const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==request.headers.get('host'))fail(403,'Request origin is not allowed');
  if(!session.csrf||request.headers.get('x-csrf-token')!==session.csrf)fail(403,'Session expired or CSRF token missing. Reload and try again.');
 }
 let raw='';if(request.body){const reader=request.body.getReader();const decoder=new TextDecoder();let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return json({message:'Request exceeds 256 KB'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
 if(path.join('/')==='auth/login'&&method==='POST'){
  const form=new URLSearchParams(raw);const username=form.get('username')||'',password=form.get('password')||'';const expected=process.env.LOCAL_PASSWORD||'demo';const hash=(v:string)=>createHash('sha256').update(v).digest();
  if(!PUBLIC_USERS.includes(username)||!timingSafeEqual(hash(password),hash(expected)))fail(401,'Invalid username or password');
  session.workspaces??={};const group=username==='viewer'?'demo':username;session.workspaces[group]??='nova-'+randomUUID();session.username=username;session.authenticated=true;session.csrf=randomUUID();await session.save();
  return json({authenticated:true});
 }
 if(path.join('/')==='auth/logout'&&method==='POST'){session.authenticated=false;session.username='';session.csrf=randomUUID();await session.save();return new Response(null,{status:204});}
 if(!session.authenticated||!session.username)fail(401,'Sign in to access your workspace');
 const actor=session.username!;const role=actor==='viewer'?'VIEWER':'OWNER';const workspaceId=session.workspaces?.[actor==='viewer'?'demo':actor]||fail(401,'Session workspace missing. Sign in again.');
 if(path.join('/')==='capabilities')return json({nodes:SUPPORTED,aiConfigured:!!process.env.OPENAI_API_KEY,aiModel:process.env.OPENAI_MODEL||'gpt-4.1-mini',runtime:'vercel-workflows',storage:'private-blob',planned:['http','webhook','schedule','slack','github','rag','billing']});
 if(path[0]!=='workspaces')fail(404,'Endpoint not found');
 if(path.length===1&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json([{id:workspaceId,name:data.name,role}]);}
 if(path[1]!==workspaceId)fail(404,'Workspace not found');
 if(method!=='GET'&&role==='VIEWER')fail(403,'Editor access is required');
 let body:unknown={};if(raw&&request.headers.get('content-type')?.includes('application/json')){try{body=JSON.parse(raw);}catch{fail(400,'Malformed JSON request');}}
 const params=request.nextUrl.searchParams;const limit=Math.max(1,Math.min(100,Number(params.get('limit')||30)||30));const offset=Math.max(0,Number(params.get('offset')||0)||0);
 if(path[2]==='analytics'&&path[3]==='overview'&&method==='GET'){const{data}=await readWorkspace(workspaceId);const succeeded=data.runs.filter(r=>r.execution.status==='SUCCEEDED').length;return json({workflows:data.workflows.length,published:data.workflows.filter(f=>f.publishedVersion>0).length,executions:data.runs.length,succeeded,failed:data.runs.filter(r=>['FAILED','TIMED_OUT'].includes(r.execution.status)).length,successRate:data.runs.length?Math.round(succeeded*100/data.runs.length):0});}
 if(path[2]==='audit-logs'&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json(data.audit.slice().reverse().slice(0,100));}
 if(path[2]==='workflows'){
  const id=path[3];
  if(!id&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json(data.workflows.slice().sort((a,b)=>b.updatedAt-a.updatedAt).slice(offset,offset+limit).map(plain));}
  if(!id&&method==='POST'){const s=saveBody(body);const result=await mutateWorkspace(workspaceId,data=>{if(data.workflows.length>=25)fail(429,'Hosted demo limit: 25 workflows per workspace');const f:StoredWorkflow={...s,id:randomUUID(),workspaceId,revision:1,publishedVersion:0,updatedAt:Date.now(),versions:[]};data.workflows.push(f);audit(data,actor,'WORKFLOW_CREATED',f.id);return plain(f);});return json(result,201);}
  if(path.length===4&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json(plain(workflow(data,id)));}
  if(path.length===4&&method==='PUT'){const s=saveBody(body);return json(await mutateWorkspace(workspaceId,data=>{const f=workflow(data,id);checkRevision(f,s.revision);Object.assign(f,{name:s.name,description:s.description,graph:s.graph,revision:f.revision+1,updatedAt:Date.now()});audit(data,actor,'DRAFT_SAVED',id);return plain(f);}));}
  if(path[4]==='validate'&&method==='POST'){const{data}=await readWorkspace(workspaceId);return json({issues:validate(workflow(data,id).graph)});}
  if(path[4]==='publish'&&method==='POST'){return json(await mutateWorkspace(workspaceId,data=>{const f=workflow(data,id);checkRevision(f,isObject(body)?body.revision:undefined);const issues=validate(f.graph);if(issues.length)fail(422,issues[0].message);if(f.versions.length>=20)fail(429,'Hosted demo limit: 20 published versions per workflow');f.publishedVersion++;f.versions.push({version:f.publishedVersion,graph:structuredClone(f.graph),createdAt:Date.now(),createdBy:actor});audit(data,actor,'WORKFLOW_PUBLISHED',id);return plain(f);}));}
  if(path[4]==='versions'){
   const version=Number(path[5]);if(path.length===5&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json(workflow(data,id).versions.map(({version,createdAt,createdBy})=>({version,createdAt,createdBy})).reverse());}
   if(path.length===6&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json(workflow(data,id).versions.find(v=>v.version===version)?.graph||fail(404,'Published version not found'));}
   if(path[6]==='restore'&&method==='POST')return json(await mutateWorkspace(workspaceId,data=>{const f=workflow(data,id);checkRevision(f,isObject(body)?body.revision:undefined);const snapshot=f.versions.find(v=>v.version===version)||fail(404,'Published version not found');f.graph=structuredClone(snapshot.graph);f.revision++;f.updatedAt=Date.now();audit(data,actor,'VERSION_RESTORED_TO_DRAFT',id);return plain(f);}));
  }
  if(path[4]==='execute'&&method==='POST'){
   const key=request.headers.get('idempotency-key')||'';if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key))fail(400,'Provide an Idempotency-Key');if(!isObject(body)||JSON.stringify(body).length>16384)fail(400,'Execution input must be an object up to 16 KB');
   const queued=await mutateWorkspace(workspaceId,data=>{const prior=data.runs.find(r=>r.key===key);if(prior){if(prior.execution.workflowId!==id)fail(409,'Idempotency key belongs to another workflow');return{id:prior.execution.id,created:false};}const f=workflow(data,id);const v=f.versions.find(v=>v.version===f.publishedVersion)||fail(409,'Publish a validated version first');if(data.runs.length>=50)fail(429,'Hosted demo limit: 50 executions per workspace');if(data.runs.filter(r=>!terminal(r.execution.status)).length>=2)fail(429,'Hosted demo limit: two active executions');const now=Date.now(),executionId=randomUUID();const record:StoredRun={execution:{id:executionId,workflowId:id,workflowName:f.name,version:v.version,status:'QUEUED',createdAt:now,startedAt:null,finishedAt:null,error:null},graph:structuredClone(v.graph),input:redact(body as Json),key,nodes:[],events:[]};event(record,'QUEUED','Execution queued');data.runs.push(record);audit(data,actor,'EXECUTION_STARTED',executionId);return{id:executionId,created:true};});
   if(queued.created){try{const durable=await start(executeGraph,[workspaceId,queued.id]);await mutateWorkspace(workspaceId,data=>{run(data,queued.id).workflowRunId=durable.runId;});}catch{await mutateWorkspace(workspaceId,data=>{const r=run(data,queued.id);if(!terminal(r.execution.status)){r.execution.status='FAILED';r.execution.error='Durable workflow could not be queued. Please try again.';r.execution.finishedAt=Date.now();event(r,'FAILED',r.execution.error);}});fail(503,'Execution could not be queued. Please try again.');}}
   const{data}=await readWorkspace(workspaceId);return json(run(data,queued.id).execution,202);
  }
 }
 if(path[2]==='executions'){
  const id=path[3];if(!id&&method==='GET'){const{data}=await readWorkspace(workspaceId);return json(data.runs.slice().reverse().slice(offset,offset+limit).map(r=>r.execution));}
  if(id&&path.length===4&&method==='GET'){
   let{data}=await readWorkspace(workspaceId);let r=run(data,id);
   if(!terminal(r.execution.status)){
    let state:string|undefined;try{if(r.workflowRunId)state=await getRun(r.workflowRunId).status;}catch{/* An unavailable provider status does not erase persisted results. */}
    const expired=Date.now()-r.execution.createdAt>120000;
    if(expired||state==='failed'||state==='cancelled'){
     await mutateWorkspace(workspaceId,document=>{const current=run(document,id);if(terminal(current.execution.status))return;current.execution.status=expired?'TIMED_OUT':state==='cancelled'?'CANCELLED':'FAILED';current.execution.finishedAt=Date.now();current.execution.error=expired?'Workflow exceeded 120 seconds':'The durable workflow stopped before completion';event(current,current.execution.status,current.execution.error);});
     ({data}=await readWorkspace(workspaceId));r=run(data,id);
    }
   }
   return json({execution:r.execution,nodes:r.nodes,events:r.events});
  }
  if(path[4]==='cancel'&&method==='POST'){const durableId=await mutateWorkspace(workspaceId,data=>{const r=run(data,id);if(terminal(r.execution.status))fail(409,'Execution is already finished');r.execution.status='CANCELLED';r.execution.finishedAt=Date.now();event(r,'CANCELLED','Cancellation requested');audit(data,actor,'EXECUTION_CANCELLED',id);return r.workflowRunId;});if(durableId)try{await getRun(durableId).cancel();}catch{/* Persisted cancellation fences any later node checkpoints. */}return new Response(null,{status:204});}
 }
 return json({message:'Endpoint not found',status:404},404);
 }catch(error){if(error instanceof DomainError)return json({message:error.message,status:error.status},error.status);console.error('Hosted request failed',{name:error instanceof Error?error.name:'unknown'});return json({message:'Hosted storage is temporarily unavailable. Please retry.',status:503},503);}
}
