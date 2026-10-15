import {randomUUID} from 'node:crypto';
import {initDb,query,userByEmail,closeDb} from './db.mjs';
const email=String(process.argv[2]||'').toLowerCase(),confirmation=process.argv[3];
if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||confirmation!=='--confirm'){
  console.error('Uso exclusivo no terminal local: node api/provision-owner.mjs email@dominio.com --confirm');
  process.exit(2);
}
try{
 await initDb();
 const user=await userByEmail(email);
 if(!user||!user.verified_at)throw Error('A conta precisa existir e ter e-mail verificado antes do provisionamento.');
 const owners=(await query('SELECT id,email FROM users WHERE is_owner=TRUE')).rows;
 if(owners.length&&owners[0].id!==user.id)throw Error('Já existe um proprietário Lifetime. Operação recusada.');
 if(!user.is_owner){
   await query('UPDATE users SET is_owner=TRUE WHERE id=$1 AND verified_at IS NOT NULL',[user.id]);
   await query('INSERT INTO audit_log(id,actor_id,event,detail) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,'owner.lifetime_granted',JSON.stringify({method:'local_provision',plan:'lifetime'})]);
 }
 console.log('Lifetime habilitado para uma conta de e-mail verificado. Nenhuma senha foi criada.');
}catch(e){console.error('Provisionamento recusado:',e.message);process.exitCode=1}
finally{await closeDb()}
