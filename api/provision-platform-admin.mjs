import {randomUUID} from 'node:crypto';
import {query,initDb,closeDb,userByEmail,transaction} from './db.mjs';
import {initFoundation} from './foundation-admin.mjs';
const [emailArg,role,confirmation]=process.argv.slice(2);
const email=String(emailArg||'').trim().toLowerCase();
if(process.env.EIXO_PLATFORM_ADMIN_PROVISION_APPROVED!=='1'||confirmation!=='--confirm'||!['owner','admin','support'].includes(role)||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
 console.error('Operação LOCAL com autorização explícita: EIXO_PLATFORM_ADMIN_PROVISION_APPROVED=1 node api/provision-platform-admin.mjs email@dominio.com owner|admin|support --confirm');
 process.exit(2);
}
try{
 await initDb();await initFoundation();
 const user=await userByEmail(email);
 if(!user?.verified_at||user.suspended_at)throw Error('Conta inexistente, suspensa ou sem e-mail verificado.');
 await transaction(async tx=>{
  const existing=(await tx("SELECT user_id FROM platform_admin_roles WHERE role='owner'")).rows;
  if(role==='owner'&&existing.length&&existing[0].user_id!==user.id)throw Error('Proprietário administrativo já definido.');
  const found=(await tx('SELECT role FROM platform_admin_roles WHERE user_id=$1',[user.id])).rows[0];
  if(found&&found.role!==role)throw Error('A alteração de papel existente precisa de procedimento separado e auditado.');
  await tx('INSERT INTO platform_admin_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,role]);
  await tx('INSERT INTO audit_log(id,actor_id,event,detail) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,'platform.role_provisioned',JSON.stringify({role,method:'local_terminal_explicit'})]);
 });
 console.log('Papel de plataforma autorizado e concedido à conta verificada. Nenhuma assinatura foi modificada.');
}catch(error){console.error('Provisionamento recusado:',error.message);process.exitCode=1}
finally{await closeDb()}
