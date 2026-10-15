import {createHash,randomUUID} from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import {initDb,query,transaction,closeDb,mode} from './db.mjs';
import {initFoundation} from './foundation-admin.mjs';
const digest=String(process.argv[2]||'').trim().toLowerCase();
const fail=message=>Object.assign(new Error(message),{operation:'refused'});
if(process.env.EIXO_PLATFORM_ADMIN_PROVISION_APPROVED!=='1'||process.argv[3]!=='--confirm'||!/^[a-f0-9]{64}$/.test(digest)){
 throw fail('Provisionamento requer autorização explícita, impressão SHA-256 da identidade e --confirm.');
}
if(mode!=='embedded-development')throw fail('Este bootstrap específico opera somente sobre o PGlite local com servidor parado.');
const appRoot=path.resolve('C:/Jogos/EIXO').toLowerCase();
if(process.cwd().toLowerCase()===appRoot){
 const open=await new Promise(resolve=>{const c=net.connect({host:'127.0.0.1',port:4173});c.setTimeout(1000);c.once('connect',()=>{c.destroy();resolve(true)});c.once('error',()=>resolve(false));c.once('timeout',()=>{c.destroy();resolve(true)})});
 if(open)throw fail('O backend está ativo: encerre com controle antes de provisionar a base real.');
}
try{
 await initDb();await initFoundation();
 const output=await transaction(async tx=>{
  const accounts=(await tx("SELECT id,email,is_owner,verified_at,suspended_at FROM users WHERE LOWER(email) NOT LIKE '%@example.test' AND LOWER(email) NOT LIKE '%@example.invalid' AND LOWER(email) NOT LIKE '%@test.local' FOR UPDATE")).rows;
  if(accounts.length!==1)throw fail('Esperada uma única conta não fictícia; encontradas '+accounts.length+'.');
  const target=accounts[0];
  if(!target.verified_at||target.suspended_at)throw fail('A conta não está verificada ou está suspensa.');
  const actual=createHash('sha256').update(target.email.trim().toLowerCase()).digest('hex');
  if(actual!==digest)throw fail('Identidade diferente daquela validada no backup. Nenhum papel concedido.');
  const previous=(await tx('SELECT user_id,role FROM platform_admin_roles')).rows;
  if(previous.length)throw fail('Já existem papéis administrativos. Requer revisão manual.');
  const before=(await tx('SELECT COUNT(*)::integer AS n FROM subscriptions')).rows[0].n;
  const lifetime=(await tx('SELECT COUNT(*)::integer AS n FROM users WHERE is_owner=TRUE')).rows[0].n;
  await tx("INSERT INTO platform_admin_roles(user_id,role) VALUES($1,'owner')",[target.id]);
  await tx('INSERT INTO audit_log(id,actor_id,event,detail) VALUES($1,$2,$3,$4)',[randomUUID(),target.id,'platform.owner_bootstrapped',JSON.stringify({method:'local_unique_verified_account',approved:true,lifetimeUnchanged:true,realBillingEnabled:false})]);
  const after=(await tx('SELECT COUNT(*)::integer AS n FROM subscriptions')).rows[0].n;
  const lifetimeAfter=(await tx('SELECT COUNT(*)::integer AS n FROM users WHERE is_owner=TRUE')).rows[0].n;
  if(before!==after||lifetime!==lifetimeAfter)throw fail('Invariantes de assinaturas ou Lifetime alteradas.');
  return {role:'owner',verified:true,existingSubscriptions:after,lifetimeAccounts:lifetime,unchangedEntitlements:true};
 });
 const check=(await query('SELECT COUNT(*)::integer AS n FROM platform_admin_roles WHERE role=$1',['owner'])).rows[0].n;
 if(check!==1)throw fail('Papel não foi persistido corretamente.');
 console.log('EIXO_PLATFORM_ADMIN_BOOTSTRAP_OK '+JSON.stringify(output));
}catch(error){console.error('EIXO_PLATFORM_ADMIN_BOOTSTRAP_REFUSED '+error.message);process.exitCode=1}
finally{await closeDb()}
