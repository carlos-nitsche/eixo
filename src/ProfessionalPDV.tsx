import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ArrowLeft,Barcode,Check,CheckCircle2,ChevronDown,Clock3,CreditCard,Delete,FileText,Keyboard,Minus,Package,PauseCircle,Play,Plus,Printer,Receipt,Search,ShoppingBag,ShoppingCart,Store,Trash2,UserRound,Wallet,X} from 'lucide-react';
import type {Entry} from './model';
import type {ERPLine,ERPOrder,ERPProduct} from './erp';
import {erpDate,money,round} from './erp';
import {emptyPOSDraft,posAddProduct,posDraftValid,posFindProduct,posTotals} from './pos-logic';
import type {POSDraft} from './pos-logic';
import type {ScanResult} from './BarcodeScanner';
import './professional-pdv.css';
const BarcodeScanner=lazy(()=>import('./BarcodeScanner'));
type Props={products:ERPProduct[];clients:Entry[];workspaceId:string;workspaceTitle:string;
 onFinish:(draft:POSDraft)=>Promise<ERPOrder>;onPrint:(order:ERPOrder)=>void;onPDF:(order:ERPOrder)=>void;onExit:()=>void;onRegisterProduct:(barcode:string)=>void};
const methods=['Dinheiro','PIX','Cartão de débito','Cartão de crédito','Boleto','Transferência','A prazo'];
const copy=(x:POSDraft):POSDraft=>({...x,lines:x.lines.map(l=>({...l}))});
function storageKey(account:string,ws:string){return 'eixo:pdv:pending:'+account+':'+ws}
function suspendedKey(account:string,ws:string){return 'eixo:pdv:suspended:'+account+':'+ws}
function draftFromDisk(account:string,ws:string){
 try{const raw=sessionStorage.getItem(storageKey(account,ws));const parsed=raw?JSON.parse(raw):null;return posDraftValid(parsed)?({...emptyPOSDraft(erpDate()),...parsed} as POSDraft):emptyPOSDraft(erpDate())}
 catch{return emptyPOSDraft(erpDate())}
}
function suspendedFromDisk(account:string,ws:string):POSDraft[]{
 try{const value=JSON.parse(sessionStorage.getItem(suspendedKey(account,ws))||'[]');return Array.isArray(value)?value.filter(posDraftValid).slice(0,10):[]}
 catch{return []}
}
export default function ProfessionalPDV({products,clients,workspaceId,workspaceTitle,onFinish,onPrint,onPDF,onExit,onRegisterProduct}:Props){
 const [identity,setIdentity]=useState<string|null>(null);
 const [draft,setDraft]=useState<POSDraft>(()=>emptyPOSDraft(erpDate()));
 const [suspended,setSuspended]=useState<POSDraft[]>([]);
 const [search,setSearch]=useState(''),[scanCode,setScanCode]=useState(''),[category,setCategory]=useState('Todos');
 const [scanner,setScanner]=useState(false),[checkout,setCheckout]=useState(false),[clientSelect,setClientSelect]=useState(false),[suspendSelect,setSuspendSelect]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[lastSale,setLastSale]=useState<ERPOrder|null>(null);
 const [selectedId,setSelectedId]=useState('');
 const searchRef=useRef<HTMLInputElement>(null),barcodeRef=useRef<HTMLInputElement>(null);
 const lock=useRef(false);
 const [shortcuts,setShortcuts]=useState(false);
 const subtotal=posTotals(draft.lines,draft.discount,draft.shipping);
 const productsActive=useMemo(()=>products.filter(p=>p.active!==false),[products]);
 const categories=useMemo(()=>['Todos',...new Set(productsActive.map(p=>p.category).filter(Boolean))], [productsActive]);
 const filtered=useMemo(()=>productsActive.filter(p=>{
  const term=search.trim().toLocaleLowerCase('pt-BR'),matches=!term||[p.title,p.sku,p.barcode,p.category].some(x=>x?.toLocaleLowerCase('pt-BR').includes(term));
  return matches&&(category==='Todos'||p.category===category);
 }).sort((a,b)=>a.title.localeCompare(b.title)),[productsActive,search,category]);
 const client=clients.find(c=>c.id===draft.clientId);
 const set=(patch:Partial<POSDraft>)=>setDraft(old=>({...old,...patch}));
 const message=(text:string,negative=false)=>{setNotice(text);setError(negative?text:'')};
 const add=(p:ERPProduct,quantity=1)=>{
  if(busy||!identity)return;
  try{setDraft(old=>({...old,lines:posAddProduct(old.lines,p,quantity)}));setSelectedId(p.id);setNotice(p.title+' adicionado.');setError('')}
  catch(e){message(e instanceof Error?e.message:'Não foi possível adicionar.',true)}
 };
 const setQuantity=(productId:string,quantity:number)=>{
  const product=products.find(p=>p.id===productId);
  if(!product)return message('Produto não encontrado.',true);
  if(quantity<=0){setDraft(x=>({...x,lines:x.lines.filter(l=>l.productId!==productId)}));return}
  if(!Number.isFinite(quantity)||quantity>product.stock)return message('Estoque insuficiente. Disponível: '+product.stock+'.',true);
  setDraft(old=>({...old,lines:old.lines.map(l=>l.productId===productId?{...l,quantity:round(quantity),price:product.price}:l)}));
  setSelectedId(productId);
 };
 const lookup=(raw:string):ScanResult=>{
  const result=posFindProduct(products,raw);
  if(result.error){message(result.error,true);return {kind:'warning',message:result.error,...(result.error==='Produto não cadastrado.'?{unknownCode:raw}:{})}}
  add(result.product!);
  return {kind:'success',message:result.product!.title+' adicionado ao caixa.'};
 };
 const scanManual=()=>{if(!scanCode.trim())return;lookup(scanCode);setScanCode('');barcodeRef.current?.focus()};
 const reset=()=>{
  if(draft.lines.length&&!window.confirm('Iniciar outra venda? A venda atual será descartada.'))return;
  setDraft(emptyPOSDraft(erpDate()));setCheckout(false);setLastSale(null);setScanCode('');setSearch('');setNotice('Novo atendimento iniciado.');
 };
 const suspend=()=>{
  if(!draft.lines.length)return message('O carrinho está vazio.',true);
  const next=[copy(draft),...suspended].slice(0,10);
  setSuspended(next);setDraft(emptyPOSDraft(erpDate()));setCheckout(false);setSuspendSelect(false);setNotice('Venda suspensa neste navegador. Use F8 para retomar.');
 };
 const resume=(idx:number)=>{
  if(draft.lines.length&&!window.confirm('A venda atual será suspensa automaticamente. Continuar?'))return;
  const next=suspended.filter((_,i)=>i!==idx);
  if(draft.lines.length)next.unshift(copy(draft));
  setSuspended(next);setDraft(copy(suspended[idx]));setSuspendSelect(false);setCheckout(false);setNotice('Venda recuperada. Revise os valores e o estoque.');
 };
 const checkoutOpen=()=>{
  if(!draft.lines.length)return message('Adicione um produto antes de finalizar.',true);
  if(subtotal.total<=0)return message('O total precisa ser maior que zero.',true);
  if(draft.paymentMethod==='A prazo'&&!draft.clientId)return message('Selecione um cliente para venda a prazo.',true);
  if(draft.lines.some(l=>{const p=products.find(x=>x.id===l.productId);return !p||!p.active||p.stock<l.quantity;}))return message('Revise produtos indisponíveis ou estoque insuficiente.',true);
  if(draft.discount>subtotal.subtotal+draft.shipping)return message('Desconto maior que o total.',true);
  setError('');setCheckout(true);
 };
 const finish=async()=>{
  if(lock.current)return;
  if(!draft.lines.length||subtotal.total<=0)return;
  lock.current=true;setBusy(true);setError('');
  try{
   const result=await onFinish(copy(draft));
   setLastSale(result);setCheckout(false);setDraft(emptyPOSDraft(erpDate()));setSearch('');setScanCode('');
   setNotice('Venda '+result.number+' confirmada. Estoque atualizado!');
  }catch(e){const msg=e instanceof Error?e.message:'Falha ao confirmar venda.';setError(msg);setNotice(msg)}
  finally{lock.current=false;setBusy(false)}
 };
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   let account='local';
   try{
    const response=await fetch('/api/me',{credentials:'same-origin'});
    if(response.ok){const result=await response.json();account=String(result.user?.id||'unknown')}
    else account='unverified-'+crypto.randomUUID();
   }catch{account='unverified-'+crypto.randomUUID()}
   if(cancelled)return;
   setDraft(draftFromDisk(account,workspaceId));
   setSuspended(suspendedFromDisk(account,workspaceId));
   setIdentity(account);
  })();
  return()=>{cancelled=true};
 },[workspaceId]);
 useEffect(()=>{if(!identity)return;try{sessionStorage.setItem(storageKey(identity,workspaceId),JSON.stringify(draft))}catch{}},[draft,identity,workspaceId]);
 useEffect(()=>{if(!identity)return;try{sessionStorage.setItem(suspendedKey(identity,workspaceId),JSON.stringify(suspended))}catch{}},[suspended,identity,workspaceId]);
 useEffect(()=>{searchRef.current?.focus()},[]);
 const onKey=useCallback((event:globalThis.KeyboardEvent)=>{
  const target=event.target as HTMLElement|null;
  const typing=!!target?.closest('input,textarea,select,[contenteditable="true"]');
  if(event.key==='Escape'){
   if(scanner||checkout||clientSelect||suspendSelect||shortcuts){event.preventDefault();setScanner(false);setCheckout(false);setClientSelect(false);setSuspendSelect(false);setShortcuts(false)}
   else if(!typing)onExit();
   return;
  }
  if(scanner||busy)return;
  if(event.key==='F2'){event.preventDefault();searchRef.current?.focus();return}
  if(event.key==='F3'){event.preventDefault();setClientSelect(true);return}
  if(event.key==='F4'){event.preventDefault();checkoutOpen();return}
  if(event.key==='F8'){event.preventDefault();setSuspendSelect(true);return}
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(checkout)void finish();else checkoutOpen();return}
  if(typing||event.ctrlKey||event.metaKey||event.altKey||checkout||clientSelect||suspendSelect)return;
  const k=event.key.toLocaleLowerCase();
  if(k==='v'){event.preventDefault();checkoutOpen()}
  if(k==='n'){event.preventDefault();reset()}
  if(k==='b'){event.preventDefault();barcodeRef.current?.focus()}
  if((event.key==='+'||event.key==='-')&&selectedId){
   event.preventDefault();const row=draft.lines.find(l=>l.productId===selectedId);
   if(row)setQuantity(selectedId,row.quantity+(event.key==='+'?1:-1));
  }
 },[scanner,checkout,clientSelect,suspendSelect,shortcuts,busy,draft,selectedId,products,subtotal,workspaceId]);
 useEffect(()=>{window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onKey]);
 const onManualKey=(e:ReactKeyboardEvent<HTMLInputElement>)=>{if(e.key==='Enter'){e.preventDefault();scanManual()}};
 return <div className="eixo-pdv" role="main" aria-label="Frente de caixa profissional">
  <header className="eixo-pdv-top">
   <div className="eixo-pdv-brand"><button aria-label="Voltar ao EIXO" title="Sair do modo caixa" onClick={onExit}><ArrowLeft size={19}/></button><div className="eixo-pdv-logo"><Store size={23}/></div><div><strong>EIXO <span>PDV</span></strong><small>{workspaceTitle} · Caixa de vendas</small></div></div>
   <div className="eixo-pdv-top-tools"><span className="eixo-pdv-status"><i/> Caixa operacional</span><button onClick={()=>setShortcuts(true)} title="Atalhos de teclado"><Keyboard size={17}/><span>Atalhos</span></button><button onClick={()=>setSuspendSelect(true)} title="Vendas suspensas"><PauseCircle size={17}/><span>Suspensas</span>{suspended.length>0&&<b>{suspended.length}</b>}</button><button className="eixo-pdv-exit" onClick={onExit}><X size={18}/><span>Sair</span></button></div>
  </header>
  <div className="eixo-pdv-workspace">
   <main className="eixo-pdv-catalog">
    <div className="eixo-pdv-section-head"><div><span className="eixo-pdv-eyebrow">ATENDIMENTO EM ANDAMENTO</span><h1>Registrar venda<span>.</span></h1><p>Busque no catálogo, escaneie ou digite o código do produto.</p></div><button className="eixo-pdv-soft-btn" onClick={reset}><Plus size={16}/> Nova venda <kbd>N</kbd></button></div>
    <section className="eixo-pdv-quick-tools" aria-label="Pesquisa de produtos">
     <label className="eixo-pdv-search"><Search size={18}/><input ref={searchRef} placeholder="Buscar por nome, SKU ou código..." aria-label="Buscar produtos" value={search} onChange={e=>setSearch(e.target.value)}/><kbd>F2</kbd></label>
     <label className="eixo-pdv-sku"><Barcode size={17}/><input ref={barcodeRef} aria-label="Digitar ou ler código de barras" placeholder="Código / leitor USB" value={scanCode} onChange={e=>setScanCode(e.target.value)} onKeyDown={onManualKey}/><button onClick={scanManual} aria-label="Adicionar pelo código">OK</button></label>
     <button className="eixo-pdv-camera" onClick={()=>setScanner(true)} title="Ler com câmera"><Barcode size={19}/><span>Escanear</span></button>
    </section>
    <div className="eixo-pdv-filter-head"><div><span>CATÁLOGO DE PRODUTOS</span><small>{filtered.length} resultados</small></div><span className="eixo-pdv-products-hint"><ShoppingBag size={14}/> Clique para adicionar</span></div>
    <div className="eixo-pdv-categories" aria-label="Filtrar por categoria">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="eixo-pdv-products">
     {filtered.map(p=><button className="eixo-pdv-product" onClick={()=>add(p)} disabled={p.stock<=0||busy} key={p.id} title={'Adicionar '+p.title}>
      <span className="eixo-pdv-product-photo">{p.images?.[0]?<img src={'/api/media/'+encodeURIComponent(p.images[0])} alt="" loading="lazy"/>:<Package size={30}/>}</span>
      <span className="eixo-pdv-product-name">{p.title}</span><span className="eixo-pdv-product-sku">{p.sku}{p.barcode?' · '+p.barcode:''}</span>
      <span className="eixo-pdv-product-bottom"><strong>{money(p.price)}</strong><small className={p.stock<=0?'empty-stock':''}>{p.stock>0?'Estoque: '+p.stock:'Esgotado'}</small></span>
     </button>)}
     {!filtered.length&&<div className="eixo-pdv-no-products"><Package size={32}/><h3>Nenhum produto encontrado</h3><p>Revise a busca ou cadastre produtos no ERP.</p><button onClick={()=>{setSearch('');setCategory('Todos')}}>Limpar filtros</button></div>}
    </div>
    <div className="eixo-pdv-bottom-hints"><span><kbd>F2</kbd> Buscar</span><span><kbd>B</kbd> Código de barras</span><span><kbd>V</kbd> Vender</span><span><kbd>F8</kbd> Suspender</span><span><kbd>Esc</kbd> Sair</span></div>
   </main>
   <aside className="eixo-pdv-sidebar" aria-label="Carrinho da venda">
    <div className="eixo-pdv-sidebar-header"><div><span className="eixo-pdv-eyebrow">VENDA ATUAL</span><h2><ShoppingCart size={20}/> Carrinho <span>{draft.lines.length}</span></h2></div><button onClick={()=>{if(!draft.lines.length||window.confirm('Limpar todos os produtos desta venda?'))set({lines:[]})}} disabled={!draft.lines.length||busy} title="Esvaziar carrinho"><Trash2 size={17}/></button></div>
    <div className="eixo-pdv-customer"><button onClick={()=>setClientSelect(true)}><UserRound size={19}/><span><small>CLIENTE</small><strong>{client?.title||'Consumidor final'}</strong></span><ChevronDown size={17}/><kbd>F3</kbd></button></div>
    <div className="eixo-pdv-items">
     {!draft.lines.length&&<div className="eixo-pdv-cart-empty"><ShoppingCart size={37}/><h3>Seu carrinho está vazio</h3><p>Adicione um produto do catálogo ou utilize a leitura de código de barras.</p></div>}
     {draft.lines.map((line,index)=>{
       const product=products.find(p=>p.id===line.productId),invalid=!product||product.stock<line.quantity;
       return <article key={line.productId} className={'eixo-pdv-cart-line '+(selectedId===line.productId?'selected ':'')+(invalid?'invalid':'')} onClick={()=>setSelectedId(line.productId)}>
        <span className="eixo-pdv-line-number">{String(index+1).padStart(2,'0')}</span>
        <div className="eixo-pdv-line-info"><b>{product?.title||line.title}</b><small>{line.sku} · {money(product?.price??line.price)} / {line.unit}</small><strong>{money((product?.price??line.price)*line.quantity)}</strong>{invalid&&<em>Estoque insuficiente</em>}</div>
        <div className="eixo-pdv-line-actions"><button aria-label={'Remover '+line.title} onClick={()=>setQuantity(line.productId,0)}><Trash2 size={14}/></button><div><button aria-label={'Diminuir '+line.title} onClick={()=>setQuantity(line.productId,line.quantity-1)}><Minus size={14}/></button><input type="number" aria-label={'Quantidade '+line.title} min="0.001" max={product?.stock||0} step="any" value={line.quantity} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))setQuantity(line.productId,value)}}/><button aria-label={'Aumentar '+line.title} onClick={()=>setQuantity(line.productId,line.quantity+1)}><Plus size={14}/></button></div></div>
       </article>
     })}
    </div>
    <section className="eixo-pdv-price-summary" aria-label="Totais da venda">
     <div><span>Subtotal <small>{subtotal.items} un.</small></span><b>{money(subtotal.subtotal)}</b></div>
     <div><label htmlFor="eixo-pdv-discount">Desconto (R$)</label><input id="eixo-pdv-discount" type="number" min="0" step=".01" value={draft.discount||''} placeholder="0,00" onChange={e=>set({discount:Math.max(0,Number(e.target.value)||0)})}/></div>
     <div><label htmlFor="eixo-pdv-shipping">Acréscimos (R$)</label><input id="eixo-pdv-shipping" type="number" min="0" step=".01" value={draft.shipping||''} placeholder="0,00" onChange={e=>set({shipping:Math.max(0,Number(e.target.value)||0)})}/></div>
     <div className="eixo-pdv-total"><span>TOTAL DA VENDA</span><strong>{money(subtotal.total)}</strong></div>
    </section>
    {error&&<p className="eixo-pdv-error" role="alert">{error}</p>}
    {notice&&!error&&<p className="eixo-pdv-feedback" role="status"><CheckCircle2 size={15}/>{notice}</p>}
    <footer className="eixo-pdv-footer"><button className="eixo-pdv-hold" onClick={suspend} disabled={!draft.lines.length||busy}><PauseCircle size={17}/> Suspender <kbd>F8</kbd></button><button className="eixo-pdv-sell" onClick={checkoutOpen} disabled={!draft.lines.length||busy}><CreditCard size={20}/> Vender {money(subtotal.total)} <kbd>V</kbd></button></footer>
   </aside>
  </div>
  {scanner&&<Suspense fallback={<div className="eixo-pdv-overlay">Abrindo câmera...</div>}><BarcodeScanner mode="sale" onDetected={(code)=>lookup(code)} onRegisterUnknown={code=>{setScanner(false);onRegisterProduct(code)}} onClose={()=>setScanner(false)}/></Suspense>}
  {checkout&&<div className="eixo-pdv-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setCheckout(false)}}><section className="eixo-pdv-dialog" role="dialog" aria-modal="true" aria-label="Finalizar venda">
   <header><div><span className="eixo-pdv-eyebrow">FECHAMENTO DE CAIXA</span><h2>Finalizar venda</h2><p>Confirme os dados antes de registrar e baixar o estoque.</p></div><button aria-label="Fechar pagamento" disabled={busy} onClick={()=>setCheckout(false)}><X size={20}/></button></header>
   <div className="eixo-pdv-payment-body"><div className="eixo-pdv-payment-total"><span>TOTAL A RECEBER</span><strong>{money(subtotal.total)}</strong><small>{subtotal.items} itens · {draft.lines.length} produtos diferentes</small></div>
   <label>Forma de pagamento<select value={draft.paymentMethod} onChange={e=>set({paymentMethod:e.target.value})}>{methods.map(m=><option key={m}>{m}</option>)}</select></label>
   <label>Cliente<select value={draft.clientId} onChange={e=>set({clientId:e.target.value})}><option value="">Consumidor final</option>{clients.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
   {draft.paymentMethod==='A prazo'&&<div className="eixo-pdv-credit-options"><p>Venda a prazo exige cliente cadastrado e gera parcelas para acompanhamento no financeiro.</p><label>Número de parcelas<input type="number" min="1" max="36" value={draft.termCount} onChange={e=>set({termCount:Number(e.target.value)||1})}/></label><label>Entrada (R$)<input type="number" min="0" max={subtotal.total} step=".01" value={draft.termEntry} onChange={e=>set({termEntry:Math.max(0,Number(e.target.value)||0)})}/></label><label>Primeiro vencimento<input type="date" value={draft.firstDueDate} onChange={e=>set({firstDueDate:e.target.value})}/></label></div>}
   <label>Observações (opcional)<textarea rows={2} maxLength={1500} value={draft.notes} onChange={e=>set({notes:e.target.value})} placeholder="Informação interna da venda"/></label>
   {error&&<p role="alert" className="eixo-pdv-error">{error}</p>}
   <div className="eixo-pdv-payment-note"><Receipt size={18}/> Ao confirmar, a venda será registrada e o estoque atualizado. O comprovante é gerencial, não fiscal.</div>
   </div><footer><button className="eixo-pdv-soft-btn" disabled={busy} onClick={()=>setCheckout(false)}>Voltar</button><button className="eixo-pdv-sell" disabled={busy||!draft.lines.length||draft.paymentMethod==='A prazo'&&!draft.clientId} onClick={()=>void finish()}>{busy?'Registrando venda...':<><Check size={18}/> Confirmar venda <kbd>Ctrl + Enter</kbd></>}</button></footer>
  </section></div>}
  {clientSelect&&<div className="eixo-pdv-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setClientSelect(false)}}><section className="eixo-pdv-dialog small" role="dialog" aria-modal="true" aria-label="Selecionar cliente"><header><div><span className="eixo-pdv-eyebrow">IDENTIFICAÇÃO</span><h2>Selecionar cliente</h2></div><button aria-label="Fechar seleção" onClick={()=>setClientSelect(false)}><X size={20}/></button></header><div className="eixo-pdv-customer-options">{[{id:'',title:'Consumidor final'},...clients].map(c=><button key={c.id} onClick={()=>{set({clientId:c.id});setClientSelect(false)}}><UserRound size={18}/><span>{c.title}</span>{draft.clientId===c.id&&<Check size={17}/>}</button>)}</div></section></div>}
  {suspendSelect&&<div className="eixo-pdv-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSuspendSelect(false)}}><section className="eixo-pdv-dialog small" role="dialog" aria-modal="true" aria-label="Vendas suspensas"><header><div><span className="eixo-pdv-eyebrow">ATENDIMENTOS AGUARDANDO</span><h2>Vendas suspensas</h2><p>Guardadas somente nesta sessão do navegador.</p></div><button aria-label="Fechar suspensas" onClick={()=>setSuspendSelect(false)}><X size={20}/></button></header><div className="eixo-pdv-customer-options">{suspended.map((draft,i)=><button key={i} onClick={()=>resume(i)}><PauseCircle size={19}/><span>{draft.lines.length} produtos · {money(posTotals(draft.lines,draft.discount,draft.shipping).total)}</span><Play size={16}/></button>)}{!suspended.length&&<p>Nenhuma venda suspensa.</p>}</div><footer><button className="eixo-pdv-soft-btn" disabled={!draft.lines.length} onClick={suspend}>Suspender venda atual</button></footer></section></div>}
  {shortcuts&&<div className="eixo-pdv-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShortcuts(false)}}><section className="eixo-pdv-dialog small" role="dialog" aria-modal="true" aria-label="Atalhos de teclado"><header><div><span className="eixo-pdv-eyebrow">PRODUTIVIDADE</span><h2>Atalhos do PDV</h2></div><button aria-label="Fechar atalhos" onClick={()=>setShortcuts(false)}><X size={20}/></button></header><div className="eixo-pdv-shortcuts">{[['V','Vender'],['F2','Buscar produto'],['F3','Selecionar cliente'],['F4','Abrir pagamento'],['F8','Vendas suspensas'],['B','Campo de código de barras'],['N','Nova venda'],['+ / −','Quantidade do item selecionado'],['Ctrl + Enter','Confirmar pagamento'],['Esc','Fechar painel ou sair']].map(([key,action])=><div key={key}><kbd>{key}</kbd><span>{action}</span></div>)}</div><p className="eixo-pdv-dialog-tip">Atalhos por letras não são ativados ao digitar em campos de texto.</p></section></div>}
  {lastSale&&<div className="eixo-pdv-overlay"><section className="eixo-pdv-dialog small eixo-pdv-success" role="dialog" aria-modal="true" aria-label="Venda concluída"><span className="eixo-pdv-success-icon"><CheckCircle2 size={32}/></span><span className="eixo-pdv-eyebrow">VENDA FINALIZADA</span><h2>{lastSale.number}</h2><p>Registrada com sucesso, com baixa de estoque e lançamento financeiro conforme o pagamento.</p><strong>{money(lastSale.lines.reduce((sum,l)=>sum+l.price*l.quantity,0)+lastSale.shipping-lastSale.discount)}</strong><div className="eixo-pdv-success-actions"><button className="eixo-pdv-soft-btn" onClick={()=>onPrint(lastSale)}><Printer size={16}/> Imprimir comprovante</button><button className="eixo-pdv-soft-btn" onClick={()=>onPDF(lastSale)}><FileText size={16}/> Baixar PDF</button><button className="eixo-pdv-sell" onClick={()=>{setLastSale(null);searchRef.current?.focus()}}><Plus size={17}/> Próxima venda</button></div></section></div>}
 </div>;
}
