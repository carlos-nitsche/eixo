// EIXO OS 0.7 · Node.js / Puppeteer · isolated assistant e2e, no external service.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {availableTestPort,isolatedEnv} from './isolated-env.mjs';
import {emptyDemoState} from '../api/demo-state.mjs';
const root=process.cwd(),port=await availableTestPort(),origin='http://127.0.0.1:'+port;
const runtime=path.join(root,'.qa-eixo-assistant');
fs.mkdirSync(runtime,{recursive:true});
for(const item of ['api','dist','server.mjs','package.json'])fs.cpSync(path.join(root,item),path.join(runtime,item),{recursive:true,force:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:runtime,env:isolatedEnv(port),windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,cookie='',errors=[];
const api=async(route,method='GET',data)=>{
 const res=await fetch(origin+route,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const setCookie=res.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
 return {status:res.status,data:await res.json()};
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Isolated server failed to boot')),25000);
  server.stdout.on('data',buffer=>{if(buffer.toString().includes('EIXO PC:')){clearTimeout(timeout);resolve()}});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('Server stopped '+code))});
 });
 const email='assistant-'+Date.now()+'@example.test',password='Assistant-QA-Only#2026';
 assert.equal((await api('/api/auth/register','POST',{email,password,name:'Assistente QA'})).status,201);
 const dir=path.join(runtime,'server-data/outbox');
 const mail=fs.readdirSync(dir).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).find(v=>v.includes(email));
 assert(mail);
 const token=new URL(mail.match(/http:\/\/\S+/)[0]).searchParams.get('token');
 assert.equal((await api('/api/auth/verify','POST',{token})).status,200);
 assert.equal((await api('/api/auth/login','POST',{email,password})).status,200);
 const state=emptyDemoState({name:'Assistente QA',enabledModules:['agenda','financeiro','estudos','projetos','habitos'],onboardingVersion:1});
 assert.equal((await api('/api/state','PUT',{baseVersion:0,state})).status,200);
 browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],timeout:22000});
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.setCookie({name:'eixo_session',value:cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Lax'});
 await page.goto(origin+'/#dashboard',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForSelector('.eixo-ai-launcher',{timeout:16000});
 await page.click('.eixo-ai-launcher');
 await page.waitForSelector('.eixo-ai-compose textarea');
 const submit=async(message)=>{
  await page.focus('.eixo-ai-compose textarea');
  await page.keyboard.type(message);
  await page.click('.eixo-ai-compose button[type="submit"]');
 };
 await submit('agende dentista amanhã às 14h');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-draft')?.innerText.includes('14:00'),{timeout:9000});
 assert((await page.$eval('.eixo-ai-draft',n=>n.innerText)).includes('dentista'));
 let before=(await api('/api/state')).data.state;
 assert.equal(before.collections.events.length,0,'draft must not change state without consent');
 await page.click('.eixo-ai-confirm');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-scroll')?.innerText.includes('adicionado a'),{timeout:7000});
 const persisted=async(predicate)=>{
  for(let i=0;i<30;i++){
   const data=(await api('/api/state')).data.state;
   if(predicate(data))return data;
   await wait(450);
  }
  throw Error('Record not persisted after 15 seconds');
 };
 const afterEvent=await persisted(s=>s.collections.events.length===1);
 assert.equal(afterEvent.collections.events[0].title,'dentista');
 assert.equal(afterEvent.collections.events[0].time,'14:00');
 await submit('gastei R$ 85 no mercado');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-draft')?.innerText.includes('85,00'),{timeout:9000});
 await page.click('.eixo-ai-confirm');
 const afterExpense=await persisted(s=>s.collections.transactions.length===1);
 assert.equal(afterExpense.collections.transactions[0].amount,85);
 assert.equal(afterExpense.collections.transactions[0].type,'Despesa');
 await submit('marque reunião');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-missing')?.innerText.includes('data'),{timeout:9000});
 await submit('amanhã');
 await submit('às 15h');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-confirm')&&!document.querySelector('.eixo-ai-confirm').disabled,{timeout:9000});
 await page.click('.eixo-ai-abort');
 const noAudio=await page.$$('button.eixo-ai-mic, .eixo-ai-audio-preview, audio');
 assert.equal(noAudio.length,0,'The assistant must not expose audio UI');
 await submit('Crie um projeto chamado Reforma da loja');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-draft')?.dataset.kind==='projects',{timeout:9000});
 await page.click('.eixo-ai-confirm');
 const afterProject=await persisted(s=>s.collections.projects.length===1);
 assert(/reforma da loja/i.test(afterProject.collections.projects[0].title));
 await submit('Quero criar um hábito de ler todos os dias');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-draft')?.dataset.kind==='habits',{timeout:9000});
 const habitPreview=await page.$eval('.eixo-ai-draft',el=>el.innerText);
 assert(habitPreview.includes('Diária'));
 await page.click('.eixo-ai-confirm');
 const afterHabit=await persisted(s=>s.collections.habits.length===1);
 assert.equal(afterHabit.collections.habits[0].frequency,'Diária');
 await submit('Crie uma meta de juntar R$ 2000');
 await page.waitForFunction(()=>document.querySelector('.eixo-ai-draft')?.dataset.kind==='goals',{timeout:9000});
 await page.click('.eixo-ai-confirm');
 const afterGoal=await persisted(s=>s.collections.goals.length===1);
 assert.equal(afterGoal.collections.goals[0].target,2000);
 const postFeatures=await page.$$('.eixo-ai-mic, .eixo-ai-audio-preview, audio');
 assert.equal(postFeatures.length,0,'Audio UI must remain absent after multiple requests');
 const afterCancel=(await api('/api/state')).data.state;
 assert.equal(afterCancel.collections.events.length,1,'cancel must not write a record');
 for(const width of [320,375,390,768]){
  await page.setViewport({width,height:845,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const sizes=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,chat:document.querySelector('.eixo-ai-window')?.getBoundingClientRect().width}));
  assert(sizes.document<=sizes.viewport+3,'horizontal overflow '+width+' '+JSON.stringify(sizes));
 }
 assert.deepEqual(errors,[]);
 console.log('EIXO_ASSISTANT_E2E_OK '+JSON.stringify({events:afterEvent.collections.events.length,transactions:afterExpense.collections.transactions.length,canceled:true,jsErrors:errors.length,viewportWidths:[320,375,390,768]}));
}finally{try{await browser?.close()}catch{}server.kill()}
