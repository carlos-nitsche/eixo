import {Fragment} from 'react';
import type {ReactNode} from 'react';
export const noteOutline=(text:string)=>{let code=false;return text.split('\n').flatMap((line,index)=>{if(line.trim().startsWith('```')){code=!code;return []}const h=!code&&line.match(/^(#{1,6})\s+(.+)/);return h?[{id:'note-heading-'+index,level:h[1].length,title:h[2]}]:[]})};
export default function StudyMarkdown({text,onWiki,exists,onTask}:{text:string;onWiki:(title:string)=>void;exists:(title:string)=>boolean;onTask?:(line:number)=>void}){
 const inline=(text:string):ReactNode[]=>text.split(/(\[\[[^\]\n]+\]\]|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{
  if(part.startsWith('[[')){const [target,alias]=part.slice(2,-2).split('|');return <button key={i} className={'sn-wikilink '+(exists(target.trim())?'':'unresolved')} onClick={()=>onWiki(target.trim())} title={exists(target.trim())?'Abrir referência':'Criar nota vinculada'}>{alias||target}</button>}
  if(part.startsWith('`')&&part.endsWith('`')&&part.length>1)return <code key={i}>{part.slice(1,-1)}</code>;
  if(part.startsWith('**')&&part.endsWith('**')&&part.length>4)return <strong key={i}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('~~')&&part.endsWith('~~')&&part.length>4)return <del key={i}>{part.slice(2,-2)}</del>;
  if(part.startsWith('*')&&part.endsWith('*')&&part.length>2)return <em key={i}>{part.slice(1,-1)}</em>;
  const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);if(link)return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
  return part;
 });
 const lines=text.split('\n'),out:ReactNode[]=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(line.trim().startsWith('```')){const start=i,lang=line.trim().slice(3);const code=[];while(++i<lines.length&&!lines[i].trim().startsWith('```'))code.push(lines[i]);out.push(<pre key={start}><small>{lang||'código'}</small><code>{code.join('\n')}</code></pre>);continue}
  const heading=line.match(/^(#{1,6})\s+(.+)/);if(heading){const Tag=('h'+heading[1].length) as 'h1';out.push(<Tag key={i} id={'note-heading-'+i}>{inline(heading[2])}</Tag>);continue}
  const task=line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)/);if(task){const index=i;out.push(<label key={i} className="sn-task"><input type="checkbox" checked={task[1]!==' '} disabled={!onTask} onChange={()=>onTask?.(index)}/><span>{inline(task[2])}</span></label>);continue}
  if(/^\s*([-*_])\1\1+\s*$/.test(line)){out.push(<hr key={i}/>);continue}
  if(line.startsWith('> ')){out.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);continue}
  const bullet=line.match(/^\s*([-*]|\d+\.)\s+(.*)/);if(bullet){out.push(<div key={i} className="sn-list-line"><span>{bullet[1]==='-'||bullet[1]==='*'?'•':bullet[1]}</span><div>{inline(bullet[2])}</div></div>);continue}
  out.push(line.trim()?<p key={i}>{inline(line)}</p>:<div className="sn-markdown-space" key={i}/>);
 }
 return <div className="sn-markdown">{out.length?out.map((line,i)=><Fragment key={i}>{line}</Fragment>):<p>Sua próxima descoberta começa aqui.</p>}</div>
}
