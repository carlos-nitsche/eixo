// EIXO OS 0.7 · Portuguese local intent parser; browser/Node; no external APIs.
import type {Collection,Entry} from './model';

export type AssistantKind=Extract<Collection,'events'|'tasks'|'transactions'|'studies'>;
export type Draft={kind:AssistantKind;fields:Record<string,string|number>;workspaceId:string;missing:string[]};
export type Result={type:'draft';draft:Draft;reply:string}|{type:'reply';reply:string}|{type:'unknown';reply:string};
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const weekdays=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const clean=(s:string)=>s.replace(/\s+/g,' ').trim().replace(/^[\s,.:;!\-]+|[\s,.:;!\-]+$/g,'');
const iso=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dayAdd=(now:Date,offset:number)=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);d.setDate(d.getDate()+offset);return iso(d)};
const isDate=(s:string)=>{const d=new Date(s+'T12:00:00');return Number.isFinite(d.getTime())&&iso(d)===s};
export const labelField=(key:string):string=>({title:'o que devo registrar',date:'a data',time:'o horário',amount:'o valor em reais',duration:'a duração em minutos'} as Record<string,string>)[key]||key;
export const draftPreview=(d:Draft):string=>{
 const f=d.fields;
 const text=[String(f.title||'Sem descrição')];
 if(f.date)text.push('Data: '+String(f.date));
 if(f.dueDate)text.push('Prazo: '+String(f.dueDate));
 if(f.time)text.push('Horário: '+String(f.time));
 if(f.amount!==undefined)text.push('Valor: '+Number(f.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
 if(f.duration!==undefined)text.push('Duração: '+String(f.duration)+' min');
 if(f.category)text.push('Categoria: '+String(f.category));
 if(f.type)text.push('Tipo: '+String(f.type));
 return text.join(' · ');
};
export function parseDate(text:string,now:Date):string|undefined{
 const normalized=normalize(text);
 const numeric=normalized.match(/\b(?:dia\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
 if(numeric){
  const day=Number(numeric[1]),month=Number(numeric[2]);
  let year=numeric[3]?Number(numeric[3]):now.getFullYear();
  if(year<100)year+=2000;
  let candidate=[year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
  if(!numeric[3]&&isDate(candidate)&&candidate<iso(now))candidate=[year+1,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
  return isDate(candidate)?candidate:undefined;
 }
 const explicit=normalized.match(/\b(?:dia\s+)?(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?\b/);
 if(explicit){
  let year=explicit[3]?Number(explicit[3]):now.getFullYear();
  const month=months.indexOf(explicit[2])+1;
  let candidate=[year,String(month).padStart(2,'0'),String(Number(explicit[1])).padStart(2,'0')].join('-');
  if(!explicit[3]&&isDate(candidate)&&candidate<iso(now))candidate=[year+1,String(month).padStart(2,'0'),String(Number(explicit[1])).padStart(2,'0')].join('-');
  return isDate(candidate)?candidate:undefined;
 }
 if(/\bdepois\s+de\s+amanha\b/.test(normalized))return dayAdd(now,2);
 if(/\bamanha\b/.test(normalized))return dayAdd(now,1);
 if(/\bhoje\b/.test(normalized))return dayAdd(now,0);
 const week=normalized.match(/\b(proxim[ao]\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/);
 if(week){
  const target=weekdays.indexOf(week[2]);let gap=(target-now.getDay()+7)%7;
  if(gap===0||week[1]&&gap<7)gap+=7;
  return dayAdd(now,gap);
 }
 const numericDay=normalized.match(/\bdia\s+(\d{1,2})(?![\/\d])\b/);
 if(numericDay){
  const n=Number(numericDay[1]);const month=now.getMonth();const year=now.getFullYear();
  let d=new Date(year,month,n,12);
  if(d.getDate()!==n||d.getMonth()!==month)return undefined;
  if(d<new Date(year,month,now.getDate(),12))d=new Date(year,month+1,n,12);
  return d.getDate()===n?iso(d):undefined;
 }
}
export function parseTime(text:string):string|undefined{
 const n=normalize(text);
 const match=n.match(/\b(?:as|pelas|para\s+as|a\s+partir\s+das)?\s*(\d{1,2})\s*(?:h|:)(\d{2})?\b/)||
 n.match(/\b(?:as|pelas|horario\s+(?:para\s+)?|hora\s+(?:para\s+)?)(\s+)?(\d{1,2})\s*(?:horas?)?\b/);
 if(!match){
  const words:Record<string,number>={zero:0,uma:1,um:1,duas:2,dois:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,'vinte e um':21,'vinte e dois':22,'vinte e tres':23};
  const spoken=n.match(/\b(?:as|pelas|para as|horario para)\s+(vinte e (?:um|dois|tres)|quatorze|catorze|dezesseis|dezessete|dezoito|dezenove|quinze|treze|doze|onze|vinte|zero|uma?|duas?|tres|quatro|cinco|seis|sete|oito|nove|dez)\s*(?:horas?)?\b/);
  if(!spoken)return;
  return String(words[spoken[1]]).padStart(2,'0')+':00';
 }
 const h=Number(match[3]||match[1]),m=match[3]?0:match[2]?Number(match[2]):0;
 return h>=0&&h<=23&&m>=0&&m<=59?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'):undefined;
}
export function parseAmount(text:string):number|undefined{
 const n=normalize(text);
 const match=n.match(/(?:r\$\s*|\b(?:de|por|para|valor|custou|gastei|recebi|paguei|ganhei|entrou|quantia|preco)\s+)([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\b/);
 if(!match)return undefined;
 const raw=match[1];const cleanNumber=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
 const value=Math.round(Number(cleanNumber)*100)/100;
 return Number.isFinite(value)&&value>0&&value<=100000000?value:undefined;
}
const removeDates=(s:string)=>s
 .replace(/(?:^|\s)(?:depois\s+de\s+amanh[aã]|amanh[aã]|hoje|pr[oó]xim[ao]\s+(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?|(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?)(?=\s|[,!?]|$)/gi,' ')
 .replace(/\b(?:dia\s+)?\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g,' ')
 .replace(/\b(?:dia\s+)?\d{1,2}\s+de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+\d{4})?\b/gi,' ')
 .replace(/\bdia\s+\d{1,2}\b/gi,' ')
 .replace(/(?:^|\s)(?:(?:às|as|pelas|para\s+as|a\s+partir\s+das)\s+)?\d{1,2}\s*(?:h|:)\d{0,2}(?=\s|[,!?]|$)/gi,' ')
 .replace(/(?:^|\s)(?:às|as|pelas)\s+\d{1,2}(?=\s|[,!?]|$)/gi,' ')
 .replace(/(?:^|\s)(?:às|as|pelas)\s+(?:vinte\s+e\s+(?:um|dois|tr[eê]s)|(?:zero|uma?|duas?|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte))\s*(?:horas?)?(?=\s|[,!?]|$)/gi,' ');
const moneyRemoved=(s:string)=>s.replace(/(?:r\$\s*|\b(?:de|por|valor|custou|gastei|recebi|paguei|ganhei|entrou)\s+)(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\b/gi,' ');
export function inferKind(text:string):AssistantKind|undefined{
 const n=normalize(text);
 if(/\b(?:agend|marc|consulta|reuniao|compromisso|evento|horario)\w*/.test(n))return 'events';
 if(/\b(?:tarefa|lembre|lembrar|lembrete|preciso\s+(?:fazer|entregar|comprar)|lista\s+de\s+afazeres|pendencia)\b/.test(n))return 'tasks';
 if(/\b(?:estudei|estudar|estudo\s+de|sessao\s+de\s+estudo|tempo\s+de\s+estudo)\b/.test(n))return 'studies';
 if(/\b(?:gastei|paguei|comprei|recebi|ganhei|entrou|despesa|receita|lancamento|registra\w*\s+(?:um\s+)?(?:gasto|pagamento))\b/.test(n))return 'transactions';
}
const description=(text:string,kind:AssistantKind)=>{
 let s=removeDates(text);
 if(kind==='transactions')s=moneyRemoved(s)
 .replace(/\b(?:gastei|paguei|comprei|recebi|ganhei|entrou|registra\w*|anota\w*|adiciona\w*|lan[cç]a\w*|uma?|despesa|receita|gasto|pagamento|no|na|com|em|de|do|da|pelo|pela)\b/gi,' ');
 if(kind==='events')s=s.replace(/\b(?:agend\w*|mar[qc]\w*|coloc\w*|registr\w*|adicion\w*|cri\w*|um|uma|me|pra|para|no|na|o|a|evento|compromisso|hor[aá]rio)\b/gi,' ');
 if(kind==='tasks')s=s.replace(/\b(?:cri\w*|adicion\w*|anot\w*|registr\w*|lembre|lembrar|lembrete|tarefa|preciso|fazer|me|para|pra|um|uma|de|que|eu)\b/gi,' ');
 if(kind==='studies')s=s.replace(/\b(?:registr\w*|anot\w*|estudei|estudar|estudo|uma?|de|e|por|durante|tempo|sess[aã]o|minutos?|mins?|horas?|hoje)\b/gi,' ').replace(/\b\d+(?:[.,]\d+)?\b/g,' ');
 s=clean(s);
 if(s.length>130)s=s.slice(0,130).trimEnd();
 return s;
};
const detectDuration=(text:string)=>{
 const n=normalize(text);
 const h=n.match(/\b(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?)\b/);
 const m=n.match(/\b(\d+)\s*(?:minutos?|mins?)\b/);
 let total=0;
 if(h)total+=Number(h[1].replace(',','.'))*60;
 if(m)total+=Number(m[1]);
 return Number.isInteger(total)&&total>=1&&total<=1440?total:undefined;
};
export function fillDraft(draft:Draft,input:string,now=new Date()):Draft{
 const fields={...draft.fields};
 const date=parseDate(input,now),time=parseTime(input),amount=parseAmount(input),duration=detectDuration(input);
 if(draft.kind==='events'){if(date)fields.date=date;if(time)fields.time=time}
 if(draft.kind==='tasks'&&date)fields.dueDate=date;
 if(draft.kind==='transactions'){if(date)fields.date=date;if(amount!==undefined)fields.amount=amount}
 if(draft.kind==='studies'){if(date)fields.date=date;if(duration!==undefined)fields.duration=duration}
 const titleCorrection=input.match(/^(?:(?:mude|muda|troque|troca|altere|altera|corrija|corrige)\s+)?(?:(?:o|a)\s+)?(?:nome|t[ií]tulo|descri[cç][aã]o)\s+(?:para\s+|pra\s+|[eé]\s+|ser\s+)?(.+)$/i);
 if(titleCorrection&&titleCorrection[1]?.trim().length>=2)fields.title=clean(titleCorrection[1]).slice(0,130);
 if(!fields.title&&input.trim()){
  const title=description(input,draft.kind);
  if(title&&title.length>=2&&!/^\d+$/.test(title))fields.title=title;
 }
 if(draft.kind==='transactions'&&!fields.date)fields.date=iso(now);
 if(draft.kind==='studies'&&!fields.date)fields.date=iso(now);
 const required=draft.kind==='events'?['title','date','time']:draft.kind==='tasks'?['title']:draft.kind==='transactions'?['title','amount']:['title','duration'];
 return {...draft,fields,missing:required.filter(k=>fields[k]===undefined||fields[k]==='')};
}
const category=(text:string)=>{
 const n=normalize(text);
 if(/mercado|supermercado|almoco|janta|restaurante|lanche|comida|cafe|padaria/.test(n))return 'Alimentação';
 if(/aluguel|condominio|energia|luz|agua|internet|casa/.test(n))return 'Moradia';
 if(/uber|combustivel|gasolina|onibus|transporte|posto/.test(n))return 'Transporte';
 if(/farmacia|remedio|medico|consulta|hospital/.test(n))return 'Saúde';
 if(/academia|suplemento|treino/.test(n))return 'Academia';
 if(/faculdade|curso|livro|educacao/.test(n))return 'Educação';
 if(/salario|pagamento\s+do\s+trabalho/.test(n))return 'Salário';
 if(/venda|cliente/.test(n))return 'Vendas';
 if(/cinema|jogo|bar|show|lazer/.test(n))return 'Lazer';
 return 'Outros';
};
const kindLabel=(kind:AssistantKind)=>({events:'compromisso',tasks:'tarefa',transactions:'lançamento financeiro',studies:'sessão de estudo'})[kind];
export function interpretAssistant(text:string,workspaceId:string,now=new Date(),existing?:Draft,records?:{tasks:Entry[];events:Entry[];transactions:Entry[]}):Result{
 const input=clean(text.slice(0,800));
 if(!input)return {type:'unknown',reply:'Escreva o que deseja organizar.'};
 const n=normalize(input);
 if(existing){
  if(/^(cancelar|cancela|desistir|esquece|nao|não)$/i.test(input))return {type:'reply',reply:'Tudo bem, descartei a solicitação.'};
  if(/^(?:novo pedido|come[cç]ar de novo|reiniciar|outra coisa)$/i.test(input))return {type:'reply',reply:'Sem problemas. O rascunho anterior foi descartado. O que deseja fazer agora?'};
  const next=fillDraft(existing,input,now);
  return {type:'draft',draft:next,reply:next.missing.length?'Só falta '+next.missing.map(labelField).join(' e ')+'.':'Confira os dados antes de confirmar.'};
 }
 if(/^(oi|ola|ol[aá]|bom dia|boa tarde|boa noite|ajuda|o que voce faz|comandos|exemplos)[!?\s.]*$/.test(n))return {type:'reply',reply:'Sou o Assistente EIXO, funcionando localmente. Posso agendar compromissos, criar tarefas, registrar despesas e receitas ou sessões de estudo. Também posso resumir seu dia. Sempre confirmo antes de salvar.'};
 if(records&&/\b(?:quanto|qual|meu|mostre|mostrar|resumo|total)\b/.test(n)&&/\b(?:gastei|gastos|despesas|recebi|receitas|ganhei|saldo|financeiro)\b/.test(n)){
  const month=iso(now).slice(0,7),money=(x:number)=>x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const active=records.transactions.filter(x=>(x.workspaceId||'pessoal')===workspaceId&&String(x.date||'').startsWith(month+'-'));
  const sum=(type:string)=>active.filter(x=>x.type===type).reduce((v,x)=>v+(Number.isFinite(Number(x.amount))?Math.max(0,Number(x.amount)):0),0);
  const income=sum('Receita'),expenses=sum('Despesa');
  return {type:'reply',reply:'Seu financeiro de '+month.slice(5)+'/'+month.slice(0,4)+':\nEntradas: '+money(income)+'\nDespesas: '+money(expenses)+'\nSaldo: '+money(income-expenses)+'.\nDados do espaço atual.'};
 }
 if(/\b(?:o que|quais|resum|me mostra|mostr|tenho|minha agenda|penden)\w*.*\b(?:hoje|amanha|tarefas|compromissos|agenda|dia)\b|\b(?:resumo do dia|minhas tarefas)\b/.test(n)){
  if(!records)return {type:'reply',reply:'Abra a Central Meu Dia para ver seu planejamento.'};
  const date=parseDate(input,now)||iso(now);
  const scoped=(rows:Entry[])=>rows.filter(r=>(r.workspaceId||'pessoal')===workspaceId);
  const tasks=scoped(records.tasks).filter(r=>r.status!=='Concluído'&&r.dueDate===date);
  const events=scoped(records.events).filter(r=>r.date===date);
  return {type:'reply',reply:'Para '+date+': '+tasks.length+' tarefa(s) e '+events.length+' compromisso(s). '+[...tasks.slice(0,3).map(r=>'Tarefa: '+r.title),...events.slice(0,3).map(r=>'Agenda: '+r.title)].join(' · ').slice(0,500)};
 }
 const kind=inferKind(input);
 if(!kind)return {type:'unknown',reply:'Ainda não entendi esse pedido. Tente “agende consulta amanhã às 14h”, “crie tarefa comprar leite” ou “gastei R$ 42 no mercado”. O processamento é local e não envia mensagens a serviços externos.'};
 const draft:Draft={kind,workspaceId,fields:{},missing:[]};
 if(kind==='transactions'){
  draft.fields.type=/\b(?:recebi|ganhei|entrou|receita)\b/.test(n)?'Receita':'Despesa';
  draft.fields.category=category(input);
 }
 if(kind==='tasks')draft.fields.status='A fazer';
 if(kind==='studies'){
  draft.fields.duration=detectDuration(input)||'';
 }
 const parsed=fillDraft(draft,input,now);
 if(kind==='transactions'&&!parsed.fields.title&&parsed.fields.category!=='Outros')parsed.fields.title=String(parsed.fields.category);
 if(kind==='studies'&&!parsed.fields.title)parsed.fields.title='Estudo';
 parsed.missing=(kind==='events'?['title','date','time']:kind==='tasks'?['title']:kind==='transactions'?['title','amount']:['title','duration']).filter(k=>!parsed.fields[k]);
 return {type:'draft',draft:parsed,reply:parsed.missing.length?'Vou preparar o registro de '+kindLabel(kind)+'. Me diga '+parsed.missing.map(labelField).join(' e ')+'.':'Entendi! Revise os dados antes de salvar.'};
}
