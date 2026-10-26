import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges, type Connection, type NodeChange, type EdgeChange } from '@xyflow/react';
import { type Graph, type Step, type StepData } from './model';
type EditorState = {graph:Graph;past:Graph[];future:Graph[];dirty:boolean;selected:string|null;load:(g:Graph)=>void;change:(g:Graph)=>void;nodes:(c:NodeChange<Step>[])=>void;edges:(c:EdgeChange[])=>void;connect:(c:Connection)=>void;select:(id:string|null)=>void;configure:(id:string,data:StepData)=>void;undo:()=>void;redo:()=>void;saved:()=>void};
export const useEditor=create<EditorState>((set,get)=>({
  graph:{nodes:[],edges:[]},past:[],future:[],dirty:false,selected:null,
  load:g=>set({graph:structuredClone(g),past:[],future:[],dirty:false,selected:null}),
  change:g=>set(s=>({graph:g,past:[...s.past.slice(-49),s.graph],future:[],dirty:true})),
  nodes:c=>{const s=get();if(c.every(x=>x.type==='select'||x.type==='dimensions'))set({graph:{...s.graph,nodes:applyNodeChanges(c,s.graph.nodes)}});else s.change({...s.graph,nodes:applyNodeChanges(c,s.graph.nodes)});},
  edges:c=>get().change({...get().graph,edges:applyEdgeChanges(c,get().graph.edges)}),
  connect:c=>get().change({...get().graph,edges:addEdge({...c,id:crypto.randomUUID()},get().graph.edges)}),
  select:id=>set({selected:id}),
  configure:(id,data)=>get().change({...get().graph,nodes:get().graph.nodes.map(n=>n.id===id?{...n,data}:n)}),
  undo:()=>{const s=get();if(s.past.length)set({graph:s.past.at(-1)!,past:s.past.slice(0,-1),future:[s.graph,...s.future],dirty:true});},
  redo:()=>{const s=get();if(s.future.length)set({graph:s.future[0],future:s.future.slice(1),past:[...s.past,s.graph],dirty:true});},
  saved:()=>set({dirty:false})
}));
