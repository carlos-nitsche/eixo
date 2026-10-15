// EIXO • Windows DPAPI vault for Asaas production credentials.
// Secrets arrive over stdin, never command-line arguments, source files, or logs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import readline from 'node:readline';

const vaultDir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'EIXO','payment-secrets');
const vaultFile=path.join(vaultDir,'asaas-production.dpapi.json');
const mine=fileURLToPath(import.meta.url);

function dpapi(mode,input){
  if(process.platform!=='win32')throw Error('Windows DPAPI indisponível nesta plataforma.');
  const script=mode==='protect'
    ? "$ErrorActionPreference='Stop';$a=[Console]::In.ReadToEnd().TrimEnd([char]10,[char]13);$s=ConvertTo-SecureString $a -AsPlainText -Force;[Console]::Out.Write((ConvertFrom-SecureString $s))"
    : "$ErrorActionPreference='Stop';$a=[Console]::In.ReadToEnd().Trim();$s=ConvertTo-SecureString $a;$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}";
  const encoded=Buffer.from(script,'utf16le').toString('base64');
  const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{input,encoding:'utf8',maxBuffer:32768,timeout:15000,windowsHide:true});
  if(r.error||r.status!==0||!r.stdout?.trim()){if(process.argv[2]==='self-test')console.error('DPAPI_SELF_TEST_DEBUG '+JSON.stringify({status:r.status,errorCode:r.error?.code,stderr:String(r.stderr||'').slice(0,500),stdoutPresent:Boolean(r.stdout)}));throw Error('Falha ao acessar cofre DPAPI do Windows.')}
  return r.stdout.trim();
}
function validKey(key){return typeof key==='string'&&key.startsWith('$aact_prod_')&&key.length>50&&!/\s/.test(key)}
export function localVaultExists(){return fs.existsSync(vaultFile)}
export function loadAsaasLocalSecrets(){
  if(!localVaultExists())return null;
  const record=JSON.parse(fs.readFileSync(vaultFile,'utf8'));
  if(record.version!==1||record.provider!=='asaas'||!record.keyDpapi||!record.webhookDpapi)throw Error('Cofre Asaas inválido.');
  const productionKey=dpapi('unprotect',record.keyDpapi);
  const webhookToken=dpapi('unprotect',record.webhookDpapi);
  if(!validKey(productionKey)||webhookToken.length<32||webhookToken===productionKey)throw Error('Cofre Asaas possui credenciais inválidas.');
  return {productionKey,webhookToken};
}
async function checkProductionKey(key){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  try{
    const response=await fetch('https://api.asaas.com/v3/webhooks',{headers:{access_token:key,'User-Agent':'EIXO/0.3.0','Accept':'application/json'},signal:ctrl.signal,redirect:'error'});
    if(!response.ok)throw Error('Asaas não aceitou a chave de produção. HTTP '+response.status);
    return true;
  }finally{clearTimeout(timer)}
}
async function runCli(){
  const command=process.argv[2];
  if(command==='self-test'){
    const fake='local-self-test-secret-2026';
    if(dpapi('unprotect',dpapi('protect',fake))!==fake)throw Error('DPAPI não recuperou segredo.');
    console.log('EIXO_ASAAS_DPAPI_SELF_TEST_OK');return;
  }
  if(command==='status'){
    const c=loadAsaasLocalSecrets();
    console.log('EIXO_ASAAS_LOCAL_VAULT '+JSON.stringify({configured:!!c,credentialFormatValid:!!c,webhookSecretPrepared:!!c,liveBillingEnabled:false}));
    return;
  }
  if(command!=='set')throw Error('Uso: node scripts/asaas-windows-vault.mjs set|status|self-test');
  const key=await new Promise(resolve=>{const rl=readline.createInterface({input:process.stdin,terminal:false});rl.once('line',line=>{resolve(line.trim());rl.close()})});
  if(!validKey(key))throw Error('Formato de chave de produção inválido.');
  await checkProductionKey(key);
  const previous=localVaultExists()?loadAsaasLocalSecrets():null;
  const webhookToken=previous?.webhookToken||randomBytes(48).toString('base64url');
  const record={version:1,provider:'asaas',savedAt:new Date().toISOString(),
    keyDpapi:dpapi('protect',key),webhookDpapi:dpapi('protect',webhookToken)};
  fs.mkdirSync(vaultDir,{recursive:true});
  const temp=vaultFile+'.tmp-'+process.pid;
  fs.writeFileSync(temp,JSON.stringify(record),{encoding:'utf8',mode:0o600,flag:'wx'});
  fs.renameSync(temp,vaultFile);
  console.log('EIXO_ASAAS_LOCAL_VAULT_SAVED '+JSON.stringify({productionKeyValidated:true,encryptedWith:'Windows DPAPI CurrentUser',webhookSecretPrepared:true,liveBillingEnabled:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===mine)
  runCli().catch(e=>{console.error('EIXO_ASAAS_VAULT_ERROR: '+e.message);process.exitCode=1});
