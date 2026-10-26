import {beforeEach,describe,it,expect,vi} from 'vitest';
const memory=vi.hoisted(()=>new Map<string,{body:string;version:number}>());
vi.mock('@vercel/blob',()=>{
 class BlobPreconditionFailedError extends Error{}class BlobNotFoundError extends Error{}
 return{BlobPreconditionFailedError,BlobNotFoundError,
  head:vi.fn(async(path:string)=>{const value=memory.get(path);if(!value)throw new BlobNotFoundError();return{url:'https://mock.private.blob.vercel-storage.com/'+path,etag:String(value.version)};}),
  get:vi.fn(async(path:string)=>{const key=path.startsWith('https:')?new URL(path).pathname.slice(1):path;const value=memory.get(key);if(!value)throw new BlobNotFoundError();return{statusCode:200,stream:new Response(value.body).body,blob:{etag:String(value.version)}};}),
  put:vi.fn(async(path:string,body:string,options:{ifMatch?:string;allowOverwrite?:boolean})=>{const current=memory.get(path);if(current&&(!options.allowOverwrite||options.ifMatch!==String(current.version)))throw new BlobPreconditionFailedError();memory.set(path,{body,version:(current?.version||0)+1});return{};})};
});
import {readWorkspace,mutateWorkspace} from './store';
describe('private workspace CAS persistence',()=>{
 beforeEach(()=>memory.clear());
 it('keeps independent workspace paths isolated',async()=>{await mutateWorkspace('tenant-a',d=>{d.name='A';});await mutateWorkspace('tenant-b',d=>{d.name='B';});expect((await readWorkspace('tenant-a')).data.name).toBe('A');expect((await readWorkspace('tenant-b')).data.name).toBe('B');});
 it('retries a conflicting edit without dropping either mutation',async()=>{await mutateWorkspace('tenant-a',d=>{d.name='Start';});await Promise.all([mutateWorkspace('tenant-a',d=>{d.name+=' A';}),mutateWorkspace('tenant-a',d=>{d.name+=' B';})]);expect((await readWorkspace('tenant-a')).data.name).toContain(' A');expect((await readWorkspace('tenant-a')).data.name).toContain(' B');});
 it('rejects storage path traversal',async()=>{await expect(readWorkspace('../private')).rejects.toThrow('Workspace not found');});
 it('does not write an oversized workspace',async()=>{await expect(mutateWorkspace('tenant-a',d=>{d.name='x'.repeat(2_000_001);})).rejects.toThrow('storage limit');expect(memory.size).toBe(0);});
});
