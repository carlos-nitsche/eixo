import type {Store,Entry} from './model';
import {parseERP} from './erp';
const collections=['transactions','tasks','events','subjects','studies','workouts','clients','deals','projects','goals','habits','businesses'] as const;
export type RecoveryInfo={companies:string[];companyCount:number;linkedRecords:number;duplicateCount:number};
export function previewCompanyRecovery(current:Store,input:unknown):RecoveryInfo{
 if(!input||typeof input!=='object'||!('collections'in input))throw new Error('O arquivo não contém um backup EIXO válido.');
 const source=input as Partial<Store>;
 if(!source.collections||!Array.isArray(source.collections.businesses))throw new Error('Backup sem cadastro de empresas.');
 const business=source.collections.businesses.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string');
 const originalIds=new Set(business.map(x=>x.id));
 const existing=new Set(current.collections.businesses.map(x=>x.id));
 const unique=business.filter(x=>!existing.has(x.id));
 const linked=collections.filter(k=>k!=='businesses').reduce((t,k)=>{
   const records=source.collections?.[k]||[];
   return t+(Array.isArray(records)?records.filter(x=>originalIds.has(x.workspaceId||'')).length:0);
 },0);
 return {companies:unique.map(x=>x.title),companyCount:unique.length,linkedRecords:linked,duplicateCount:business.length-unique.length};
}
export function mergeCompanyRecovery(current:Store,input:unknown):Store{
 const info=previewCompanyRecovery(current,input);
 const source=input as Store;
 const originalIds=new Set(source.collections.businesses.map(x=>x.id));
 const targetCollections={...current.collections};
 for(const k of collections){
   const incoming=source.collections[k];
   if(!Array.isArray(incoming))continue;
   const relevant=k==='businesses'
     ?incoming.filter(x=>originalIds.has(x.id))
     :incoming.filter(x=>originalIds.has(x.workspaceId||''));
   const exists=new Set(targetCollections[k].map(x=>x.id));
   targetCollections[k]=[...targetCollections[k],...relevant.filter(x=>x&&typeof x.id==='string'&&!exists.has(x.id))] as Entry[];
 }
 const inputERP=parseERP(source.erp);
 const targetERP=parseERP(current.erp);
 const mergedERP={...targetERP};
 for(const k of ['products','suppliers','orders','movements','bills','payments'] as const){
   const original=targetERP[k] as Array<{id:string;workspaceId:string}>;
   const incoming=inputERP[k] as Array<{id:string;workspaceId:string}>;
   const existing=new Set(original.map(x=>x.id));
   (mergedERP as unknown as Record<string,unknown>)[k]=[...original,...incoming.filter(x=>originalIds.has(x.workspaceId)&&!existing.has(x.id))];
 }
 // Não altera usuário, tema, espaço ativo ou dados existentes.
 void info;
 return {...current,collections:targetCollections,erp:mergedERP};
}
