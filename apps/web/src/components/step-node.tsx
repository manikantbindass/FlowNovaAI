'use client';
import {Handle,Position,type NodeProps} from '@xyflow/react';
import {Play,Braces,GitBranch,Clock3,Sparkles,Check,AlertCircle} from 'lucide-react';
import {type Step,catalog} from '@/lib/model';
const icons={manual:Play,transform:Braces,condition:GitBranch,delay:Clock3,ai:Sparkles,collection:Braces,assert:GitBranch};
export function StepNode({data,selected}:NodeProps<Step>){const Icon=icons[data.kind];return <div className={`step-node ${selected?'selected':''} ${data.invalid?'invalid':''}`}>
  {data.kind!=='manual'&&<Handle type="target" position={Position.Left}/>}
  <div className="step-top"><span className={`node-symbol ${catalog[data.kind].color}`}><Icon size={19}/></span><span className="step-type">{catalog[data.kind].title}</span>{data.status==='SUCCEEDED'?<Check className="green-text" size={14}/>:data.invalid?<AlertCircle className="red-text" size={14}/>:<span className="step-dots">•••</span>}</div>
  <strong>{data.label}</strong><span className="step-subtitle">{data.status||catalog[data.kind].description}</span>
  {data.kind==='condition'?<><Handle id="true" type="source" position={Position.Right} style={{top:'38%'}}/><Handle id="false" type="source" position={Position.Right} style={{top:'77%'}}/><span className="handle-label yes">true</span><span className="handle-label no">false</span></>:<Handle type="source" position={Position.Right}/>}
  </div>;}
export const nodeTypes={step:StepNode};
