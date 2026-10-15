// EIXO · Render preview. Read-only static storefront. No auth, database or billing.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('dist');
const port=Number(process.env.PORT||10000);
const safeMime=new Map(Object.entries({
 '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.ico':'image/x-icon','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'
}));
const headers={
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
 'Strict-Transport-Security':'max-age=86400','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'
};
const notice='<div role="status" style="position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:9px 14px;background:#161d28;color:#fff;font:500 13px system-ui;text-align:center;box-shadow:0 2px 8px #0003">Prévia do EIXO · Cadastros e pagamentos indisponíveis nesta versão</div>';
const send=(res,status,obj,method='GET')=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});if(method==='HEAD')res.end();else res.end(JSON.stringify(obj))};
const plans=[
 {id:'monthly',name:'Mensal',amountCents:2990,originalAmountCents:3990,months:1},
 {id:'semiannual',name:'Semestral',amountCents:14990,originalAmountCents:19990,months:6},
 {id:'annual',name:'Anual',amountCents:26990,originalAmountCents:34990,months:12}
];
http.createServer(async(req,res)=>{
 const method=req.method||'GET';
 if(!['GET','HEAD'].includes(method))return send(res,405,{error:'Modo prévia: operações desativadas.'},method);
 let route;
 try{route=decodeURIComponent(new URL(req.url||'/', 'http://preview.invalid').pathname)}catch{return send(res,400,{error:'Rota inválida.'},method)}
 if(route==='/api/health')return send(res,200,{ok:false,mode:'preview',readyForBilling:false},method);
 if(route==='/api/plans')return send(res,200,{plans,trialHours:72,checkoutConfigured:false,billingMode:'preview',liveBilling:false},method);
 if(route.startsWith('/api/'))return send(res,503,{error:'Modo prévia: cadastros, contas e pagamentos desativados.'},method);
 if(route==='/robots.txt'){res.writeHead(200,{...headers,'Content-Type':'text/plain; charset=utf-8'});return res.end(method==='HEAD'?'':'User-agent: *\nDisallow: /\n')}
 try{
  const requested=path.resolve(dir,'.'+route);
  if(!requested.startsWith(dir+path.sep)&&requested!==dir)return send(res,403,{error:'Rota inválida.'},method);
  let target=requested,stat=await fs.stat(target).catch(()=>null);
  if(stat?.isDirectory()){target=path.join(target,'index.html');stat=await fs.stat(target).catch(()=>null)}
  if(!stat?.isFile()){if(path.extname(route))return send(res,404,{error:'Recurso não encontrado.'},method);target=path.join(dir,'index.html')}
  let buf=await fs.readFile(target);
  if(path.basename(target)==='index.html')buf=Buffer.from(buf.toString('utf8').replace('</body>',notice+'</body>'));
  res.writeHead(200,{...headers,'Content-Type':safeMime.get(path.extname(target))||'application/octet-stream'});
  res.end(method==='HEAD'?undefined:buf);
 }catch(e){console.error('PREVIEW_FILE_ERROR',e?.code||'unknown');send(res,500,{error:'Prévia indisponível.'},method)}
}).listen(port,'0.0.0.0',()=>console.log('EIXO_PREVIEW_READY port='+port+' billing=false database=false'));
