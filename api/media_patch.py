from pathlib import Path
p=Path(r'C:\Jogos\EIXO\api\db.mjs');s=p.read_text('utf-8')
def change(old,new):
 global s
 if old not in s:raise ValueError(old[:90])
 s=s.replace(old,new,1)
change("  await query(`CREATE TABLE IF NOT EXISTS sessions (","  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT');\n  await query(`CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,workspace_id TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);\n  await query(`CREATE TABLE IF NOT EXISTS sessions (")
change("export async function closeDb(){await client.close?.() ?? client.end?.()}","export async function closeDb(){if(mode==='postgresql')await client.end();else await client.close()}")
p.write_text(s,'utf-8')
p=Path(r'C:\Jogos\EIXO\api\server.mjs');s=p.read_text('utf-8')
def c(old,new):
 global s
 if old not in s:raise ValueError(old[:90])
 s=s.replace(old,new,1)
c("import {promisify} from 'node:util';","import {promisify} from 'node:util';\nimport sharp from 'sharp';")
c("return {id:u.id,email:u.email,displayName:u.display_name,","return {avatarUrl:u.avatar_id?'/api/media/'+u.avatar_id:null,id:u.id,email:u.email,displayName:u.display_name,")
c(" const u=await auth(req);if(!u)return fail(res,401,'Faça login para continuar.');",""" const u=await auth(req);if(!u)return fail(res,401,'Faça login para continuar.');
 if(pathname==='/api/media'&&method==='POST'){
   if(!(await profile(u)).access)return fail(res,402,'Conta sem acesso de escrita.');
   if(!['image/jpeg','image/png','image/webp'].includes(req.headers['content-type']))return fail(res,415,'Formato de imagem não aceito.');
   let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>5*1024*1024)return fail(res,413,'Limite de 5 MB por imagem.');chunks.push(part)}
   if(size<16)return fail(res,400,'Imagem inválida.');
   const count=(await query('SELECT COUNT(*) AS count FROM media WHERE user_id=$1',[u.id])).rows[0];
   if(Number(count.count)>=500)return fail(res,413,'Limite de 500 imagens por conta.');
   let converted;
   try{const buff=Buffer.concat(chunks);const meta=await sharp(buff,{limitInputPixels:30000000,animated:false}).metadata();
     if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)return fail(res,415,'Formato não aceito.');
     converted=await sharp(buff,{limitInputPixels:30000000}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:4}).toBuffer();
   }catch{return fail(res,400,'Não foi possível validar a imagem.');}
   const mid=randomUUID(),dir=path.join(dataDir,'media',u.id);fs.mkdirSync(dir,{recursive:true});
   const filename=mid+'.webp';fs.writeFileSync(path.join(dir,filename),converted,{flag:'wx',mode:0o600});
   const ws=safe(req.headers['x-eixo-workspace']||'pessoal').slice(0,128);
   await query('INSERT INTO media(id,user_id,workspace_id,filename,mime,bytes) VALUES($1,$2,$3,$4,$5,$6)',[mid,u.id,ws,filename,'image/webp',converted.length]);
   return json(res,201,{id:mid,url:'/api/media/'+mid,size:converted.length});
 }
 if(pathname.startsWith('/api/media/')&&method==='GET'){
   const mid=pathname.slice('/api/media/'.length);if(!/^[0-9a-f-]{36}$/i.test(mid))return fail(res,404,'Imagem não encontrada.');
   const record=(await query('SELECT * FROM media WHERE id=$1 AND user_id=$2',[mid,u.id])).rows[0];if(!record)return fail(res,404,'Imagem não encontrada.');
   const file=path.join(dataDir,'media',u.id,record.filename);if(!fs.existsSync(file))return fail(res,404,'Imagem indisponível.');
   res.writeHead(200,{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'});fs.createReadStream(file).pipe(res);return;
 }
 if(pathname.startsWith('/api/media/')&&method==='DELETE'){
   const mid=pathname.slice('/api/media/'.length);if(!/^[0-9a-f-]{36}$/i.test(mid))return fail(res,404,'Imagem não encontrada.');
   const record=(await query('DELETE FROM media WHERE id=$1 AND user_id=$2 RETURNING filename',[mid,u.id])).rows[0];if(!record)return fail(res,404,'Imagem não encontrada.');
   try{fs.unlinkSync(path.join(dataDir,'media',u.id,record.filename))}catch{}
   return json(res,200,{ok:true});
 }""")
c("   await query('UPDATE users SET display_name=$2,full_name=$3,phone=$4 WHERE id=$1',[u.id,name,full,phone]);","""   if(b.avatarId!==undefined&&b.avatarId!==null&&b.avatarId!==''){
     const found=(await query('SELECT id FROM media WHERE id=$1 AND user_id=$2',[b.avatarId,u.id])).rows[0];
     if(!found)return fail(res,400,'Imagem de perfil inválida.');
   }
   await query('UPDATE users SET display_name=$2,full_name=$3,phone=$4,avatar_id=$5 WHERE id=$1',[u.id,name,full,phone,b.avatarId===undefined?u.avatar_id:(b.avatarId||null)]);""")
p.write_text(s,'utf-8')
print('API media e perfil aprimorados')
