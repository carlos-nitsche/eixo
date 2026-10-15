from pathlib import Path
root=Path(r'C:\Jogos\EIXO')
p=root/'api'/'db.mjs';s=p.read_text('utf-8')
old="  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');"
assert old in s;s=s.replace(old,"  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_single_owner ON users (is_owner) WHERE is_owner=TRUE');\n"+old,1);p.write_text(s,'utf-8')
p=root/'api'/'server.mjs';s=p.read_text('utf-8')
old="import sharp from 'sharp';";assert old in s;s=s.replace(old,old+"\nimport nodemailer from 'nodemailer';",1)
old="return {avatarUrl:u.avatar_id?'/api/media/'+u.avatar_id:null,id:u.id"
assert old in s;s=s.replace(old,"return {avatarId:u.avatar_id||null,avatarUrl:u.avatar_id?'/api/media/'+u.avatar_id:null,id:u.id",1)
old="""async function sendLocalMail(email,purpose,raw){
 const outbox=path.join(dataDir,'outbox');"""
assert old in s;s=s.replace(old,"""async function sendLocalMail(email,purpose,raw){
 if(process.env.SMTP_URL){
   const route=purpose==='verify'?'verify':'reset';
   const link=(process.env.EIXO_PUBLIC_URL||('http://127.0.0.1:'+port))+'/?action='+route+'&token='+encodeURIComponent(raw);
   const transporter=nodemailer.createTransport(process.env.SMTP_URL);
   await transporter.sendMail({from:process.env.SMTP_FROM||'EIXO <no-reply@localhost>',to:email,subject:purpose==='verify'?'Confirme sua conta EIXO':'Redefina sua senha EIXO',text:'Acesse o link para continuar:\\n'+link+'\\nEste link expira. Caso não tenha solicitado, ignore a mensagem.'});
   return;
 }
 const outbox=path.join(dataDir,'outbox');""",1)
p.write_text(s,'utf-8')
print('SMTP opcional, unicidade Lifetime e foto de perfil no backend')
