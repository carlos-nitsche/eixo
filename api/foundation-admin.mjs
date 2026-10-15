import {randomUUID} from 'node:crypto';
import {query,transaction,mode} from './db.mjs';

const error=(status,message)=>Object.assign(new Error(message),{status});
const validRole=new Set(['owner','admin','support']);
export async function initFoundation(){
 await transaction(async tx=>{
  await tx("ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ");
  await tx("ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT");
  await tx("CREATE TABLE IF NOT EXISTS platform_admin_roles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('owner','admin','support')),granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await tx("CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_one_owner ON platform_admin_roles(role) WHERE role='owner'");
  await tx("CREATE INDEX IF NOT EXISTS idx_users_suspended_at ON users(suspended_at)");
  await tx("CREATE INDEX IF NOT EXISTS idx_admin_audit ON audit_log(occurred_at DESC)");
  await tx("INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",['20261013_f1_platform_admin']);
 });
}
export async function platformRole(id){
 const row=(await query('SELECT role FROM platform_admin_roles WHERE user_id=$1',[id])).rows[0];
 return row&&validRole.has(row.role)?row.role:null;
}
const canManage=role=>role==='owner'||role==='admin';
const canView=role=>validRole.has(role);
const marker=async(tx,actor,event,detail)=>tx('INSERT INTO audit_log(id,actor_id,event,detail) VALUES($1,$2,$3,$4)',[randomUUID(),actor,event,JSON.stringify(detail)]);
export async function adminApi({req,res,url,user,body,json,fail,realChargesEnabled=false}){
 const role=await platformRole(user.id);
 if(!canView(role))return fail(res,403,'Acesso administrativo negado.');
 const p=url.pathname,m=req.method;
 if(p==='/api/admin/overview'&&m==='GET'){
  const [users,subs,events,paid]=await Promise.all([
   query('SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE verified_at IS NOT NULL)::integer AS verified,COUNT(*) FILTER (WHERE suspended_at IS NOT NULL)::integer AS suspended,COUNT(*) FILTER (WHERE verified_at IS NOT NULL AND trial_start IS NOT NULL AND trial_start + INTERVAL \'72 hours\' > NOW())::integer AS trials FROM users'),
   query('SELECT status,plan_code,COUNT(*)::integer AS total FROM subscriptions GROUP BY status,plan_code ORDER BY status,plan_code'),
   query('SELECT (SELECT COUNT(*) FROM live_billing_events)::integer AS live_events,(SELECT COUNT(*) FROM billing_webhook_events)::integer AS sandbox_events'),
   query('SELECT COALESCE(SUM(i.amount_cents),0)::bigint AS cents FROM live_billing_receipts r JOIN live_billing_intents i ON i.id=r.intent_id')
  ]);
  return json(res,200,{role,users:users.rows[0],subscriptions:subs.rows,webhooks:events.rows[0],confirmedRealReceiptsCents:Number(paid.rows[0].cents),databaseMode:mode,realChargesEnabled,note:'Valor confirmado registrado no banco; não equivale a receita conciliada com extrato bancário.'});
 }
 if(p==='/api/admin/health'&&m==='GET'){
  const r=await query('SELECT 1 AS connected');
  return json(res,200,{database:r.rows[0]?.connected===1?'ok':'error',mode,at:new Date().toISOString(),remoteHostingReady:false});
 }
 if(!canManage(role))return fail(res,403,'Papel sem autorização para consultar registros pessoais.');
 if(p==='/api/admin/users'&&m==='GET'){
  const search=(url.searchParams.get('q')||'').trim().slice(0,120);
  const rawPage=Number(url.searchParams.get('page')||1);
  if(!Number.isSafeInteger(rawPage)||rawPage<1||rawPage>10000)return fail(res,400,'Página inválida.');
  const pattern='%'+search.replace(/[\\%_]/g,x=>'\\'+x)+'%';
  const where="WHERE (u.email ILIKE $1 ESCAPE '\\' OR u.display_name ILIKE $1 ESCAPE '\\')";
  const records=await query('SELECT u.id,u.email,u.display_name,u.verified_at,u.created_at,u.suspended_at,s.status AS subscription_status,s.plan_code,ar.role AS platform_role FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id LEFT JOIN platform_admin_roles ar ON ar.user_id=u.id '+where+' ORDER BY u.created_at DESC,u.id DESC LIMIT 21 OFFSET $2',[pattern,(rawPage-1)*20]);
  return json(res,200,{page:rawPage,more:records.rows.length>20,users:records.rows.slice(0,20)});
 }
 if(p==='/api/admin/audit'&&m==='GET'){
  const rawPage=Number(url.searchParams.get('page')||1);
  if(!Number.isSafeInteger(rawPage)||rawPage<1||rawPage>10000)return fail(res,400,'Página inválida.');
  const records=await query('SELECT id,actor_id,event,occurred_at FROM audit_log ORDER BY occurred_at DESC LIMIT 41 OFFSET $1',[(rawPage-1)*40]);
  return json(res,200,{page:rawPage,more:records.rows.length>40,events:records.rows.slice(0,40)});
 }
 const match=/^\/api\/admin\/users\/([0-9a-f-]{36})\/(suspend|resume|revoke-sessions)$/.exec(p);
 if(match&&m==='POST'){
  const targetId=match[1],action=match[2];
  if(targetId===user.id)return fail(res,403,'Alterações administrativas sobre a própria conta não são permitidas.');
  const input=await body(req);
  const reason=String(input.reason||'').trim();
  if(reason.length<8||reason.length>300)return fail(res,400,'Informe uma justificativa de 8 a 300 caracteres.');
  const result=await transaction(async tx=>{
   const target=(await tx('SELECT id,suspended_at FROM users WHERE id=$1 FOR UPDATE',[targetId])).rows[0];
   if(!target)throw error(404,'Conta não encontrada.');
   const admin=(await tx('SELECT role FROM platform_admin_roles WHERE user_id=$1',[targetId])).rows[0];
   if(admin?.role==='owner'||(admin?.role==='admin'&&role!=='owner'))throw error(403,'Não é permitido alterar conta com privilégio administrativo superior ou equivalente.');
   if(action==='suspend')await tx('UPDATE users SET suspended_at=COALESCE(suspended_at,NOW()),suspended_reason=$2 WHERE id=$1',[targetId,reason]);
   if(action==='resume')await tx('UPDATE users SET suspended_at=NULL,suspended_reason=NULL WHERE id=$1',[targetId]);
   if(action!=='resume')await tx('DELETE FROM sessions WHERE user_id=$1',[targetId]);
   await marker(tx,user.id,'platform.user_'+action.replace('-','_'),{targetId,reason});
   return {ok:true};
  });
  return json(res,200,result);
 }
 return fail(res,404,'Rota administrativa não encontrada.');
}
