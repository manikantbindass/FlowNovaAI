import {describe,it,expect} from 'vitest';
import {starter,branched,type Step} from '../model';
import {validate,deterministic,redact,equal} from './graph';
const node=(kind:Step['data']['kind'],config:Record<string,unknown>):Step=>({id:'test',type:'step',position:{x:0,y:0},data:{kind,label:'Test',schemaVersion:1,config}});
describe('hosted workflow semantics',()=>{
 it('validates both starter templates',()=>{expect(validate(starter())).toEqual([]);expect(validate(branched())).toEqual([]);});
 it('rejects a cycle even when it has a trigger',()=>{const g=starter();g.edges.push({id:'back',source:'map',target:'trigger'});expect(validate(g).some(i=>i.message.includes('Cycles'))).toBe(true);});
 it('rejects joins and unsupported branch handles',()=>{const g=branched();g.edges.push({id:'join',source:'urgent',target:'standard'});g.edges[1].sourceHandle='unsafe';expect(validate(g).some(i=>i.message.includes('Joins'))).toBe(true);expect(validate(g).some(i=>i.message.includes('handles'))).toBe(true);});
 it('rejects an unbounded delay',()=>{const g=starter();g.nodes[1]=node('delay',{milliseconds:10001});g.nodes[1].id='map';expect(validate(g).length).toBeGreaterThan(0);});
 it('maps literals, paths and absent values',()=>{expect(deterministic(node('transform',{mapping:{name:'$.customer.name',missing:'$.absent',ready:true}}),{customer:{name:'Nova'}})).toEqual({name:'Nova',missing:null,ready:true});});
 it('returns condition input under data',()=>{expect(deterministic(node('condition',{path:'$.priority',equals:'high'}),{priority:'high'})).toEqual({matched:true,data:{priority:'high'}});});
 it('compares JSON objects independent of key order',()=>{expect(equal({a:1,b:2},{b:2,a:1})).toBe(true);expect(equal([1,2],[2,1])).toBe(false);});
 it('filters and caps a collection while reporting its full match count',()=>{expect(deterministic(node('collection',{path:'$.items',operation:'filter',field:'active',equals:true,limit:1}),{items:[{active:true},{active:false},{active:true}]})).toEqual({items:[{active:true}],total:2,returned:1});});
 it('plucks a field and can count without returning items',()=>{expect(deterministic(node('collection',{path:'$.items',operation:'pluck',field:'name'}),{items:[{name:'A'},{name:'B'}]})).toEqual({items:['A','B'],total:2,returned:2});expect(deterministic(node('collection',{path:'$.items',operation:'count'}),{items:[1,2]})).toEqual({items:[],total:2,returned:0});});
 it('fails an assertion with a safe fixed message',()=>{expect(()=>deterministic(node('assert',{path:'$.approved',equals:true}),{approved:false,password:'private'})).toThrow('Assertion failed: required data condition was not met');});
 it('redacts nested secrets without changing safe fields',()=>{expect(redact({nested:[{apiKey:'private',message:'ok'}]})).toEqual({nested:[{apiKey:'[REDACTED]',message:'ok'}]});});
});
