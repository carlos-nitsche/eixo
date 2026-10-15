// EIXO OS — TypeScript module: workspace-scoped universal search (browser + Node tests).
import type {Collection,Entry,Store} from './model';

export type WorkspaceSearchResult={kind:Collection;item:Entry;score:number};
export const normalizeSearch=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();

export function searchWorkspaceRecords(
 collections:Store['collections'],
 allowed:readonly Collection[],
 workspaceId:string,
 query:string,
 limit=12
):WorkspaceSearchResult[]{
 const needle=normalizeSearch(query);
 if(!needle||needle.length>160||limit<=0)return [];
 const seen=new Set<string>(),matches:WorkspaceSearchResult[]=[];
 for(const kind of allowed){
  for(const item of collections[kind]||[]){
   // Company names may be listed to select another workspace, but customer and financial
   // records must never appear outside the currently active workspace.
   if(kind!=='businesses'&&(item.workspaceId||'pessoal')!==workspaceId)continue;
   const title=normalizeSearch(item.title),category=normalizeSearch(item.category);
   const start=title.startsWith(needle),contains=title.includes(needle),categoryMatches=category.includes(needle);
   if(!start&&!contains&&!categoryMatches)continue;
   const key=kind+':'+item.id;
   if(seen.has(key))continue;
   seen.add(key);
   matches.push({kind,item,score:start?3:contains?2:1});
  }
 }
 return matches.sort((a,b)=>b.score-a.score||a.item.title.localeCompare(b.item.title,'pt-BR')).slice(0,Math.min(limit,50));
}
