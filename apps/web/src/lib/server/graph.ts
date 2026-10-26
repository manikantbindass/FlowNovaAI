import type {Graph,Step} from '../model';
export type Json = null|boolean|number|string|Json[]|{[key:string]:Json};
export type Issue={nodeId:string|null;message:string};
export class DomainError extends Error{constructor(public status:number,message:string){super(message);}}
export const fail=(status:number,message:string):never=>{throw new DomainError(status,message);};
export function isObject(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export const SUPPORTED=['manual','transform','condition','delay','ai','collection','assert'];
export function validate(graph:Graph):Issue[]{
 const issues:Issue[]=[];const issue=(nodeId:string|null,message:string)=>issues.push({nodeId,message});
 if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))return[{nodeId:null,message:'Graph requires nodes and edges arrays'}];
 if(graph.nodes.length<1||graph.nodes.length>50||graph.edges.length>100)return[{nodeId:null,message:'Use 1–50 nodes and at most 100 edges'}];
 const nodes=new Map<string,Step>();for(const node of graph.nodes){const id=node.id,kind=node.data?.kind,c=node.data?.config||{};
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||nodes.has(id))issue(id,'Node IDs must be valid and unique');nodes.set(id,node);
 if(!SUPPORTED.includes(kind))issue(id,'Unsupported node type');if(node.data?.schemaVersion!==1)issue(id,'Unsupported node schema version');if(!isObject(node.data?.config))issue(id,'Configuration must be an object');
 if(kind==='transform'&&(!isObject(c.mapping)||Object.keys(c.mapping).length>40))issue(id,'Transform requires a mapping object with at most 40 keys');
 if(kind==='delay'&&(!Number.isInteger(c.milliseconds)||Number(c.milliseconds)<0||Number(c.milliseconds)>10000))issue(id,'Delay must be 0–10000 milliseconds');
 if(['condition','assert'].includes(kind)&&(typeof c.path!=='string'||!/^\$\.[a-zA-Z0-9_.-]{1,100}$/.test(c.path)||!Object.hasOwn(c,'equals')))issue(id,'Check requires a $.path and equals value');
 if(kind==='ai'&&(typeof c.prompt!=='string'||!c.prompt.trim()||c.prompt.length>4000))issue(id,'AI requires a prompt up to 4000 characters');
 if(kind==='collection'&&(typeof c.path!=='string'||!c.path.startsWith('$.')||!['filter','pluck','take','count'].includes(String(c.operation))||!Number.isInteger(c.limit??100)||Number(c.limit??100)<1||Number(c.limit??100)>100))issue(id,'Collection requires a path, operation, and limit from 1–100');
 if(kind==='collection'&&['filter','pluck'].includes(String(c.operation))&&(typeof c.field!=='string'||!/^\w[\w.-]{0,99}$/.test(c.field)))issue(id,'Collection requires a valid field');
 if(kind==='collection'&&c.operation==='filter'&&!Object.hasOwn(c,'equals'))issue(id,'Collection filter requires equals');
 }
 const triggers=graph.nodes.filter(n=>n.data?.kind==='manual');if(triggers.length!==1)issue(null,'Exactly one manual trigger is required');
 const incoming=new Map<string,number>();const outgoing=new Map<string,string[]>();const handles=new Set<string>();
 for(const edge of graph.edges){if(!nodes.has(edge.source)||!nodes.has(edge.target)){issue(null,'Edge references a missing node');continue;}
 if(nodes.get(edge.target)?.data.kind==='manual')issue(edge.target,'Triggers cannot have incoming edges');incoming.set(edge.target,(incoming.get(edge.target)||0)+1);if(incoming.get(edge.target)!>1)issue(edge.target,'Joins are not supported');
 const handle=edge.sourceHandle||'';if(nodes.get(edge.source)?.data.kind==='condition'){if(!['true','false'].includes(handle))issue(edge.source,'Condition edges require true/false handles');}else if(handle)issue(edge.source,'Only conditions have named outputs');
 const key=edge.source+':'+handle;if(handles.has(key))issue(edge.source,'Use one edge per output handle');handles.add(key);outgoing.set(edge.source,[...(outgoing.get(edge.source)||[]),edge.target]);
 }
 const degrees=new Map(graph.nodes.map(n=>[n.id,incoming.get(n.id)||0]));const q=graph.nodes.filter(n=>!degrees.get(n.id)).map(n=>n.id);let visited=0;
 while(q.length){const id=q.shift()!;visited++;for(const target of outgoing.get(id)||[]){degrees.set(target,degrees.get(target)!-1);if(!degrees.get(target))q.push(target);}}
 if(visited!==nodes.size)issue(null,'Cycles are not supported');
 if(triggers.length===1){const seen=new Set<string>();q.push(triggers[0].id);while(q.length){const id=q.shift()!;if(!seen.has(id)){seen.add(id);q.push(...(outgoing.get(id)||[]));}}for(const id of nodes.keys())if(!seen.has(id))issue(id,'Node is disconnected from the trigger');}
 return issues;
}
export function resolve(input:Json,path:string):Json{let value:Json=input;for(const key of path.slice(2).split('.')){if(!isObject(value)||!Object.hasOwn(value,key))return null;value=value[key] as Json;}return value;}
export function redact(input:Json):Json{if(Array.isArray(input))return input.map(redact);if(isObject(input))return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,/(secret|password|token|authorization|api.?key|cookie)/i.test(k)?'[REDACTED]':redact(v as Json)]));return input;}
export function equal(a:unknown,b:unknown):boolean{if(a===b)return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));if(isObject(a)&&isObject(b))return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));return false;}
export function deterministic(node:Step,input:Json):Json{
 const c=node.data.config;
 switch(node.data.kind){
 case'manual':case'delay':return input;
 case'transform':return Object.fromEntries(Object.entries(c.mapping as Record<string,Json>).map(([k,v])=>[k,typeof v==='string'&&v.startsWith('$.')?resolve(input,v):v]));
 case'condition':return{matched:equal(resolve(input,String(c.path)),c.equals),data:input};
 case'assert':if(!equal(resolve(input,String(c.path)),c.equals))fail(422,'Assertion failed: required data condition was not met');return input;
 case'collection':{const items=resolve(input,String(c.path));if(!Array.isArray(items)||items.length>1000)fail(422,'Collection input must be an array with at most 1000 items');const selected=(items as Json[]).filter(item=>c.operation!=='filter'||equal(resolve(item,'$.'+c.field),c.equals));const result=c.operation==='count'?[]:selected.slice(0,Number(c.limit??100)).map(item=>c.operation==='pluck'?resolve(item,'$.'+c.field):item);return{items:result,total:selected.length,returned:result.length};}
 default:return fail(422,'Node requires a configured provider');
 }
}
