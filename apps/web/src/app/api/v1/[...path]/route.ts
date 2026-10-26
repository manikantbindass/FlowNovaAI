import {type NextRequest} from 'next/server';
import {hostedApi} from '@/lib/server/hosted-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function proxy(request:NextRequest){
  if((process.env.VERCEL==='1'||process.env.FLOWNOVA_RUNTIME==='hosted')&&!process.env.API_ORIGIN)return hostedApi(request);
  const headers=new Headers();
  for(const name of ['content-type','cookie','x-csrf-token','authorization','idempotency-key']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  let body:Uint8Array|undefined;
  if(request.body){const reader=request.body.getReader();const parts:Uint8Array[]=[];let size=0;while(true){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return Response.json({message:'Request exceeds 256 KB'},{status:413});}parts.push(value);}body=new Uint8Array(size);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.length;}}
  try{
    const url=new URL(request.nextUrl.pathname+request.nextUrl.search,process.env.API_ORIGIN||'http://127.0.0.1:8080');
    const response=await fetch(url,{method:request.method,headers,body:body as BodyInit|undefined,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000)});
    const outgoing=new Headers();for(const name of ['content-type','x-request-id','cache-control','retry-after']){const value=response.headers.get(name);if(value)outgoing.set(name,value);}for(const cookie of response.headers.getSetCookie())outgoing.append('set-cookie',cookie);
    return new Response(response.body,{status:response.status,headers:outgoing});
  }catch{return Response.json({message:'API unavailable. Start the backend and check API_ORIGIN.'},{status:502});}
}
export {proxy as GET,proxy as POST,proxy as PUT,proxy as DELETE,proxy as PATCH};
