from pathlib import Path
p=Path(r'C:\Jogos\EIXO\api\server.mjs')
s=p.read_text('utf-8')
if "import https from 'node:https';" not in s:
    s=s.replace("import http from 'node:http';","import http from 'node:http';\nimport https from 'node:https';",1)
old="""const server=http.createServer(async(req,res)=>{
 try{
   const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
   if(url.pathname.startsWith('/api/'))return await api(req,res,url);
   return await staticFile(req,res,url);
 }catch(error){console.error('EIXO server failure:',error?.message);return fail(res,error?.status||500,error?.status?error.message:'Erro interno.');}
});
server.listen(port,host,()=>console.log(`EIXO local seguro: http://${host}:${port} | DB ${mode} | emails em server-data/outbox`));"""
new="""const handleRequest=async(req,res)=>{
 try{
   const url=new URL(req.url||'/',`${req.socket.encrypted?'https':'http'}://${req.headers.host||'localhost'}`);
   if(url.pathname.startsWith('/api/'))return await api(req,res,url);
   return await staticFile(req,res,url);
 }catch(error){console.error('EIXO server failure:',error?.message);return fail(res,error?.status||500,error?.status?error.message:'Erro interno.');}
};
const server=http.createServer(handleRequest);
server.listen(port,host,()=>console.log(`EIXO PC: http://${host}:${port} | DB ${mode}`));

const tlsRoot=path.join(dataDir,'tls'), configPath=path.join(tlsRoot,'lan.json');
if(fs.existsSync(configPath)){
 const lan=JSON.parse(fs.readFileSync(configPath,'utf8'));
 const ip=lan.lanIp, httpsPort=Number(lan.httpsPort), setupPort=Number(lan.setupPort);
 if(!/^192\\.168\\.|^10\\.|^172\\.(1[6-9]|2[0-9]|3[01])\\./.test(ip)||!(httpsPort>=1024&&httpsPort<65536)||!(setupPort>=1024&&setupPort<65536))throw Error('Configuracao de IP/portas LAN invalida.');
 const cert=fs.readFileSync(path.join(tlsRoot,'server-cert.pem'));
 const key=fs.readFileSync(path.join(tlsRoot,'server-key.pem'));
 const tlsServer=https.createServer({cert,key,minVersion:'TLSv1.2'},handleRequest);
 tlsServer.listen(httpsPort,ip,()=>console.log(`EIXO IPHONE HTTPS: https://${ip}:${httpsPort}/`));
 tlsServer.on('error',error=>console.error('HTTPS LAN nao iniciou:',error.message));
 const ca=fs.readFileSync(path.join(tlsRoot,'eixo-ca.cer'));
 const page=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configurar EIXO no iPhone</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f9fb;color:#24334b;font:16px -apple-system,BlinkMacSystemFont,Arial,sans-serif;line-height:1.6;padding:20px}.card{max-width:650px;background:white;border:1px solid #e2e7ed;border-radius:18px;padding:27px;margin:30px auto;box-shadow:0 6px 30px #0001}h1{font-size:25px;margin:0 0 14px}h2{font-size:16px;margin:23px 0 4px}a.button{background:#263a58;color:white;padding:14px 20px;border-radius:9px;display:inline-block;text-decoration:none;font-weight:700;max-width:100%}code{word-break:break-all;font-size:12px;background:#edf1f7;padding:7px;border-radius:5px}ol{padding-left:25px}li{margin-bottom:13px}.muted{color:#66778d;font-size:13px}.notice{padding:12px;background:#fff7df;border-radius:10px}</style></head><body><div class="card"><h1>EIXO · Configuracao no iPhone</h1><p>Conecte o iPhone ao mesmo Wi-Fi deste computador. Instale o certificado local <b>apenas no seu aparelho pessoal</b> para que o Safari reconheca a conexao HTTPS.</p><h2>1. Baixe o certificado publico</h2><p><a class="button" href="/eixo-ca.cer">Baixar certificado do EIXO</a></p><h2>2. Instale e confie no certificado</h2><ol><li>Abra <b>Ajustes → Geral → VPN e Gerenciamento de Dispositivo</b> (ou Perfil Baixado) e instale o certificado.</li><li>Abra <b>Ajustes → Geral → Sobre → Ajustes de Confianca dos Certificados</b> e ative confianca total para <b>EIXO - Autoridade local de teste</b>.</li></ol><p class="muted">Identificador SHA-256 do certificado: <code>${lan.caSha256}</code>. Confira com o identificador fornecido diretamente no ChatGPT.</p><h2>3. Abra o EIXO</h2><p><a class="button" href="https://${ip}:${httpsPort}/">Abrir EIXO com HTTPS</a></p><p class="notice">Este certificado confia em uma autoridade local criada para o EIXO. Instale-o somente se confiar neste computador. Nao abra o roteador para acesso externo. O computador precisa permanecer ligado.</p><p class="muted">Nenhuma senha ou informacao do EIXO e transmitida por esta pagina HTTP; ela fornece apenas o certificado publico.</p></div></body></html>`;
 const setupServer=http.createServer((req,res)=>{
  const pathname=new URL(req.url||'/','http://localhost').pathname;
  const allowed=req.method==='GET'&&['/','/eixo-ca.cer'].includes(pathname);
  if(!allowed){res.writeHead(404,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end('Nao encontrado');}
  if(pathname==='/eixo-ca.cer'){res.writeHead(200,{'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="eixo-ca.cer"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(ca)}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(page);
 });
 setupServer.listen(setupPort,ip,()=>console.log(`EIXO IPHONE CERTIFICADO: http://${ip}:${setupPort}/`));
 setupServer.on('error',error=>console.error('Instalador LAN nao iniciou:',error.message));
}
"""
if old not in s: raise RuntimeError('Nao encontrou o bloco de servidor esperado; nenhuma alteracao efetuada')
p.write_text(s.replace(old,new,1),'utf-8')
print('HTTPS LAN e instalador de certificado adicionados ao mesmo processo de API')
