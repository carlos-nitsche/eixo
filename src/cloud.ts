import type {Store} from './model';
let version=0;
let active=false;
let timer:ReturnType<typeof setTimeout>|undefined;
let pending:string|null=null;
let lastSent='';
let sending=false;
let halted=false;
export const isCloud=()=>active;
export function activateCloud(nextVersion:number,initial:Store){
  active=true;halted=false;version=nextVersion;lastSent=JSON.stringify(initial);pending=null;
}
export function deactivateCloud(){
  active=false;halted=false;version=0;pending=null;lastSent='';
  if(timer)clearTimeout(timer);
}
export function enqueueCloud(state:Store){
  if(!active||halted)return;
  const serialized=JSON.stringify(state);
  if(serialized===lastSent&&!sending){pending=null;if(timer)clearTimeout(timer);return}
  pending=serialized;
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>void syncCloud(),800);
}
export const hasPendingChanges=()=>Boolean(sending||pending);
export async function syncCloud():Promise<void>{
 if(!active||sending||!pending||halted)return;
 sending=true;
 const payload=pending;pending=null;
 try{
   const response=await fetch('/api/state',{method:'PUT',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({baseVersion:version,state:JSON.parse(payload)})});
   if(response.status===409){
     halted=true;pending??=payload;window.alert('Os dados foram alterados em outro dispositivo. Seus dados atuais continuam neste navegador. Exporte um backup antes de atualizar esta página para evitar conflitos.');
     return;
   }
   if(response.status===402){halted=true;pending??=payload;window.alert('O período de teste terminou. Os dados locais não foram excluídos. Atualize para gerenciar sua assinatura.');return}
   if(response.status===403||response.status===400){halted=true;pending??=payload;window.alert('Alteração bloqueada pelo servidor para proteger seu histórico financeiro e estoque. Os dados locais não foram apagados. Exporte um backup e recarregue para recuperar a versão autorizada.');return}
   if(!response.ok)throw new Error('Falha ao sincronizar.');
   const data=await response.json();version=data.version;lastSent=payload;
 }catch{
   pending??=payload;
 }finally{
   sending=false;
   if(pending&&!halted&&active){if(timer)clearTimeout(timer);timer=setTimeout(()=>void syncCloud(),3500)}
 }
}

/** Persists sensitive ERP operations in the backend; never submits browser-made balances. */
export async function runErpCommand(action:string,workspaceId:string,input:unknown):Promise<Store>{
 if(!active||halted)throw Error('Sincronização indisponível. Não foi feita nenhuma alteração.');
 for(let k=0;sending&&k<100;k++)await new Promise(done=>setTimeout(done,50));
 if(sending)throw Error('Sincronização ocupada. Tente novamente.');
 if(pending)await syncCloud();
 if(pending||sending||halted)throw Error('Salve os dados pendentes antes de concluir esta operação.');
 sending=true;
 try{
  const res=await fetch('/api/erp/command',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({baseVersion:version,workspaceId,action,input})});
  const result=await res.json();
  if(!res.ok){
   if(res.status===409){halted=true;window.alert('Dados modificados em outro dispositivo. Recarregue a conta e tente novamente.');}
   throw Error(result.error||'Falha ao validar operação no servidor.');
  }
  version=result.version;
  lastSent=JSON.stringify(result.state);
  pending=null;
  return result.state as Store;
 }finally{
  sending=false;
 }
}

