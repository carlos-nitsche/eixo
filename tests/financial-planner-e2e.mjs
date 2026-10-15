// EIXO OS — Node.js 22+, Puppeteer browser QA, isolated temp runtime only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {availableTestPort,isolatedEnv} from './isolated-env.mjs';
import {emptyDemoState} from '../api/demo-state.mjs';

const root=process.cwd(),port=await availableTestPort(),origin='http://127.0.0.1:'+port;
const runtime=path.join(root,'.qa-financial-planner');
fs.mkdirSync(runtime,{recursive:true});
for(const item of ['api','dist','server.mjs','package.json'])fs.cpSync(path.join(root,item),path.join(runtime,item),{recursive:true,force:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:runtime,env:isolatedEnv(port),windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,cookie='',errors=[];
const api=async(route,method='GET',data)=>{
 const r=await fetch(origin+route,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const header=r.headers.get('set-cookie');if(header)cookie=header.split(';')[0];
 return {status:r.status,data:await r.json()};
};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Server QA boot timeout')),25000);
  server.stdout.on('data',b=>{if(b.toString().includes('EIXO PC:')){clearTimeout(timeout);resolve()}});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('Server closed before QA: '+code))});
 });
 const email='finance-'+Date.now()+'@example.test',password='Finance-QA-Only#2026';
 assert.equal((await api('/api/auth/register','POST',{email,password,name:'Teste financeiro'})).status,201);
 const outbox=path.join(runtime,'server-data/outbox');
 const mail=fs.readdirSync(outbox).map(file=>fs.readFileSync(path.join(outbox,file),'utf8')).find(content=>content.includes(email));
 assert(mail,'Verification e-mail generated locally');
 const token=new URL(mail.match(/http:\/\/\S+/)[0]).searchParams.get('token');
 assert.equal((await api('/api/auth/verify','POST',{token})).status,200);
 assert.equal((await api('/api/auth/login','POST',{email,password})).status,200);
 const state=emptyDemoState({name:'Teste',enabledModules:['financeiro','negocios','agenda'],onboardingVersion:1});
 const month=new Date().toISOString().slice(0,7);
 state.collections.transactions.push({
  id:'financial-sample',title:'Aluguel QA',workspaceId:'pessoal',createdAt:new Date().toISOString(),
  date:month+'-05',type:'Despesa',category:'Moradia',amount:500,account:'Teste'
 });
 assert.equal((await api('/api/state','PUT',{baseVersion:0,state})).status,200);
 browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu'],timeout:20000});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setCookie({name:'eixo_session',value:cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Lax'});
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.goto(origin+'/#financeiro',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForSelector('.financial-planner',{timeout:20000});
 await page.select('.financial-budget-form select','Moradia');
 await page.focus('.financial-budget-form input');
 await page.keyboard.type('400');
 console.log('FINANCE_FORM_BEFORE',await page.evaluate(()=>({month:document.querySelector('.finance-month input')?.value,category:document.querySelector('.financial-budget-form select')?.value,amount:document.querySelector('.financial-budget-form input')?.value})));
 await page.click('.financial-budget-form button[type="submit"]');
 console.log('FINANCE_FORM_AFTER',await page.evaluate(()=>({budgetRow:document.querySelector('.finance-budget-item')?.innerText,message:document.querySelector('.finance-message')?.innerText})));
 await page.waitForFunction(()=>document.querySelector('.finance-budget-item')?.textContent?.includes('Limite excedido'),{timeout:10000});
 await page.waitForFunction(()=>document.querySelector('.financial-planner')?.textContent?.includes('500,00'),{timeout:10000});
 for(const width of [320,375,390,768]){
  await page.setViewport({width,height:850,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const widths=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));
  assert(widths.body<=widths.viewport+3,'Finance horizontal overflow '+JSON.stringify(widths));
 }
 const csvControl=await page.$('.financial-planner-actions button');
 assert(csvControl,'month CSV export should be present');
 const saved=await (async()=>{
  for(let attempt=0;attempt<30;attempt++){
   const result=(await api('/api/state')).data.state;
   if(result.budgets?.some(x=>x.category==='Moradia'&&x.limit===400))return result;
   await wait(400);
  }
  throw Error('Budget not persisted to user state');
 })();
 assert.equal(saved.collections.transactions.length,1);
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.evaluate(()=>{location.hash='dashboard'});
 await page.waitForFunction(()=>document.body.innerText.includes('Orçamento excedido'),{timeout:10000});
 assert.deepEqual(errors,[]);
 console.log('EIXO_FINANCIAL_E2E_OK '+JSON.stringify({monthlyBudget:saved.budgets[0].limit,transactionsPreserved:saved.collections.transactions.length,testedWidths:[320,375,390,768],jsErrors:errors.length}));
}finally{
 try{await browser?.close()}catch{}
 server.kill();
}
