import {jsPDF} from 'jspdf';
import type {Entry} from './model';
import type {ERPOrder,ERPLine} from './erp';
import {money,orderTotal,dateShort,lineTotal} from './erp';

export type Issuer=Pick<Entry,'title'> & Partial<Entry>;
const plain=(v:unknown)=>String(v??'').trim();
const address=(a:Partial<Entry>|undefined)=>[a?.address,a?.number,a?.complement,a?.neighborhood,a?.city,a?.state,a?.postcode].map(plain).filter(Boolean).join(', ');
const documentLabel=(order:ERPOrder)=>order.kind==='Orçamento'?'ORÇAMENTO COMERCIAL':order.kind==='Compra'?'PEDIDO DE COMPRA':'COMPROVANTE DE VENDA';
const wrap=(pdf:jsPDF,content:string,x:number,y:number,width:number,size=9)=>{
 pdf.setFontSize(size);
 const lines=pdf.splitTextToSize(content||'Não informado',width);
 pdf.text(lines,x,y);
 return y+Math.max(1,lines.length)*size*0.48+2;
};
async function loadLogo(id:string|undefined):Promise<string|null>{
 if(!id)return null;
 const response=await fetch('/api/media/'+encodeURIComponent(id),{credentials:'same-origin'});
 if(!response.ok)return null;
 const blob=await response.blob();
 if(!blob.type.startsWith('image/'))return null;
 return new Promise(resolve=>{
  const image=new Image();
  const url=URL.createObjectURL(blob);
  image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=280;canvas.height=280;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#fff';ctx.fillRect(0,0,280,280);const scale=Math.min(280/image.naturalWidth,280/image.naturalHeight);const w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,(280-w)/2,(280-h)/2,w,h);resolve(canvas.toDataURL('image/png'))}else resolve(null);URL.revokeObjectURL(url)};
  image.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};
  image.src=url;
 });
}
export async function downloadCommercialDocument(args:{order:ERPOrder;issuer:Issuer|null;customer:Entry|null}):Promise<void>{
 const {order,issuer,customer}=args;
 if(order.kind==='Compra')throw Error('Use documentos de compra em uma etapa futura.');
 const pdf=new jsPDF({format:'a4',unit:'mm'});
 const pageWidth=210,margin=16;
 const colors={ink:[35,49,73] as const,muted:[105,117,135] as const,blue:[48,72,106] as const};
 const setInk=()=>pdf.setTextColor(...colors.ink);
 const footer=(page:number)=>{
  pdf.setDrawColor(222,227,233);pdf.line(margin,273,pageWidth-margin,273);
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(170,55,55);
  pdf.text('DOCUMENTO COMERCIAL - NÃO É NOTA FISCAL',margin,280);
  pdf.setFont('helvetica','normal');pdf.setTextColor(...colors.muted);
  pdf.text('EIXO • Uso administrativo • '+page,pageWidth-margin,286,{align:'right'});
 };
 const addPage=()=>{footer(pdf.getNumberOfPages());pdf.addPage();pdf.setFillColor(248,250,252);pdf.rect(0,0,pageWidth,24,'F');setInk();pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text(documentLabel(order)+' • '+order.number,margin,15);return 38};
 pdf.setFillColor(37,56,84);pdf.rect(0,0,pageWidth,38,'F');
 pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(18);pdf.text(documentLabel(order),margin,18);
 pdf.setFontSize(10);pdf.setFont('helvetica','normal');pdf.text('Nº '+order.number+'   |   Emissão '+dateShort(order.date),margin,28);
 let y=49;
 const logoId=plain(issuer?.logoId);
 const logo=await loadLogo(logoId||undefined);
 if(logo)pdf.addImage(logo,'PNG',margin,y-3,27,27);
 const ix=logo?margin+34:margin;
 setInk();pdf.setFont('helvetica','bold');pdf.setFontSize(14);
 y=wrap(pdf,plain(issuer?.legalName)||plain(issuer?.title)||'Empresa não identificada',ix,y,175-ix,14)+2;
 pdf.setFont('helvetica','normal');pdf.setTextColor(...colors.muted);
 y=wrap(pdf,'CNPJ/CPF: '+(plain(issuer?.document)||'Não informado')+'  |  IE: '+(plain(issuer?.stateRegistration)||'Não informada'),ix,y,174-ix,9);
 y=wrap(pdf,'Contato: '+[issuer?.phone,issuer?.email,issuer?.website].map(plain).filter(Boolean).join(' · '),ix,y,174-ix,9);
 y=wrap(pdf,'Endereço: '+address(issuer||undefined),ix,y,174-ix,9);
 y=Math.max(y,82)+7;
 pdf.setDrawColor(219,225,234);pdf.line(margin,y,pageWidth-margin,y);y+=9;
 setInk();pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text('DADOS DO CLIENTE',margin,y);y+=7;
 pdf.setFont('helvetica','normal');pdf.setFontSize(9);
 y=wrap(pdf,'Nome / razão social: '+(plain(customer?.title)||plain(order.partnerName)||'Consumidor final'),margin,y,175,9);
 y=wrap(pdf,'CPF/CNPJ: '+(plain(customer?.document)||'Não informado')+'  |  WhatsApp: '+(plain(customer?.whatsapp)||plain(customer?.phone)||'Não informado'),margin,y,175,9);
 y=wrap(pdf,'E-mail: '+(plain(customer?.email)||'Não informado'),margin,y,175,9);
 y=wrap(pdf,'Endereço: '+address(customer||undefined),margin,y,175,9);
 y+=7;
 const header=()=>{
  pdf.setFillColor(240,243,248);pdf.rect(margin,y-6,178,10,'F');
  setInk();pdf.setFont('helvetica','bold');pdf.setFontSize(8);
  pdf.text('DESCRIÇÃO',margin+3,y);pdf.text('QTD.',112,y,{align:'right'});pdf.text('UNITÁRIO',148,y,{align:'right'});pdf.text('TOTAL',190,y,{align:'right'});y+=9;
 };
 header();
 for(const line of order.lines){
  if(y>252){y=addPage();header()}
  setInk();pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  const title=pdf.splitTextToSize(plain(line.title),78);
  const height=Math.max(10,title.length*5+4);
  pdf.text(title,margin+3,y);
  pdf.text(String(line.quantity)+' '+line.unit,112,y,{align:'right'});
  pdf.text(money(line.price),148,y,{align:'right'});
  pdf.text(money(lineTotal(line)),190,y,{align:'right'});
  pdf.setDrawColor(234,238,243);pdf.line(margin,y+height-5,194,y+height-5);y+=height;
 }
 if(y>228)y=addPage();
 pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.setTextColor(...colors.muted);
 pdf.text('Desconto: '+money(order.discount),margin,y+5);
 pdf.text('Frete/acréscimos: '+money(order.shipping),margin,y+12);
 setInk();pdf.setFont('helvetica','bold');pdf.setFontSize(15);
 pdf.text('TOTAL  '+money(orderTotal(order)),194,y+12,{align:'right'});y+=28;
 if(order.installments?.length){
  if(y>243)y=addPage();
  pdf.setFontSize(10);pdf.text('CONDIÇÕES DE PAGAMENTO',margin,y);y+=8;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  for(const installment of order.installments){
   if(y>260)y=addPage();
   pdf.text(installment.label+' • '+dateShort(installment.dueDate),margin,y);
   pdf.text(money(installment.amount),194,y,{align:'right'});y+=7;
  }
 }
 if(order.notes){
  if(y>243)y=addPage();
  setInk();pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('OBSERVAÇÕES',margin,y);y+=6;
  pdf.setFont('helvetica','normal');y=wrap(pdf,plain(order.notes),margin,y,178);
 }
 footer(pdf.getNumberOfPages());
 pdf.setProperties({title:documentLabel(order)+' '+order.number,subject:'Documento comercial não fiscal',author:'EIXO'});
 pdf.save('EIXO-'+order.number+'-documento-nao-fiscal.pdf');
}
