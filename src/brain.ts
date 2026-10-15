import type {Collection, Store} from './model';
export type BrainKind='ideas'|'subjects'|'studies'|'plans'|'cards'|'exams';
export type BrainIdea={id:string;workspaceId:string;title:string;notes:string;createdAt:string;updatedAt?:string;folder?:string;tags?:string[];subjectId?:string;pinned?:boolean};
export type BrainLink={id:string;workspaceId:string;source:string;target:string};
export type BrainData={ideas:BrainIdea[];links:BrainLink[]};
export type BrainNode={id:string;title:string;notes:string;kind:BrainKind;collection?:Collection;recordId:string;status?:string;date?:string};
export type BrainEdge={id:string;source:string;target:string;reason:string;manual:boolean};
export const brainKinds:BrainKind[]=['ideas','subjects','studies','plans','cards','exams'];
export const brainLabels:Record<BrainKind,string>={ideas:'Notas',subjects:'Disciplinas',studies:'Sessões',plans:'Planos',cards:'Cartões',exams:'Avaliações'};
export const brainColors:Record<BrainKind,string>={ideas:'var(--accent)',subjects:'var(--text-secondary)',studies:'var(--success)',plans:'var(--warning)',cards:'color-mix(in srgb, var(--accent) 65%, var(--heading))',exams:'var(--text-muted)'};
export function parseBrain(raw:unknown):BrainData{
 const r=raw as Partial<BrainData>|null;
 return {ideas:Array.isArray(r?.ideas)?r.ideas.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.workspaceId==='string').map(x=>({...x,notes:typeof x.notes==='string'?x.notes:'',folder:typeof x.folder==='string'?x.folder:'',tags:Array.isArray(x.tags)?x.tags.filter(t=>typeof t==='string'):[],subjectId:typeof x.subjectId==='string'?x.subjectId:'',pinned:x.pinned===true})):[],links:Array.isArray(r?.links)?r.links.filter(x=>x&&typeof x.id==='string'&&typeof x.workspaceId==='string'&&typeof x.source==='string'&&typeof x.target==='string'):[]};
}
export const normalizeTitle=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
// Ignore code examples: only prose references become knowledge connections.
export const prose=(s:string)=>s.replace(/```[\s\S]*?```/g,'').replace(/`[^`\n]*`/g,'');
export const wikiReferences=(s:string)=>[...prose(s).matchAll(/\[\[([^\]\n]+)\]\]/g)].map(m=>m[1].split('|')[0].trim()).filter(Boolean);
export function resolveBrainTitle(nodes:BrainNode[],title:string){const all=nodes.filter(n=>normalizeTitle(n.title)===normalizeTitle(title));const notes=all.filter(n=>n.kind==='ideas');return notes.length?notes:all}
export function buildBrain(store:Store,workspace:string){
 const brain=parseBrain(store.brain),notes=brain.ideas.filter(x=>x.workspaceId===workspace),nodes:BrainNode[]=notes.map(x=>({...x,id:'ideas:'+x.id,recordId:x.id,kind:'ideas'}));
 for(const collection of ['studies','subjects'] as const)for(const x of store.collections[collection])if((x.workspaceId||'pessoal')===workspace)nodes.push({id:collection+':'+x.id,recordId:x.id,title:x.title,notes:String(x.notes||''),kind:collection,collection,date:String(x.date||'')});
 for(const kind of ['plans','cards','exams'] as const)for(const x of store.study?.[kind]||[])if(x.workspaceId===workspace)nodes.push({id:kind+':'+x.id,recordId:x.id,title:'front'in x?x.front:x.title,notes:'back'in x?x.back:x.notes,kind,date:'date'in x?x.date:undefined,status:'done'in x?(x.done?'Concluído':'Planejado'):undefined});
 const ids=new Set(nodes.map(n=>n.id)),edges:BrainEdge[]=[],pairs=new Set<string>();
 const add=(source:string,target:string,reason:string,id:string,manual=false)=>{const pair=[source,target].sort().join('|');if(source===target||!ids.has(source)||!ids.has(target)||pairs.has(pair))return;pairs.add(pair);edges.push({id,source,target,reason,manual})};
 for(const x of brain.links)if(x.workspaceId===workspace)add(x.source,x.target,'Conexão criada por você',x.id,true);
 const titles=new Map<string,BrainNode[]>();for(const n of nodes){const key=normalizeTitle(n.title);titles.set(key,[...(titles.get(key)||[]),n])}
 for(const n of nodes)for(const title of wikiReferences(n.notes)){const candidates=titles.get(normalizeTitle(title))||[];const matches=resolveBrainTitle(candidates,title);if(matches.length===1)add(n.id,matches[0].id,'Referência [[…]]','wiki:'+n.id+':'+matches[0].id)}
 for(const x of notes)if(x.subjectId)add('ideas:'+x.id,'subjects:'+x.subjectId,'Disciplina da nota','note:subject:'+x.id);
 for(const type of ['plans','cards','exams'] as const)for(const x of store.study?.[type]||[])if(x.workspaceId===workspace){if(x.subjectId)add(type+':'+x.id,'subjects:'+x.subjectId,'Disciplina do estudo',type+':subject:'+x.id);if('sourceNoteId'in x&&x.sourceNoteId)add(type+':'+x.id,'ideas:'+x.sourceNoteId,'Criado a partir desta nota',type+':note:'+x.id)}
 for(const x of store.collections.studies)if((x.workspaceId||'pessoal')===workspace){if(x.sourceNoteId)add('studies:'+x.id,'ideas:'+x.sourceNoteId,'Estudo realizado a partir desta nota','session:note:'+x.id);const subject=store.collections.subjects.filter(s=>(s.workspaceId||'pessoal')===workspace&&(s.id===x.subjectId||normalizeTitle(s.title)===normalizeTitle(String(x.subject||''))));if(subject.length===1)add('studies:'+x.id,'subjects:'+subject[0].id,'Disciplina do estudo','study:subject:'+x.id)}
 return {nodes,edges};
}
/** Renames references only when the original title is unambiguous in this workspace. */
export function renameStudyNote(store:Store,workspace:string,id:string,title:string):Store{
 const b=parseBrain(store.brain),note=b.ideas.find(x=>x.id===id&&x.workspaceId===workspace);if(!note)return store;
 const graph=buildBrain(store,workspace);const unique=resolveBrainTitle(graph.nodes,note.title).length===1;
 const replace=(text:string)=>!unique?text:text.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,i)=>i%2?part:part.replace(/\[\[([^\]\n]+)\]\]/g,(full,inside:string)=>{const [name,...alias]=inside.split('|');return normalizeTitle(name)===normalizeTitle(note.title)?`[[${title}${alias.length?'|'+alias.join('|'):''}]]`:full})).join('');
 return {...store,brain:{...b,ideas:b.ideas.map(x=>x.workspaceId!==workspace?x:{...x,title:x.id===id?title:x.title,notes:replace(x.notes),updatedAt:x.id===id?new Date().toISOString():x.updatedAt})},collections:{...store.collections,...Object.fromEntries((['subjects','studies'] as const).map(k=>[k,store.collections[k].map(x=>(x.workspaceId||'pessoal')===workspace?{...x,notes:replace(String(x.notes||''))}:x)]))},study:{...store.study,plans:(store.study?.plans||[]).map(x=>x.workspaceId===workspace?{...x,notes:replace(x.notes)}:x),cards:(store.study?.cards||[]).map(x=>x.workspaceId===workspace?{...x,back:replace(x.back)}:x),exams:(store.study?.exams||[]).map(x=>x.workspaceId===workspace?{...x,notes:replace(x.notes)}:x)}};
}
