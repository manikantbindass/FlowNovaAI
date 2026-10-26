import {describe,it,expect} from 'vitest';
import {graphSchema,starter,branched} from './model';
describe('workflow interchange contracts',()=>{
 it('accepts both executable starter graphs',()=>{expect(graphSchema.safeParse(starter()).success).toBe(true);expect(graphSchema.safeParse(branched()).success).toBe(true);});
 it('rejects untrusted executable node types',()=>{const graph=starter();graph.nodes[1].data.kind='script' as never;expect(graphSchema.safeParse(graph).success).toBe(false);});
 it('rejects oversized import graphs',()=>{const graph=starter();graph.nodes=Array.from({length:51},(_,i)=>({...graph.nodes[0],id:'node'+i}));expect(graphSchema.safeParse(graph).success).toBe(false);});
 it('rejects incompatible node schemas',()=>{const graph=starter();graph.nodes[0].data.schemaVersion=2;expect(graphSchema.safeParse(graph).success).toBe(false);});
});
