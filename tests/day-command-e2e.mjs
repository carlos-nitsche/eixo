// EIXO OS 0.6.0 · Windows Node.js 22+ · isolated real-browser QA for Meu Dia.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {availableTestPort,isolatedEnv} from './isolated-env.mjs';
import {emptyDemoState} from '../api/demo-state.mjs';
const root=process.cwd(),port=await availableTestPort(),origin='http://127.0.0.1:'+port;
const runtime=path.join(root,'.qa-day-command-center');
fs.mkdirSync(runtime,{recursive:true});
for(const item of ['api','dist','server.mjs','package.json'])fs.cpSync(path.join(root,item),path.join(runtime,item),{recursive:true,force:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:runtime,env:isolatedEnv(port),windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,cookie='',errors=[];
const api=async(route,method='GET',data)=>{
 const res=await fetch(origin+route,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const header=res.headers.get('set-cookie');if(header)cookie=header.split(';')[0];
 return {status:res.status,data:await res.json()};
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('QA server timeout')),30000);
  server.stdout.on('data',data=>{if(data.toString().includes('EIXO PC:')){clearTimeout(timeout);resolve()}});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('QA server exited '+code))});
 });
 const email='day-command-'+Date.now()+'@example.test',password='Day-Command-QA#2026';
 assert.equal((await api('/api/auth/register','POST',{email,password,name:'Validação Meu Dia'})).status,201);
 const outbox=path.join(runtime,'server-data/outbox');
 const mail=fs.readdirSync(outbox).map(file=>fs.readFileSync(path.join(outbox,file),'utf8')).find(data=>data.includes(email));
 assert(mail,'account verification e-mail was generated in isolated outbox');
 const token=new URL(mail.match(/http:\/\/\S+/)[0]).searchParams.get('token');
 assert.equal((await api('/api/auth/verify','POST',{token})).status,200);
 assert.equal((await api('/api/auth/login','POST',{email,password})).status,200);
 const date=new Date().toLocaleDateString('en-CA');
 const state=emptyDemoState({name:'Validação',enabledModules:['agenda','financeiro'],onboardingVersion:1});
 state.collections.tasks.push({id:'task-day-a',title:'Entregar relatório do EIXO',workspaceId:'pessoal',createdAt:new Date().toISOString(),dueDate:date,status:'A fazer',priority:'Alta'});
 state.collections.events.push({id:'event-day-a',title:'Reunião de revisão',workspaceId:'pessoal',createdAt:new Date().toISOString(),date,time:'16:30'});
 assert.equal((await api('/api/state','PUT',{baseVersion:0,state})).status,200);
 browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu'],timeout:20000});
 const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.setCookie({name:'eixo_session',value:cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Lax'});
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.goto(origin+'/#dashboard',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForSelector('.eixo-day',{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('.eixo-day')?.innerText.includes('Entregar relatório'),{timeout:12000});
 assert((await page.$eval('.eixo-day-eventlist',element=>element.innerText)).includes('Reunião de revisão'));
 await page.click('.eixo-day-check');
 await page.waitForFunction(()=>document.querySelector('.eixo-day-finished')?.innerText.includes('Entregar relatório'),{timeout:10000});
 await page.click('.eixo-focus-options button:first-child');
 assert((await page.$eval('.eixo-focus-ring-inner strong',node=>node.innerText)).startsWith('15:'));
 await page.click('.eixo-focus-primary');
 await page.waitForFunction(()=>document.querySelector('.eixo-focus-primary')?.innerText.includes('Pausar'),{timeout:7000});
 await page.click('.eixo-focus-primary');
 await page.waitForFunction(()=>document.querySelector('.eixo-focus-primary')?.innerText.includes('Continuar'),{timeout:7000});
 await page.evaluate(()=>{
  const key=Object.keys(sessionStorage).find(key=>key.startsWith('eixo:focus:session:'));
  if(!key)throw Error('Timer session not stored');
  const data=JSON.parse(sessionStorage.getItem(key));
  data.deadline=Date.now()-1000;
  data.remainingMs=1000;
  sessionStorage.setItem(key,JSON.stringify(data));
 });
 await page.evaluate(()=>{location.hash='agenda'});
 await page.waitForSelector('.calendar',{timeout:10000});
 await page.evaluate(()=>{location.hash='dashboard'});
 await page.waitForSelector('.eixo-day',{timeout:12000});
 await page.waitForFunction(()=>document.querySelector('.eixo-focus-primary')?.innerText.includes('Registrar sessão'),{timeout:9000});
 await page.click('.eixo-focus-primary');
 await page.waitForFunction(()=>document.querySelector('.eixo-focus-weektitle')?.innerText.includes('1 sessões'),{timeout:9000});
 let saved;
 for(let attempt=0;attempt<24;attempt++){
  saved=(await api('/api/state')).data?.state;
  if(saved?.focusSessions?.length===1&&saved?.collections?.tasks?.[0]?.status==='Concluído')break;
  await wait(350);
 }
 assert.equal(saved.focusSessions.length,1);
 assert.equal(saved.focusSessions[0].minutes,15);
 assert.equal(saved.collections.tasks[0].status,'Concluído');
 for(const width of [320,375,390,768]){
  await page.setViewport({width,height:850,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const geometry=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,day:document.querySelector('.eixo-day')?.getBoundingClientRect().width}));
  assert(geometry.page<=geometry.viewport+3,'horizontal overflow at '+width+' '+JSON.stringify(geometry));
 }
 assert.deepEqual(errors,[]);
 console.log('EIXO_DAY_COMMAND_E2E_OK '+JSON.stringify({task:saved.collections.tasks[0].status,minutes:saved.focusSessions[0].minutes,widths:[320,375,390,768],errors:errors.length}));
}finally{try{await browser?.close()}catch{}server.kill()}
