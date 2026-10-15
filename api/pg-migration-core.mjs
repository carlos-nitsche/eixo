import {createHash} from 'node:crypto';

/** FK-topological order. Entire destination must be empty except migration metadata. */
export const COPY_TABLES=[
 'users','platform_admin_roles','media','sessions','verification_tokens',
 'user_states','subscriptions','audit_log','user_state_snapshots',
 'billing_checkout_intents','billing_webhook_events','billing_payment_receipts',
 'live_billing_intents','live_billing_events','live_billing_receipts'
];
const validName=/^[a-z][a-z0-9_]*$/;
const quote=name=>{if(!validName.test(name))throw Error('SQL identifier rejected');return '"'+name+'"';};
const failure=(kind)=>Object.assign(new Error(kind),{qaMigration:true});
function canonical(value){
 if(value===null||value===undefined)return null;
 if(value instanceof Date)return value.toISOString();
 if(typeof value==='bigint')return value.toString();
 if(typeof value==='number')return Number.isFinite(value)?value.toString():null;
 if(typeof value==='string')return value;
 if(typeof value==='boolean')return value;
 if(Array.isArray(value))return value.map(canonical);
 if(typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return String(value);
}
const digest=rows=>{const hash=createHash('sha256');for(const row of rows)hash.update(JSON.stringify(canonical(row))+'\n');return hash.digest('hex');};
const getColumns=async(db,table)=> (await db.query(
 'SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',
 ['public',table])).rows;
const hasTable=async(db,table)=>(await getColumns(db,table)).length>0;
const count=async(db,table)=>Number((await db.query('SELECT COUNT(*)::bigint AS n FROM '+quote(table))).rows[0].n);
// Cast PostgreSQL DATE to text in SQL before crossing drivers/timezones.
const rows=async(db,table,definitions=[])=>{
 const select=definitions.map(col=>col.udt_name==='date'?quote(col.column_name)+'::text AS '+quote(col.column_name):quote(col.column_name)).join(',');
 return (await db.query('SELECT '+(select||'*')+' FROM '+quote(table))).rows;
};
const compareColumns=(source,dest,table)=>{
 const sm=new Map(source.map(x=>[x.column_name,x.udt_name]));
 const dm=new Map(dest.map(x=>[x.column_name,x.udt_name]));
 for(const [key,type] of sm)if(dm.get(key)!==type)throw failure('Incompatibilidade de schema na tabela '+table+': '+key);
};
const missingReferences=async target=>{
 const checks=[
  ['sessions','user_id'],['media','user_id'],['verification_tokens','user_id'],
  ['user_states','user_id'],['subscriptions','user_id'],['user_state_snapshots','user_id'],
  ['platform_admin_roles','user_id'],['billing_checkout_intents','user_id'],['live_billing_intents','user_id']
 ];
 for(const [table,column] of checks){
  const sql='SELECT COUNT(*)::bigint AS n FROM '+quote(table)+' a LEFT JOIN users u ON u.id=a.'+quote(column)+' WHERE u.id IS NULL';
  if(Number((await target.query(sql)).rows[0].n)>0)throw failure('Relação quebrada em '+table);
 }
};
/**
 * src: PGlite (QA synthetic only); target: disposable PG or PGlite.
 * transact: callback that provides transactional query client.
 * Schema creation must occur prior to invocation. On any mismatch, rollback all data rows.
 */
export async function rehearseMigration({source,target,transaction,dryRun=true}){
 if(!source||!target||typeof transaction!=='function')throw failure('Fonte, destino e transação obrigatórios.');
 const planned=[];
 for(const table of COPY_TABLES){
  if(!await hasTable(source,table)||!await hasTable(target,table))throw failure('Tabela ausente: '+table);
  const from=await getColumns(source,table),to=await getColumns(target,table);
  compareColumns(from,to,table);
  const original=await count(source,table),existing=await count(target,table);
  if(existing!==0)throw failure('Destino não vazio: '+table+' ('+existing+' registros).');
  planned.push({table,rows:original,columns:from.map(x=>x.column_name),dateColumns:from.filter(x=>x.udt_name==='date').map(x=>x.column_name),columnDefinitions:from});
 }
 const sourceVersions=(await source.query('SELECT version FROM schema_migrations')).rows.map(r=>r.version);
 const targetVersions=(await target.query('SELECT version FROM schema_migrations')).rows.map(r=>r.version);
 const missingVersions=sourceVersions.filter(v=>!targetVersions.includes(v));
 if(dryRun)return {mode:'dry-run',tables:planned.length,totalRows:planned.reduce((sum,x)=>sum+x.rows,0),counts:Object.fromEntries(planned.map(({table,rows})=>[table,rows])),missingVersions,committed:false};
 const result=await transaction(async tx=>{
  const counts={},checksums={};
  for(const {table,rows:expected,columns,dateColumns,columnDefinitions} of planned){
   const data=await rows(source,table,columnDefinitions);
   const cols=columns.map(quote).join(',');
   const placeholders=columns.map((_,i)=>'$'+(i+1)).join(',');
   const sql='INSERT INTO '+quote(table)+' ('+cols+') VALUES('+placeholders+')';
   for(const entry of data)await tx.query(sql,columns.map(c=>entry[c]));
   const copied=await rows(tx,table,columnDefinitions);
   // PostgreSQL DATE é calendário sem fuso; drivers podem devolver Date ou string.
   const normaliseDates=(row)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,dateColumns.includes(key)&&value!=null?(value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)):value]));
   const sourceNormalised=data.map(normaliseDates),destNormalised=copied.map(normaliseDates);
   if(copied.length!==expected||digest(sourceNormalised)!==digest(destNormalised)){
    const fields=data[0]&&copied[0]?columns.filter(c=>JSON.stringify(canonical(normaliseDates(data[0])[c]))!==JSON.stringify(canonical(normaliseDates(copied[0])[c]))):[];
    throw failure('Dados divergentes na verificação: '+table+' [colunas: '+fields.join(',')+']');
   }
   counts[table]=copied.length;
   checksums[table]=digest(destNormalised);
  }
  for(const version of missingVersions)await tx.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',[version]);
  await missingReferences(tx);
  return {mode:'isolated-rehearsal',tables:planned.length,totalRows:Object.values(counts).reduce((a,n)=>a+n,0),counts,checksums,committed:true};
 });
 return result;
}
