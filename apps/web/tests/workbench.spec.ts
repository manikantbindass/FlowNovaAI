import {test,expect,type Page} from '@playwright/test';
async function signIn(page:Page,username='demo'){await page.goto('/login');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(process.env.LOCAL_PASSWORD||'demo');await page.getByRole('button',{name:'Enter workspace'}).click();await expect(page.getByRole('heading',{name:'Good things start with a flow.'})).toBeVisible();}
test('create, edit, validate, publish, execute, inspect and restore a workflow',async({page})=>{
 await signIn(page);await page.getByRole('button',{name:'Create workflow',exact:true}).click();await page.getByLabel('Workflow name',{exact:true}).fill('E2E flow '+Date.now());await page.getByRole('button',{name:'Create workflow',exact:true}).last().click();
 await expect(page.getByText('Prepare your data',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Draft saved',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Validate',exact:true}).click();await expect(page.getByText('All connected. Your workflow is valid.')).toBeVisible();
 await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByRole('button',{name:'Confirm publish'}).click();await expect(page.locator('.workflow-title')).toContainText('Published v1');
 await page.getByRole('button',{name:'Run workflow'}).click();await page.getByRole('button',{name:'Start execution'}).click();await expect(page.getByRole('dialog',{name:'Execution details'})).toBeVisible();await expect(page.getByText('Execution completed',{exact:true})).toBeVisible();await expect(page.locator('pre').filter({hasText:'"processed": true'})).toBeVisible();
 await page.screenshot({path:'test-results/execution.png',fullPage:true});await page.getByRole('button',{name:'Close dialog'}).click();await page.reload();await expect(page.getByText('Prepare your data',{exact:true})).toBeVisible();await expect(page.locator('.workflow-title')).toContainText('Published v1');
});
test('session, CSRF and tenant boundaries are enforced over HTTP',async({request})=>{
 const unauth=await request.get('/api/v1/workspaces');expect(unauth.status()).toBe(401);
 const session=await(await request.get('/api/v1/auth/session')).json();
 const forbidden=await request.post('/api/v1/auth/login',{form:{username:'demo',password:'demo'}});expect(forbidden.status()).toBe(403);
 const login=await request.post('/api/v1/auth/login',{headers:{[session.csrfHeader]:session.csrf},form:{username:'other',password:process.env.LOCAL_PASSWORD||'demo'}});expect(login.status()).toBe(200);
 const workspaces=await(await request.get('/api/v1/workspaces')).json();expect(workspaces).toHaveLength(1);const ownId=workspaces[0].id;expect((await request.get('/api/v1/workspaces/'+ownId+'/workflows')).status()).toBe(200);
 expect((await request.get('/api/v1/workspaces/local-workspace/workflows')).status()).toBe(404);
});
test('viewer can inspect the workspace but cannot create workflows',async({request})=>{
 const session=await(await request.get('/api/v1/auth/session')).json();expect((await request.post('/api/v1/auth/login',{headers:{[session.csrfHeader]:session.csrf},form:{username:'viewer',password:process.env.LOCAL_PASSWORD||'demo'}})).status()).toBe(200);
 const current=await(await request.get('/api/v1/auth/session')).json();const workspaces=await(await request.get('/api/v1/workspaces')).json();const ownId=workspaces[0].id;expect((await request.get('/api/v1/workspaces/'+ownId+'/workflows')).status()).toBe(200);
 const denied=await request.post('/api/v1/workspaces/'+ownId+'/workflows',{headers:{[current.csrfHeader]:current.csrf},data:{name:'Forbidden',description:'',graph:{nodes:[],edges:[]},revision:0}});expect(denied.status()).toBe(403);
});
test('public and signed-in layouts fit a phone viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'Less busywork. More possibility.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await signIn(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Open navigation'}).click();await expect(page.getByRole('link',{name:'Workflows',exact:false}).first()).toBeVisible();await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
