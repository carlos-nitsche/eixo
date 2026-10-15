import type {ERPLine,ERPProduct} from './erp';
import {lineTotal,round} from './erp';
import {findBarcodeProducts,normalizeBarcode} from './barcode-utils';
export type POSDraft={idempotencyKey:string;lines:ERPLine[];clientId:string;paymentMethod:string;discount:number;shipping:number;termCount:number;termEntry:number;firstDueDate:string;notes:string};
export const emptyPOSDraft=(date:string):POSDraft=>({idempotencyKey:crypto.randomUUID(),lines:[],clientId:'',paymentMethod:'Dinheiro',discount:0,shipping:0,termCount:3,termEntry:0,firstDueDate:date,notes:''});
export const posTotals=(lines:ERPLine[],discount:number,shipping:number)=>{
 const subtotal=round(lines.reduce((sum,line)=>sum+lineTotal(line),0));
 return {subtotal,total:round(Math.max(0,subtotal+shipping-discount)),items:lines.reduce((sum,l)=>sum+l.quantity,0)};
};
export const canSell=(product:ERPProduct,quantity:number)=>product.active&&Number.isFinite(quantity)&&quantity>0&&quantity<=product.stock+1e-7;
export function posAddProduct(lines:ERPLine[],product:ERPProduct,quantity=1){
 if(!product.active)throw Error('Produto inativo.');
 if(!Number.isFinite(quantity)||quantity<=0||quantity>100000)throw Error('Quantidade inválida.');
 const inCart=lines.find(l=>l.productId===product.id)?.quantity||0;
 if(!canSell(product,round(inCart+quantity)))throw Error('Estoque insuficiente para '+product.title+'. Disponível: '+product.stock+'.');
 const line:ERPLine={productId:product.id,title:product.title,sku:product.sku,quantity:round(inCart+quantity),price:product.price,cost:product.cost,unit:product.unit};
 return inCart?lines.map(l=>l.productId===product.id?line:l):[...lines,line];
}
export function posFindProduct(products:ERPProduct[],code:string){
 const search=code.trim(),barcode=normalizeBarcode(search);
 if(!search)return {product:null,error:'Informe um código.'};
 const matches=barcode?findBarcodeProducts(products,barcode):[];
 const direct=products.filter(p=>p.sku.toLocaleLowerCase('pt-BR')===search.toLocaleLowerCase('pt-BR'));
 const found=[...new Map([...matches,...direct].map(p=>[p.id,p])).values()];
 if(found.length>1)return {product:null,error:'Código duplicado no catálogo. Corrija o cadastro antes de vender.'};
 if(!found.length)return {product:null,error:'Produto não cadastrado.'};
 return {product:found[0],error:null};
}
export function posDraftValid(value:unknown):value is POSDraft{
 if(!value||typeof value!=='object')return false;
 const x=value as Record<string,unknown>;
 return Array.isArray(x.lines)&&x.lines.length<=150&&x.lines.every(l=>l&&typeof l==='object'&&typeof l.productId==='string'&&typeof l.quantity==='number'&&Number.isFinite(l.quantity)&&l.quantity>0)&&typeof x.paymentMethod==='string'&&typeof x.clientId==='string';
}
