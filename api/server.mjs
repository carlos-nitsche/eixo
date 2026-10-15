import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify,isDeepStrictEqual} from 'node:util';
import {applyErpCommand} from './erp-operations.mjs';
import {billingConfig,billingStatus,createBillingCheckout,checkoutPayload,applySandboxWebhook,verifyAsaasWebhook,cancelSandboxSubscription} from './asaas-billing.mjs';
import {liveBillingStatus,verifyLiveWebhook,realBillingHistory,createRealCheckout,applyLiveWebhook,cancelRealSubscription,reconcileRealCheckout} from './asaas-live.mjs';
import sharp from 'sharp';
import nodemailer from 'nodemailer';
import {query,transaction,initDb,userByEmail,userById,mode,dataDir} from './db.mjs';
import {initFoundation,platformRole,adminApi} from './foundation-admin.mjs';
const scrypt=promisify(scryptCallback);
const root=path.resolve('dist'), port=Number(process.env.PORT||4173);
const host=process.env.EIXO_HOST||'127.0.0.1';
if(process.env.EIXO_MODE==='production'&&(!process.env.DATABASE_URL||!process.env.SMTP_URL||!String(process.env.EIXO_PUBLIC_URL||'').startsWith('https://')))throw Error('Produção requer PostgreSQL externo, SMTP e URL HTTPS.');
if(!['127.0.0.1','::1'].includes(host)&&process.env.EIXO_MODE!=='production')throw Error('Servidor de desenvolvimento só pode escutar no loopback.');
const plans=[{id:'monthly',name:'Mensal',amountCents:2990,originalAmountCents:3990,months:1},{id:'semiannual',name:'Semestral',amountCents:14990,originalAmountCents:19990,months:6},{id:'annual',name:'Anual',amountCents:26990,originalAmountCents:34990,months:12}];
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const hash=v=>createHash('sha256').update(v).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const safe=(s)=>String(s??'').trim();
const cookieName='eixo_session';
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).filter(x=>x[0]&&x.length===2));
const days=(n)=>new Date(Date.now()+n*86400000).toISOString();
const minutes=(n)=>new Date(Date.now()+n*60000).toISOString();
const secure=(req)=>Boolean(req.socket.encrypted)||process.env.EIXO_MODE==='production'||process.env.EIXO_PRIVATE_ACCESS==='1';
const cookieOpts=req=>`HttpOnly; SameSite=Lax; Path=/; ${secure(req)?'Secure; ':''}`;
const json=(res,status,body,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...extra});res.end(JSON.stringify(body))};
const fail=(res,status,message)=>json(res,status,{error:message});
const attempts=new Map();
let activePasswordChecks=0;
const MAX_PARALLEL_PASSWORD_CHECKS=6;
const safeJSON=(value)=>{
 const visited={count:0};
 function walk(v,depth){
  visited.count++;
  if(depth>36||visited.count>60000)throw Object.assign(new Error('Documento excessivamente complexo.'),{status:400});
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Object.assign(new Error('Número inválido.'),{status:400});return}
  if(typeof v==='string'){if(v.length>300000)throw Object.assign(new Error('Texto muito longo.'),{status:400});return}
  if(Array.isArray(v)){if(v.length>20000)throw Object.assign(new Error('Lista muito extensa.'),{status:400});for(const x of v)walk(x,depth+1);return}
  if(typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype)throw Object.assign(new Error('Estrutura de dados inválida.'),{status:400});
  const keys=Object.keys(v);
  if(keys.length>5000)throw Object.assign(new Error('Objeto excessivamente grande.'),{status:400});
  for(const key of keys){
   if(['__proto__','prototype','constructor'].includes(key)||key.length>200)throw Object.assign(new Error('Campo não permitido.'),{status:400});
   walk(v[key],depth+1);
  }
 }
 walk(value,0);
 return value;
};
function allow(key,limit=10,windowMs=15*60000){
 const now=Date.now(),existing=attempts.get(key)||{count:0,reset:now+windowMs};
 const item=existing.reset<now?{count:0,reset:now+windowMs}:existing;
 item.count++;attempts.set(key,item);
 if(attempts.size>5000)for(const [k,v] of attempts){if(v.reset<now)attempts.delete(k)}
 return item.count<=limit;
}
function originOkay(req){
 const origin=req.headers.origin;
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 if(!origin)return true;
 try{
  const u=new URL(origin);
  const allowed=String(req.socket.encrypted?req.headers.host:(process.env.EIXO_PUBLIC_HOST||req.headers.host)||'').toLowerCase();
  return u.host.toLowerCase()===allowed&&(secure(req)?u.protocol==='https:'||(u.hostname==='127.0.0.1'&&process.env.EIXO_PRIVATE_ACCESS!=='1'):['http:','https:'].includes(u.protocol));
 }catch{return false}
}
function securityHeaders(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');
 res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(), payment=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:");
 if(secure(req)&&process.env.EIXO_PRIVATE_ACCESS==='1')res.setHeader('Strict-Transport-Security','max-age=604800');
}
function knownHost(req){
 const received=String(req.headers.host||'').toLowerCase();
 if(!received||received.includes(',')||received.includes(' '))return false;
 if(process.env.EIXO_PUBLIC_HOST&&received===process.env.EIXO_PUBLIC_HOST.toLowerCase())return true;
 if(req.socket.encrypted)return /^192\.168\.\d+\.\d+(?::\d+)?$/.test(received)||/^10\.\d+\.\d+\.\d+(?::\d+)?$/.test(received)||/^172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+(?::\d+)?$/.test(received);
 if(process.env.EIXO_PUBLIC_HOST)return /^127\.0\.0\.1(?::\d+)?$/.test(received)||/^localhost(?::\d+)?$/.test(received);
 if(process.env.EIXO_PRIVATE_ACCESS==='1')return /^127\.0\.0\.1(?::\d+)?$/.test(received)||/^localhost(?::\d+)?$/.test(received);
 return /^127\.0\.0\.1(?::\d+)?$/.test(received)||/^localhost(?::\d+)?$/.test(received)||/^192\.168\.\d+\.\d+(?::\d+)?$/.test(received)||/^10\.\d+\.\d+\.\d+(?::\d+)?$/.test(received);
}
async function body(req){
 let size=0,chunks=[];
 for await(const part of req){size+=part.length;if(size>2*1024*1024)throw Object.assign(new Error('Arquivo de dados muito grande.'),{status:413});chunks.push(part)}
 if(!chunks.length)return {};
 try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value}catch{throw Object.assign(new Error('JSON inválido.'),{status:400})}
}
async function passHash(password){
 const salt=randomBytes(16).toString('hex');const raw=await scrypt(password,salt,64,{N:16384,r:8,p:1});return `scrypt:16384:${salt}:${raw.toString('hex')}`
}
async function verifyPass(password,stored){
 try{const [method,cost,salt,h]=stored.split(':');if(method!=='scrypt'||cost!=='16384')return false;const raw=await scrypt(password,salt,64,{N:16384,r:8,p:1});const actual=Buffer.from(h,'hex');return actual.length===raw.length&&timingSafeEqual(raw,actual)}catch{return false}
}
const DUMMY_PASS_HASH=await passHash('temporary-dummy-password-for-timing');
async function issue(req,res,userId){
 const raw=token();await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[hash(raw),userId,days(14)]);
 res.setHeader('Set-Cookie',`${cookieName}=${raw}; Max-Age=1209600; ${cookieOpts(req)}`);
}
async function auth(req){
 const raw=cookies(req)[cookieName];if(!raw)return null;
 const rows=(await query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>NOW()',[hash(raw)])).rows;
 if(!rows.length)return null;const user=await userById(rows[0].user_id);return user&&!user.suspended_at?user:null;
}
const userPublic=(u)=>{
 const end=u.trial_start?new Date(new Date(u.trial_start).getTime()+72*3600000).toISOString():null;
 const trialActive=Boolean(u.verified_at&&end&&new Date(end)>new Date());
 return {avatarId:u.avatar_id||null,avatarUrl:u.avatar_id?'/api/media/'+u.avatar_id:null,id:u.id,email:u.email,displayName:u.display_name,fullName:u.full_name,phone:u.phone,locale:u.locale,timezone:u.timezone,verified:Boolean(u.verified_at),owner:u.is_owner,trialEndsAt:end,trialActive,access:u.is_owner||trialActive};
};
async function hasPaid(id){
 const result=(await query("SELECT status,paid_through FROM subscriptions WHERE user_id=$1",[id])).rows[0];
 return result?.status==='active'&&result.paid_through&&new Date(result.paid_through)>new Date();
}
async function profile(user){
 const p=userPublic(user),paid=await hasPaid(user.id);return {...p,platformRole:await platformRole(user.id),access:p.access||paid,subscription:paid?'active':user.is_owner?'lifetime':p.trialActive?'trial':'expired'};
}
const audit=async(id,event,detail={})=>query('INSERT INTO audit_log(id,actor_id,event,detail) VALUES($1,$2,$3,$4)',[randomUUID(),id,event,JSON.stringify(detail)]);
async function sendLocalMail(email,purpose,raw){
 if(process.env.SMTP_URL){
   const route=purpose==='verify'?'verify':'reset';
   const link=(process.env.EIXO_PUBLIC_URL||('http://127.0.0.1:'+port))+'/?action='+route+'&token='+encodeURIComponent(raw);
   const transporter=nodemailer.createTransport(process.env.SMTP_URL);
   await transporter.sendMail({from:process.env.SMTP_FROM||'EIXO <no-reply@localhost>',to:email,subject:purpose==='verify'?'Confirme sua conta EIXO':'Redefina sua senha EIXO',text:'Acesse o link para continuar:\n'+link+'\nEste link expira. Caso não tenha solicitado, ignore a mensagem.'});
   return;
 }
 const outbox=path.join(dataDir,'outbox');fs.mkdirSync(outbox,{recursive:true});
 const action=purpose==='verify'?'confirmar seu e-mail':'redefinir sua senha';
 const link=`http://127.0.0.1:${port}/?action=${purpose}&token=${encodeURIComponent(raw)}`;
 const msg=`Destinatário: ${email}\nAção: ${action}\nLink de desenvolvimento (não para envio público): ${link}\n`;
 fs.writeFileSync(path.join(outbox,`${Date.now()}-${randomUUID()}.txt`),msg,{encoding:'utf8',flag:'wx',mode:0o600});
}
async function issueLink(user,purpose){
 const raw=token();
 await query('INSERT INTO verification_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)',[hash(raw),user.id,purpose,minutes(purpose==='verify'?1440:30)]);
 await sendLocalMail(user.email,purpose,raw);
}
async function api(req,res,url){
 const pathname=url.pathname,method=req.method||'GET';
 if(!['GET','HEAD','POST','PATCH','PUT','DELETE'].includes(method))return fail(res,405,'Método não permitido.');
 if(method!=='GET'&&method!=='HEAD'){
  if(!['/api/billing/asaas/sandbox-webhook','/api/billing/asaas/production-webhook'].includes(pathname)&&!originOkay(req))return fail(res,403,'Origem não autorizada.');
  const remote=req.headers.host===process.env.EIXO_PUBLIC_HOST&&process.env.EIXO_PRIVATE_ACCESS==='1';
  if(remote&&!['/api/billing/asaas/sandbox-webhook','/api/billing/asaas/production-webhook'].includes(pathname)&&!req.headers.origin&&req.headers['sec-fetch-site']!=='same-origin')return fail(res,403,'Origem da requisição não comprovada.');
  const contentType=String(req.headers['content-type']||'').toLowerCase();
  if(method!=='DELETE'&&!pathname.startsWith('/api/media')&&!contentType.startsWith('application/json'))return fail(res,415,'A API aceita apenas JSON.');
 }
 if(pathname==='/api/health'&&method==='GET')return json(res,200,{ok:true});
 if(pathname==='/api/plans'&&method==='GET')return json(res,200,{plans,trialHours:72,checkoutConfigured:liveBillingStatus().enabled,billingMode:liveBillingStatus().enabled?'production':'sandbox',liveBilling:liveBillingStatus().enabled});
 if(pathname==='/api/billing/asaas/production-webhook'&&method==='POST'){
   if(!liveBillingStatus().enabled)return fail(res,503,'Recebimento financeiro real indisponível.');
   if(!verifyLiveWebhook(req.headers['asaas-access-token']))return fail(res,401,'Webhook não autorizado.');
   return json(res,200,await applyLiveWebhook(await body(req)));
 }
 if(pathname==='/api/billing/asaas/sandbox-webhook'&&method==='POST'){
   // Public route: no session cookie or CSRF Origin; authenticate strictly with the Asaas Webhook secret.
   if(!billingConfig().checkoutConfigured)return fail(res,503,'Webhook Sandbox não configurado.');
   if(!verifyAsaasWebhook(req.headers['asaas-access-token']))return fail(res,401,'Token de Webhook inválido.');
   const event=await body(req);
   const outcome=await applySandboxWebhook(event);
   return json(res,200,outcome);
 }

 const ip=process.env.EIXO_PRIVATE_ACCESS==='1'&&req.socket.remoteAddress?.includes('127.0.0.1')&&typeof req.headers['x-eixo-client-ip']==='string'&&/^[0-9a-f:.]{3,45}$/i.test(req.headers['x-eixo-client-ip'])?req.headers['x-eixo-client-ip']:(req.socket.remoteAddress||'unknown');
 if(pathname==='/api/auth/register'&&method==='POST'){
   if(process.env.EIXO_PRIVATE_ACCESS==='1'&&req.headers.host===process.env.EIXO_PUBLIC_HOST)return fail(res,403,'Cadastro remoto temporariamente desativado.');
   if(!allow('register:'+ip,8))return fail(res,429,'Muitas tentativas. Aguarde.');
   const b=await body(req),email=safe(b.email).toLowerCase(),pw=String(b.password||''),name=safe(b.name);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||pw.length<12||pw.length>128||name.length<2||name.length>100)return fail(res,400,'Informe nome, e-mail válido e senha de 12 a 128 caracteres.');
   if(await userByEmail(email))return fail(res,409,'Esse e-mail já está cadastrado.');
   const id=randomUUID();await query('INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)',[id,email,await passHash(pw),name]);
   const u=await userById(id);await issueLink(u,'verify');await audit(id,'auth.register');
   return json(res,201,{ok:true,message:'Conta criada. Confirme o e-mail para ativar seu teste gratuito.',mailDelivery:process.env.SMTP_URL?'smtp':'development-local-only'});
 }
 if(pathname==='/api/auth/verify'&&method==='POST'){
   const b=await body(req);if(typeof b.token!=='string'||b.token.length<20)return fail(res,400,'Token inválido.');
   const v=(await query("SELECT * FROM verification_tokens WHERE token_hash=$1 AND purpose='verify' AND consumed_at IS NULL AND expires_at>NOW()",[hash(b.token)])).rows[0];
   if(!v)return fail(res,400,'Link inválido ou expirado.');
   await query('UPDATE verification_tokens SET consumed_at=NOW() WHERE token_hash=$1',[hash(b.token)]);
   await query('UPDATE users SET verified_at=COALESCE(verified_at,NOW()),trial_start=COALESCE(trial_start,NOW()) WHERE id=$1',[v.user_id]);
   await audit(v.user_id,'auth.verify');
   return json(res,200,{ok:true,message:'E-mail confirmado. Agora você pode entrar.'});
 }
 if(pathname==='/api/auth/login'&&method==='POST'){
   const b=await body(req),email=safe(b.email).toLowerCase();
   if(!allow('login:'+ip,20)||!allow('login-email:'+email,10)||!allow('login-all',600))return fail(res,429,'Muitas tentativas. Aguarde.');
   const password=String(b.password||'');
   if(password.length>128||activePasswordChecks>=MAX_PARALLEL_PASSWORD_CHECKS)return fail(res,429,'Aguarde antes de tentar novamente.');
   activePasswordChecks++;
   let u,valid;
   try{
    u=await userByEmail(email);
    valid=await verifyPass(password,u?.password_hash||DUMMY_PASS_HASH);
   }finally{activePasswordChecks--}

   if(!u||!valid)return fail(res,401,'E-mail ou senha incorretos.');
   if(!u.verified_at)return fail(res,403,'Confirme seu e-mail antes de entrar.');
   if(u.suspended_at)return fail(res,403,'Conta temporariamente suspensa. Contate o suporte.');
   await issue(req,res,u.id);await audit(u.id,'auth.login');
   return json(res,200,{user:await profile(u)});
 }
 if(pathname==='/api/auth/forgot'&&method==='POST'){
   if(process.env.EIXO_PRIVATE_ACCESS==='1'&&!process.env.SMTP_URL&&req.headers.host===process.env.EIXO_PUBLIC_HOST)return fail(res,503,'Recuperação remota indisponível até configurar um serviço de e-mail.');
   if(!allow('forgot:'+ip,10))return fail(res,429,'Aguarde antes de tentar novamente.');
   const b=await body(req),u=await userByEmail(safe(b.email).toLowerCase());
   if(u)await issueLink(u,'reset');
   return json(res,200,{ok:true,message:'Se o e-mail estiver cadastrado, serão enviadas instruções de recuperação.'});
 }
 if(pathname==='/api/auth/reset'&&method==='POST'){
   const b=await body(req),pw=String(b.password||'');
   if(typeof b.token!=='string'||pw.length<12||pw.length>128)return fail(res,400,'Token ou senha inválidos.');
   const v=(await query("SELECT * FROM verification_tokens WHERE token_hash=$1 AND purpose='reset' AND consumed_at IS NULL AND expires_at>NOW()",[hash(b.token)])).rows[0];
   if(!v)return fail(res,400,'Link inválido ou expirado.');
   await query('UPDATE verification_tokens SET consumed_at=NOW() WHERE token_hash=$1',[hash(b.token)]);
   await query('UPDATE users SET password_hash=$2 WHERE id=$1',[v.user_id,await passHash(pw)]);
   await query('DELETE FROM sessions WHERE user_id=$1',[v.user_id]);await audit(v.user_id,'auth.password_reset');
   return json(res,200,{ok:true});
 }
  const u=await auth(req);if(!u)return fail(res,401,'Faça login para continuar.');
  if(pathname.startsWith('/api/admin/'))return adminApi({req,res,url,user:u,body,json,fail,realChargesEnabled:liveBillingStatus().enabled});
  if(pathname==='/api/billing/live/status'&&method==='GET')return json(res,200,await realBillingHistory(u.id));
  if(pathname==='/api/billing/live/reconcile'&&method==='POST'){
   if(!allow('live-reconcile:'+u.id,6,3600000))return fail(res,429,'Muitas tentativas de consulta. Aguarde.');
   const input=await body(req);
   if(typeof input.id!=='string')return fail(res,400,'Identificador de cobrança inválido.');
   return json(res,200,await reconcileRealCheckout(u.id,input.id));
  }
  if(pathname==='/api/billing/live/cancel'&&method==='POST'){
   if(!allow('live-cancel:'+u.id,4,3600000))return fail(res,429,'Muitas solicitações de cancelamento. Aguarde.');
   const input=await body(req);
   if(typeof input.id!=='string')return fail(res,400,'Informe a assinatura a cancelar.');
   return json(res,200,await cancelRealSubscription(u.id,input.id));
  }
  if(pathname==='/api/billing/live/checkout'&&method==='POST'){
   if(!liveBillingStatus().enabled)return fail(res,503,'Pagamentos reais indisponíveis até configurar a produção.');
   if(!allow('live-checkout:'+u.id,3,3600000))return fail(res,429,'Muitas tentativas de pagamento. Aguarde.');
   const input=await body(req),plan=plans.find(x=>x.id===input.planCode);
   if(!plan)return fail(res,400,'Plano inválido.');
   if(!['PIX','CREDIT_CARD'].includes(input.method))return fail(res,400,'Pagamento inválido.');
   return json(res,201,await createRealCheckout(u,plan,input.method));
  }
  if(pathname==='/api/billing/status'&&method==='GET')return json(res,200,await billingStatus(u.id));
  if(pathname==='/api/billing/preview'&&method==='POST'){
   if(!allow('billing-preview:'+u.id,20))return fail(res,429,'Aguarde antes de consultar novamente.');
   const input=await body(req),plan=plans.find(x=>x.id===input.planCode),method=input.method;
   if(!plan)return fail(res,400,'Plano não encontrado.');
   const origin=String(process.env.EIXO_BILLING_CALLBACK_ORIGIN||(process.env.EIXO_PUBLIC_HOST?'https://'+process.env.EIXO_PUBLIC_HOST:''));
   return json(res,200,{mode:'sandbox',preview:true,realChargesEnabled:false,plan,method,payload:checkoutPayload(plan,method,'exemplo-sandbox',origin)});
  }
  if(pathname==='/api/billing/cancel'&&method==='POST'){
   if(!allow('billing-cancel:'+u.id,5,3600000))return fail(res,429,'Aguarde antes de tentar novamente.');
   const input=await body(req);
   return json(res,200,await cancelSandboxSubscription(u.id,input.id));
  }
  if(pathname==='/api/billing/checkout'&&method==='POST'){
   if(!allow('billing-checkout:'+u.id,5,60*60000))return fail(res,429,'Aguarde antes de tentar outro checkout.');
   const input=await body(req),plan=plans.find(x=>x.id===input.planCode),method=input.method;
   if(!plan)return fail(res,400,'Plano não encontrado.');
   if(!['PIX','CREDIT_CARD'].includes(method))return fail(res,400,'Forma de pagamento inválida.');
   const origin=String(process.env.EIXO_BILLING_CALLBACK_ORIGIN||(process.env.EIXO_PUBLIC_HOST?'https://'+process.env.EIXO_PUBLIC_HOST:''));
   return json(res,201,await createBillingCheckout(u,plan,method,origin));
  }

 if(pathname==='/api/media'&&method==='POST'){
   if(!(await profile(u)).access)return fail(res,402,'Conta sem acesso de escrita.');
   if(!['image/jpeg','image/png','image/webp'].includes(req.headers['content-type']))return fail(res,415,'Formato de imagem não aceito.');
   let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>5*1024*1024)return fail(res,413,'Limite de 5 MB por imagem.');chunks.push(part)}
   if(size<16)return fail(res,400,'Imagem inválida.');
   const count=(await query('SELECT COUNT(*) AS count FROM media WHERE user_id=$1',[u.id])).rows[0];
   if(Number(count.count)>=500)return fail(res,413,'Limite de 500 imagens por conta.');
   let converted;
   try{const buff=Buffer.concat(chunks);const meta=await sharp(buff,{limitInputPixels:30000000,animated:false}).metadata();
     if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)return fail(res,415,'Formato não aceito.');
     converted=await sharp(buff,{limitInputPixels:30000000}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:4}).toBuffer();
   }catch{return fail(res,400,'Não foi possível validar a imagem.');}
   const mid=randomUUID(),dir=path.join(dataDir,'media',u.id);fs.mkdirSync(dir,{recursive:true});
   const filename=mid+'.webp';fs.writeFileSync(path.join(dir,filename),converted,{flag:'wx',mode:0o600});
   const ws=safe(req.headers['x-eixo-workspace']||'pessoal').slice(0,128);
   await query('INSERT INTO media(id,user_id,workspace_id,filename,mime,bytes) VALUES($1,$2,$3,$4,$5,$6)',[mid,u.id,ws,filename,'image/webp',converted.length]);
   return json(res,201,{id:mid,url:'/api/media/'+mid,size:converted.length});
 }
 if(pathname.startsWith('/api/media/')&&method==='GET'){
   const mid=pathname.slice('/api/media/'.length);if(!/^[0-9a-f-]{36}$/i.test(mid))return fail(res,404,'Imagem não encontrada.');
   const record=(await query('SELECT * FROM media WHERE id=$1 AND user_id=$2',[mid,u.id])).rows[0];if(!record)return fail(res,404,'Imagem não encontrada.');
   const file=path.join(dataDir,'media',u.id,record.filename);if(!fs.existsSync(file))return fail(res,404,'Imagem indisponível.');
   res.writeHead(200,{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'});fs.createReadStream(file).pipe(res);return;
 }
 if(pathname.startsWith('/api/media/')&&method==='DELETE'){
   const mid=pathname.slice('/api/media/'.length);if(!/^[0-9a-f-]{36}$/i.test(mid))return fail(res,404,'Imagem não encontrada.');
   const record=(await query('DELETE FROM media WHERE id=$1 AND user_id=$2 RETURNING filename',[mid,u.id])).rows[0];if(!record)return fail(res,404,'Imagem não encontrada.');
   try{fs.unlinkSync(path.join(dataDir,'media',u.id,record.filename))}catch{}
   return json(res,200,{ok:true});
 }
 if(pathname==='/api/auth/logout'&&method==='POST'){
   const raw=cookies(req)[cookieName];if(raw)await query('DELETE FROM sessions WHERE token_hash=$1',[hash(raw)]);
   res.setHeader('Set-Cookie',`${cookieName}=; Max-Age=0; ${cookieOpts(req)}`);
   return json(res,200,{ok:true});
 }
 if(pathname==='/api/me'&&method==='GET')return json(res,200,{user:await profile(u)});
 if(pathname==='/api/me'&&method==='PATCH'){
   const b=await body(req);
   const name=safe(b.displayName).slice(0,100),full=safe(b.fullName).slice(0,140),phone=safe(b.phone).slice(0,30);
   if(!name)return fail(res,400,'Informe um nome de exibição.');
   if(b.avatarId!==undefined&&b.avatarId!==null&&b.avatarId!==''){
     const found=(await query('SELECT id FROM media WHERE id=$1 AND user_id=$2',[b.avatarId,u.id])).rows[0];
     if(!found)return fail(res,400,'Imagem de perfil inválida.');
   }
   await query('UPDATE users SET display_name=$2,full_name=$3,phone=$4,avatar_id=$5 WHERE id=$1',[u.id,name,full,phone,b.avatarId===undefined?u.avatar_id:(b.avatarId||null)]);
   await audit(u.id,'profile.update');return json(res,200,{user:await profile(await userById(u.id))});
 }
 if(pathname==='/api/auth/change-password'&&method==='POST'){
   const b=await body(req),pw=String(b.password||'');
   if(pw.length<12||pw.length>128||!(await verifyPass(String(b.currentPassword||''),u.password_hash)))return fail(res,400,'Senha atual inválida ou nova senha fora dos requisitos.');
   await query('UPDATE users SET password_hash=$2 WHERE id=$1',[u.id,await passHash(pw)]);
   const current=cookies(req)[cookieName];await query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2',[u.id,hash(current||'')]);
   await audit(u.id,'auth.password_changed');return json(res,200,{ok:true});
 }
 if(pathname==='/api/account/sessions'&&method==='GET'){
   const sessions=(await query('SELECT token_hash,created_at,expires_at FROM sessions WHERE user_id=$1 AND expires_at>NOW() ORDER BY created_at DESC',[u.id])).rows.map(s=>({id:s.token_hash,createdAt:s.created_at,expiresAt:s.expires_at,current:s.token_hash===hash(cookies(req)[cookieName]||'')}));
   return json(res,200,{sessions});
 }
 if(pathname==='/api/account/revoke-other-sessions'&&method==='POST'){
   await query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2',[u.id,hash(cookies(req)[cookieName]||'')]);await audit(u.id,'auth.sessions_revoked');return json(res,200,{ok:true});
 }
 if(pathname==='/api/account/delete'&&method==='POST'){
   const b=await body(req);if(!(await verifyPass(String(b.password||''),u.password_hash)))return fail(res,400,'Senha incorreta.');
   await audit(u.id,'account.delete_requested');await query('DELETE FROM users WHERE id=$1',[u.id]);
   try{fs.rmSync(path.join(dataDir,'media',u.id),{recursive:true,force:true})}catch{}
   res.setHeader('Set-Cookie',`${cookieName}=; Max-Age=0; ${cookieOpts(req)}`);return json(res,200,{ok:true});
 }
 if(pathname==='/api/account/export'&&method==='GET'){
   const [saved,sub,media]=await Promise.all([query('SELECT version,payload,updated_at FROM user_states WHERE user_id=$1',[u.id]),query('SELECT plan_code,status,paid_through,created_at FROM subscriptions WHERE user_id=$1',[u.id]),query('SELECT id,workspace_id,mime,bytes,created_at FROM media WHERE user_id=$1',[u.id])]);
   const {id,email,display_name,full_name,phone,locale,timezone,created_at}=u;
   return json(res,200,{exportedAt:new Date().toISOString(),account:{id,email,display_name,full_name,phone,locale,timezone,created_at},state:saved.rows[0]||null,subscriptions:sub.rows,media:media.rows,note:'Exportação de metadados de imagens; bytes dos arquivos não incluídos.'});
 }
 if(pathname==='/api/account/backups'&&method==='GET'){
   const items=(await query('SELECT snapshot_day,version,created_at FROM user_state_snapshots WHERE user_id=$1 ORDER BY snapshot_day DESC LIMIT 90',[u.id])).rows;
   return json(res,200,{backups:items.map(row=>({date:new Date(row.snapshot_day).toISOString().slice(0,10),version:row.version,createdAt:row.created_at}))});
 }
 if(pathname.startsWith('/api/account/backups/')&&method==='GET'){
   const day=pathname.slice('/api/account/backups/'.length);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return fail(res,400,'Data de backup inválida.');
   const found=(await query('SELECT version,payload FROM user_state_snapshots WHERE user_id=$1 AND snapshot_day=$2',[u.id,day])).rows[0];
   return found?json(res,200,{date:day,version:found.version,state:found.payload}):fail(res,404,'Backup não encontrado.');
 }
 if(pathname==='/api/erp/command'&&method==='POST'){
   if(!(await profile(u)).access)return fail(res,402,'Conta sem permissão de edição.');
   const b=await body(req);
   if(!Number.isSafeInteger(b.baseVersion)||b.baseVersion<=0||typeof b.action!=='string'||b.action.length>70)return fail(res,400,'Operação ou versão inválida.');
   const outcome=await transaction(async tx=>{
    const row=(await tx('SELECT version,payload FROM user_states WHERE user_id=$1 FOR UPDATE',[u.id])).rows[0];
    if(!row||row.version!==b.baseVersion)throw Object.assign(new Error('Conflito de sincronização. Atualize antes de alterar dados.'),{status:409});
    const next=applyErpCommand(row.payload,b.workspaceId,b.action,b.input);
    safeJSON(next);
    const serialized=JSON.stringify(next);
    if(serialized.length>1200000)throw Object.assign(new Error('Estado excede o limite.'),{status:413});
    const updated=await tx('UPDATE user_states SET payload=$3,version=version+1,updated_at=NOW() WHERE user_id=$1 AND version=$2 RETURNING version',[u.id,row.version,serialized]);
    if(!updated.rows.length)throw Object.assign(new Error('A conta mudou em outra sessão. Recarregue.'),{status:409});
    await tx('INSERT INTO user_state_snapshots(user_id,snapshot_day,version,payload) VALUES($1,CURRENT_DATE,$2,$3) ON CONFLICT DO NOTHING',[u.id,row.version,JSON.stringify(row.payload)]);
    await tx('INSERT INTO audit_log(id,actor_id,event,detail) VALUES($1,$2,$3,$4)',[randomUUID(),u.id,'erp.command',JSON.stringify({action:b.action,workspaceId:b.workspaceId})]);
    return {version:updated.rows[0].version,state:next};
   });
   return json(res,200,outcome);
 }
 if(pathname==='/api/state'&&method==='GET'){
   const row=(await query('SELECT version,payload,updated_at FROM user_states WHERE user_id=$1',[u.id])).rows[0];
   return json(res,200,{version:row?.version??0,state:row?.payload??null,updatedAt:row?.updated_at??null,subscription:(await profile(u)).subscription});
 }
 if(pathname==='/api/state'&&method==='PUT'){
   if(!(await profile(u)).access)return fail(res,402,'Teste expirado. Contrate um plano para continuar editando.');
   const b=await body(req),v=b.baseVersion;
   if(!Number.isSafeInteger(v)||v<0||!b.state||typeof b.state!=='object'||Array.isArray(b.state)||!b.state.collections||!b.state.erp)return fail(res,400,'Dados ou versão inválidos.');
   safeJSON(b.state);
   if(['owner','access','subscription','sessions','users'].some(key=>Object.hasOwn(b.state,key)))return fail(res,400,'Campos de autenticação não pertencem aos dados da conta.');
   const state=JSON.stringify(b.state);if(state.length>1200000)return fail(res,413,'Limite de dados excedido.');
   if(v===0){
     const created=await query('INSERT INTO user_states(user_id,version,payload) VALUES($1,1,$2) ON CONFLICT DO NOTHING RETURNING version',[u.id,state]);
     if(!created.rows.length)return fail(res,409,'Conflito de versão. Recarregue os dados.');
     await audit(u.id,'state.initialized');return json(res,200,{version:1});
   }
   const current=(await query('SELECT payload FROM user_states WHERE user_id=$1 AND version=$2',[u.id,v])).rows[0];
   if(!current)return fail(res,409,'Conflito de versão.');
   for(const key of ['products','orders','movements','bills','payments']){
     if(!isDeepStrictEqual(current.payload.erp?.[key]||[],b.state.erp?.[key]||[]))return fail(res,403,'Operações empresariais exigem validação no servidor.');
   }
   await query('INSERT INTO user_state_snapshots(user_id,snapshot_day,version,payload) SELECT user_id,CURRENT_DATE,version,payload FROM user_states WHERE user_id=$1 AND version=$2 ON CONFLICT DO NOTHING',[u.id,v]);
   const updated=await query('UPDATE user_states SET version=version+1,payload=$3,updated_at=NOW() WHERE user_id=$1 AND version=$2 RETURNING version',[u.id,v,state]);
   if(!updated.rows.length)return fail(res,409,'Os dados foram modificados em outro dispositivo. Recarregue antes de salvar.');
   return json(res,200,{version:updated.rows[0].version});
 }
 return fail(res,404,'Rota não encontrada.');
}
async function staticFile(req,res,url){
 if(req.method!=='GET'&&req.method!=='HEAD')return fail(res,405,'Método não permitido.');
 let pathname;
 try{pathname=decodeURIComponent(url.pathname)}catch{return fail(res,400,'URL inválida.')}
 if(pathname.includes('\\')||pathname.split('/').includes('..')||pathname.startsWith('/server-data')||pathname.startsWith('/api/'))return fail(res,403,'Acesso negado.');
 let file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)&&file!==root)return fail(res,403,'Acesso negado.');
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 const ext=path.extname(file),type=mime[ext]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':ext==='.html'?'no-store':'public, max-age=3600'});
 if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}
