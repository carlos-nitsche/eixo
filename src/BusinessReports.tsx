import {useMemo,useState} from 'react';
import {Activity,ArrowDown,ArrowRight,ArrowUp,BarChart3,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Download,FileSpreadsheet,FileText,Filter,Package,Printer,Search,ShieldCheck,TrendingUp,Wallet} from 'lucide-react';
import type {ERPData} from './erp';
import {reportCatalog,buildBusinessReport} from './business-reports';
import type {ReportCell,ReportColumn,ReportId,ReportKpi,ReportRow,ReportSection,ReportResult} from './business-reports';
import './business-reports.css';
type Props={data:ERPData;workspaceId:string;workspaceTitle:string;clients:{id:string;title:string}[]};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const percentage=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const abbr=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1});
const dday=(x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x;
const format=(x:ReportCell,kind?:ReportColumn['kind']):string=>{
 if(kind==='currency')return currency.format(Number(x)||0);
 if(kind==='number')return number.format(Number(x)||0);
 if(kind==='percent')return percentage.format(Number(x)||0)+'%';
 if(kind==='date')return dday(String(x));
 return String(x??'—');
};
const todaySP=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const minusDays=(date:string,days:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10)};
const monthFirst=(day:string)=>day.slice(0,7)+'-01';
const sanitizeCSV=(v:string)=>/^\-\d+(?:[.,]\d+)?$/.test(v.trim())?v:/^[\s\u0000-\u001f]*[=+\-@]/.test(v)?"'"+v:v;
function exportCsv(report:ReportResult,rows:ReportRow[],company:string){
 const quotes=(v:string)=>'"'+sanitizeCSV(v).replace(/"/g,'""')+'"';
 const body=[['EIXO · '+report.title],['Empresa',company],['Tipo',report.section],['Período',report.periodType==='snapshot'?'Posição atual':dday(report.from)+' a '+dday(report.to)],['Observação',report.note],[],report.columns.map(x=>x.label),...rows.map(r=>r.cells.map((x,i)=>typeof x==='number'&&report.columns[i]?.kind!=='text'?String(x).replace('.',','):String(x??'')))];
 const csv='\ufeff'+body.map(items=>items.map(x=>quotes(String(x))).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');
 a.href=url;a.download='eixo-relatorio-'+report.id+'-'+report.to+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const ascii=(text:string)=>text.replace(/[–—]/g,'-').replace(/[•·]/g,'-').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,'');
async function exportPdf(report:ReportResult,rows:ReportRow[],company:string){
 const {jsPDF}=await import('jspdf');
 const landscape=report.columns.length>=6;const pdf=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true});
 const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight(),M=15,usable=W-M*2;
 const ink:[number,number,number]=[25,35,49],slate:[number,number,number]=[95,108,124],edge:[number,number,number]=[224,228,234];
 let page=1,y=0;
 const text=(s:string,x:number,yy:number,size=9,color=ink,weight:'normal'|'bold'='normal')=>{pdf.setFont('helvetica',weight);pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(ascii(s),x,yy)};
 const header=()=>{
  pdf.setFillColor(...ink);pdf.rect(0,0,W,22,'F');
  text('EIXO',M,12,17,[255,255,255],'bold');text('RELATÓRIOS / GESTÃO EMPRESARIAL',M+29,11.3,8,[205,216,228]);
  text(report.title,M,33,16,ink,'bold');text(company,M,41,10,slate);
  text(report.periodType==='snapshot'?'POSICAO ATUAL':dday(report.from)+'  A  '+dday(report.to),W-M,41,8,slate);
  pdf.setDrawColor(...edge);pdf.line(M,46,W-M,46);y=52;
 };
 const footer=()=>{pdf.setDrawColor(...edge);pdf.line(M,H-17,W-M,H-17);text('EIXO  |  Relatorio gerencial - nao fiscal',M,H-10,7,slate);text('Pagina '+page,W-M-25,H-10,7,slate)};
 const next=()=>{footer();pdf.addPage();page++;header()};
 header();
 const cards=report.kpis.slice(0,4);
 const gap=3,cardW=(usable-(cards.length-1)*gap)/Math.max(cards.length,1);
 for(const [i,k] of cards.entries()){
  const x=M+i*(cardW+gap);pdf.setFillColor(246,248,251);pdf.roundedRect(x,y,cardW,26,2,2,'F');
  text(k.label.slice(0,30),x+3,y+8,8,slate,'bold');
  const v=format(k.value,k.kind);let size=13;while(size>8&&pdf.getTextWidth(ascii(v))>cardW-6){size-=1;pdf.setFontSize(size)}
  text(v,x+3,y+19,size,ink,'bold');
 }
 y+=34;
 if(report.trend.length){
  const items=report.trend.slice(-Math.min(18,report.trend.length));const max=Math.max(1,...items.map(e=>Math.max(e.value,e.second||0)));
  text('EVOLUCAO E COMPARATIVOS',M,y+2,9,ink,'bold');y+=9;
  const plotH=31,barW=(usable-1)/items.length;
  for(const [i,item] of items.entries()){
   const x=M+i*barW,base=y+plotH;pdf.setFillColor(237,241,246);pdf.rect(x,base-plotH,Math.max(2,barW-1),plotH,'F');
   const widths=item.second===undefined?[Math.max(2,barW-2)]:[Math.max(1,(barW-2)/2),Math.max(1,(barW-2)/2)];
   pdf.setFillColor(54,80,112);pdf.rect(x,base-item.value/max*plotH,widths[0],item.value/max*plotH,'F');
   if(item.second!==undefined){pdf.setFillColor(161,176,194);pdf.rect(x+widths[0]+.2,base-item.second/max*plotH,widths[1],item.second/max*plotH,'F')}
   if(i%Math.max(1,Math.ceil(items.length/6))===0)text(item.label.slice(0,12),x,base+5,6,slate);
  }
  y+=plotH+14;
 }
 const noteLines=pdf.splitTextToSize(ascii(report.note),usable);
 if(y+noteLines.length*3.7+24>H-20)next();
 text('CRITÉRIOS DO RELATÓRIO',M,y,8,ink,'bold');y+=5;
 pdf.setFont('helvetica','normal');pdf.setFontSize(7.2);pdf.setTextColor(...slate);pdf.text(noteLines,M,y);y+=noteLines.length*3.6+9;
 text('DETALHAMENTO  -  '+rows.length+' REGISTROS',M,y,9,ink,'bold');y+=7;
 const count=report.columns.length;
 const ratios=report.columns.map(c=>c.kind==='currency'?1.05:c.kind==='text'?1.42:c.kind==='date'?.8:.85);
 const sumRatios=ratios.reduce((a,b)=>a+b,0);const widths=ratios.map(v=>v/sumRatios*usable);
 const tableHead=()=>{
  pdf.setFillColor(...ink);pdf.rect(M,y,usable,9,'F');
  let x=M;for(let i=0;i<count;i++){text(report.columns[i].label.slice(0,35),x+2,y+5.7,7,[255,255,255],'bold');x+=widths[i]}
  y+=9;
 };
 if(y+26>H-21)next();tableHead();
 for(const [index,r] of rows.entries()){
  const str=r.cells.map((cell,i)=>format(cell,report.columns[i]?.kind));const fields=str.map((s,i)=>pdf.splitTextToSize(ascii(s),Math.max(8,widths[i]-4)).slice(0,3));
  const height=Math.max(8,...fields.map(a=>a.length*3.5+2));
  if(y+height>H-22){next();tableHead()}
  if(index%2===0){pdf.setFillColor(246,248,251);pdf.rect(M,y,usable,height,'F')}
  let x=M;for(let i=0;i<count;i++){pdf.setFont('helvetica',i===0?'bold':'normal');pdf.setFontSize(7);pdf.setTextColor(...ink);pdf.text(fields[i],x+2,y+5,{lineHeightFactor:1.2});x+=widths[i]}
  pdf.setDrawColor(...edge);pdf.line(M,y+height,W-M,y+height);y+=height;
 }
 if(!rows.length){text('Nenhum registro encontrado para os filtros selecionados.',M,y+7,9,slate);y+=16}
 footer();
 pdf.save('eixo-relatorio-'+report.id+'-'+report.to+'.pdf');
}
const sectionGroups:ReportSection[]=['Comercial','Financeiro','Estoque','Relacionamento'];
const sectionIcons={Comercial:TrendingUp,Financeiro:Wallet,Estoque:Package,Relacionamento:Activity};
const showKpi=(x:ReportKpi)=>format(x.value,x.kind);
export default function BusinessReports({data,workspaceId,workspaceTitle,clients}:Props){
 const now=todaySP();const [reportId,setReportId]=useState<ReportId>('vendas');
 const [section,setSection]=useState<'Todos'|ReportSection>('Todos');
 const [findReport,setFindReport]=useState(''),[quick,setQuick]=useState('90');
 const [from,setFrom]=useState(minusDays(now,89)),[to,setTo]=useState(now);
 const [query,setQuery]=useState(''),[sort,setSort]=useState<{index:number;desc:boolean}|null>(null);
 const [page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [showCatalog,setShowCatalog]=useState(false);
 const selected=reportCatalog.find(x=>x.id===reportId)!;
 const validDates=from<=to&&/^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to);
 const report=useMemo(()=>validDates?buildBusinessReport({data,workspaceId,clients,from,to,today:now,id:reportId}):null,[data,workspaceId,clients,from,to,now,reportId,validDates]);
 const visibleReports=reportCatalog.filter(x=>(section==='Todos'||x.section===section)&&(''+x.title+' '+x.description).normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g,'').includes(findReport.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g,'')));
 const selectedRows=useMemo(()=>{
  if(!report)return [];
  const q=query.trim().normalize('NFD').toLocaleLowerCase('pt-BR').replace(/[\u0300-\u036f]/g,'');
  const rows=q?report.rows.filter(r=>r.cells.some((cell,i)=>format(cell,report.columns[i]?.kind).normalize('NFD').toLocaleLowerCase('pt-BR').replace(/[\u0300-\u036f]/g,'').includes(q))):report.rows;
  if(!sort)return rows;
  return [...rows].sort((a,b)=>{const av=a.cells[sort.index],bv=b.cells[sort.index];const kind=report.columns[sort.index]?.kind;const comp=kind==='currency'||kind==='number'||kind==='percent'?(Number(av)||0)-(Number(bv)||0):String(av).localeCompare(String(bv),'pt-BR',{numeric:true});return (sort.desc?-1:1)*comp});
 },[report,query,sort]);
 const count=Math.max(1,Math.ceil(selectedRows.length/25)),current=Math.max(1,Math.min(page,count)),table=selectedRows.slice((current-1)*25,current*25);
 const choose=(id:ReportId)=>{setReportId(id);setPage(1);setQuery('');setSort(null);setError('');setShowCatalog(false)};
 const preset=(v:string)=>{
  setQuick(v);let a=now;
  if(v==='7')a=minusDays(now,6);
  else if(v==='30')a=minusDays(now,29);
  else if(v==='90')a=minusDays(now,89);
  else if(v==='365')a=now.slice(0,4)+'-01-01';
  else if(v==='month')a=monthFirst(now);
  if(v!=='custom'){setFrom(a);setTo(now);setPage(1)}
 };
 const pdf=async()=>{if(!report||busy)return;setBusy(true);setError('');try{await exportPdf(report,selectedRows,workspaceTitle)}catch(e){setError(e instanceof Error?e.message:'Não foi possível exportar o PDF.')}finally{setBusy(false)}};
 return <div className="br-shell">
  <div className="br-header"><div><div className="br-overline"><FileText size={13}/> EIXO / BUSINESS INTELLIGENCE</div><h2>Central de relatórios</h2><p>Informações organizadas para apoiar decisões, acompanhamento e prestação de contas.</p></div><span className="br-report-count"><ShieldCheck size={17}/>{reportCatalog.length} modelos disponíveis</span></div>
  <div className="br-body">
   <aside className={'br-catalog '+(showCatalog?'br-catalog-open':'')} aria-label="Catálogo de relatórios">
    <label className="br-search br-search-catalog"><Search size={16}/><input placeholder="Buscar relatórios..." value={findReport} onChange={e=>setFindReport(e.target.value)}/></label>
    <div className="br-section-filters"><button className={section==='Todos'?'selected':''} onClick={()=>setSection('Todos')}>Todos</button>{sectionGroups.map(s=><button key={s} className={section===s?'selected':''} onClick={()=>setSection(s)}>{s}</button>)}</div>
    {sectionGroups.map(group=>{
     const items=visibleReports.filter(x=>x.section===group),Icon=sectionIcons[group];
     return items.length?<section key={group} className="br-catalog-section"><h3><Icon size={14}/>{group}<small>{items.length}</small></h3>{items.map(it=><button key={it.id} className={'br-catalog-item '+(reportId===it.id?'selected':'')} onClick={()=>choose(it.id)} aria-current={reportId===it.id?'page':undefined}><span><strong>{it.title}</strong><small>{it.description}</small></span><ArrowRight size={14}/></button>)}</section>:null;
    })}
    {visibleReports.length===0&&<p className="br-catalog-empty">Nenhum modelo encontrado.</p>}
   </aside>
   <div className="br-main">
    <div className="br-titlebar"><button className="br-catalog-toggle" onClick={()=>setShowCatalog(x=>!x)} aria-expanded={showCatalog}><Filter size={15}/> Catálogo de relatórios</button><div><div className="br-subhead">{selected.section} / {selected.periodType==='snapshot'?'Posição atual':selected.periodType==='due'?'Por vencimento':'Por período'}</div><h3>{selected.title}</h3><p>{selected.description}</p></div></div>
    <section className="br-filters"><div className="br-filter-heading"><CalendarDays size={16}/><strong>Período e filtros</strong><span>{selected.periodType==='snapshot'?'Estoque e posição na data atual':selected.periodType==='due'?'Filtro pela data de vencimento':'Filtro pela data de lançamento'}</span></div>
     {selected.periodType!=='snapshot'?<><div className="br-shortcuts" role="group" aria-label="Atalhos de período">{[['7','7 dias'],['30','30 dias'],['90','90 dias'],['month','Este mês'],['365','Este ano'],['custom','Personalizado']].map(([id,label])=><button key={id} aria-pressed={quick===id} className={quick===id?'selected':''} onClick={()=>preset(id)}>{label}</button>)}</div><div className="br-dates"><label>Data inicial<input type="date" value={from} max={to} onChange={e=>{setFrom(e.target.value);setQuick('custom');setPage(1)}}/></label><label>Data final<input type="date" value={to} min={from} onChange={e=>{setTo(e.target.value);setQuick('custom');setPage(1)}}/></label></div></>:<p className="br-static-note">Este relatório apresenta o saldo atual do estoque da empresa selecionada; não reconstrói saldos históricos.</p>}
    </section>
    {!report?<div className="br-error">Confira as datas de início e fim do relatório.</div>:<>
    <div className="br-kpis">{report.kpis.map(k=><article key={k.label} className="br-kpi"><span>{k.label}</span><strong>{showKpi(k)}</strong>{k.note&&<small>{k.note}</small>}</article>)}</div>
    {report.trend.length>0&&<section className="br-chart-card"><div className="br-card-head"><div><h4>Evolução e distribuição</h4><p>{report.trend.length>12?'Últimos 12 pontos · detalhes completos na tabela':'Visualização dos dados do período selecionado'}</p></div><BarChart3 size={18}/></div><div className="br-chart" role="img" aria-label="Gráfico de valores por período ou categoria">{(()=>{const bars=report.trend.slice(-12),max=Math.max(1,...bars.flatMap(b=>[b.value,b.second||0]));return bars.map((b,i)=><div className="br-bar-col" key={i} title={b.label+' · '+currency.format(b.value)+(b.second!==undefined?' / '+currency.format(b.second):'')}><div className="br-bars"><i style={{height:b.value?Math.max(2,b.value/max*100)+'%':0}}/><i className={b.second!==undefined?'br-bar-second':'br-bar-empty'} style={{height:b.second?Math.max(2,b.second/max*100)+'%':0}}/></div><small>{b.label.length>14?b.label.slice(0,12)+'…':b.label}</small></div>)})()}</div></section>}
    <section className="br-results"><div className="br-card-head br-results-header"><div><h4>Detalhamento</h4><p>{selectedRows.length.toLocaleString('pt-BR')} registro(s){query?' encontrados pela busca':''} · {report.rows.length.toLocaleString('pt-BR')} no relatório</p></div><div className="br-exports"><button onClick={()=>exportCsv(report,selectedRows,workspaceTitle)}><FileSpreadsheet size={16}/> Exportar CSV</button><button className="br-pdf" disabled={busy} onClick={()=>void pdf()}><FileText size={16}/> {busy?'Gerando PDF…':'Exportar PDF'}</button></div></div>
     <div className="br-result-search"><label className="br-search"><Search size={16}/><input aria-label="Buscar nos registros" placeholder="Buscar em todos os campos..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label><small>Busca filtra apenas linhas da tabela. Os indicadores representam o período completo.</small></div>
     {error&&<p className="br-error" role="alert">{error}</p>}
     {table.length?<div className="br-table-scroll" tabIndex={0} aria-label="Tabela detalhada do relatório"><table><thead><tr>{report.columns.map((c,index)=><th key={c.key}><button onClick={()=>setSort(s=>s?.index===index?{index,desc:!s.desc}:{index,desc:false})}>{c.label}{sort?.index===index?(sort.desc?<ArrowDown size={12}/>:<ArrowUp size={12}/>):null}</button></th>)}</tr></thead><tbody>{table.map(r=><tr key={r.id}>{r.cells.map((cell,index)=><td key={index} className={['currency','number','percent'].includes(report.columns[index]?.kind||'')?'br-cell-number':''}>{format(cell,report.columns[index]?.kind)}</td>)}</tr>)}</tbody></table></div>:<div className="br-empty"><CheckCircle2 size={23}/><strong>Nenhum registro neste período</strong><p>Altere os filtros ou registre novas operações no EIXO.</p></div>}
     <div className="br-results-footer"><span>Mostrando {table.length?((current-1)*25+1).toLocaleString('pt-BR'):0}–{((current-1)*25+table.length).toLocaleString('pt-BR')} de {selectedRows.length.toLocaleString('pt-BR')}</span><div><button disabled={current<=1} onClick={()=>setPage(x=>Math.max(1,x-1))} aria-label="Página anterior"><ChevronLeft size={17}/></button><span>Página {current} de {count}</span><button disabled={current>=count} onClick={()=>setPage(x=>x+1)} aria-label="Próxima página"><ChevronRight size={17}/></button></div></div>
    </section><div className="br-footnote"><ShieldCheck size={17}/><p><strong>Critérios e limitações</strong> — {report.note} Os dados são sempre restritos à empresa ativa; relatórios não emitem documentos fiscais ou atualizam saldos.</p></div>
    </>}
   </div>
  </div>
 </div>;
}
