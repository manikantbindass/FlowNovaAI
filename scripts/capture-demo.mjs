import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.WEB_URL||'http://127.0.0.1:3210';
const out=path.resolve('docs/assets/screenshots');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function shot(name){if(['overview','analytics','mobile'].includes(name))await page.locator('.metric-card .skeleton').first().waitFor({state:'hidden',timeout:30000});if(name==='history')await page.locator('tbody tr').first().waitFor();await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});}
try{
 await page.goto(base,{waitUntil:'networkidle'});await shot('landing');
 await page.goto(base+'/login');await page.getByLabel('Username',{exact:true}).fill('demo');await page.getByLabel('Password',{exact:true}).fill(process.env.LOCAL_PASSWORD||'demo');await page.getByRole('button',{name:'Enter workspace'}).click();await page.getByRole('heading',{name:'Good things start with a flow.'}).waitFor({timeout:30000});await shot('overview');
 await page.getByRole('button',{name:'Create workflow',exact:true}).click();await page.getByLabel('Workflow name',{exact:true}).fill('Customer request · Live demo');await page.getByRole('button',{name:'Create workflow',exact:true}).last().click();await page.getByText('Prepare your data',{exact:true}).waitFor();await shot('editor');
 await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByRole('button',{name:'Confirm publish'}).click();await page.locator('.workflow-title').filter({hasText:'Published v1'}).waitFor();await shot('published');
 await page.getByRole('button',{name:'Run workflow'}).click();await shot('run-input');await page.getByRole('button',{name:'Start execution'}).click();await page.getByText('Execution completed',{exact:true}).waitFor({timeout:30000});await shot('execution');
 await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('link',{name:'Executions',exact:true}).click();await page.getByRole('heading',{name:'Every run. Every step.'}).waitFor();await shot('history');
 await page.getByRole('link',{name:'Analytics',exact:true}).click();await page.getByRole('heading',{name:'Understand your flow.'}).waitFor();await shot('analytics');
 await page.goto(base+'/app');await page.getByRole('heading',{name:'Good things start with a flow.'}).waitFor();await shot('overview');await page.setViewportSize({width:390,height:844});await shot('mobile');
 if(errors.length)throw new Error('Browser errors: '+errors.join('; '));
 console.log('Captured nine screenshots from authenticated real workflow execution.');
}finally{await browser.close();}