await initDb();
await initFoundation();
const handleRequest=async(req,res)=>{
 const requestId=randomUUID();res.setHeader('X-Request-ID',requestId);
 try{
   securityHeaders(req,res);
   if(!knownHost(req))return fail(res,421,'Host não autorizado.');
   const url=new URL(req.url||'/',`${req.socket.encrypted?'https':'http'}://${req.headers.host||'localhost'}`);
   if(url.pathname.startsWith('/api/'))return await api(req,res,url);
   return await staticFile(req,res,url);
 }catch(error){const status=Number(error?.status)||500;console.error(JSON.stringify({service:'eixo',type:'request_error',requestId,status,error:status<500?String(error?.message||'Falha'):String(error?.name||'InternalError')}));return fail(res,status,error?.status?error.message:'Erro interno.');}
};
const server=http.createServer(handleRequest);
server.requestTimeout=30000;server.headersTimeout=12000;server.keepAliveTimeout=5000;
server.listen(port,host,()=>console.log(`EIXO PC: http://${host}:${port} | DB ${mode}`));

const tlsRoot=path.join(dataDir,'tls'), configPath=path.join(tlsRoot,'lan.json');
if(fs.existsSync(configPath)){
 const lan=JSON.parse(fs.readFileSync(configPath,'utf8'));
 const ip=lan.lanIp, httpsPort=Number(lan.httpsPort), setupPort=Number(lan.setupPort);
 if(!/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)||!(httpsPort>=1024&&httpsPort<65536)||!(setupPort>=1024&&setupPort<65536))throw Error('Configuracao de IP/portas LAN invalida.');
 const cert=fs.readFileSync(path.join(tlsRoot,'server-cert.pem'));
 const key=fs.readFileSync(path.join(tlsRoot,'server-key.pem'));
 const tlsServer=https.createServer({cert,key,minVersion:'TLSv1.2'},handleRequest);
 tlsServer.listen(httpsPort,ip,()=>console.log(`EIXO IPHONE HTTPS: https://${ip}:${httpsPort}/`));
 tlsServer.on('error',error=>console.error('HTTPS LAN nao iniciou:',error.message));
 const ca=fs.readFileSync(path.join(tlsRoot,'eixo-ca.cer'));
 const page=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configurar EIXO no iPhone</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f9fb;color:#24334b;font:16px -apple-system,BlinkMacSystemFont,Arial,sans-serif;line-height:1.6;padding:20px}.card{max-width:650px;background:white;border:1px solid #e2e7ed;border-radius:18px;padding:27px;margin:30px auto;box-shadow:0 6px 30px #0001}h1{font-size:25px;margin:0 0 14px}h2{font-size:16px;margin:23px 0 4px}a.button{background:#263a58;color:white;padding:14px 20px;border-radius:9px;display:inline-block;text-decoration:none;font-weight:700;max-width:100%}code{word-break:break-all;font-size:12px;background:#edf1f7;padding:7px;border-radius:5px}ol{padding-left:25px}li{margin-bottom:13px}.muted{color:#66778d;font-size:13px}.notice{padding:12px;background:#fff7df;border-radius:10px}</style></head><body><div class="card"><h1>EIXO · Configuracao no iPhone</h1><p>Conecte o iPhone ao mesmo Wi-Fi deste computador. Instale o certificado local <b>apenas no seu aparelho pessoal</b> para que o Safari reconheca a conexao HTTPS.</p><h2>1. Baixe o certificado publico</h2><p><a class="button" href="/eixo-ca.cer">Baixar certificado do EIXO</a></p><h2>2. Instale e confie no certificado</h2><ol><li>Abra <b>Ajustes → Geral → VPN e Gerenciamento de Dispositivo</b> (ou Perfil Baixado) e instale o certificado.</li><li>Abra <b>Ajustes → Geral → Sobre → Ajustes de Confianca dos Certificados</b> e ative confianca total para <b>EIXO - Autoridade local de teste</b>.</li></ol><p class="muted">Identificador SHA-256 do certificado: <code>${lan.caSha256}</code>. Confira com o identificador fornecido diretamente no ChatGPT.</p><h2>3. Abra o EIXO</h2><p><a class="button" href="https://${ip}:${httpsPort}/">Abrir EIXO com HTTPS</a></p><p class="notice">Este certificado confia em uma autoridade local criada para o EIXO. Instale-o somente se confiar neste computador. Nao abra o roteador para acesso externo. O computador precisa permanecer ligado.</p><p class="muted">Nenhuma senha ou informacao do EIXO e transmitida por esta pagina HTTP; ela fornece apenas o certificado publico.</p></div></body></html>`;
 const setupServer=http.createServer((req,res)=>{
  const pathname=new URL(req.url||'/','http://localhost').pathname;
  const allowed=req.method==='GET'&&['/','/eixo-ca.cer'].includes(pathname);
  if(!allowed){res.writeHead(404,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end('Nao encontrado');}
  if(pathname==='/eixo-ca.cer'){res.writeHead(200,{'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="eixo-ca.cer"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(ca)}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(page);
 });
 setupServer.listen(setupPort,ip,()=>console.log(`EIXO IPHONE CERTIFICADO: http://${ip}:${setupPort}/`));
 setupServer.on('error',error=>console.error('Instalador LAN nao iniciou:',error.message));
}

