import AppLoading from './AppLoading';
import ModuleSetup from './ModuleSetup';
import type {SetupChoice} from './ModuleSetup';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
const AdminConsole=lazy(()=>import('./AdminConsole'));
import type {FormEvent,ReactNode} from 'react';
import {Camera,Smartphone,Share2,ArrowLeft,ArrowRight,Check,CheckCircle2,ChevronRight,Cloud,Download,Eye,EyeOff,KeyRound,LockKeyhole,Mail,MonitorSmartphone,ShieldCheck,Sparkles,UserRound,Wallet,X} from 'lucide-react';
import {activateCloud,deactivateCloud,hasPendingChanges,syncCloud} from './cloud';
import {emptyStore,STORAGE_KEY} from './model';
import type {Store} from './model';
import './auth.css';
import {AccountContext} from './AccountContext';
import {Brand} from './Brand';
import LandingPage from './LandingPage';
import AsaasLiveCheckout from './AsaasLiveCheckout';
type User={avatarId:string|null;avatarUrl:string|null;id:string;email:string;displayName:string;fullName:string;phone:string;locale:string;timezone:string;owner:boolean;platformRole?:'owner'|'admin'|'support'|null;trialEndsAt:string|null;trialActive:boolean;access:boolean;subscription:string};
type Plan={id:string;name:string;amountCents:number;originalAmountCents?:number;months:number};
type View='onboarding'|'loading'|'landing'|'login'|'register'|'forgot'|'reset'|'ready'|'migrate'|'account'|'pricing'|'expired'|'unavailable'|'admin';
async function request<T=any>(url:string,method='GET',data?:unknown):Promise<T>{
 const r=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 let result;try{result=await r.json()}catch{throw Error('Resposta inválida do servidor.')}
 if(!r.ok)throw Error(result?.error||'Não foi possível concluir a solicitação.');
 return result as T;
}
const localBackup=():Store|null=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return null;const s=JSON.parse(raw);if(!s||!s.collections||!s.preferences)return null;return s}catch{return null}};
const hasLegacyData=(s:Store|null)=>Boolean(s&&(Object.values(s.collections).some(v=>Array.isArray(v)&&v.length)||s.brain?.ideas?.length||s.erp&&Object.values(s.erp).some(v=>Array.isArray(v)&&v.length)));
const downloadBackup=(value:unknown,name:string)=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export default function AuthGate({children}:{children:ReactNode}){
 const previewMode=import.meta.env.VITE_EIXO_PREVIEW==='1';
 const privateRemote=location.hostname.endsWith('.trycloudflare.com');
 const [introComplete,setIntroComplete]=useState(false);
 const [avatarId,setAvatarId]=useState<string|null>(null),[uploadingAvatar,setUploadingAvatar]=useState(false),[installVisible,setInstallVisible]=useState(false),[installIos,setInstallIos]=useState(false);const installPrompt=useRef<any>(null);
 const [view,setView]=useState<View>('loading'),[user,setUser]=useState<User|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[showPassword,setShowPassword]=useState(false);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[resetToken,setResetToken]=useState(''),[profile,setProfile]=useState({displayName:'',fullName:'',phone:''});
 const [legacy,setLegacy]=useState<Store|null>(null),[backupDone,setBackupDone]=useState(false),[plans,setPlans]=useState<Plan[]>([]),[remoteState,setRemoteState]=useState<Store|null>(null),[backView,setBackView]=useState<View>('ready');
 const actionRef=useRef(false);
 const [catalogLoading,setCatalogLoading]=useState(true),[catalogError,setCatalogError]=useState(false),[trialHours,setTrialHours]=useState<number>();
 const loadPlans=async()=>{setCatalogLoading(true);setCatalogError(false);try{const result=await request<{plans:Plan[];trialHours:number}>('/api/plans');setPlans(result.plans);setTrialHours(result.trialHours)}catch{setCatalogError(true)}finally{setCatalogLoading(false)}};
 useEffect(()=>{const saved=localStorage.getItem('eixo-theme');document.documentElement.setAttribute('data-theme',saved==='dark'?'dark':'light')},[]);
 useEffect(()=>{const handler=(e:Event)=>{e.preventDefault();installPrompt.current=e;if(view==='ready'&&Date.now()>=Number(localStorage.getItem('eixo-install-hide-until')||0)&&!matchMedia('(display-mode: standalone)').matches)setInstallVisible(true)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[view]);
 useEffect(()=>{if(view!=='ready')return;const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true;if(standalone)return;if(Date.now()<Number(localStorage.getItem('eixo-install-hide-until')||0))return;const ua=navigator.userAgent;const ios=/iPad|iPhone|iPod/.test(ua)&&!/CriOS|FxiOS|EdgiOS/.test(ua);setInstallIos(ios);const t=setTimeout(()=>setInstallVisible(Boolean(installPrompt.current)||ios),7000);return()=>clearTimeout(t)},[view]);
 const dismissInstall=()=>{setInstallVisible(false);localStorage.setItem('eixo-install-hide-until',String(Date.now()+14*86400000))};
 const installApp=async()=>{if(installPrompt.current){await installPrompt.current.prompt();try{await installPrompt.current.userChoice}catch{}installPrompt.current=null;setInstallVisible(false)}else setInstallIos(true)};
 const uploadAvatar=async(file:File|null)=>{if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Selecione JPG, PNG ou WebP até 5 MB.');return}setUploadingAvatar(true);try{const r=await fetch('/api/media',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Eixo-Workspace':'pessoal'},body:file});const data=await r.json();if(!r.ok)throw Error(data.error||'Falha ao enviar foto.');setAvatarId(data.id);setMessage('Foto enviada. Clique em Salvar dados para atualizar seu perfil.')}catch(e){setError((e as Error).message)}finally{setUploadingAvatar(false)}};

 useEffect(()=>{void loadPlans();const callback=()=>{setBackView('ready');setView('account')};window.addEventListener('eixo:account',callback);return()=>window.removeEventListener('eixo:account',callback)},[]);
 useEffect(()=>{if(actionRef.current)return;actionRef.current=true;
  if(previewMode){setView('landing');return}
  (async()=>{try{
    const params=new URLSearchParams(location.search),action=params.get('action'),token=params.get('token');
    if(action==='home'){setView('landing');return}
    if(token&&(action==='verify'||action==='reset')){
      history.replaceState({},'',location.pathname);
      if(action==='reset'){setResetToken(token);setView('reset');return}
      await request('/api/auth/verify','POST',{token});setMessage('E-mail confirmado. Entre para acessar sua conta.');
    }
    const res=await fetch('/api/me',{credentials:'same-origin'});
    if(res.status===401){setView(action==='register'&&!privateRemote?'register':action==='login'||action==='verify'?'login':'landing');return}
    if(!res.ok)throw Error('Servidor de autenticação indisponível.');
    const data=await res.json();await beginSession(data.user);
  }catch(e){setError(e instanceof Error?e.message:'Falha na conexão.');setView('unavailable')}})();
 },[]);
 const beginSession=async(u:User)=>{
  setUser(u);setAvatarId(u.avatarId);setProfile({displayName:u.displayName,fullName:u.fullName,phone:u.phone});
  const [cloud]=await Promise.all([request<{version:number;state:Store|null}>('/api/state'),import('./App')]);
  setRemoteState(cloud.state);
  if(!u.access){setView('expired');return}
  if(cloud.state){
   sessionStorage.setItem(STORAGE_KEY,JSON.stringify(cloud.state));sessionStorage.setItem('eixo:cloud','1');
   activateCloud(cloud.version,cloud.state);setView('ready');return;
  }
  const older=localBackup();
  if(hasLegacyData(older)){setLegacy(older);setBackupDone(false);setView('migrate');return}
  setError('');setView('onboarding');
 };
 const initialize=async(s:Store,baseVersion:number)=>{
  const save=await request<{version:number}>('/api/state','PUT',{baseVersion,state:s});
  sessionStorage.setItem(STORAGE_KEY,JSON.stringify(s));sessionStorage.setItem('eixo:cloud','1');
  activateCloud(save.version,s);setView('ready');
 };
 const action=async(e:FormEvent,kind:'login'|'register'|'forgot'|'reset')=>{
  e.preventDefault();setError('');setMessage('');setBusy(true);
  try{
   if(kind==='register'){const r=await request<{message:string}>('/api/auth/register','POST',{name,email,password});setMessage(r.message+' No ambiente local de desenvolvimento, o link é salvo em server-data/outbox, sem envio real de e-mails.');setView('login');setPassword('')}
   if(kind==='login'){const r=await request<{user:User}>('/api/auth/login','POST',{email,password});setPassword('');setIntroComplete(false);setView('loading');await beginSession(r.user)}
   if(kind==='forgot'){const r=await request<{message:string}>('/api/auth/forgot','POST',{email});setMessage(r.message+' No ambiente local, o link fica em server-data/outbox.');setView('login')}
   if(kind==='reset'){await request('/api/auth/reset','POST',{token:resetToken,password:newPassword});setNewPassword('');setResetToken('');setMessage('Senha atualizada. Entre novamente.');setView('login')}
  }catch(err){if(kind==='login')setView('login');setError(err instanceof Error?err.message:'Erro inesperado.')}finally{setBusy(false)}
 };
 const logout=async()=>{
  if(hasPendingChanges())await syncCloud();
  if(hasPendingChanges()&&!window.confirm('Existem alterações ainda não sincronizadas. Sair mesmo assim?'))return;
  try{await request('/api/auth/logout','POST',{})}catch{}
  deactivateCloud();sessionStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem('eixo:cloud');
  setUser(null);setView('login');setEmail('');setPassword('');setError('');setMessage('');
 };
 const saveProfile=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await request<{user:User}>('/api/me','PATCH',{...profile,avatarId});setUser(r.user);setMessage('Perfil atualizado.')}catch(e){setError(String((e as Error).message))}finally{setBusy(false)}};
 const changePassword=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await request('/api/auth/change-password','POST',{currentPassword,password:newPassword});setCurrentPassword('');setNewPassword('');setMessage('Sua senha foi alterada e as outras sessões foram encerradas.')}catch(e){setError(String((e as Error).message))}finally{setBusy(false)}};
 const startWithOld=async()=>{if(!legacy||!backupDone)return;setBusy(true);setError('');try{await initialize(legacy,0);setMessage('Dados locais importados para sua conta. O backup anterior foi preservado.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const startNew=async()=>{setError('');setView('onboarding')};
 const completeSetup=async(choice:SetupChoice)=>{setBusy(true);setError('');try{const s=emptyStore();s.preferences={...s.preferences,...choice,name:user?.displayName||user?.fullName||''};await initialize(s,0)}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const subscriptionLabel=user?.owner?'Lifetime — proprietário':user?.subscription==='trial'?'Teste gratuito ativo':user?.subscription==='active'?'Assinatura ativa':'Teste expirado';
 const remaining=user?.trialEndsAt?Math.max(0,Math.ceil((new Date(user.trialEndsAt).getTime()-Date.now())/3600000)):0;
 const authForm=(kind:'login'|'register'|'forgot'|'reset')=><div className="auth-stage"><div className="auth-sidebar"><Brand/><div className="auth-story"><small>UMA VIDA. UM SISTEMA.</small><h2>Organize o que realmente importa.</h2><p>Finanças, estudos, negócios, academia e planos em uma plataforma feita para a sua rotina.</p><div className="auth-perks"><span><CheckCircle2 size={16}/> Seus projetos em um só lugar</span><span><ShieldCheck size={16}/> Acesso protegido por senha</span><span><Cloud size={16}/> Dados associados à sua conta</span></div></div><small className="auth-copyright">EIXO OS · Uma vida. Um sistema.</small></div><main className="auth-content"><div className="auth-card">
 <a className="auth-home-link" href="?action=home"><ArrowLeft size={15}/> Conhecer o EIXO</a><div className="auth-card-icon"><LockKeyhole size={22}/></div><h1>{kind==='login'?'Bem-vindo de volta':kind==='register'?'Crie sua conta':kind==='forgot'?'Recuperar acesso':'Definir nova senha'}</h1>
 <p>{kind==='login'?'Entre para acessar seu espaço pessoal.':kind==='register'?'3 dias de acesso completo, sem cartão.':kind==='forgot'?'Solicite um link para redefinir sua senha.':'Escolha uma nova senha segura.'}</p>
 <form onSubmit={e=>void action(e,kind)}>
 {kind==='register'&&<label>Nome completo<input required minLength={2} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></label>}
 {kind!=='reset'&&<label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>}
 {(kind==='login'||kind==='register')&&<label>Senha<div className="auth-pass"><input required minLength={kind==='register'?12:1} maxLength={128} type={showPassword?'text':'password'} autoComplete={kind==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={kind==='register'?'Mínimo de 12 caracteres':'Sua senha'}/><button type="button" onClick={()=>setShowPassword(x=>!x)} aria-label="Mostrar senha">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
 {kind==='reset'&&<label>Nova senha<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo de 12 caracteres"/></label>}
 <button disabled={busy} className="auth-primary" type="submit">{busy?'Aguarde...':kind==='login'?'Entrar':kind==='register'?'Criar conta':kind==='forgot'?'Enviar instruções':'Alterar senha'} <ArrowRight size={16}/></button>
 </form>
 {error&&<div className="auth-alert error" role="alert">{error}</div>}{message&&<div className="auth-alert success" role="status">{message}</div>}
 <div className="auth-switch">{kind==='login'?privateRemote?<span>Use sua conta existente. Cadastro e recuperação de senha pela internet ficam indisponíveis até configurarmos o envio seguro de e-mails.</span>:<><button onClick={()=>{setError('');setView('forgot')}}>Esqueci minha senha</button><span>Não tem conta? <button onClick={()=>{setError('');setView('register')}}>Cadastre-se</button></span></>:<button onClick={()=>{setError('');setView('login')}}><ArrowLeft size={14}/> Voltar para entrar</button>}</div>
 </div><button className="auth-pricing-link" onClick={()=>{setBackView(view);setView('pricing')}}>Conheça os planos e preços <ArrowRight size={14}/></button></main></div>;
 if(view==='loading'||!introComplete)return <AppLoading onComplete={()=>setIntroComplete(true)}/>;
 if(view==='onboarding')return <ModuleSetup name={user?.displayName||user?.fullName||'Olá'} busy={busy} error={error} onComplete={choice=>void completeSetup(choice)} onLogout={()=>void logout()}/>;
 if(view==='unavailable')return <div className="auth-centered"><div className="auth-white-card"><Cloud size={28}/><h1>Serviço indisponível</h1><p>Não foi possível acessar a autenticação local. Inicie o servidor EIXO e tente novamente. Nenhum dado foi excluído.</p>{error&&<div className="auth-alert error">{error}</div>}<button className="auth-primary" onClick={()=>location.reload()}>Tentar novamente</button></div></div>;
 if(view==='landing')return <LandingPage plans={plans} trialHours={trialHours} loading={catalogLoading} error={catalogError} onRetry={()=>void loadPlans()} registrationAvailable={!privateRemote&&!previewMode} previewMode={previewMode}/>;
 if(['login','register','forgot','reset'].includes(view))return authForm(view as 'login'|'register'|'forgot'|'reset');
 if(view==='migrate')return <div className="auth-centered"><div className="auth-white-card wide"><div className="auth-card-icon"><Download size={22}/></div><h1>Encontramos seus registros antigos</h1><p>Seus dados anteriores continuam neste navegador. Escolha importar para a conta ou iniciar vazia. Seus registros originais não serão excluídos automaticamente.</p><div className="auth-migration-actions"><button className="auth-secondary" onClick={()=>{if(legacy){downloadBackup(legacy,'eixo-backup-antes-migracao.json');setBackupDone(true)}}}><Download size={16}/> 1. Baixar backup dos dados antigos</button><button className="auth-primary" disabled={!backupDone||busy} onClick={()=>void startWithOld()}><Cloud size={16}/> 2. Importar dados para minha conta</button><button className="auth-secondary" disabled={busy} onClick={()=>void startNew()}>Iniciar conta vazia e preservar dados antigos</button></div>{error&&<div className="auth-alert error">{error}</div>}<button className="auth-text" onClick={()=>void logout()}>Sair da conta</button></div></div>;
 if(view==='pricing')return <div className="auth-centered"><div className="auth-white-card pricing-card"><button className="auth-close" onClick={()=>setView(backView)} aria-label="Voltar"><X size={20}/></button><Brand/><div className="eyebrow">SEU PRÓXIMO CICLO</div><h1>Mais espaço para o que importa.</h1><p>Todos os períodos oferecem os mesmos recursos. Apenas a duração e o preço mudam.</p>{user&&<div className="auth-subscription"><ShieldCheck size={18}/><span>Sua conta: <strong>{subscriptionLabel}</strong></span></div>}<div className="auth-pricing-grid">{plans.map(p=><div className="auth-plan" key={p.id}><img className="plan-art" src={`/brand/plan-${p.months===12?'annual':p.months===6?'semiannual':'monthly'}.svg`} alt="" width="320" height="180"/><b>{p.name}</b>{p.originalAmountCents!==undefined&&p.originalAmountCents>p.amountCents&&<div className="auth-promo-summary"><span className="auth-promo-chip">Oferta de lançamento</span><span>De <del>{money(p.originalAmountCents)}</del> · {Math.round(100*(1-p.amountCents/p.originalAmountCents))}% OFF</span></div>}<strong>{money(p.amountCents)}</strong><span>{p.months===1?'por mês':`a cada ${p.months} meses`}</span><small>{p.months>1&&plans.find(x=>x.months===1)?`Economia de ${(100*(1-p.amountCents/(plans.find(x=>x.months===1)!.amountCents*p.months))).toLocaleString('pt-BR',{maximumFractionDigits:1})}% em relação ao mensal`:'Pagamento mensal'}</small><ul className="plan-benefits"><li><Check size={15}/> Gestão pessoal e empresarial</li><li><Check size={15}/> Mesmos recursos em todos os períodos</li><li><Check size={15}/> Acesso por {p.months} {p.months===1?'mês':'meses'}</li></ul><AsaasLiveCheckout plan={p} authenticated={Boolean(user)}/></div>)}</div>{plans.length===0&&<p role="status">Não foi possível carregar os planos. <button className="auth-text" onClick={()=>void request<{plans:Plan[]}>('/api/plans').then(r=>setPlans(r.plans))}>Tentar novamente</button></p>}<p className="auth-disclaimer">Primeiros 3 dias gratuitos para contas verificadas. As compras reais são disponibilizadas somente após ativação segura da integração Asaas em produção. As prévias de Sandbox não cobram nem concedem assinatura.</p></div></div>;
 if(view==='expired')return <div className="auth-centered"><div className="auth-white-card wide"><LockKeyhole size={30}/><h1>Seu teste gratuito terminou</h1><p>Os registros da sua conta continuam preservados. A edição permanece bloqueada enquanto não houver uma assinatura confirmada pelo servidor.</p><button className="auth-primary" onClick={()=>{setBackView('expired');setView('pricing')}}>Ver planos <ArrowRight size={15}/></button><button className="auth-secondary" onClick={()=>{if(remoteState)downloadBackup(remoteState,'eixo-conta-exportacao.json')}}>Exportar meus dados</button><button className="auth-text" onClick={()=>{setBackView('expired');setView('account')}}>Meu perfil</button><button className="auth-text" onClick={()=>void logout()}>Sair</button></div></div>;
 if(view==='admin')return <Suspense fallback={<AppLoading/>}><AdminConsole onBack={()=>setView('account')}/></Suspense>;
 if(view==='account')return <div className="auth-centered"><div className="auth-white-card account-card"><button className="auth-close" onClick={()=>setView(backView)} aria-label="Voltar"><X size={20}/></button><div className="auth-avatar-wrap"><label className="auth-avatar-picker">{avatarId?<img alt="Foto de perfil" src={'/api/media/'+avatarId}/>:<UserRound size={30}/>}<span><Camera size={14}/></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingAvatar} onChange={e=>{void uploadAvatar(e.target.files?.[0]||null);e.target.value=''}}/></label><div><h1>Minha conta</h1><small>{uploadingAvatar?'Enviando foto...':'Toque na foto para alterar · até 5 MB'}</small></div></div><p>{user?.email}</p><div className="auth-subscription"><ShieldCheck size={19}/><span><strong>{subscriptionLabel}</strong><small>{user?.owner?'Acesso vitalício sem cobranças':user?.trialActive?`Aproximadamente ${remaining} hora(s) restantes`:'Acesse os planos para saber mais'}</small></span><button onClick={()=>{setBackView('account');setView('pricing')}}>Planos <ChevronRight size={15}/></button></div><div className="account-columns"><form onSubmit={e=>void saveProfile(e)}><h3>Dados do perfil</h3><label>Nome de exibição<input value={profile.displayName} required onChange={e=>setProfile(v=>({...v,displayName:e.target.value}))}/></label><label>Nome completo<input value={profile.fullName} onChange={e=>setProfile(v=>({...v,fullName:e.target.value}))}/></label><label>Telefone<input type="tel" autoComplete="tel" value={profile.phone} onChange={e=>setProfile(v=>({...v,phone:e.target.value}))}/></label><button type="submit" className="auth-primary" disabled={busy||uploadingAvatar}>Salvar dados</button></form><form onSubmit={e=>void changePassword(e)}><h3>Segurança</h3><label>Senha atual<input type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>Nova senha<input type="password" minLength={12} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><button type="submit" className="auth-secondary" disabled={busy}><KeyRound size={15}/> Alterar senha</button><button type="button" className="auth-secondary" onClick={()=>void request('/api/account/revoke-other-sessions','POST',{}).then(()=>setMessage('Outras sessões encerradas.')).catch(e=>setError(e.message))}><MonitorSmartphone size={15}/> Encerrar outras sessões</button></form></div>{error&&<div className="auth-alert error">{error}</div>}{message&&<div className="auth-alert success">{message}</div>}<div className="auth-account-footer">{user?.platformRole&&<button onClick={()=>{setError('');setMessage('');setView('admin')}}>Administração</button>}<button onClick={()=>void logout()}>Sair da conta</button><button onClick={()=>{setBackView('ready');setView('ready')}}>Voltar ao aplicativo</button></div></div></div>;
 return <>{installVisible&&<div className="auth-install-prompt"><div className="auth-install-icon"><Smartphone size={21}/></div><div><strong>Instale o EIXO</strong><p>{installIos?'No Safari, toque em Compartilhar e depois Adicionar à Tela de Início.':'Acesse o EIXO direto da tela inicial do celular.'}</p></div><div className="auth-install-buttons">{!installIos&&<button onClick={()=>void installApp()}>Instalar</button>}<button onClick={dismissInstall}>Agora não</button></div></div>}<AccountContext.Provider value={{account:user,openAccount:()=>{setBackView('ready');setMessage('');setError('');setView('account')},openPlans:()=>{setBackView('ready');setView('pricing')},logout:()=>void logout()}}>{children}</AccountContext.Provider></>;
}
