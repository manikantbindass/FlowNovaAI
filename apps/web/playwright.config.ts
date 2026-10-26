import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests',fullyParallel:false,workers:1,timeout:90000,expect:{timeout:20000},use:{baseURL:process.env.WEB_URL||'http://127.0.0.1:3210',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],reporter:[['list'],['html',{open:'never'}]]});
