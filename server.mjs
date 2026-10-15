// EIXO startup — production secrets are loaded server-side only.
// Windows DPAPI vault remains opt-in; Linux deployments use environment secrets.
if(process.env.EIXO_MODE==='production'&&process.env.EIXO_ASAAS_USE_WINDOWS_VAULT==='1'){
  if(process.platform!=='win32')throw Error('O cofre Windows exige execução no mesmo usuário do Windows.');
  const {loadAsaasLocalSecrets}=await import('./scripts/asaas-windows-vault.mjs');
  const credentials=loadAsaasLocalSecrets();
  if(!credentials)throw Error('Credenciais do Asaas não encontradas no cofre local.');
  if(!process.env.EIXO_ASAAS_PRODUCTION_KEY)process.env.EIXO_ASAAS_PRODUCTION_KEY=credentials.productionKey;
  if(!process.env.EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN)process.env.EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN=credentials.webhookToken;
}
await import('./api/server.mjs');
