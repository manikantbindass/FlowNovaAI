import { z } from 'zod';
import type { Node, Edge } from '@xyflow/react';

export const kinds = ['manual','transform','condition','delay','ai','collection','assert'] as const;
export type Kind = typeof kinds[number];
export type StepData = { label: string; kind: Kind; schemaVersion: number; config: Record<string, unknown>; status?: string; invalid?: boolean };
export type Step = Node<StepData>;
export type Graph = { nodes: Step[]; edges: Edge[] };
export type Workflow = { id: string; workspaceId: string; name: string; description: string; graph: Graph; revision: number; publishedVersion: number; updatedAt: number };
export type Workspace = {id:string;name:string;role:string};
export type Execution = {id:string;workflowId:string;workflowName:string;version:number;status:string;createdAt:number;startedAt:number|null;finishedAt:number|null;error:string|null};
export type Detail = {execution:Execution;nodes:{nodeId:string;status:string;output:unknown;startedAt:number;finishedAt:number}[];events:{id:string;kind:string;message:string;nodeId:string;createdAt:number}[]};
export type Metrics = {workflows:number;published:number;executions:number;succeeded:number;failed:number;successRate:number};
export const graphSchema = z.object({nodes:z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),type:z.literal('step'),position:z.object({x:z.number(),y:z.number()}),data:z.object({label:z.string().max(100),kind:z.enum(kinds),schemaVersion:z.literal(1),config:z.record(z.string(),z.unknown())})})).max(50),edges:z.array(z.object({id:z.string(),source:z.string(),target:z.string(),sourceHandle:z.string().nullable().optional(),targetHandle:z.string().nullable().optional()})).max(100)});
export const catalog: Record<Kind,{title:string;description:string;color:string;config:Record<string,unknown>}> = {
  manual:{title:'Manual trigger',description:'Start with your own JSON input',color:'green',config:{}},
  transform:{title:'Map data',description:'Reshape JSON with simple mappings',color:'purple',config:{mapping:{message:'$.message',source:'FlowNova'}}},
  condition:{title:'Condition',description:'Route data with an equality check',color:'amber',config:{path:'$.priority',equals:'high'}},
  delay:{title:'Delay',description:'Wait up to 10 seconds',color:'blue',config:{milliseconds:1000}},
  ai:{title:'AI completion',description:'Return JSON from a configured model',color:'pink',config:{prompt:'Summarize the input in a JSON object with a summary field.'}},
  collection:{title:'Collection',description:'Filter, pluck, take, or count an array',color:'blue',config:{path:'$.items',operation:'filter',field:'status',equals:'active',limit:100}},
  assert:{title:'Assert data',description:'Stop safely when a check fails',color:'amber',config:{path:'$.approved',equals:true}},
};
export function makeNode(kind:Kind,x=160,y=160):Step {return {id:crypto.randomUUID(),type:'step',position:{x,y},data:{label:catalog[kind].title,kind,schemaVersion:1,config:structuredClone(catalog[kind].config)}};}
export function starter():Graph {return {nodes:[{id:'trigger',type:'step',position:{x:100,y:170},data:{label:'Manual trigger',kind:'manual',schemaVersion:1,config:{}}},{id:'map',type:'step',position:{x:440,y:170},data:{label:'Prepare your data',kind:'transform',schemaVersion:1,config:{mapping:{message:'$.message',processed:true,source:'FlowNova AI'}}}}],edges:[{id:'trigger-map',source:'trigger',target:'map',animated:true}]};}
export function branched():Graph {const g=starter();g.nodes[1]={...g.nodes[1],id:'condition',position:{x:390,y:170},data:{label:'Check priority',kind:'condition',schemaVersion:1,config:{path:'$.priority',equals:'high'}}};g.nodes.push({...makeNode('transform',710,70),id:'urgent',data:{label:'Priority request',kind:'transform',schemaVersion:1,config:{mapping:{message:'$.data.message',route:'urgent'}}}},{...makeNode('transform',710,290),id:'standard',data:{label:'Standard request',kind:'transform',schemaVersion:1,config:{mapping:{message:'$.data.message',route:'standard'}}}});g.edges=[{id:'start-check',source:'trigger',target:'condition'},{id:'yes',source:'condition',sourceHandle:'true',target:'urgent',label:'True'},{id:'no',source:'condition',sourceHandle:'false',target:'standard',label:'False'}];return g;}
