import {ArrowRight,CalendarDays,ClipboardCheck,Dumbbell,Wallet,BriefcaseBusiness,BookOpen,HeartPulse,ShieldCheck,Smartphone,Layers,Target,Repeat2,Sparkles,GraduationCap,TrendingUp,CheckCircle2,Users,Package,ShoppingCart} from 'lucide-react';
import {Brand} from './Brand';

const areas=[
 {name:'Agenda e tarefas',icon:CalendarDays,description:'Compromissos, lembretes, prioridades e calendário.',tone:'blue'},
 {name:'Financeiro pessoal',icon:Wallet,description:'Receitas, despesas, categorias e planejamento.',tone:'green'},
 {name:'Estudos',icon:GraduationCap,description:'Disciplinas, sessões de foco, revisões e anotações.',tone:'violet'},
 {name:'Treinos e saúde',icon:Dumbbell,description:'Fichas, séries, cargas, calendário e mapa muscular.',tone:'orange'},
 {name:'Alimentação',icon:HeartPulse,description:'Refeições, registros alimentares e acompanhamento.',tone:'rose'},
 {name:'Negócios e ERP',icon:BriefcaseBusiness,description:'Produtos, clientes, orçamentos, PDV e relatórios.',tone:'blue'},
 {name:'Projetos e metas',icon:Target,description:'Objetivos, projetos e acompanhamento do progresso.',tone:'violet'},
 {name:'Hábitos',icon:Repeat2,description:'Rotinas diárias, semanais e consistência.',tone:'green'}
] as const;

export function HeroProduct(){
 return <div className="lp-dashboard-illustration" aria-label="Ilustração do EIXO com exemplos fictícios, sem dados reais">
  <div className="lp-dash-top"><Brand compact/><span>VISÃO GERAL · DEMONSTRAÇÃO</span><span className="lp-dash-light"/></div>
  <div className="lp-dash-content">
   <span className="lp-dash-kicker">UM CENTRO PARA SUA ROTINA</span><h3>Seu dia, no seu ritmo.</h3><p>Um lugar para encontrar o que importa.</p>
   <div className="lp-dash-tiles"><div><CalendarDays size={19}/><small>Agenda</small><strong>Compromissos</strong><span>Seus próximos horários</span></div><div><Wallet size={19}/><small>Finanças</small><strong>Controle</strong><span>Receitas e despesas</span></div></div>
   <div className="lp-dash-tasks"><div><span><ClipboardCheck size={16}/> Planejamento</span><small>DADOS ILUSTRATIVOS</small></div><p><CheckCircle2 size={17}/> Revisar as prioridades da semana <span>Feito</span></p><p><span className="lp-dash-empty-circle"/> Organizar próximas atividades <span>A fazer</span></p></div>
   <div className="lp-dash-foot"><span><BriefcaseBusiness size={15}/> Negócios</span><span><Dumbbell size={15}/> Treinos</span><span><Target size={15}/> Metas</span></div>
  </div>
 </div>;
}
export function ValueSections({start,previewMode}:{start:string;previewMode:boolean}){
 return <>
 <section className="lp-problem" aria-labelledby="lp-problem-title"><div><span className="lp-eyebrow">ORGANIZAR NÃO PRECISA SER COMPLICADO</span><h2 id="lp-problem-title">Você cuida de muita coisa.<br/><em>Encontre tudo em um lugar.</em></h2></div><div className="lp-problem-compare"><div><span>QUANDO TUDO FICA ESPALHADO</span><p>Uma lista de tarefas aqui. Os gastos em outro lugar. Notas soltas, treinos e o negócio exigindo atenção.</p></div><div><span><Sparkles size={15}/> COM O EIXO</span><p>Agenda, finanças, projetos e operação da empresa dentro do mesmo sistema — cada área no seu espaço.</p></div></div></section>
 <section className="lp-areas" id="recursos"><div className="lp-section-intro"><span className="lp-eyebrow">O QUE EXISTE NO EIXO</span><h2>Um aplicativo. <em>Oito áreas.</em><br/>Sua rotina conectada.</h2><p>Comece por onde fizer mais sentido. Os módulos reúnem ferramentas para cuidar da vida pessoal e dos seus negócios.</p></div><div className="lp-area-grid">{areas.map(area=>{const Icon=area.icon;return <article className="lp-area-card" data-tone={area.tone} key={area.name}><span className="lp-area-icon"><Icon size={23}/></span><h3>{area.name}</h3><p>{area.description}</p></article>})}</div>
  <div className="lp-assistant-promo"><span className="lp-assistant-icon"><Sparkles size={25}/></span><div><span className="lp-eyebrow">ASSISTENTE EIXO · SEM API EXTERNA</span><h3>Você escreve. O EIXO organiza.</h3><p>Peça por texto para criar tarefas, agendar compromissos ou registrar gastos. O assistente interpreta comandos conhecidos, esclarece dados ausentes e só salva após sua confirmação.</p></div><a href="#demonstracao" className="lp-text-link">Explorar por dentro <ArrowRight size={16}/></a></div>
 </section>
 <section className="lp-how" aria-labelledby="lp-how-title"><div className="lp-section-intro"><span className="lp-eyebrow">DO PRIMEIRO DIA EM DIANTE</span><h2 id="lp-how-title">Simples para começar.<br/><em>Feito para acompanhar você.</em></h2></div><div className="lp-how-grid"><article><span>01</span><Users size={22}/><h3>Crie seu espaço</h3><p>Cadastre sua conta, confirme o e-mail e escolha quais áreas deseja organizar.</p></article><article><span>02</span><ClipboardCheck size={22}/><h3>Organize os registros</h3><p>Adicione seus compromissos, finanças, projetos, hábitos e informações do negócio.</p></article><article><span>03</span><TrendingUp size={22}/><h3>Acompanhe suas decisões</h3><p>Consulte históricos, relatórios e próximos passos no mesmo aplicativo.</p></article></div><div className="lp-how-action"><a href={start} className="lp-button lp-primary">{previewMode?'Conhecer planos e condições':'Começar minha organização'} <ArrowRight size={18}/></a></div></section>
 </>;
}
