import {useEffect,useMemo,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {Star,Apple,ArrowRight,BookOpen,CalendarDays,Check,ChevronLeft,ChevronRight,Download,Leaf,Plus,Search,ShieldAlert,ShoppingBasket,Trash2,X} from 'lucide-react';
import type {Store} from './model';
import type {FoodItem,NutritionData,NutritionProfile,Restriction,RestrictionKind,Meal,MealSlot,Recipe,MealIngredient,EatingStyle,NutritionObjective,Nutrients} from './nutrition';
import {ALLERGEN_OPTIONS,EATING_STYLES,MEAL_SLOTS,NUTRITION_OBJECTIVES,assessFood,assessMeal,foodSearch,moveDate,nowDate,parseNutrition,scaleNutrients,shoppingFor,suggestFoods,sumNutrition,validGrams,validateProfile,safeCsvCell} from './nutrition';
import {availableIdeas} from './nutrition-meals';
import './nutrition-studio.css';
type Tab='inicio'|'plano'|'alimentos'|'receitas'|'alergias'|'diario'|'compras'|'perfil';
type Props={store:Store;setStore:Dispatch<SetStateAction<Store>>;workspaceId:string;onAcademia?:()=>void};
const newId=()=>crypto.randomUUID();
const freshProfile=(workspaceId:string):NutritionProfile=>({workspaceId,objective:'equilibrio',style:'onivoro',mealsPerDay:3,prepMinutes:30,preferences:[],dislikes:[],useTraining:false,showNumbers:false,updatedAt:new Date().toISOString()});
const n=(value:string)=>value.trim()===''?undefined:Number(value.replace(',','.'));
const show=(value:number|null,unit='')=>value===null?'Sem dado':value.toLocaleString('pt-BR',{maximumFractionDigits:1})+unit;
const dateLabel=(ymd:string)=>/^\d{4}-\d{2}-\d{2}$/.test(ymd)?new Date(ymd+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric'}):'Selecionar data';
function Macro({value}:{value:Nutrients}){return <div className="ns-macros"><span><b>{show(value.kcal)}</b><small>kcal</small></span><span><b>{show(value.protein,' g')}</b><small>proteínas</small></span><span><b>{show(value.carbs,' g')}</b><small>carboidratos</small></span><span><b>{show(value.fat,' g')}</b><small>gorduras</small></span></div>}
export default function NutritionStudio({store,setStore,workspaceId,onAcademia}:Props){
 const data=useMemo(()=>parseNutrition(store.nutrition),[store.nutrition]);
 const profile=data.profiles.find(x=>x.workspaceId===workspaceId);
 const restrictions=data.restrictions.filter(x=>x.workspaceId===workspaceId);
 const [catalog,setCatalog]=useState<FoodItem[]>([]),[catalogError,setCatalogError]=useState('');
 const [tab,setTab]=useState<Tab>('inicio'),[notice,setNotice]=useState('');
 const [date,setDate]=useState(nowDate()),[query,setQuery]=useState(''),[category,setCategory]=useState('');
 const [editingProfile,setEditingProfile]=useState<NutritionProfile|null>(null);
 const [kind,setKind]=useState<RestrictionKind>('allergy'),[allergen,setAllergen]=useState('leite'),[customAllergen,setCustomAllergen]=useState(''),[restrictionNote,setRestrictionNote]=useState('');
 const [draft,setDraft]=useState<Meal|null>(null),[foodId,setFoodId]=useState(''),[grams,setGrams]=useState('100');
 const [recipeDraft,setRecipeDraft]=useState<Recipe|null>(null);
 const [swapItemId,setSwapItemId]=useState('');
 const [ingredientQuery,setIngredientQuery]=useState(''),[favoritesOnly,setFavoritesOnly]=useState(false);
 const [customFood,setCustomFood]=useState(false),[ownName,setOwnName]=useState(''),[ownIngredients,setOwnIngredients]=useState('');
 const [ownEnergy,setOwnEnergy]=useState(''),[ownProtein,setOwnProtein]=useState(''),[ownCarbs,setOwnCarbs]=useState(''),[ownFat,setOwnFat]=useState('');
 const [ownAllergens,setOwnAllergens]=useState<string[]>([]);
 const library=useMemo(()=>[...catalog,...data.foods.filter(x=>x.workspaceId===workspaceId)],[catalog,data.foods,workspaceId]);
 const visible=useMemo(()=>foodSearch(library,query,category).filter(f=>!favoritesOnly||data.favorites.some(v=>v.workspaceId===workspaceId&&v.foodId===f.id)),[library,query,category,favoritesOnly,data.favorites,workspaceId]);
 const categories=[...new Set(library.map(x=>x.category))].sort();
 const isFavorite=(id:string)=>data.favorites.some(x=>x.workspaceId===workspaceId&&x.foodId===id);
 const highRisk=restrictions.some(x=>['allergy','suspected','celiac','medical','intolerance'].includes(x.kind));
 const checkedSafety=(items:MealIngredient[])=>{const state=assessMeal(items,library,restrictions);if(state==='blocked')return 'Contém ingrediente incompatível com as restrições declaradas.';if(state==='unverified'&&highRisk)return 'Ingredientes incompletos: não é possível aprovar a combinação com as restrições informadas.';return '';};
 const suggestions=useMemo(()=>suggestFoods(library,profile,restrictions,8),[library,profile,restrictions]);
 const ideas=useMemo(()=>availableIdeas(library,profile,restrictions),[library,profile,restrictions]);
 const daily=data.meals.filter(x=>x.workspaceId===workspaceId&&x.date===date);
 const planned=daily.filter(x=>x.status==='planned'),consumed=daily.filter(x=>x.status==='consumed');
 const recipes=data.recipes.filter(x=>x.workspaceId===workspaceId);
 const shopping=shoppingFor(data.meals,date,moveDate(date,6),workspaceId,library);
 const trainingProfile=store.training.profiles.find(x=>x.workspaceId===workspaceId);
 const trainingDay=(new Date(date+'T12:00:00').getDay()+6)%7;
 const dayPlans=profile?.useTraining?store.training.plans.filter(p=>p.workspaceId===workspaceId&&!p.archived&&p.days.includes(trainingDay)):[];
 const daySessions=profile?.useTraining?store.training.sessions.filter(s=>s.workspaceId===workspaceId&&s.status==='completed'&&s.date===date):[];
 const save=(fn:(n:NutritionData)=>NutritionData)=>setStore(old=>({...old,nutrition:fn(parseNutrition(old.nutrition))}));
 useEffect(()=>{let active=true;fetch('/data/taco-foods.json').then(r=>{if(!r.ok)throw Error('Falha');return r.json()}).then(v=>{if(active&&Array.isArray(v.foods)&&v.foods.length>=500)setCatalog(v.foods);else if(active)setCatalogError('Catálogo incompleto.')}).catch(()=>{if(active)setCatalogError('Não foi possível carregar o catálogo TACO.');});return()=>{active=false}},[]);
 useEffect(()=>{setDraft(null);setRecipeDraft(null);setNotice('')},[workspaceId]);
 const alert=(message:string)=>{setNotice(message)};
 const startMeal=(status:'planned'|'consumed')=>{setDraft({id:newId(),workspaceId,date,slot:'Almoço',title:'',status,ingredients:[],createdAt:new Date().toISOString()});setTab(status==='planned'?'plano':'diario')};
 const addIngredient=(target:'meal'|'recipe')=>{
  const food=library.find(x=>x.id===foodId),amount=Number(grams);
  if(!food||!validGrams(amount))return alert('Selecione um alimento e informe a quantidade válida em gramas.');
  const verdict=assessFood(food,restrictions);
  if(verdict==='blocked')return alert('Alimento incompatível com uma restrição registrada.');
  if(verdict==='unverified'&&highRisk)return alert('Ingredientes incompletos para as restrições registradas. Não foi possível adicionar sem revisão.');
  if(verdict==='unverified'&&!window.confirm('Ingredientes/contaminação cruzada não verificados. Revise o rótulo. Deseja continuar?'))return;
  const item:MealIngredient={id:newId(),foodId,grams:amount};
  if(target==='meal')setDraft(p=>p?{...p,ingredients:[...p.ingredients,item]}:p);
  else setRecipeDraft(p=>p?{...p,ingredients:[...p.ingredients,item]}:p);
 };
 const replaceIngredient=()=>{
  if(!draft||!swapItemId||!foodId)return alert('Selecione o ingrediente original e a substituição.');
  const replacement=library.find(f=>f.id===foodId),original=draft.ingredients.find(i=>i.id===swapItemId);
  if(!replacement||!original)return alert('Ingrediente indisponível.');
  const verdict=assessFood(replacement,restrictions);
  if(verdict==='blocked'||(verdict==='unverified'&&highRisk))return alert('Não foi possível sugerir uma substituição compatível com as restrições informadas.');
  const previousFood=library.find(f=>f.id===original.foodId);
  const prior=previousFood?scaleNutrients(previousFood,original.grams):null;
  const next=scaleNutrients(replacement,original.grams);
  const fmt=(x:number|null|undefined)=>typeof x==='number'?x.toLocaleString('pt-BR',{maximumFractionDigits:1}):'sem dado';
  if(!window.confirm('Substituir '+(previousFood?.name||'ingrediente')+' por '+replacement.name+' mantendo '+original.grams+' g? Energia: '+fmt(prior?.kcal)+' → '+fmt(next.kcal)+' kcal; proteína: '+fmt(prior?.protein)+' → '+fmt(next.protein)+' g. Não é equivalência clínica. Confira rótulos.'))return;
  setDraft({...draft,ingredients:draft.ingredients.map(i=>i.id===swapItemId?{...i,foodId}:i)});
  setSwapItemId('');alert('Substituição aplicada. Revise porções e valores nutricionais.');
 };
 const saveMeal=()=>{
  if(!draft?.title.trim()||!draft.ingredients.length)return alert('Preencha o título e os ingredientes.');
  const warning=checkedSafety(draft.ingredients);if(warning)return alert(warning);
  save(p=>({...p,meals:p.meals.some(x=>x.id===draft.id)?p.meals.map(x=>x.id===draft.id?draft:x):[...p.meals,draft]}));setDraft(null);alert('Refeição salva.');
 };
 const markConsumed=(meal:Meal)=>{
  const warning=checkedSafety(meal.ingredients);if(warning)return alert(warning);
  if(data.meals.some(m=>m.status==='consumed'&&m.sourceTemplateId===meal.id))return alert('O consumo desta refeição já foi registrado.');
  save(p=>p.meals.some(m=>m.status==='consumed'&&m.sourceTemplateId===meal.id)?p:{
   ...p,meals:[...p.meals,{...meal,id:newId(),status:'consumed',createdAt:new Date().toISOString(),sourceTemplateId:meal.id,
    ingredients:meal.ingredients.map(x=>({...x,id:newId()}))}]
  });
  alert('Consumo registrado. O planejamento original foi preservado.');
 };
 const createFood=()=>{
  if(!ownName.trim())return alert('Informe o nome do alimento.');
  const numbers=[ownEnergy,ownProtein,ownCarbs,ownFat].map(n);
  if(numbers.some(x=>x!==undefined&&(!Number.isFinite(x)||x<0||x>10000)))return alert('Valor nutricional inválido.');
  const food:FoodItem={id:newId(),workspaceId,name:ownName.trim(),category:'Meus alimentos',source:'Informado pelo usuário / rótulo',referenceUnit:'g',per100:{kcal:numbers[0]??null,protein:numbers[1]??null,carbs:numbers[2]??null,fat:numbers[3]??null,fiber:null,sodiumMg:null},allergens:ownAllergens,ingredientStatus:'unverified',aliases:[],ingredients:ownIngredients.split(',').map(x=>x.trim()).filter(Boolean),userProvided:true};
  save(p=>({...p,foods:[...p.foods,food]}));setCustomFood(false);setOwnName('');setOwnIngredients('');setOwnAllergens([]);alert('Alimento personalizado criado; confirme sempre seu rótulo.');
 };
 const saveRecipe=()=>{
  if(!recipeDraft?.title.trim()||!recipeDraft.ingredients.length)return alert('Inclua nome e ingredientes.');
  const warning=checkedSafety(recipeDraft.ingredients);if(warning)return alert(warning);
  save(p=>({...p,recipes:p.recipes.some(r=>r.id===recipeDraft.id)?p.recipes.map(r=>r.id===recipeDraft.id?recipeDraft:r):[...p.recipes,recipeDraft]}));setRecipeDraft(null);alert('Receita salva.');
 };
 const addRecipeToPlan=(recipe:Recipe)=>{
  const warning=checkedSafety(recipe.ingredients);if(warning)return alert(warning);
  setDraft({id:newId(),workspaceId,date,slot:'Almoço',title:recipe.title,ingredients:recipe.ingredients.map(x=>({...x,id:newId()})),status:'planned',createdAt:new Date().toISOString()});setTab('plano');
 };
 const saveProfile=()=>{
  const p=editingProfile||profile||freshProfile(workspaceId);
  const problems=validateProfile(p);if(problems.length)return alert(problems.join(' '));
  save(old=>({...old,profiles:[...old.profiles.filter(x=>x.workspaceId!==workspaceId),{...p,workspaceId,updatedAt:new Date().toISOString()}]}));setEditingProfile(null);alert('Preferências salvas.');
 };
 const addRestriction=()=>{
  const key=kind==='celiac'?'gluten':allergen;
  const label=key==='outro'?customAllergen.trim():ALLERGEN_OPTIONS.find(x=>x[0]===key)?.[1]||key;
  if(!label)return alert('Informe o ingrediente.');
  if(restrictions.some(r=>r.kind===kind&&r.allergen===key&&r.label.toLowerCase()===label.toLowerCase()))return alert('Esta restrição já está registrada.');
  const restriction:Restriction={id:newId(),workspaceId,allergen:key,label,kind,notes:restrictionNote.trim(),source:'self',severity:'unspecified',updatedAt:new Date().toISOString()};
  save(p=>({...p,restrictions:[...p.restrictions,restriction],restrictionAudit:[...p.restrictionAudit,{id:newId(),workspaceId,at:new Date().toISOString(),operation:'added',kind,allergen:key}]}));setRestrictionNote('');setCustomAllergen('');alert('Restrição declarada cadastrada. Isso não é diagnóstico.');
 };
 const removeRestriction=(r:Restriction)=>{
  if(!window.confirm('Excluir esta restrição? As recomendações serão recalculadas.'))return;
  save(p=>({...p,restrictions:p.restrictions.filter(x=>x.id!==r.id),restrictionAudit:[...p.restrictionAudit,{id:newId(),workspaceId,at:new Date().toISOString(),operation:'removed',kind:r.kind,allergen:r.allergen}]}));
 };
 const ingredientInputs=(target:'meal'|'recipe')=><div className="ns-ingredient-input"><input aria-label="Buscar ingrediente" placeholder="Filtrar alimentos..." value={ingredientQuery} onChange={e=>setIngredientQuery(e.target.value)}/><select aria-label="Selecionar ingrediente" value={foodId} onChange={e=>setFoodId(e.target.value)}><option value="">Selecionar alimento...</option>{library.filter(f=>!ingredientQuery||f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(ingredientQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))||f.id===foodId).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><input aria-label="Quantidade em gramas" type="number" min="1" max="5000" value={grams} onChange={e=>setGrams(e.target.value)}/><button type="button" className="ns-button ns-secondary" onClick={()=>addIngredient(target)}>Adicionar</button></div>;
 const activeItems=(target:'meal'|'recipe')=>{
  const items=target==='meal'?draft?.ingredients||[]:recipeDraft?.ingredients||[];
  return <div className="ns-ingredient-list">{items.map(item=><div key={item.id}><span>{library.find(f=>f.id===item.foodId)?.name||'Alimento indisponível'}</span><label>g <input type="number" min="1" value={item.grams} onChange={e=>{const amount=Number(e.target.value);if(!validGrams(amount))return;if(target==='meal')setDraft(p=>p?{...p,ingredients:p.ingredients.map(x=>x.id===item.id?{...x,grams:amount}:x)}:p);else setRecipeDraft(p=>p?{...p,ingredients:p.ingredients.map(x=>x.id===item.id?{...x,grams:amount}:x)}:p);}}/></label><button aria-label="Remover ingrediente" onClick={()=>{if(target==='meal')setDraft(p=>p?{...p,ingredients:p.ingredients.filter(x=>x.id!==item.id)}:p);else setRecipeDraft(p=>p?{...p,ingredients:p.ingredients.filter(x=>x.id!==item.id)}:p)}}><Trash2 size={16}/></button></div>)}</div>;
 };
 const dateBar=<div className="ns-date">
  <button type="button" aria-label="Dia anterior" onClick={()=>setDate(moveDate(date,-1))}><ChevronLeft size={18}/></button>
  <label className="ns-date-control">
   <span className="ns-date-caption">Data</span>
   <span className="ns-date-display"><CalendarDays size={17} aria-hidden="true"/><span>{dateLabel(date)}</span></span>
   <input type="date" aria-label="Escolher data do planejamento alimentar" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value)}}/>
  </label>
  <button type="button" aria-label="Próximo dia" onClick={()=>setDate(moveDate(date,1))}><ChevronRight size={18}/></button>
 </div>;
 return <div className="ns-root">
  <header className="ns-hero"><div><span className="ns-eyebrow"><Leaf size={15}/> EIXO / SAÚDE E ROTINA</span><h1>Alimentação e nutrição<span>.</span></h1><p>Refeições flexíveis, alimentos brasileiros e preferências respeitadas.</p></div>{onAcademia&&<button className="ns-button ns-secondary" onClick={onAcademia}>Voltar aos treinos <ArrowRight size={15}/></button>}</header>
  <div className="ns-safety-banner"><ShieldAlert size={20}/><span>Informe suas alergias e restrições antes de receber sugestões. Ingredientes e risco de contaminação cruzada exigem revisão do rótulo.</span><button onClick={()=>setTab('alergias')}>Revisar</button></div>
  <nav className="ns-tabs" aria-label="Seções de alimentação">{([['inicio','Visão geral'],['plano','Meu plano'],['alimentos','Alimentos'],['receitas','Receitas'],['alergias','Alergias'],['diario','Diário'],['compras','Compras'],['perfil','Meu perfil']] as [Tab,string][]).map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
  {notice&&<div className="ns-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Fechar"><X size={15}/></button></div>}
  {tab==='inicio'&&<>
   <div className="ns-section-head"><h2>Sua rotina alimentar</h2><button className="ns-button ns-secondary" onClick={()=>setTab('perfil')}>Personalizar</button></div>
   <div className="ns-stats"><div data-tone="info"><UtensilsCrossedIcon/><small>Planejadas hoje</small><strong>{planned.length}</strong></div><div data-tone={consumed.length?'positive':'neutral'}><Check size={19}/><small>Consumidas hoje</small><strong>{consumed.length}</strong></div><div><ShieldAlert size={19}/><small>Restrições declaradas</small><strong>{restrictions.length||'—'}</strong></div><div><BookOpen size={19}/><small>Alimentos TACO</small><strong>{catalog.length||'…'}</strong></div></div>
   {profile?.useTraining&&<section className="ns-panel"><h3>Treino e alimentação: {date}</h3><p>{dayPlans.length?'Fichas planejadas: '+dayPlans.map(p=>p.title).join(', '):'Nenhuma ficha prevista para esta data.'} {daySessions.length?'Sessões concluídas: '+daySessions.length+'.':''}</p><p>Use este contexto para organizar seus horários de refeição. Não há cálculo automático de calorias gastas nem prescrição pré/pós-treino.</p></section>}
   <div className="ns-row"><button className="ns-button ns-primary" onClick={()=>startMeal('planned')}><Plus size={16}/> Planejar refeição</button><button className="ns-button ns-secondary" onClick={()=>startMeal('consumed')}><Check size={16}/> Registrar consumo</button></div>
   {!profile?<section className="ns-panel"><h3>Primeiro: suas preferências</h3><p>Configure seus objetivos e estilo alimentar. Não é obrigatório contar calorias.</p><button className="ns-button ns-primary" onClick={()=>{setEditingProfile(freshProfile(workspaceId));setTab('perfil')}}>Configurar perfil</button></section>:
    <section className="ns-panel"><h3><Leaf size={18}/> Sugestões explicadas</h3><p>Filtradas pelo estilo alimentar e restrições declaradas. Confira sempre ingredientes e rótulos.</p><div className="ns-suggestions">{suggestions.length?suggestions.map(s=><button key={s.food.id} onClick={()=>{setQuery(s.food.name);setTab('alimentos')}}><b>{s.food.name}</b><small>{s.reason}</small><span>Consultar <ArrowRight size={13}/></span></button>):<p>Não há sugestões suficientemente verificáveis para suas restrições. Consulte um profissional para alternativas.</p>}</div></section>}
   {profile&&ideas.length>0&&<section className="ns-panel"><h3><BookOpen size={18}/> Ideias de refeições brasileiras</h3><p>Combinações editáveis com quantidades ilustrativas. Não são uma dieta prescrita; confira ingredientes, temperos, rótulos e contato cruzado.</p><div className="ns-suggestions">{ideas.slice(0,6).map(({idea,ingredients,safety})=><button key={idea.id} onClick={()=>{setDraft({id:newId(),workspaceId,date,slot:'Almoço',title:idea.title,ingredients:ingredients.map(x=>({...x,id:newId()})),status:'planned',createdAt:new Date().toISOString()});setTab('plano');alert('Revise as quantidades ilustrativas antes de salvar. Confira ingredientes e rótulos.')}}><b>{idea.title}</b><small>{idea.description}</small><span>{idea.occasion} · {idea.prepMinutes} min estimados · {safety==='unverified'?'ingredientes não verificados':'revisar procedência'} <ArrowRight size={13}/></span></button>)}</div></section>}
   {profile?.showNumbers&&consumed.length>0&&<section className="ns-panel"><h3>Resumo do consumo registrado</h3><Macro value={sumNutrition(consumed.flatMap(x=>x.ingredients),library)}/></section>}
  </>}
  {tab==='perfil'&&<section className="ns-panel"><div className="ns-section-head"><h2>Meu perfil alimentar</h2></div><p>Dados opcionais, armazenados na sua conta. Não geram dietas clínicas nem cargas de treino.</p>
   {trainingProfile&&<button className="ns-button ns-secondary" onClick={()=>{if(window.confirm('Copiar idade, altura e peso dos treinos para seu perfil alimentar?'))setEditingProfile({...editingProfile||profile||freshProfile(workspaceId),age:trainingProfile.age,heightCm:trainingProfile.heightCm,weightKg:trainingProfile.weightKg})}}>Importar medidas dos treinos (confirmar)</button>}
   {(()=>{const p=editingProfile||profile||freshProfile(workspaceId);const change=(next:Partial<NutritionProfile>)=>setEditingProfile({...p,...next});return <div className="ns-form-grid">
    <label>Objetivo<select value={p.objective} onChange={e=>change({objective:e.target.value as NutritionObjective})}>{Object.entries(NUTRITION_OBJECTIVES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label>Estilo alimentar<select value={p.style} onChange={e=>change({style:e.target.value as EatingStyle})}>{Object.entries(EATING_STYLES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label>Refeições por dia<input type="number" min="1" max="9" value={p.mealsPerDay} onChange={e=>change({mealsPerDay:Number(e.target.value)})}/></label>
    <label>Tempo de preparo (min)<input type="number" min="0" max="240" value={p.prepMinutes} onChange={e=>change({prepMinutes:Number(e.target.value)})}/></label>
    <label>Idade opcional<input type="number" min="18" value={p.age??''} onChange={e=>change({age:n(e.target.value)})}/></label>
    <label>Altura (cm) opcional<input type="number" value={p.heightCm??''} onChange={e=>change({heightCm:n(e.target.value)})}/></label>
    <label>Peso (kg) opcional<input type="number" step=".1" value={p.weightKg??''} onChange={e=>change({weightKg:n(e.target.value)})}/></label>
    <label>Orçamento semanal opcional (R$)<input type="number" value={p.budgetBRL??''} onChange={e=>change({budgetBRL:n(e.target.value)})}/></label>
    <label>Gosto destes alimentos (vírgulas)<input value={p.preferences.join(', ')} onChange={e=>change({preferences:e.target.value.split(',').map(x=>x.trim())})}/></label>
    <label>Quero evitar (vírgulas)<input value={p.dislikes.join(', ')} onChange={e=>change({dislikes:e.target.value.split(',').map(x=>x.trim())})}/></label>
    <label className="ns-check"><input type="checkbox" checked={p.useTraining} onChange={e=>change({useTraining:e.target.checked})}/> Considerar rotina dos treinos</label>
    <label className="ns-check"><input type="checkbox" checked={p.showNumbers} onChange={e=>change({showNumbers:e.target.checked})}/> Exibir macros opcionais</label>
    {p.showNumbers&&<><label>Meta informada manualmente (kcal/dia, opcional)<input type="number" min="0" value={p.manualGoals?.kcal??''} onChange={e=>change({manualGoals:{...p.manualGoals,kcal:n(e.target.value)}})}/></label><label>Meta manual de proteína (g/dia, opcional)<input type="number" min="0" value={p.manualGoals?.protein??''} onChange={e=>change({manualGoals:{...p.manualGoals,protein:n(e.target.value)}})}/></label></>}
    <button className="ns-button ns-primary" onClick={saveProfile}>Salvar preferências</button>
   </div>})()}
  </section>}
  {tab==='alergias'&&<section className="ns-panel"><div className="ns-section-head"><h2>Alergias e restrições</h2></div><p>Este formulário não diagnostica alergias. Não informado não significa ausência de alergia. Siga as recomendações médicas e confira rótulos e contaminação cruzada.</p>
   <div className="ns-form-grid"><label>Tipo<select value={kind} onChange={e=>{const next=e.target.value as RestrictionKind;setKind(next);if(next==='celiac')setAllergen('gluten')}}><option value="allergy">Alergia declarada</option><option value="suspected">Alergia suspeita</option><option value="intolerance">Intolerância</option><option value="celiac">Doença celíaca (glúten)</option><option value="medical">Orientação médica</option><option value="ethical">Ética / religião</option><option value="preference">Preferência / aversão</option></select></label><label>Ingrediente<select value={kind==='celiac'?'gluten':allergen} disabled={kind==='celiac'} onChange={e=>setAllergen(e.target.value)}>{ALLERGEN_OPTIONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{allergen==='outro'&&<label>Nome<input value={customAllergen} onChange={e=>setCustomAllergen(e.target.value)}/></label>}<label>Observações<input value={restrictionNote} onChange={e=>setRestrictionNote(e.target.value)}/></label></div>
   <button className="ns-button ns-primary" onClick={addRestriction}><Plus size={16}/> Adicionar restrição</button>
   <div className="ns-list">{restrictions.length?restrictions.map(r=><article key={r.id}><ShieldAlert size={16}/><span><b>{r.label}</b><small>{r.kind} · autodeclarada</small><small>{r.notes}</small></span><button onClick={()=>removeRestriction(r)} aria-label={'Remover '+r.label}><Trash2 size={16}/></button></article>):<p>Nenhuma restrição informada. Isso não é confirmação de ausência de alergias.</p>}</div>
  </section>}
  {tab==='alimentos'&&<>
   <div className="ns-section-head"><div><h2>Catálogo de alimentos</h2><p>TACO / NEPA–Unicamp 4ª ed. 2011. Nutrientes por 100g.</p></div><button className="ns-button ns-secondary" onClick={()=>setCustomFood(!customFood)}><Plus size={15}/> Alimento próprio</button></div>
   {catalogError&&<p className="ns-notice">{catalogError}</p>}
   {customFood&&<section className="ns-panel"><h3>Novo alimento</h3><p>Valores do seu rótulo por 100g. Deixe em branco o que desconhecer. Confirme ingredientes e alergênicos.</p><div className="ns-form-grid"><label>Nome<input value={ownName} onChange={e=>setOwnName(e.target.value)}/></label><label>kcal por 100 g<input value={ownEnergy} onChange={e=>setOwnEnergy(e.target.value)}/></label><label>Proteína g/100g<input value={ownProtein} onChange={e=>setOwnProtein(e.target.value)}/></label><label>Carboidratos g/100g<input value={ownCarbs} onChange={e=>setOwnCarbs(e.target.value)}/></label><label>Gorduras g/100g<input value={ownFat} onChange={e=>setOwnFat(e.target.value)}/></label><label>Ingredientes do rótulo separados por vírgula<input value={ownIngredients} onChange={e=>setOwnIngredients(e.target.value)}/></label></div><div className="ns-tags">{ALLERGEN_OPTIONS.filter(x=>x[0]!=='outro').map(([key,label])=><label key={key}><input type="checkbox" checked={ownAllergens.includes(key)} onChange={e=>setOwnAllergens(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))}/>{label}</label>)}</div><button className="ns-button ns-primary" onClick={createFood}>Salvar alimento próprio</button></section>}
   <label className="ns-check ns-favorites"><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> Mostrar apenas favoritos</label><div className="ns-search"><label><Search size={17}/><input aria-label="Buscar alimento" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar arroz, feijão, banana..."/></label><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filtrar categoria"><option value="">Todas as categorias</option>{categories.map(x=><option key={x}>{x}</option>)}</select></div><p className="ns-muted">{visible.length} resultados · mostrando até 80</p>
   <div className="ns-food-grid">{!visible.length&&<p className="ns-empty">Nenhum alimento encontrado. Ajuste os filtros ou salve seus favoritos.</p>}{visible.slice(0,80).map(f=>{const safety=assessFood(f,restrictions);return <article key={f.id}><div className="ns-food-title"><Apple size={19}/><div><b>{f.name}</b><small>{f.category}</small></div></div><span className={'ns-safety '+safety}>{safety==='blocked'?'Conflito com restrição':safety==='unverified'?'Ingredientes não verificados':'Conferir rótulo/contato cruzado'}</span><Macro value={f.per100}/><small>Fonte: {f.source}</small><div className="ns-row"><button className="ns-button ns-secondary" onClick={()=>setFoodId(f.id)}>Ver porção</button><button className="ns-button ns-secondary" aria-pressed={isFavorite(f.id)} aria-label={(isFavorite(f.id)?'Remover dos favoritos: ':'Favoritar: ')+f.name} onClick={()=>save(p=>({...p,favorites:isFavorite(f.id)?p.favorites.filter(x=>!(x.workspaceId===workspaceId&&x.foodId===f.id)):[...p.favorites,{workspaceId,foodId:f.id}]}))}><Star size={15} fill={isFavorite(f.id)?'currentColor':'none'}/>{isFavorite(f.id)?'Salvo':'Favoritar'}</button></div>{foodId===f.id&&<div className="ns-portion"><label>Quantidade g<input type="number" min="1" max="5000" value={grams} onChange={e=>setGrams(e.target.value)}/></label>{validGrams(Number(grams))&&<Macro value={scaleNutrients(f,Number(grams))}/>}<p>A composição nutricional não certifica ingredientes nem alergênicos.</p>{draft&&<button className="ns-button ns-primary" disabled={safety==='blocked'} onClick={()=>addIngredient('meal')}>Incluir na refeição aberta</button>}</div>}</article>})}</div>
  </>}
  {(tab==='plano'||tab==='diario')&&<>
   <div className="ns-section-head"><div><h2>{tab==='plano'?'Meu plano alimentar':'Diário alimentar'}</h2><p>{tab==='plano'?'Planejar não registra consumo automaticamente.':'Somente o que foi registrado como consumido.'}</p></div><button className="ns-button ns-primary" onClick={()=>startMeal(tab==='plano'?'planned':'consumed')}><Plus size={15}/> Nova refeição</button></div>{dateBar}
   {draft?.status===(tab==='plano'?'planned':'consumed')&&<section className="ns-panel ns-editor"><div className="ns-section-head"><h3>Editar refeição</h3><button onClick={()=>setDraft(null)} aria-label="Fechar"><X size={18}/></button></div><div className="ns-form-grid"><label>Nome<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Tipo<select value={draft.slot} onChange={e=>setDraft({...draft,slot:e.target.value as MealSlot})}>{MEAL_SLOTS.map(x=><option key={x}>{x}</option>)}</select></label><label className="ns-date-control ns-date-control-field">
    <span className="ns-date-caption">Data</span>
    <span className="ns-date-display"><CalendarDays size={17} aria-hidden="true"/><span>{dateLabel(draft.date)}</span></span>
    <input type="date" aria-label="Data da refeição" value={draft.date} onChange={e=>{if(e.target.value)setDraft({...draft,date:e.target.value})}}/>
   </label></div>    {activeItems('meal')}{ingredientInputs('meal')}
    {draft.ingredients.length>0&&<div className="ns-ingredient-input"><select aria-label="Ingrediente que será substituído" value={swapItemId} onChange={e=>setSwapItemId(e.target.value)}><option value="">Trocar ingrediente...</option>{draft.ingredients.map(i=><option key={i.id} value={i.id}>{library.find(f=>f.id===i.foodId)?.name}</option>)}</select><button className="ns-button ns-secondary" onClick={replaceIngredient}>Confirmar substituição</button></div>}
    <button className="ns-button ns-secondary" onClick={()=>setTab('alimentos')}>Buscar no catálogo</button>{profile?.showNumbers&&<Macro value={sumNutrition(draft.ingredients,library)}/>}<p>Se os ingredientes estiverem incompletos, verifique rótulos e fabricante antes de consumir.</p><button className="ns-button ns-primary" onClick={saveMeal}>Salvar refeição</button></section>}
   <div className="ns-meals">{(tab==='plano'?planned:consumed).length?(tab==='plano'?planned:consumed).map(meal=><article key={meal.id}><small>{meal.slot} · {meal.status==='planned'?'Planejada':'Consumida'}</small><h3>{meal.title}</h3><p>{meal.ingredients.map(x=>{const f=library.find(f=>f.id===x.foodId);return (f?.name||'Alimento removido')+' ('+x.grams+' g)'}).join(' · ')}</p>{profile?.showNumbers&&<Macro value={sumNutrition(meal.ingredients,library)}/>}<div className="ns-row"><button onClick={()=>setDraft({...meal})}>Editar</button>{meal.status==='planned'&&<button disabled={data.meals.some(m=>m.status==='consumed'&&m.sourceTemplateId===meal.id)} onClick={()=>markConsumed(meal)}>{data.meals.some(m=>m.status==='consumed'&&m.sourceTemplateId===meal.id)?'Consumo registrado':'Marcar consumida'}</button>}{meal.status==='planned'&&<button onClick={()=>{if(window.confirm('Copiar esta refeição para os próximos seis dias?'))save(p=>({...p,meals:[...p.meals,...Array.from({length:6},(_,i)=>({...meal,id:newId(),date:moveDate(meal.date,i+1),ingredients:meal.ingredients.map(x=>({...x,id:newId()}))}))]}))}}>Repetir na semana</button>}<button onClick={()=>{if(window.confirm('Excluir este registro?'))save(p=>({...p,meals:p.meals.filter(x=>x.id!==meal.id)}))}} aria-label="Excluir refeição"><Trash2 size={15}/></button></div></article>):<p className="ns-empty">Não há refeições {tab==='plano'?'planejadas':'consumidas'} neste dia.</p>}</div>
   {profile?.showNumbers&&tab==='diario'&&consumed.length>0&&<section className="ns-panel"><h3>Consumo registrado neste dia</h3><Macro value={sumNutrition(consumed.flatMap(x=>x.ingredients),library)}/></section>}
  </>}
  {tab==='receitas'&&<>
   <div className="ns-section-head"><h2>Receitas pessoais</h2><button className="ns-button ns-primary" onClick={()=>setRecipeDraft({id:newId(),workspaceId,title:'',ingredients:[],instructions:'',prepMinutes:20,createdAt:new Date().toISOString()})}><Plus size={16}/> Nova receita</button></div>
   {recipeDraft&&<section className="ns-panel ns-editor"><div className="ns-section-head"><h3>Editor de receitas</h3><button onClick={()=>setRecipeDraft(null)}><X size={17}/></button></div><div className="ns-form-grid"><label>Nome<input value={recipeDraft.title} onChange={e=>setRecipeDraft({...recipeDraft,title:e.target.value})}/></label><label>Tempo de preparo (min)<input type="number" value={recipeDraft.prepMinutes} onChange={e=>setRecipeDraft({...recipeDraft,prepMinutes:Number(e.target.value)})}/></label></div><label>Preparo<textarea rows={3} value={recipeDraft.instructions} onChange={e=>setRecipeDraft({...recipeDraft,instructions:e.target.value})}/></label>{activeItems('recipe')}{ingredientInputs('recipe')}{profile?.showNumbers&&<Macro value={sumNutrition(recipeDraft.ingredients,library)}/>}<button className="ns-button ns-primary" onClick={saveRecipe}>Salvar receita</button></section>}
   <div className="ns-meals">{recipes.length?recipes.map(r=><article key={r.id}><small>{r.prepMinutes} min estimados</small><h3>{r.title}</h3><p>{r.ingredients.map(x=>library.find(f=>f.id===x.foodId)?.name).join(', ')}</p><p>{r.instructions}</p><div className="ns-row"><button onClick={()=>setRecipeDraft({...r})}>Editar</button><button onClick={()=>addRecipeToPlan(r)}>Planejar</button><button onClick={()=>{if(window.confirm('Remover receita?'))save(p=>({...p,recipes:p.recipes.filter(x=>x.id!==r.id)}))}} aria-label="Excluir receita"><Trash2 size={15}/></button></div></article>):<p className="ns-empty">Nenhuma receita salva.</p>}</div>
  </>}
  {tab==='compras'&&<>
   <div className="ns-section-head"><div><h2>Lista de compras</h2><p>Ingredientes planejados para sete dias, sem incluir consumo já registrado.</p></div><button className="ns-button ns-secondary" onClick={()=>{const content='\uFEFFAlimento;Quantidade\r\n'+shopping.map(x=>safeCsvCell(x.food.name)+';'+safeCsvCell(x.grams+' g')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='eixo-compras.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}}><Download size={15}/> Exportar</button></div>{dateBar}
   <section className="ns-panel ns-shopping">{shopping.length?shopping.map(item=>{const checked=data.shoppingChecks.find(x=>x.workspaceId===workspaceId&&x.foodId===item.foodId)?.checked||false;return <label key={item.foodId}><input type="checkbox" checked={checked} onChange={e=>save(p=>({...p,shoppingChecks:[...p.shoppingChecks.filter(x=>!(x.workspaceId===workspaceId&&x.foodId===item.foodId)),{workspaceId,foodId:item.foodId,checked:e.target.checked}]}))}/><span><b>{item.food.name}</b><small>{item.food.category}</small></span><strong>{item.grams.toLocaleString('pt-BR')} g</strong></label>}):<p className="ns-empty">Planeje refeições para gerar a lista.</p>}</section>
  </>}
  <footer className="ns-footer"><p>Composição: TACO / NEPA–Unicamp (2011), por 100g. Valores variam por marca e preparo. A tabela de nutrientes não certifica alergênicos.</p><p>Informações educativas; não substituem acompanhamento de nutricionista ou médico. Sempre confira rótulos e risco de contaminação cruzada.</p></footer>
 </div>
}
function UtensilsCrossedIcon(){return <Apple size={19}/>};
