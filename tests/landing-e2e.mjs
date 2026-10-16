import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {availableTestPort,isolatedEnv} from './isolated-env.mjs';
const port=await availableTestPort(),origin=`http://127.0.0.1:${port}`,root=process.cwd(),runtime=path.join(root,'.qa-landing');
fs.mkdirSync(runtime,{recursive:true});
for(const file of ['api','dist','server.mjs','package.json'])fs.cpSync(path.join(root,file),path.join(runtime,file),{recursive:true,force:true});
const output=path.join(root,'tests/visual-results');fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['server.mjs'],{cwd:runtime,env:isolatedEnv(port),windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,page;const checks=[],errors=[],writes=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fit(name){const measurements=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('.lp-page main *,.lp-header *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)}).slice(0,6).map(e=>e.className)}));assert.equal(measurements.scroll,measurements.width,name+' overflow');assert.deepEqual(measurements.bad,[],name+' elements outside viewport');checks.push(name)}
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Timeout do servidor isolado')),60000);server.stdout.on('data',c=>{if(c.toString().includes('EIXO PC:')){clearTimeout(timer);resolve()}});server.stderr.on('data',c=>process.stderr.write(c));server.on('exit',code=>{clearTimeout(timer);reject(Error('Servidor: '+code))})});
 browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().startsWith(origin+'/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url())});
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForSelector('.lp-plan');assert.match(await page.$eval('h1',n=>n.textContent),/Mais controle/);assert.equal(await page.$$('.lp-area-card').then(nodes=>nodes.length),8);assert(await page.$eval('.lp-dashboard-illustration',node=>node.getAttribute('aria-label')?.includes('dados reais')));
 const catalog=await (await fetch(origin+'/api/plans')).json();assert.equal(await page.$$('.lp-plan').then(x=>x.length),catalog.plans.length);
 const displayed=await page.$$eval('.lp-plan>strong',nodes=>nodes.map(n=>n.textContent.replace(/\s/g,'')));
 assert.deepEqual(displayed,catalog.plans.map(p=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.amountCents/100).replace(/\s/g,'')));const previous=await page.$$eval('.lp-promo-before del',nodes=>nodes.map(n=>n.textContent.replace(/\s/g,'')));
 assert.deepEqual(previous,catalog.plans.map(p=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.originalAmountCents/100).replace(/\s/g,'')));
 assert.equal(await page.$$('.lp-promo-chip').then(nodes=>nodes.length),3,'todos os planos com promoção visível');
 checks.push('Preços, valores riscados e periodicidades do catálogo real');
 for(const dark of [false,true]){
  if(dark)await page.click('.lp-theme');
  for(const width of [320,360,375,390,430,768,1024,1440]){
   await page.setViewport({width,height:900});
   for(const id of ['rotina','financas','treinos','negocios','nutricao']){await page.click('#lp-tab-'+id);await pause(100);assert.equal(await page.$eval('#lp-tab-'+id,n=>n.getAttribute('aria-selected')),'true');await fit(`${dark?'dark':'light'} ${width} ${id}`)}
   if([390,1440].includes(width)){await page.click('#lp-tab-treinos');await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{})}));scrollTo(0,0)});await pause(300);await page.screenshot({path:path.join(output,`landing-${dark?'dark':'light'}-${width}.png`),fullPage:true})}
  }
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.waitForSelector('#lp-tab-treinos',{timeout:20000});await page.focus('#lp-tab-treinos');await page.keyboard.press('End');assert.equal(await page.$eval('#lp-tab-nutricao',n=>n.getAttribute('aria-selected')),'true');await page.keyboard.press('Home');assert.equal(await page.$eval('#lp-tab-rotina',n=>n.getAttribute('aria-selected')),'true');checks.push('Teclado Home/End, abas e toque');
 await page.click('.lp-faq summary');assert(await page.$eval('.lp-faq details',n=>n.open));assert.deepEqual(writes,[],'Demonstração não deve gravar dados');checks.push('Demonstração sem gravação e FAQ funcional');
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('.lp-login')]);await page.waitForSelector('.auth-card');assert.match(await page.$eval('h1',n=>n.textContent),/Bem-vindo/);checks.push('CTA de login');
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('.auth-home-link')]);await page.waitForSelector('.lp-page');
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('.lp-hero .lp-primary')]);await page.waitForSelector('input[autocomplete=name]');assert.match(await page.$eval('h1',n=>n.textContent),/Crie sua conta/);checks.push('Retorno à apresentação e CTA de cadastro');
 await page.goBack({waitUntil:'domcontentloaded'});await page.waitForSelector('.lp-page');await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await fit('Movimento reduzido');
 assert.deepEqual(errors,[]);
 // Deliberate API failure: show a recoverable state, never fabricated prices.
 await page.setRequestInterception(true);const intercept=req=>{if(req.url().endsWith('/api/plans'))req.respond({status:503,contentType:'application/json',body:'{"error":"Teste isolado"}'});else req.continue()};page.on('request',intercept);await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.lp-catalog-error');assert.equal(await page.$$('.lp-plan').then(x=>x.length),0);
 page.off('request',intercept);await page.setRequestInterception(false);await page.click('.lp-catalog-error button');await page.waitForSelector('.lp-plan');checks.push('Falha de catálogo e nova tentativa');
 fs.writeFileSync(path.join(output,'landing-report.json'),JSON.stringify({checks,errors,writes,device:'Chrome emulado'},null,2));console.log('LANDING_E2E_OK '+checks.length+' verificações');
}catch(error){console.error(error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'landing-failure.png'),fullPage:true}).catch(()=>{})}
finally{if(browser){browser.process()?.kill('SIGKILL');browser.disconnect()}server.kill()}
process.exit(process.exitCode||0);
