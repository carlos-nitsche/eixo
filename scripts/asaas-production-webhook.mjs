/**
 * Asaas production webhook provisioning. DRY RUN by default.
 * Never enables billing, creates checkouts, modifies old webhooks or prints secrets.
 * To register: supply infrastructure, credentials and --apply with distinct approval flag.
 */
const env=process.env;
// Optionally load the encrypted Windows credential vault. No secrets are printed or persisted in source.
if(env.EIXO_ASAAS_USE_WINDOWS_VAULT==='1'){
 if(process.platform!=='win32')throw Error('O cofre local do Asaas só está disponível no Windows.');
 const {loadAsaasLocalSecrets}=await import('./asaas-windows-vault.mjs');
 const credentials=loadAsaasLocalSecrets();
 if(!credentials)throw Error('Cofre local do Asaas não configurado.');
 if(!env.EIXO_ASAAS_PRODUCTION_KEY)env.EIXO_ASAAS_PRODUCTION_KEY=credentials.productionKey;
 if(!env.EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN)env.EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN=credentials.webhookToken;
}
const origin=String(env.EIXO_BILLING_PRODUCTION_ORIGIN||'').replace(/\/$/,'');
const publicUrl=String(env.EIXO_PUBLIC_URL||'').replace(/\/$/,'');
const secret=String(env.EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN||'');
const key=String(env.EIXO_ASAAS_PRODUCTION_KEY||'');
const email=String(env.EIXO_ASAAS_WEBHOOK_EMAIL||'');
const events=['CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED'];
const webhooksUrl='https://api.asaas.com/v3/webhooks';
const isSafe=raw=>{try{const x=new URL(raw);return x.protocol==='https:'&&x.hostname.includes('.')&&!x.username&&!x.password&&!x.port&&!x.search&&!x.hash&&!x.hostname.endsWith('.trycloudflare.com')&&!x.hostname.endsWith('.example')&&!['localhost','127.0.0.1'].includes(x.hostname)}catch{return false}};
const checks={
 key:key.startsWith('$aact_prod_')&&key.length>50,
 token:secret.length>=32&&secret.length<=255&&!/\s/.test(secret)&&secret!==key,
 stableHttps:isSafe(origin)&&origin===publicUrl,
 publicHost:isSafe(origin)&&new URL(isSafe(origin)?origin:'https://example.invalid').hostname.toLowerCase()===String(env.EIXO_PUBLIC_HOST||'').toLowerCase(),
 email:/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),
 postgres:Boolean(String(env.DATABASE_URL||'').startsWith('postgres')&&env.DATABASE_SSL==='require'),
 smtp:/^smtps?:\/\//.test(String(env.SMTP_URL||'')),
 backup:env.EIXO_OFFSITE_BACKUP_READY==='1',
 infraApproval:env.EIXO_INFRASTRUCTURE_DEPLOYMENT_APPROVED==='1',
 billingInactive:env.EIXO_ASAAS_ENABLE_REAL_BILLING!=='1'
};
const ready=Object.values(checks).every(Boolean);
const result={mode:process.argv.includes('--apply')?'apply':'dry-run',ready,checks,blocked:Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name),webhookSuffix:'/api/billing/asaas/production-webhook',eventCount:events.length,realChargesCreated:0};
if(!process.argv.includes('--apply')){console.log('EIXO_ASAAS_PRODUCTION_WEBHOOK_PREFLIGHT '+JSON.stringify(result));process.exit(ready?0:2)}
if(process.argv.slice(2).some(x=>!['--apply'].includes(x))||env.EIXO_ASAAS_WEBHOOK_REGISTRATION_APPROVED!=='REGISTER_PRODUCTION_WEBHOOK_ONLY'||!ready)throw Error('Webhook não provisionado. Requer pré-requisitos e autorização específica; cobrança deve permanecer desativada.');
const headers={access_token:key,'User-Agent':'EIXO/1.0','accept':'application/json','content-type':'application/json'};
async function asaas(path,method='GET',data){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{
  const res=await fetch(webhooksUrl+path,{method,headers,body:data?JSON.stringify(data):undefined,signal:ctrl.signal,redirect:'error'});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok)throw Error('Asaas retornou HTTP '+res.status+' ao gerenciar Webhook.');
  return payload;
 }finally{clearTimeout(timer)}
}
const target=origin+'/api/billing/asaas/production-webhook';
// Do not register a webhook against an unreachable deployment, even if flags are set.
let health;
try{
 const response=await fetch(origin+'/api/health',{method:'GET',headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(response.status!==200)throw Error('HTTP '+response.status);
 health=await response.json();
 if(health?.ok!==true)throw Error('Resposta de health inválida');
}catch{throw Error('Implantação HTTPS de produção não respondeu corretamente a /api/health. Webhook não foi registrado.');}
const current=await asaas('');
if(!Array.isArray(current.data))throw Error('Resposta de listagem do Asaas inválida.');
const existing=current.data.find(x=>x.url===target);
if(existing){
 const needsReview=!existing.enabled||existing.interrupted||!events.every(e=>existing.events?.includes(e));
 if(needsReview)throw Error('Já existe Webhook na URL informada com configuração incompleta. Revise manualmente, sem alterações automáticas.');
 console.log('EIXO_ASAAS_PRODUCTION_WEBHOOK_EXISTS '+JSON.stringify({configured:true,unchanged:true,realBillingEnabled:false}));
}else{
 const created=await asaas('','POST',{name:'EIXO · Assinaturas · Produção',url:target,email,enabled:true,interrupted:false,apiVersion:3,authToken:secret,sendType:'SEQUENTIALLY',events});
 if(!created?.id)throw Error('Asaas não confirmou a criação do Webhook.');
 console.log('EIXO_ASAAS_PRODUCTION_WEBHOOK_REGISTERED '+JSON.stringify({configured:true,newWebhook:true,realBillingEnabled:false}));
}
