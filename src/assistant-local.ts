// EIXO OS 1.0 — local Portuguese command understanding, no speech, external API or model.
import type {Collection,Entry} from './model';

export type AssistantKind=Extract<Collection,'events'|'tasks'|'transactions'|'studies'|'projects'|'habits'|'goals'>;
export type Draft={kind:AssistantKind;fields:Record<string,string|number>;workspaceId:string;missing:string[]};
export type Result={type:'draft';draft:Draft;reply:string}|{type:'reply';reply:string}|{type:'unknown';reply:string};
export type AssistantRecords={tasks:Entry[];events:Entry[];transactions:Entry[];studies?:Entry[];projects?:Entry[];habits?:Entry[];goals?:Entry[]};
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const weekdays=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
const norm=(x:string)=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const clean=(x:string)=>x.replace(/\s+/g,' ').trim().replace(/^[\s,.:;!\-]+|[\s,.:;!\-]+$/g,'');
const iso=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const shift=(now:Date,days:number)=>{const date=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);date.setDate(date.getDate()+days);return iso(date)};
export const isValidDay=(date:string)=>{if(!/^\d{4}-\d\d-\d\d$/.test(date))return false;const d=new Date(date+'T12:00:00');return !Number.isNaN(d.getTime())&&iso(d)===date};
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const labelField=(k:string)=>({title:'o nome ou a descrição',date:'a data',time:'o horário',amount:'o valor',duration:'a duração em minutos',target:'a meta numérica',frequency:'a frequência'} as Record<string,string>)[k]||k;
export function draftPreview(d:Draft):string{
 const f=d.fields;return [String(f.title||'Sem título'),...['date','dueDate','time','amount','duration','category','priority','status','type','frequency','target','unit'].filter(k=>f[k]!==undefined&&f[k]!=='').map(k=>k==='amount'?money(Number(f[k])):String(f[k]))].join(' · ');
}
export function parseDate(input:string,now:Date):string|undefined{
 const text=norm(input);
 const numeric=text.match(/\b(?:dia\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
 if(numeric){
  let year=numeric[3]?Number(numeric[3]):now.getFullYear();if(year<100)year+=2000;
  const make=(y:number)=>[y,String(Number(numeric[2])).padStart(2,'0'),String(Number(numeric[1])).padStart(2,'0')].join('-');
  let date=make(year);if(!numeric[3]&&isValidDay(date)&&date<iso(now))date=make(year+1);
  return isValidDay(date)?date:undefined;
 }
 const full=text.match(/\b(?:dia\s+)?(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?\b/);
 if(full){
  const make=(y:number)=>[y,String(months.indexOf(full[2])+1).padStart(2,'0'),String(Number(full[1])).padStart(2,'0')].join('-');
  let date=make(full[3]?Number(full[3]):now.getFullYear());
  if(!full[3]&&isValidDay(date)&&date<iso(now))date=make(now.getFullYear()+1);
  return isValidDay(date)?date:undefined;
 }
 if(/\b(?:depois\s+de\s+amanha|depois\s+de\s+amanha)\b/.test(text))return shift(now,2);
 if(/\bamanha\b/.test(text))return shift(now,1);
 if(/\bhoje\b/.test(text))return shift(now,0);
 if(/\b(?:semana\s+que\s+vem|proxima\s+semana)\b/.test(text)&&!/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/.test(text))return shift(now,7);
 const week=text.match(/\b(?:(proxim[ao]|que\s+vem|semana\s+que\s+vem)\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/);
 if(week){let gap=(weekdays.indexOf(week[2])-now.getDay()+7)%7;if(gap===0||week[1])gap+=7;return shift(now,gap)}
 const day=text.match(/\bdia\s+(\d{1,2})(?![\/\d])\b/);
 if(day){const n=Number(day[1]),y=now.getFullYear(),m=now.getMonth();let date=new Date(y,m,n,12);
  if(date.getDate()!==n||date.getMonth()!==m)return;
  if(date<new Date(y,m,now.getDate(),12))date=new Date(y,m+1,n,12);
  return date.getDate()===n?iso(date):undefined;
 }
}
const wordHours:Record<string,number>={zero:0,uma:1,um:1,duas:2,dois:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,'vinte e um':21,'vinte e dois':22,'vinte e tres':23};
export function parseTime(input:string):string|undefined{
 const text=norm(input);
 const match=text.match(/\b(?:as\s+|pelas\s+|para\s+as\s+|horario\s+)?(\d{1,2})\s*(?:h|:)(\d{1,2})?\b/)||
   text.match(/\b(?:as|pelas|horario\s+(?:para\s+)?|hora\s+(?:para\s+)?)\s*(\d{1,2})\s*(?:horas?)?(?=\b)/);
 let hour:number,minute=0;
 if(match){hour=Number(match[1]);minute=match[2]?Number(match[2]):0;}
 else{
  const words=Object.keys(wordHours).sort((a,b)=>b.length-a.length).join('|');
  const spoken=text.match(new RegExp('\\b(?:as|pelas|horario\\s+(?:para\\s+)?|hora\\s+(?:para\\s+)?)\\s*('+words+')\\s*(?:horas?)?\\b'));
  if(!spoken)return;
  hour=wordHours[spoken[1]];
 }
 if(!Number.isInteger(hour)||hour<0||hour>23||minute<0||minute>59)return;
 if(/\b(?:da tarde|a tarde|de tarde|da noite|a noite|de noite)\b/.test(text)&&hour>=1&&hour<=11)hour+=12;
 if(/\bmeio-dia\b/.test(text))hour=12;
 return String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
export function parseAmount(input:string):number|undefined{
 const text=norm(input);
 const match=text.match(/(?:r\$\s*|\b(?:gastei|paguei|recebi|ganhei|valor|custo|custou|preco|de|por|quantia|entrou|saldo\s+de)\s+)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\b/)||
 text.match(/\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|contos)\b/);
 if(!match)return;
 const value=Number(match[1].includes(',')?match[1].replace(/\./g,'').replace(',','.'):match[1]);
 return Number.isFinite(value)&&value>0&&value<=100000000?Math.round(value*100)/100:undefined;
}
const duration=(input:string)=>{
 const text=norm(input),h=text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?)\b/),m=text.match(/\b(\d+)\s*(?:minutos?|mins?)\b/);
 const amount=(h?60*Number(h[1].replace(',','.')):0)+(m?Number(m[1]):0);
 return Number.isInteger(amount)&&amount>0&&amount<=1440?amount:undefined;
};
const priority=(input:string)=>/\b(?:urgente|urgencia|importante|prioridade\s+alta|alta\s+prioridade)\b/.test(norm(input))?'Alta':/\b(?:sem pressa|prioridade baixa|baixa prioridade)\b/.test(norm(input))?'Baixa':/\b(?:prioridade media|media prioridade)\b/.test(norm(input))?'Média':undefined;
const category=(input:string)=>{
 const n=norm(input);
 const cases:[RegExp,string][]=[[/mercado|supermercado|almoco|janta|restaurante|lanche|comida|padaria|delivery|ifood/,'Alimentação'],[/aluguel|condominio|energia|luz|agua|internet|casa|moradia/,'Moradia'],[/uber|combustivel|gasolina|onibus|transporte|posto|taxi/,'Transporte'],[/farmacia|remedio|medico|consulta|hospital/,'Saúde'],[/academia|suplemento|treino/,'Academia'],[/faculdade|curso|livro|educacao|escola/,'Educação'],[/salario|pagamento\s+do\s+trabalho/,'Salário'],[/venda|cliente/,'Vendas'],[/cinema|jogo|bar|show|lazer/,'Lazer'],[/investimento|dividendo/,'Investimentos']];
 return cases.find(([re])=>re.test(n))?.[1]||'Outros';
};
const stripDetails=(input:string)=>input
 .replace(/(?:^|\s)(?:depois\s+de\s+amanh[aã]|amanh[aã]|hoje|pr[oó]xim[ao]\s+(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?|(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?)(?=\s|[,!?]|$)/gi,' ')
 .replace(/\b(?:dia\s+)?\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g,' ')
 .replace(/\b(?:dia\s+)?\d{1,2}\s+de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+\d{4})?\b/gi,' ')
 .replace(/\bdia\s+\d{1,2}\b/gi,' ')
 .replace(/(?:^|\s)(?:às|as|pelas|para\s+as)?\s*\d{1,2}\s*(?:h|:)\d{0,2}(?=\s|[,!?]|$)/gi,' ')
 .replace(/(?:^|\s)(?:às|as|pelas)\s+\d{1,2}(?=\s|[,!?]|$)/gi,' ')
 .replace(/(?:^|\s)(?:às|as|pelas)\s+(?:vinte\s+e\s+(?:um|dois|tr[eê]s)|(?:zero|uma?|duas?|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte))\s*(?:horas?)?(?=\s|[,!?]|$)/gi,' ')
 .replace(/\b(?:semana\s+que\s+vem|pr[oó]xima\s+semana)\b/gi,' ')
 .replace(/\b(?:urgente|com\s+prioridade\s+alta|prioridade\s+alta|prioridade\s+baixa|sem\s+pressa)\b/gi,' ');
const moneyRemoved=(input:string)=>input
 .replace(/(?:r\$\s*|\b(?:de|por|valor|custou|gastei|recebi|paguei|ganhei|entrou)\s+)(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\b/gi,' ')
 .replace(/\b\d+(?:[.,]\d+)?\s*(?:reais|real|conto|contos)\b/gi,' ');
function describe(input:string,kind:AssistantKind):string{
 let text=stripDetails(input);
 if(kind==='transactions')text=moneyRemoved(text).replace(/\b(?:gastei|paguei|comprei|recebi|ganhei|entrou|depositaram|registrei|registrar|registre|registra|anote|anota|adicione|adiciona|lance|lanca|uma?|despesa|receita|gasto|pagamento|no|na|com|em|de|do|da|pelo|pela|reais|real)\b/gi,' ');
 if(kind==='events')text=text.replace(/\b(?:agend\w*|mar[qc]\w*|coloc\w*|registr\w*|adicion\w*|cri\w*|program\w*|reserv\w*|quero|preciso|pode|por\s+favor|um|uma|me|pra|para|no|na|o|a|evento|compromisso|hor[aá]rio)\b/gi,' ');
 if(kind==='tasks')text=text.replace(/\b(?:cri\w*|adicion\w*|anot\w*|registr\w*|lembr\w*|lembrete|tarefa|preciso|fazer|me|para|pra|um|uma|de|que|eu|pode|quero|por\s+favor)\b/gi,' ');
 if(kind==='studies')text=text.replace(/\b(?:registr\w*|anot\w*|estudei|estudar|estudo|uma?|de|e|por|durante|tempo|sess[aã]o|minutos?|mins?|horas?|hoje|pode)\b/gi,' ').replace(/\b\d+(?:[.,]\d+)?\b/g,' ');
 if(kind==='projects')text=text.replace(/\b(?:crie|criar|criando|adicione|adicionar|registra|registre|projeto|novo|nova|um|uma|de|chamado|chamada|nome|pode|quero)\b/gi,' ');
 if(kind==='habits')text=text.replace(/\b(?:crie|criar|adicione|adicionar|registra|registre|habito|habitos|todo|todos|os|dias|diariamente|semanalmente|por|dia|quero|um|uma|de|fazer|pode)\b/gi,' ');
 if(kind==='goals')text=text.replace(/\b(?:crie|criar|adicione|adicionar|registra|registre|meta|objetivo|alvo|atingir|alcancar|guardar|economizar|quero|um|uma|de|para|ate|pode)\b/gi,' ');
 return clean(text).slice(0,130);
}
export function inferKind(input:string):AssistantKind|undefined{
 const text=norm(input);
 if(/\b(?:gastei|paguei|comprei|recebi|ganhei|despesa|receita|lancamento|gasto|salario|pix\s+de|vendi|registrar\s+pagamento|anota\s+um\s+pagamento|custou)\b/.test(text))return 'transactions';
 if(/\b(?:estudei|estudar|estudo\s+de|sessao\s+de\s+estudo|tempo\s+de\s+estudo|horas\s+de\s+estudo)\b/.test(text))return 'studies';
 if(/\b(?:habito|habitos|rotina\s+diaria|todo\s+dia|todos\s+os\s+dias|diariamente|semanalmente)\b/.test(text))return 'habits';
 if(/\b(?:meta|metas|objetivo|objetivos|juntar\s+(?:r\$|dinheiro)|economizar\s+(?:r\$|dinheiro))\b/.test(text))return 'goals';
 if(/\b(?:projeto|projetos|iniciativa)\b/.test(text))return 'projects';
 if(/\b(?:tarefa|lembrete|lembrar|lembre|lembrar-me|tenho\s+que|preciso\s+(?:fazer|entregar|comprar)|nao\s+posso\s+esquecer|pendencia|lista\s+de\s+afazeres)\b/.test(text))return 'tasks';
 if(/\b(?:agend\w*|mar[qc]\w*|consulta|reuniao|compromisso|evento|horario|reservar\s+(?:horario|consulta))\b/.test(text))return 'events';
 if(/\b(?:anota|anote|registre|registra|lembra)\b/.test(text))return 'tasks';
}
const required:Record<AssistantKind,string[]>={events:['title','date','time'],tasks:['title'],transactions:['title','amount'],studies:['title','duration'],projects:['title'],habits:['title'],goals:['title','target']};
const kindLabel:Record<AssistantKind,string>={events:'compromisso',tasks:'tarefa',transactions:'lançamento financeiro',studies:'sessão de estudo',projects:'projeto',habits:'hábito',goals:'meta'};
const missing=(kind:AssistantKind,fields:Record<string,string|number>)=>required[kind].filter(k=>fields[k]===undefined||fields[k]==='');
export function fillDraft(draft:Draft,input:string,now=new Date()):Draft{
 const fields={...draft.fields},text=norm(input);
 const date=parseDate(input,now),time=parseTime(input),amount=parseAmount(input),minutes=duration(input),rank=priority(input);
 const correction=input.match(/^(?:(?:mude|muda|troque|troca|altere|altera|corrija|corrige)\s+)?(?:(?:o|a)\s+)?(?:nome|titulo|t[ií]tulo|descri[cç][aã]o)\s+(?:para\s+|pra\s+|[eé]\s+|ser\s+)?(.+)$/i);
 if(correction?.[1]?.trim())fields.title=clean(correction[1]).slice(0,130);
 if(draft.kind==='events'){if(date)fields.date=date;if(time)fields.time=time;}
 if(draft.kind==='tasks'||draft.kind==='projects'||draft.kind==='goals'){if(date)fields.dueDate=date;}
 if(draft.kind==='tasks'||draft.kind==='projects'){if(rank)fields.priority=rank;}
 if(draft.kind==='transactions'){if(date)fields.date=date;if(amount!==undefined)fields.amount=amount;
  if(/\b(?:receita|entrada|recebi|ganhei|salario)\b/.test(text))fields.type='Receita';
  if(/\b(?:despesa|saida|gastei|paguei)\b/.test(text))fields.type='Despesa';
 }
 if(draft.kind==='studies'){if(date)fields.date=date;if(minutes!==undefined)fields.duration=minutes;}
 if(draft.kind==='habits'){
  if(/\b(?:semanalmente|toda\s+semana|por\s+semana)\b/.test(text))fields.frequency='Semanal';
  if(/\b(?:diariamente|todo\s+dia|todos\s+os\s+dias|por\s+dia)\b/.test(text))fields.frequency='Diária';
 }
 if(draft.kind==='goals'){
  const targetMatch=text.match(/\b(?:meta|alvo|objetivo|atingir|alcancar|chegar\s+a|juntar|economizar|total)\s*(?:(?:de|em|a|para)\s+)?(?:r\$\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?)\b/);
  if(targetMatch||amount!==undefined){
   const target=targetMatch?Number(targetMatch[1].replace(/\./g,'').replace(',','.')):amount;
   if(target!==undefined&&Number.isFinite(target)&&target>0&&target<=100000000)fields.target=target;
  }
  if(/r\$|reais|dinheiro|economiz|juntar/.test(text))fields.unit='R$';
 }
 // A short answer in the clarification stage should populate ONLY the field asked for.
 if(!fields.title){
  const stripped=describe(input,draft.kind);
  const meaningful=stripped&&!/^(?:registrar|registre|anote|crie|quero|uma?|preciso|para|pra|o|a|novo|nova)$/.test(norm(stripped));
  if(meaningful&&!(/^(?:amanha|hoje|as\s+\d|r\$\s*\d)/.test(text)))fields.title=stripped;
 }
 if(draft.kind==='transactions'&&!fields.date)fields.date=iso(now);
 if(draft.kind==='studies'&&!fields.date)fields.date=iso(now);
 // Answering a direct follow-up with a bare description, date, number or duration.
 if(!fields.title&&draft.missing.includes('title')&&!date&&!time&&amount===undefined&&minutes===undefined){
  const answer=clean(input);
  if(answer&&!/^(?:(?:registr[ae]|crie|criar|adicione|anote)\s+)?(?:(?:um|uma)\s+)?(?:tarefa|evento|meta|habito|projeto)$/.test(norm(answer)))fields.title=answer.slice(0,130);
 }
 if(draft.kind==='transactions'&&fields.title===undefined&&fields.category!==undefined&&fields.category!=='Outros')fields.title=String(fields.category);
 return {...draft,fields,missing:missing(draft.kind,fields)};
}
const summary=(records:AssistantRecords,space:string,date:string)=>{
 const tasks=records.tasks.filter(r=>(r.workspaceId||'pessoal')===space&&r.dueDate===date&&r.status!=='Concluído');
 const events=records.events.filter(r=>(r.workspaceId||'pessoal')===space&&r.date===date).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
 return {tasks,events};
};
export function interpretAssistant(inputText:string,workspaceId:string,now=new Date(),existing?:Draft,records?:AssistantRecords):Result{
 const input=clean(inputText.slice(0,800));if(!input)return {type:'unknown',reply:'Escreva o que você gostaria de organizar.'};
 const text=norm(input);
 if(existing){
  if(/^(?:cancelar|cancela|desistir|esquece|nao|não|deixa pra la|deixa para la|novo pedido|recomecar|outra coisa)$/.test(text))return {type:'reply',reply:'Combinado, descartei o rascunho. Nada foi registrado.'};
  const next=fillDraft(existing,input,now);
  return {type:'draft',draft:next,reply:next.missing.length?'Certo. '+(next.missing.length===1?'Só falta '+labelField(next.missing[0]):'Ainda preciso de '+next.missing.map(labelField).join(' e '))+'.':'Atualizei os detalhes. Confira o cartão abaixo; você pode corrigir mais alguma informação antes de salvar.'};
 }
 if(/^(?:oi|ola|bom dia|boa tarde|boa noite|e ai|opa|ajuda|comandos|exemplos|o que voce faz|o que voce consegue fazer)[!?\s.]*$/.test(text))
  return {type:'reply',reply:'Oi! Posso organizar sua agenda, tarefas, finanças, estudos, projetos, metas e hábitos. Também consulto compromissos e lançamentos do seu espaço. É tudo processado aqui, sem API externa. Quer começar por qual área?'};
 if(records){
  if(/\b(?:quanto|qual|como\s+esta|resumo|relatorio|saldo|total|mostre|mostrar|meus|minhas)\b/.test(text)&&/\b(?:gastei|gastos|despesas|recebi|receitas|ganhei|saldo|financeiro|entradas|saidas|dinheiro)\b/.test(text)){
   const month=iso(now).slice(0,7);
   const tx=records.transactions.filter(r=>(r.workspaceId||'pessoal')===workspaceId&&String(r.date||'').startsWith(month+'-'));
   const total=(kind:string)=>tx.filter(x=>x.type===kind).reduce((s,r)=>s+(Number.isFinite(Number(r.amount))?Math.max(0,Number(r.amount)):0),0);
   const income=total('Receita'),expenses=total('Despesa');
   return {type:'reply',reply:'Neste mês ('+month.slice(5)+'/'+month.slice(0,4)+'):\nReceitas: '+money(income)+'\nDespesas: '+money(expenses)+'\nSaldo: '+money(income-expenses)+'.\nConsiderei apenas seu espaço de trabalho atual.'};
  }
  if(/\b(?:o que|quais|resum|mostr|tenho|agenda|compromissos|tarefas|pendencias|planejamento)\w*/.test(text)&&/\b(?:hoje|amanha|semana|dia|tarefas|compromissos|agenda|pendencias)\b/.test(text)){
   const date=parseDate(input,now)||iso(now);
   const {tasks,events}=summary(records,workspaceId,date);
   const details=[...events.slice(0,4).map(r=>'• '+(r.time||'Sem hora')+' — '+r.title),...tasks.slice(0,4).map(r=>'• Tarefa: '+r.title)];
   return {type:'reply',reply:'Em '+date.slice(8)+'/'+date.slice(5,7)+': '+events.length+' compromisso(s) e '+tasks.length+' tarefa(s) pendente(s).'+(details.length?'\n'+details.join('\n'):'\nSeu dia está livre nesses registros.')};
  }
  if(/\b(?:quantas|quantos|listar|liste|meus|minhas|resumo|mostrar)\b/.test(text)&&/\b(?:projetos|metas|habitos|estudos)\b/.test(text)){
   const key=/\bprojetos\b/.test(text)?'projects':/\bmetas\b/.test(text)?'goals':/\bhabitos\b/.test(text)?'habits':'studies';
   const list=(records[key]||[]).filter(r=>(r.workspaceId||'pessoal')===workspaceId);
   return {type:'reply',reply:'Você tem '+list.length+' registro(s) de '+({projects:'projetos',goals:'metas',habits:'hábitos',studies:'estudos'} as Record<string,string>)[key]+' neste espaço.'+(list.length?'\n'+list.slice(0,6).map(x=>'• '+x.title).join('\n'):'')};
  }
 }
 const kind=inferKind(input);
 if(!kind)return {type:'unknown',reply:'Consigo entender pedidos de agenda, tarefas, gastos, receitas, estudos, projetos, hábitos e metas. Não vou criar registros sem entender sua intenção. Por exemplo: “anota pagar internet amanhã”, “recebi R$ 500”, “quero criar um hábito de ler diariamente” ou “quais são minhas tarefas?”.'};
 const draft:Draft={kind,fields:{},workspaceId,missing:required[kind]};
 if(kind==='transactions'){draft.fields.type=/\b(?:recebi|ganhei|entrou|receita|salario|vendi)\b/.test(text)?'Receita':'Despesa';draft.fields.category=category(input);}
 if(kind==='tasks')draft.fields.status='A fazer';
 if(kind==='projects')draft.fields.status='Planejamento';
 if(kind==='goals')draft.fields.current=0;
 const parsed=fillDraft(draft,input,now);
 if(kind==='studies'&&!parsed.fields.title){parsed.fields.title='Estudo';parsed.missing=missing(kind,parsed.fields)}
 const reply=parsed.missing.length?'Vou preparar seu '+kindLabel[kind]+'. '+(parsed.missing.length===1?'Me diga '+labelField(parsed.missing[0]):'Preciso de '+parsed.missing.map(labelField).join(' e '))+'.':'Entendi: '+kindLabel[kind]+'! Organizei os detalhes para você revisar. Se quiser mudar algo, escreva a correção antes de confirmar.';
 return {type:'draft',draft:parsed,reply};
}
