import type {ERPOrder} from './erp';
import type {Entry} from './model';

export type ReceiptWidth=58|80;
export type ReceiptLine={name:string;sku:string;qty:number;unit:string;price:number;total:number};
export type ReceiptInstallment={label:string;due:string;amount:number;paid:number};
export type ReceiptModel={
 number:string;id:string;date:string;time:string;status:string;
 issuerName:string;issuerDocument:string;issuerAddress:string;issuerContact:string;logoId:string;
 customerName:string;customerDocument:string;paymentMethod:string;notes:string;
 lines:ReceiptLine[];installments:ReceiptInstallment[];
 subtotal:number;discount:number;shipping:number;total:number;paid:number;remaining:number;items:number;
 nonFiscal:true;
};
const safe=(s:unknown,max=240)=>String(s??'').replace(/[\u0000-\u001F\u007F-\u009F]/g,' ').trim().slice(0,max);
const decimal=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
const cents=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const dateBR=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const moneyBR=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const qtyBR=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v);
const escapeHtml=(s:unknown)=>safe(s,2000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const issuerAddress=(a:Entry|null)=>a?[a.address,a.number,a.complement,a.neighborhood,a.city,a.state,a.postcode].filter(x=>typeof x==='string'&&x.trim()).join(' · '):'';
export function createReceiptModel(order:ERPOrder,issuer:Entry|null,customer:Entry|null,workspaceName='Meu espaço pessoal'):ReceiptModel{
 if(order.kind!=='Venda')throw new Error('Comprovante de venda indisponível para compras e orçamentos.');
 if(!order.lines.length)throw new Error('Esta venda não tem itens registrados.');
 const lines=order.lines.map(l=>{
  const qty=decimal(l.quantity),price=decimal(l.price);
  return {name:safe(l.title,180),sku:safe(l.sku,90),qty,unit:safe(l.unit,15),price:cents(price),total:cents(qty*price)};
 });
 const subtotal=cents(lines.reduce((acc,x)=>acc+x.total,0)),discount=cents(decimal(order.discount)),shipping=cents(decimal(order.shipping));
 const total=cents(Math.max(0,subtotal-discount+shipping));
 const paid=cents(Math.max(0,Math.min(total,decimal(order.paid))));
 const rawTime=Date.parse(order.createdAt||'');
 const isoTime=Number.isFinite(rawTime)?new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(rawTime)):'—';
 const issueDate=Number.isFinite(rawTime)?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(rawTime)):dateBR(order.date);
 const customerDoc=customer&&order.partnerId===customer.id?safe(customer.document,30):'';
 const installments=(order.installments||[]).map(i=>({label:safe(i.label,65),due:dateBR(safe(i.dueDate,10)),amount:cents(decimal(i.amount)),paid:cents(decimal(i.paid))}));
 return {
  id:safe(order.id,80),number:safe(order.number,60),date:issueDate,time:isoTime,status:safe(order.status,35),
  issuerName:safe(issuer?.legalName||issuer?.title||workspaceName,130),issuerDocument:safe(issuer?.document,30),
  issuerAddress:safe(issuerAddress(issuer),260),issuerContact:safe(issuer?.phone||issuer?.email,100),
  logoId:/^[a-f0-9-]{36}$/i.test(String(issuer?.logoId||''))?String(issuer?.logoId):'',
  customerName:safe(customer?.title||order.partnerName||'Consumidor final',160),customerDocument:customerDoc,
  paymentMethod:safe(order.paymentMethod,55),notes:safe(order.notes,750),lines,installments,
  subtotal,discount,shipping,total,paid,remaining:cents(Math.max(0,total-paid)),items:lines.reduce((n,x)=>n+x.qty,0),nonFiscal:true
 };
}
export function receiptHTML(r:ReceiptModel,paper:ReceiptWidth=80):string{
 const field=(label:string,value:string)=>value?'<div class="pair"><span>'+escapeHtml(label)+'</span><b>'+escapeHtml(value)+'</b></div>':'';
 const itemLines=r.lines.map((l,i)=>'<article class="item"><div class="item-top"><span class="idx">'+String(i+1).padStart(2,'0')+'</span><strong>'+escapeHtml(l.name)+'</strong></div>'+
  (l.sku?'<div class="item-sku">CÓD. '+escapeHtml(l.sku)+'</div>':'')+
  '<div class="item-values"><span>'+escapeHtml(qtyBR(l.qty))+' '+escapeHtml(l.unit)+' × '+escapeHtml(moneyBR(l.price))+'</span><strong>'+escapeHtml(moneyBR(l.total))+'</strong></div></article>').join('');
 const installments=r.installments.map(i=>'<div class="pair"><span>'+escapeHtml(i.label)+' · '+escapeHtml(i.due)+'</span><b>'+escapeHtml(moneyBR(i.amount))+(i.paid>0?' (pago '+escapeHtml(moneyBR(i.paid))+')':'')+'</b></div>').join('');
 const logo=r.logoId?'<img class="logo" src="/api/media/'+encodeURIComponent(r.logoId)+'" alt="Logotipo do estabelecimento"/>':'';
 const kind=r.status==='Confirmada'?'COMPROVANTE DE VENDA':r.status==='Cancelada'?'VENDA CANCELADA':'VENDA NÃO CONFIRMADA';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="noindex,nofollow"><title>'+escapeHtml(r.number)+' · Comprovante não fiscal · EIXO</title>'+
 '<style>'+
 '*{box-sizing:border-box}html,body{margin:0}body{font:13px/1.43 Arial,Helvetica,sans-serif;background:#e9edf2;color:#171b21}'+
 '.tools{position:relative;z-index:1;padding:13px 17px;background:#fff;border-bottom:1px solid #d9dfe7;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;box-shadow:0 2px 14px #25314115}.tools b{font-size:12px;margin-right:12px}.tools button{background:#fff;border:1px solid #ced5df;color:#1c2635;border-radius:7px;font-size:12px;padding:10px 12px;font-weight:700;cursor:pointer}.tools button.active,.tools button.print{color:white;background:#1d2b41;border-color:#1d2b41}.tools button:focus-visible{outline:3px solid #7ba5df}.hint{font-size:11px;color:#697586;padding:9px 16px;text-align:center}'+
 '.receipt{--paper:'+paper+'mm;width:var(--paper);background:white;margin:22px auto 40px;padding:6mm 4mm 8mm;box-shadow:0 10px 34px #26354a26;min-height:120mm;overflow-wrap:anywhere}.receipt[data-size="58"]{--paper:58mm;padding:5mm 2.6mm}.receipt[data-size="58"] .logo{width:34px;max-height:34px}.receipt[data-size="58"] .total b{font-size:17px}.receipt[data-size="58"] .pair{font-size:10px}.receipt[data-size="58"] .item{font-size:11px}'+
 'h1,h2,p{margin:0}.brand{text-align:center}.brand h1{font-size:16px;letter-spacing:-.35px;margin:5px 0 4px}.logo{width:48px;max-height:48px;object-fit:contain}.muted{color:#566273}.sub{font-size:10px;line-height:1.55}.brand .reg{margin-top:5px}.rule{border:0;border-top:1px dashed #7a8491;margin:14px 0}.eyebrow{font-size:9px;font-weight:900;letter-spacing:1.5px;text-align:center}.title{font-size:12px;font-weight:900;text-align:center;margin:8px 0 11px}.meta{text-align:center;font-size:11px;margin-bottom:8px}.pair{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:11px;padding:3px 0}.pair b{text-align:right;max-width:66%;font-weight:800;overflow-wrap:anywhere}.pair span{color:#46505b;max-width:58%}.item{font-size:12px;border-bottom:1px dotted #bcc2c9;padding:8px 0}.item-top{display:flex;gap:7px;align-items:flex-start}.item-top strong{flex:1}.idx{font-size:10px;color:#7b8491}.item-sku{font-size:9px;color:#657080;margin:3px 0 0 25px}.item-values{display:flex;justify-content:space-between;gap:8px;margin:5px 0 0 25px}.item-values strong{white-space:nowrap}.totals{padding-top:1px}.total{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 0 7px;margin:8px 0;border-block:2px solid #1d2631;font-weight:900}.total b{font-size:20px;letter-spacing:-.5px}.section{margin:9px 0 5px;font-size:10px;font-weight:850;letter-spacing:1px}.status{font-size:10px;text-align:center;font-weight:700;color:#273445;border:1px solid #c8ced6;padding:8px 5px;margin:9px 0;border-radius:3px}.notice{text-align:center;font-size:10px;font-weight:900;line-height:1.55;border-block:1px solid #222;padding:9px 3px;margin-top:14px}.footer{text-align:center;font-size:10px;line-height:1.6;margin-top:11px;color:#4c5965}.memo{font-size:10px;white-space:pre-wrap;margin-top:5px;overflow-wrap:anywhere}'+
 '@media print{@page{margin:0}html,body{background:white!important;width:auto;height:auto}.tools,.hint{display:none!important}.receipt{width:var(--paper)!important;box-shadow:none!important;border:0!important;margin:0 auto!important;padding-top:5mm!important;min-height:0!important;break-after:auto}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.item,.total,.status,.notice{break-inside:avoid}}'+
 '@media(max-width:360px){.tools b{width:100%;text-align:center}.receipt{max-width:100%}}'+
 '</style></head><body>'+
 '<div class="tools"><b>EIXO · Comprovante</b><button id="p58" type="button">Bobina 58 mm</button><button id="p80" type="button">Bobina 80 mm</button><button class="print" type="button" id="print">Imprimir / Salvar em PDF</button></div>'+
 '<p class="hint">Escolha a largura, confira a prévia e imprima. Para PDF, selecione “Salvar como PDF” na impressão.</p>'+
 '<main class="receipt" id="receipt" data-size="'+paper+'"><header class="brand">'+logo+'<h1>'+escapeHtml(r.issuerName)+'</h1>'+
 (r.issuerDocument?'<p class="sub reg">CPF/CNPJ: '+escapeHtml(r.issuerDocument)+'</p>':'')+
 (r.issuerAddress?'<p class="sub">'+escapeHtml(r.issuerAddress)+'</p>':'')+
 (r.issuerContact?'<p class="sub">'+escapeHtml(r.issuerContact)+'</p>':'')+
 '</header><hr class="rule"><div class="eyebrow">EIXO · REGISTRO COMERCIAL</div><h2 class="title">'+kind+'</h2>'+
 '<p class="meta"><b>Nº '+escapeHtml(r.number)+'</b><br>Emissão '+escapeHtml(r.date)+' · '+escapeHtml(r.time)+'</p>'+
 '<div class="status">Situação registrada: '+escapeHtml(r.status)+'</div><hr class="rule">'+
 '<div class="section">CLIENTE</div><div class="pair"><span>Nome</span><b>'+escapeHtml(r.customerName)+'</b></div>'+
 (r.customerDocument?field('CPF/CNPJ',r.customerDocument):'')+
 '<hr class="rule"><div class="section">ITENS DA VENDA</div>'+
 itemLines+'<div class="totals">'+field('Itens / quantidade',qtyBR(r.items))+field('Subtotal',moneyBR(r.subtotal))+
 (r.discount?field('Desconto','− '+moneyBR(r.discount)):'')+(r.shipping?field('Acréscimos',moneyBR(r.shipping)):'')+
 '<div class="total"><span>TOTAL</span><b>'+escapeHtml(moneyBR(r.total))+'</b></div>'+
 field('Forma informada',r.paymentMethod)+field('Pagamento registrado',moneyBR(r.paid))+field('Saldo em aberto',moneyBR(r.remaining))+'</div>'+
 (r.installments.length?'<hr class="rule"><div class="section">PARCELAS / VENCIMENTOS</div>'+installments:'')+
 (r.notes?'<hr class="rule"><div class="section">OBSERVAÇÕES</div><p class="memo">'+escapeHtml(r.notes)+'</p>':'')+
 '<div class="notice">COMPROVANTE NÃO FISCAL<br>NÃO SUBSTITUI NFC-e, NF-e OU NOTA FISCAL</div>'+
 '<div class="footer">Emitido pelo EIXO · Sistema de gestão<br>Conserve para conferência de sua compra.<br><b>Obrigado pela preferência!</b></div></main>'+
 '</body></html>';
}
