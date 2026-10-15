// EIXO OS · Node.js 22 / Chromium — real Portuguese Whisper offline inference and mic-to-text test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {availableTestPort,isolatedEnv} from './isolated-env.mjs';
import {emptyDemoState} from '../api/demo-state.mjs';
const root=process.cwd(),sample=path.join(root,'.qa-portuguese.wav');
assert(fs.existsSync(sample),'Generate local Brazilian Portuguese test speech first: SAPI Microsoft Maria Desktop');
const port=await availableTestPort(),origin='http://127.0.0.1:'+port;
const runtime=path.join(root,'.qa-whisper-e2e');
fs.mkdirSync(runtime,{recursive:true});
for(const item of ['api','dist','server.mjs','package.json'])fs.cpSync(path.join(root,item),path.join(runtime,item),{recursive:true,force:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:runtime,env:isolatedEnv(port),windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,cookie='',errors=[],external=[];
const api=async(route,method='GET',data)=>{
 const res=await fetch(origin+route,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const setCookie=res.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
 return {status:res.status,data:await res.json()};
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('QA server boot timeout')),30000);
  server.stdout.on('data',buffer=>{if(buffer.toString().includes('EIXO PC:')){clearTimeout(timeout);resolve()}});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('QA server exited '+code))});
 });
 const user='whisper-'+Date.now()+'@example.test',password='Whisper-Qa-Only#2026';
 assert.equal((await api('/api/auth/register','POST',{email:user,password,name:'Whisper offline QA'})).status,201);
 const outbox=path.join(runtime,'server-data/outbox');
 const mail=fs.readdirSync(outbox).map(f=>fs.readFileSync(path.join(outbox,f),'utf8')).find(x=>x.includes(user));
 const token=new URL(mail.match(/http:\/\/\S+/)[0]).searchParams.get('token');
 assert.equal((await api('/api/auth/verify','POST',{token})).status,200);
 assert.equal((await api('/api/auth/login','POST',{email:user,password})).status,200);
 assert.equal((await api('/api/state','PUT',{baseVersion:0,state:emptyDemoState({name:'Whisper',enabledModules:['agenda','financeiro'],onboardingVersion:1})})).status,200);
 browser=await puppeteer.launch({
  executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,
  args:['--no-sandbox','--disable-gpu','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
   '--use-file-for-fake-audio-capture='+sample.replace(/\\/g,'/')],
  timeout:22000
 });
 const page=await browser.newPage();
 page.setDefaultTimeout(30000);
 page.on('requestfailed',r=>console.log('FETCH_FAIL',r.url().slice(0,120),r.failure()?.errorText));
 page.on('response',r=>{if(r.url().includes('/whisper-wasm/')||r.url().includes('/models/'))console.log('MODEL_HTTP',r.status(),r.url().split('/').slice(-2).join('/'))});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',event=>{if(event.type()==='error')errors.push(event.text())});
 // Read-only request auditing; interception can deadlock module imports in Chromium workers.
 page.on('request',request=>{
  if(!request.url().startsWith(origin)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());
 });
 await page.setCookie({name:'eixo_session',value:cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Lax'});
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.goto(origin+'/#dashboard',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForSelector('.eixo-ai-launcher',{timeout:15000});
 const header=await fetch(origin+'/models/eixo-whisper-status.json');assert.equal(header.status,200);
 await page.click('.eixo-ai-launcher');
 await page.click('.eixo-ai-mic');
 await page.waitForSelector('.eixo-ai-audio-active:not(.local)',{timeout:12000});
 await wait(4200);
 await page.click('.eixo-ai-audio-active button');
 console.log('WHISPER_INFERENCE_STARTED');
 const started=Date.now();
 const heartbeat=setInterval(()=>{page.evaluate(()=>({notice:document.querySelector('.eixo-ai-voice-notice')?.textContent,mode:document.querySelector('.eixo-ai-audio-active')?.textContent,typed:document.querySelector('.eixo-ai-compose textarea')?.value})).then(x=>console.log('WHISPER_HEARTBEAT',JSON.stringify(x))).catch(()=>{})},7000);
 await page.waitForFunction(()=>{
  const input=document.querySelector('.eixo-ai-compose textarea');
  const notice=document.querySelector('.eixo-ai-voice-notice')?.textContent||'';
  return input?.value.trim()||document.querySelector('.eixo-ai-audio-preview')||notice.includes('Transcrição indisponível')||notice.includes('Erro ao iniciar');
 },{timeout:120000,polling:500});
 clearInterval(heartbeat);
 const result=await page.evaluate(()=>({
  transcript:document.querySelector('.eixo-ai-compose textarea')?.value||'',
  status:document.querySelector('.eixo-ai-voice-notice')?.textContent||'',
  mode:document.querySelector('.eixo-ai-audio-active')?.textContent||'',
  fallback:!!document.querySelector('.eixo-ai-audio-preview')
 }));
 console.log('WHISPER_RESULT '+JSON.stringify({...result,seconds:Math.round((Date.now()-started)/1000),errors,external}));
 assert(result.transcript.length>0,'Whisper local must return a nonempty Portuguese transcription');
 assert(/consulta|agende|amanh[aã]|quatorze/i.test(result.transcript),'Transcript should contain Portuguese speech: '+result.transcript);
 assert.deepEqual(external,[],'Whisper must not contact any third party during inference');
 assert.deepEqual(errors,[],'No JS/worker errors permitted');
 console.log('EIXO_REAL_LOCAL_WHISPER_OK '+JSON.stringify({transcript:result.transcript,seconds:Math.round((Date.now()-started)/1000),requestsToExternalServices:0}));
}finally{try{await browser?.close()}catch{}server.kill()}
