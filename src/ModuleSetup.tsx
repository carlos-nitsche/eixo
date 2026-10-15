import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,BriefcaseBusiness,CalendarDays,Check,Dumbbell,HeartPulse,LayoutGrid,Leaf,Settings2,ShieldCheck,Sparkles,Sun,Moon,Target,Wallet} from 'lucide-react';
import {Brand} from './Brand';
import {MODULES,enabledModules} from './modules';
import type {ModuleId} from './modules';
import './onboarding.css';
export const moduleIcons={agenda:CalendarDays,financeiro:Wallet,estudos:BookOpen,academia:Dumbbell,alimentacao:HeartPulse,negocios:BriefcaseBusiness,projetos:Target,habitos:Leaf};
export function ModulePicker({value,onChange}:{value:ModuleId[];onChange:(value:ModuleId[])=>void}) {
 return <div className="module-picker">{MODULES.map(m=>{const Icon=moduleIcons[m.id],selected=value.includes(m.id);return <button type="button" className={'module-choice '+(selected?'is-selected':'')} key={m.id} aria-pressed={selected} onClick={()=>onChange(selected?value.filter(id=>id!==m.id):[...value,m.id])}>
  <span className="module-symbol"><Icon size={23}/></span><span className="module-choice-copy"><strong>{m.title}</strong><span>{m.description}</span><small>{m.detail}</small></span><span className="module-check" aria-hidden="true">{selected&&<Check size={14}/>}</span>
 </button>})}</div>;
}
const purposes:{id:string;title:string;copy:string;modules:ModuleId[];icon:typeof Leaf}[]=[
 {id:'rotina',title:'Organizar minha vida',copy:'Tempo, dinheiro e objetivos em equilíbrio.',modules:['agenda','financeiro','projetos','habitos'],icon:LayoutGrid},
 {id:'saude',title:'Cuidar de mim',copy:'Treino, alimentação e hábitos consistentes.',modules:['academia','alimentacao','habitos'],icon:HeartPulse},
 {id:'negocio',title:'Gerenciar meu negócio',copy:'Operação, clientes e próximos passos.',modules:['negocios','agenda','projetos'],icon:BriefcaseBusiness},
 {id:'estudo',title:'Aprender e evoluir',copy:'Foco nos estudos e nas suas metas.',modules:['estudos','agenda','projetos'],icon:BookOpen},
];
export type SetupChoice={enabledModules:ModuleId[];theme:'light'|'dark';onboardingVersion:number};
export default function ModuleSetup({name,busy,error,onComplete,onLogout}:{name:string;busy:boolean;error:string;onComplete:(choice:SetupChoice)=>void;onLogout:()=>void}) {
 const [step,setStep]=useState(0),[purpose,setPurpose]=useState(''),[selected,setSelected]=useState<ModuleId[]>([]),[theme,setTheme]=useState<'light'|'dark'>(document.documentElement.dataset.theme==='dark'?'dark':'light');
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus()},[step]);
 const next=()=>{setStep(s=>s+1);window.scrollTo({top:0,behavior:'instant'})};
 return <div className="setup-page"><header className="setup-top"><Brand/><button type="button" className="setup-exit" disabled={busy} onClick={onLogout}>Sair da conta</button></header>
  <main className="setup-layout"><aside className="setup-story"><span className="setup-overline">FEITO PARA A SUA ROTINA</span><h2>Seu EIXO.<br/>Do seu jeito.</h2><p>Um espaço que acompanha o que faz sentido para você, agora.</p><ol className="setup-steps">{['Seu momento','Seus módulos','Seu espaço'].map((label,index)=><li key={label} aria-current={step===index?'step':undefined} className={step>=index?'reached':''}><span>{step>index?<Check size={15}/>:String(index+1).padStart(2,'0')}</span><div><strong>{label}</strong><small>{['O que você quer organizar?','Escolha o que aparece','Tudo pronto para começar'][index]}</small></div></li>)}</ol><div className="setup-note"><Settings2 size={19}/><p>Você pode mudar tudo isso depois em <b>Configurações → Meus módulos</b>.</p></div></aside>
  <section className="setup-card" aria-busy={busy}><div className="setup-step-content" key={step} inert={busy}><span className="setup-overline">PASSO {step+1} DE 3</span><h1 ref={heading} tabIndex={-1}>{step===0?`${name.split(' ')[0]||'Olá'}, o que te traz ao EIXO?`:step===1?'O que faz parte da sua rotina?':'Vamos deixar com a sua cara?'}</h1><p className="setup-intro">{step===0?'Escolha seu foco principal. Vamos sugerir um ponto de partida que você pode ajustar.':step===1?'Ative somente o que quer ver. Cada módulo funciona no seu ritmo, e seus registros ficam preservados se você o ocultar depois.':'Revise suas escolhas e escolha a aparência do seu novo espaço.'}</p>
   {step===0&&<><div className="setup-purposes">{purposes.map(p=><button type="button" key={p.id} aria-pressed={purpose===p.id} className={purpose===p.id?'selected':''} onClick={()=>{setPurpose(p.id);setSelected(p.modules)}}><p.icon size={24}/><span><strong>{p.title}</strong><small>{p.copy}</small></span><span className="module-check">{purpose===p.id&&<Check size={14}/>}</span></button>)}</div><button type="button" className="setup-custom" onClick={()=>{setPurpose('custom');setSelected([]);next()}}>Prefiro escolher cada módulo <ArrowRight size={16}/></button></>}
   {step===1&&<><div className="setup-selection-bar"><span aria-live="polite">{selected.length} de {MODULES.length} módulos selecionados</span><button type="button" onClick={()=>setSelected(selected.length===MODULES.length?[]:MODULES.map(m=>m.id))}>{selected.length===MODULES.length?'Limpar seleção':'Selecionar todos'}</button></div><ModulePicker value={selected} onChange={setSelected}/><p className="setup-hint"><ShieldCheck size={16}/> Visão geral e Configurações sempre ficam disponíveis.</p></>}
   {step===2&&<><div className="setup-review"><span className="setup-review-icon"><Sparkles size={24}/></span><div><strong>Um espaço com {selected.length} {selected.length===1?'módulo':'módulos'}</strong><p>{selected.length?'Tudo organizado para o que importa para você.':'Comece com um painel simples e adicione módulos quando quiser.'}</p></div></div><div className="setup-chips">{MODULES.filter(m=>selected.includes(m.id)).map(m=>{const Icon=moduleIcons[m.id];return <span key={m.id}><Icon size={15}/>{m.title}</span>})}</div><h3>Como você prefere visualizar?</h3><div className="setup-themes">{(['light','dark'] as const).map(t=><button type="button" key={t} aria-pressed={theme===t} onClick={()=>setTheme(t)} className={theme===t?'selected':''}><span className={'theme-preview '+t}><i/><span><i/><i/><i/></span></span><span>{t==='light'?<Sun size={16}/>:<Moon size={16}/>}Tema {t==='light'?'claro':'escuro'}{theme===t&&<Check size={16}/>}</span></button>)}</div></>}
  </div>{error&&<p className="setup-error" role="alert">{error}</p>}<footer className="setup-footer"><button type="button" className="btn light" disabled={busy||step===0} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={16}/> Voltar</button><button type="button" className="btn primary" disabled={busy||(step===0&&!purpose)} onClick={()=>step===2?onComplete({enabledModules:enabledModules(selected),theme,onboardingVersion:1}):next()}>{busy?'Salvando seu espaço…':step===2?'Entrar no meu EIXO':'Continuar'}{!busy&&<ArrowRight size={16}/>}</button></footer></section></main>
 </div>;
}
export function ModulePreferences({value,onSave}:{value:unknown;onSave:(value:ModuleId[])=>void}) {
 const key=JSON.stringify(enabledModules(value));
 const [selected,setSelected]=useState(()=>enabledModules(value));
 useEffect(()=>setSelected(JSON.parse(key)),[key]);
 const dirty=JSON.stringify(enabledModules(selected))!==key;
 return <section className="module-preferences"><div className="module-preferences-heading"><span className="module-symbol"><LayoutGrid size={24}/></span><div><h2>Meus módulos</h2><p>Escolha o que aparece no menu, na busca e na visão geral. Ocultar um módulo não apaga seus registros.</p></div></div><ModulePicker value={selected} onChange={setSelected}/><footer><span aria-live="polite">{selected.length} módulos selecionados · Visão geral e Configurações sempre disponíveis</span><button className="btn primary" disabled={!dirty} onClick={()=>onSave(enabledModules(selected))}><Check size={16}/> Salvar módulos</button></footer></section>;
}
