import {sleep} from 'workflow';
import {initializeRun,executeNode,recordSkipped,finishRun} from './steps';
import type {Graph,Step} from '@/lib/model';
import type {Json} from '@/lib/server/graph';

/** Durable orchestration. Every I/O operation is isolated in a replayable step. */
export async function executeGraph(workspaceId:string,executionId:string){
 'use workflow';
 const state=await initializeRun(workspaceId,executionId);if(!state)return;
 const graph:Graph=state.graph;const statuses:Record<string,string>={...state.statuses};const outputs:Record<string,Json>={...state.outputs};
 try{
  while(Object.keys(statuses).length<graph.nodes.length){let progress=false;
   for(const node of graph.nodes){
    if(statuses[node.id])continue;const incoming=graph.edges.find(e=>e.target===node.id);if(incoming&&!statuses[incoming.source])continue;
    let input:Json=incoming?outputs[incoming.source]:state.input;let skipped=!!incoming&&statuses[incoming.source]==='SKIPPED';
    if(incoming&&graph.nodes.find(n=>n.id===incoming.source)?.data.kind==='condition'){const matched=!!(input as Record<string,Json>)?.matched;skipped=skipped||incoming.sourceHandle!==(matched?'true':'false');}
    if(skipped){const result=await recordSkipped(workspaceId,executionId,node.id);if(result.cancelled)return;input={};statuses[node.id]='SKIPPED';outputs[node.id]=input;}
    else{
     if(node.data.kind==='delay')await sleep(Number(node.data.config.milliseconds));
     const result=await executeNode(workspaceId,executionId,node as Step,input);if(result.cancelled)return;statuses[node.id]='SUCCEEDED';outputs[node.id]=result.output!;
    }
    progress=true;
   }
   if(!progress)throw new Error('Graph made no progress');
  }
  await finishRun(workspaceId,executionId,'SUCCEEDED');
 }catch{await finishRun(workspaceId,executionId,'FAILED','Execution failed. Inspect the node error and configuration.');}
}
