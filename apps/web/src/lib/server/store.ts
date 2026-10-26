import {get,put,head,BlobNotFoundError,BlobPreconditionFailedError} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
import type {Graph,Workflow,Detail,Execution} from '../model';
import {DomainError,type Json} from './graph';
export type Version={version:number;graph:Graph;createdAt:number;createdBy:string};
export type StoredWorkflow=Workflow&{versions:Version[]};
export type StoredRun=Detail&{graph:Graph;input:Json;key:string;workflowRunId?:string};
export type Audit={actor:string;action:string;resource_id:string;created_at:number};
export type WorkspaceData={schemaVersion:1;id:string;name:string;workflows:StoredWorkflow[];runs:StoredRun[];audit:Audit[]};
const pathname=(id:string)=>{if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new DomainError(404,'Workspace not found');return`workspaces/v1/${id}.json`;};
export const empty=(id:string):WorkspaceData=>({schemaVersion:1,id,name:'Your Nova workspace',workflows:[],runs:[],audit:[]});
export async function readWorkspace(id:string):Promise<{data:WorkspaceData;etag?:string}>{
 try{
  for(let attempt=0;attempt<3;attempt++){
   // Pair the authoritative write ETag with an immutable-version cache key.
   // CDN representation ETags may be weak; never use a newer metadata tag with older content.
   const metadata=await head(pathname(id));const url=new URL(metadata.url);url.searchParams.set('version',metadata.etag);
   const result=await get(url.toString(),{access:'private',useCache:false,headers:{'Cache-Control':'no-store'}});
   if(!result||result.statusCode!==200||!result.stream)continue;
   const normalized=(tag:string)=>tag.replace(/^W\//,'');
   if(normalized(result.blob.etag)!==normalized(metadata.etag))continue;
   const data=await new Response(result.stream).json() as WorkspaceData;if(data.id!==id||data.schemaVersion!==1)throw new Error('Workspace storage schema mismatch');return{data,etag:metadata.etag};
  }
  throw new DomainError(409,'Workspace changed during reading. Please retry.');
 }
 catch(error){if(error instanceof BlobNotFoundError)return{data:empty(id)};throw error;}
}
export async function mutateWorkspace<T>(id:string,fn:(data:WorkspaceData)=>T):Promise<T>{
 for(let attempt=0;attempt<6;attempt++){
  const {data,etag}=await readWorkspace(id);const result=fn(data);data.audit=data.audit.slice(-200);const body=JSON.stringify(data);if(body.length>2_000_000)throw new DomainError(429,'Demo workspace storage limit reached. Export your workflows before creating more data.');
  try{await put(pathname(id),body,{access:'private',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:0});return result;}
  catch(error){if(!(error instanceof BlobPreconditionFailedError)&&!(error instanceof Error&&error.name==='BlobAlreadyExistsError'))throw error;}
 }
 throw new DomainError(409,'Workspace changed concurrently. Please retry.');
}
export const audit=(data:WorkspaceData,actor:string,action:string,id:string)=>data.audit.push({actor,action,resource_id:id,created_at:Date.now()});
export const event=(run:StoredRun,kind:string,message:string,nodeId='')=>run.events.push({id:randomUUID(),kind,message,nodeId,createdAt:Date.now()});
export const summary=(run:StoredRun):Execution=>run.execution;
export const terminal=(status:string)=>['SUCCEEDED','FAILED','CANCELLED','TIMED_OUT'].includes(status);
