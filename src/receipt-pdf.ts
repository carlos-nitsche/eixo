import {jsPDF} from 'jspdf';
import type {ReceiptModel,ReceiptWidth} from './sales-receipt';
const currency=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const amount=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v);
const textSafe=(v:string)=>String(v||'').replace(/[^\x20-\x7e\u00a0-\u00ff]/g,' ').trim();
export function makeSalesReceiptPDF(model:ReceiptModel,strip:ReceiptWidth=80,logoData?:string|null):jsPDF{
 const W=strip,margin=strip===58?3:5,right=W-margin,maxY=276;
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:[strip,297],compress:true});
 const center=W/2;let y=7;
 const ink:[number,number,number]=[25,33,44],light:[number,number,number]=[94,103,116];
 const tx=(content:string,x:number,lineY:number,size=8,bold=false,align:'left'|'right'|'center'='left',color=ink)=>{
  pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(...color);
  pdf.text(textSafe(content),x,lineY,{align});
 };
 const divider=()=>{pdf.setDrawColor(175,184,195);pdf.setLineDashPattern([1,1.5],0);pdf.line(margin,y,right,y);pdf.setLineDashPattern([],0);y+=5};
 const page=()=>{
  pdf.addPage([strip,297],'portrait');y=10;
  tx('EIXO · CONTINUAÇÃO',center,y,8,true,'center');y+=7;
  tx('Venda '+model.number,center,y,8,true,'center');y+=8;divider();
 };
 const space=(h:number)=>{if(y+h>maxY)page()};
 const multiline=(value:string,size=8,bold=false,indent=0)=>{
  pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);
  const maxWidth=W-margin*2-indent;const lines=pdf.splitTextToSize(textSafe(value)||'—',maxWidth);
  for(const l of lines){space(size*.44+2);tx(l,margin+indent,y,size,bold);y+=size*.44+2}
 };
 const pair=(name:string,value:string)=>{
  pdf.setFontSize(8);pdf.setFont('helvetica','normal');
  const labelMax=strip===58?18:27;const label=textSafe(name).slice(0,labelMax);
  const v=pdf.splitTextToSize(textSafe(value),strip===58?24:37);
  space(Math.max(1,v.length)*4.4+1);
  tx(label,margin,y,8);for(const [i,line] of v.entries())tx(line,right,y+i*4.4,8,true,'right');
  y+=Math.max(1,v.length)*4.4+1.5;
 };
 const section=(name:string)=>{space(14);divider();tx(name,center,y,8,true,'center');y+=8};
 const date=[model.date,model.time].filter(Boolean).join(' · ');
 if(logoData?.startsWith('data:image/png;base64,')){pdf.addImage(logoData,'PNG',center-8,y,16,16);y+=20}
 tx('EIXO · COMPROVANTE NÃO FISCAL',center,y,7,true,'center');y+=8;
 multiline(model.issuerName,12,true);y+=1;
 if(model.issuerDocument)multiline('CPF/CNPJ: '+model.issuerDocument,7);
 if(model.issuerAddress)multiline(model.issuerAddress,7);
 if(model.issuerContact)multiline(model.issuerContact,7);
 section(model.status==='Confirmada'?'COMPROVANTE DE VENDA':'VENDA '+model.status.toUpperCase());
 tx('Nº '+model.number,center,y,10,true,'center');y+=6;
 tx(date,center,y,7,false,'center',light);y+=7;
 pair('Situação',model.status);
 section('CLIENTE');
 multiline(model.customerName,9,true);
 if(model.customerDocument)multiline('CPF/CNPJ: '+model.customerDocument,7);
 section('ITENS DA VENDA');
 for(const [index,line] of model.lines.entries()){
  space(15);
  multiline(String(index+1).padStart(2,'0')+'  '+line.name,8,true);
  if(line.sku)multiline('Cód.: '+line.sku,6,false,4);
  pair(amount(line.qty)+' '+line.unit+' × '+currency(line.price),currency(line.total));
  y+=2;
 }
 section('TOTALIZAÇÃO');
 pair('Subtotal',currency(model.subtotal));
 if(model.discount)pair('Desconto','- '+currency(model.discount));
 if(model.shipping)pair('Acréscimos',currency(model.shipping));
 space(13);divider();tx('TOTAL',margin,y,10,true);tx(currency(model.total),right,y,12,true,'right');y+=10;
 pair('Forma informada',model.paymentMethod);
 pair('Registrado pago',currency(model.paid));
 pair('Saldo em aberto',currency(model.remaining));
 if(model.installments.length){
  section('PARCELAS / VENCIMENTOS');
  for(const i of model.installments)pair(i.label+' · '+i.due,currency(i.amount));
 }
 if(model.notes){section('OBSERVAÇÕES');multiline(model.notes,7)}
 space(33);divider();tx('COMPROVANTE NÃO FISCAL',center,y,8,true,'center');y+=5;
 multiline('Não substitui NFC-e, NF-e ou nota fiscal.',7);y+=5;
 tx('Obrigado pela preferência!',center,y,8,true,'center');y+=4;
 const pages=pdf.getNumberOfPages();
 for(let p=1;p<=pages;p++){
  pdf.setPage(p);pdf.setDrawColor(208,214,224);pdf.line(margin,285,right,285);
  tx('EIXO · Controle comercial · '+p+'/'+pages,center,290,6,false,'center',light);
 }
 pdf.setProperties({title:'EIXO · Comprovante de venda '+model.number,author:'EIXO',subject:'Comprovante de venda não fiscal'});
 return pdf;
}
async function loadReceiptLogo(id:string):Promise<string|null>{
 if(!/^[a-f0-9-]{36}$/i.test(id))return null;
 try{
  const response=await fetch('/api/media/'+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)return null;
  const blob=await response.blob();
  if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>5*1024*1024)return null;
  const url=URL.createObjectURL(blob);
  try{
   return await new Promise<string|null>(resolve=>{
    const img=new Image();
    img.onload=()=>{
     const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
     const ctx=canvas.getContext('2d');if(!ctx){resolve(null);return}
     ctx.fillStyle='white';ctx.fillRect(0,0,160,160);
     const ratio=Math.min(160/img.naturalWidth,160/img.naturalHeight);
     ctx.drawImage(img,(160-img.naturalWidth*ratio)/2,(160-img.naturalHeight*ratio)/2,img.naturalWidth*ratio,img.naturalHeight*ratio);
     resolve(canvas.toDataURL('image/png'));
    };
    img.onerror=()=>resolve(null);img.src=url;
   });
  }finally{URL.revokeObjectURL(url)}
 }catch{return null}
}
export async function downloadSalesReceiptPDF(model:ReceiptModel,strip:ReceiptWidth=80):Promise<void>{
 const logo=model.logoId?await loadReceiptLogo(model.logoId):null;
 const pdf=makeSalesReceiptPDF(model,strip,logo);
 pdf.save('EIXO-'+(model.number.replace(/[^a-zA-Z0-9_-]/g,'-'))+'-comprovante-nao-fiscal.pdf');
}
