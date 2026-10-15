import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import {validateProductionRuntime} from './production-runtime.mjs';

validateProductionRuntime(process.env);
const dataDir=path.resolve('server-data');
let client, mode;
if(process.env.DATABASE_URL){
  client=new pg.Pool({connectionString:process.env.DATABASE_URL, max:8, ssl:process.env.DATABASE_SSL==='require'?{rejectUnauthorized:true}:undefined});
  mode='postgresql';
}else{
  fs.mkdirSync(dataDir,{recursive:true});
  client=new PGlite(path.join(dataDir,'postgres'));
  mode='embedded-development';
}
export {mode,dataDir};
export const query=async(text,params=[])=>client.query(text,params);
export async function transaction(fn){
 if(mode==='postgresql'){
  const conn=await client.connect();
  try{
   await conn.query('BEGIN');
   const result=await fn((sql,params=[])=>conn.query(sql,params));
   await conn.query('COMMIT');
   return result;
  }catch(error){try{await conn.query('ROLLBACK')}catch{}throw error}
  finally{conn.release()}
 }
 return client.transaction(async tx=>fn((sql,params=[])=>tx.query(sql,params)));
}
export async function initDb(){
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '', full_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '', locale TEXT NOT NULL DEFAULT 'pt-BR',
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    verified_at TIMESTAMPTZ, trial_start TIMESTAMPTZ, is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT');
  await query(`CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,workspace_id TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS verification_tokens(
    token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ
  )`);
  await query(`CREATE TABLE IF NOT EXISTS user_states(
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS subscriptions(
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive',
    paid_through TIMESTAMPTZ,
    provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS audit_log(
    id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    event TEXT NOT NULL,detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query('CREATE TABLE IF NOT EXISTS user_state_snapshots (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,snapshot_day DATE NOT NULL DEFAULT CURRENT_DATE,version INTEGER NOT NULL,payload JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,snapshot_day))');
  await query('CREATE INDEX IF NOT EXISTS idx_state_snapshot_user_time ON user_state_snapshots(user_id,created_at DESC)');
  await query(`CREATE TABLE IF NOT EXISTS billing_checkout_intents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL,method TEXT NOT NULL,amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'creating',
    checkout_id TEXT UNIQUE,subscription_id TEXT,
    paid_through TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id TEXT PRIMARY KEY,event_type TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_billing_user_created ON billing_checkout_intents(user_id,created_at DESC)');
  await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_one_open_per_user ON billing_checkout_intents(user_id) WHERE status IN ('creating','pending','needs_review')");
  await query('CREATE TABLE IF NOT EXISTS billing_payment_receipts (payment_id TEXT PRIMARY KEY,intent_id TEXT NOT NULL REFERENCES billing_checkout_intents(id) ON DELETE CASCADE,recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscription ON billing_checkout_intents(subscription_id) WHERE subscription_id IS NOT NULL');
  await query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',['20261013_asaas_sandbox_only']);
  await query("CREATE TABLE IF NOT EXISTS live_billing_intents (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan_code TEXT NOT NULL,method TEXT NOT NULL,amount_cents INTEGER NOT NULL,status TEXT NOT NULL,checkout_id TEXT UNIQUE,subscription_id TEXT UNIQUE,paid_through TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await query('CREATE INDEX IF NOT EXISTS idx_live_billing_user_created ON live_billing_intents(user_id,created_at DESC)');
  await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_live_billing_one_open ON live_billing_intents(user_id) WHERE status IN ('creating','pending','needs_review','awaiting_card_settlement')");
  await query('CREATE TABLE IF NOT EXISTS live_billing_events(id TEXT PRIMARY KEY,event_type TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await query('CREATE TABLE IF NOT EXISTS live_billing_receipts(payment_id TEXT PRIMARY KEY,intent_id TEXT NOT NULL REFERENCES live_billing_intents(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',['20261013_asaas_live_schema_prepared']);
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_single_owner ON users (is_owner) WHERE is_owner=TRUE');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_tokens_user ON verification_tokens(user_id)');
  await query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',['20261012_initial_saas']);
}
export const userById=async(id)=> (await query('SELECT * FROM users WHERE id=$1',[id])).rows[0]||null;
export const userByEmail=async(email)=> (await query('SELECT * FROM users WHERE email=$1',[email])).rows[0]||null;
export async function closeDb(){if(mode==='postgresql')await client.end();else await client.close()}
