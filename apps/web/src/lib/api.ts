export type Session = {authenticated:boolean;username:string;mode:string;csrf?:string;csrfHeader?:string};
let session: Session|undefined;
let pendingSession:Promise<Session>|undefined;
export function getSession():Promise<Session>{
  if(pendingSession)return pendingSession;
  pendingSession=(async()=>{const r=await fetch('/api/v1/auth/session',{cache:'no-store'});if(!r.ok)throw new Error('API unavailable. Start the Spring Boot server and check API_ORIGIN.');session=await r.json();return session!;})().finally(()=>{pendingSession=undefined;});
  return pendingSession;
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const method=options.method||'GET';const headers=new Headers(options.headers);
  if(method!=='GET'){if(!session)await getSession();if(session?.csrf)headers.set(session.csrfHeader||'X-CSRF-TOKEN',session.csrf);}
  if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const r=await fetch('/api/v1'+path,{...options,headers,cache:'no-store'});
  if(!r.ok){let message=`Request failed (${r.status})`;try {const body=await r.json();message=body.message||message;}catch{}throw new Error(message);}
  if(r.status===204)return undefined as T;return r.json();
}
export async function login(username:string,password:string){await getSession();await api('/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password}).toString()});return getSession();}
export async function logout(){await api('/auth/logout',{method:'POST'});session=undefined;}
export const wsPath=(id:string)=>`/workspaces/${encodeURIComponent(id)}`;
