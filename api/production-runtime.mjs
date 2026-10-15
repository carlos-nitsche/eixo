const parse=value=>{try{return new URL(value)}catch{return null}};
const secureHost=url=>{
 if(!url||url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return false;
 const hostname=url.hostname.toLowerCase();
 return hostname.includes('.')&&!['localhost','127.0.0.1'].includes(hostname)&&!hostname.endsWith('.trycloudflare.com');
};
/** Reject unsafe production defaults before opening any database or listener. No secrets in errors. */
export function validateProductionRuntime(env=process.env){
 if(env.EIXO_MODE!=='production')return {production:false,validated:false};
 const errors=[];
 const db=parse(env.DATABASE_URL);
 const publicUrl=parse(env.EIXO_PUBLIC_URL);
 const smtp=parse(env.SMTP_URL);
 if(!db||!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname||!db.username||!db.password)errors.push('DATABASE_URL PostgreSQL obrigatório');
 if(env.DATABASE_SSL!=='require')errors.push('DATABASE_SSL=require obrigatório');
 if(!secureHost(publicUrl))errors.push('EIXO_PUBLIC_URL HTTPS estável obrigatório');
 if(!publicUrl||String(env.EIXO_PUBLIC_HOST||'').toLowerCase()!==publicUrl.hostname.toLowerCase())errors.push('EIXO_PUBLIC_HOST deve coincidir com HTTPS');
 if(!smtp||!['smtp:','smtps:'].includes(smtp.protocol)||!smtp.hostname||!smtp.username||!smtp.password)errors.push('SMTP_URL válido obrigatório');
 if(!String(env.SMTP_FROM||'').includes('@'))errors.push('SMTP_FROM obrigatório');
 if(errors.length)throw Object.assign(new Error('Configuração de produção recusada: '+errors.join('; ')),{code:'EIXO_PRODUCTION_CONFIG_REJECTED'});
 return {production:true,validated:true};
}
