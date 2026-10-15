# EIXO OS — Deploy no Render (etapas controladas)

Este diretório contém **somente o código do aplicativo**. Não inclui contas reais, base PGlite, backups, arquivos de segredo, sessões ou mídia dos usuários.

## Situação na criação deste pacote
- Workspace Render conectado: ainda sem serviços e bancos.
- Repositório Git remoto: ainda não configurado. O deploy na integração Render depende de um URL Git clonável pela conta.
- A API de produção Asaas já foi consultada; registro de webhook real ainda pendente.
- A cópia é para implantação; não é o banco de produção.
- Fonte: C:\Jogos\EIXO, cópia separada.

## Implantação comercial segura
1. Publicar este projeto em repositório Git **privado**, autorizado na conta Render.
2. Criar no Render uma instância web Node.js não suspensível e um PostgreSQL gerenciado persistente, preferencialmente na mesma região. Recursos pagos precisam de autorização de cobrança separada.
3. Compilar: `npm ci && npm run build`; iniciar: `node server.mjs`. A aplicação escuta `PORT` do provedor com `EIXO_HOST=0.0.0.0`. Node 24.21.0 fixado em .node-version.
4. Configurar variáveis de produção (segredos apenas no painel/cofre do Render):
   - `EIXO_MODE=production`, `EIXO_HOST=0.0.0.0`, `DATABASE_URL`, `DATABASE_SSL=require`.
   - `SMTP_URL` e `SMTP_FROM` com SMTP transacional funcional.
   - `EIXO_PUBLIC_URL=https://<host-atribuido>.onrender.com`, `EIXO_PUBLIC_HOST=<host-atribuido>.onrender.com` e `EIXO_BILLING_PRODUCTION_ORIGIN` igual à URL pública.
   - `EIXO_ASAAS_PRODUCTION_KEY`, `EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN` independentes, `EIXO_ASAAS_WEBHOOK_EMAIL`.
   - No início: `EIXO_ASAAS_ENABLE_REAL_BILLING=0`, `EIXO_ASAAS_PRODUCTION_WEBHOOK_READY=0`, `EIXO_OFFSITE_BACKUP_READY=0`.
5. **Não liberar clientes ainda.** O banco original do EIXO usa PGlite local e contém dados de contas reais. Fazer backup frio + restauração e migração transacional auditada da base original (inclusive mídia) para Render antes do corte, com janela de manutenção para evitar escrita concorrente.
6. Implementar backup externo restaurável, SMTP, monitoramento de uptime e alertas; confirmar a hospedagem via `GET /api/health`.
7. Após preflight aprovado, cadastrar `POST /v3/webhooks` pelo comando `node scripts/asaas-production-webhook.mjs --apply`, com `EIXO_ASAAS_WEBHOOK_REGISTRATION_APPROVED=REGISTER_PRODUCTION_WEBHOOK_ONLY` e env vars confirmadas.
8. Validar teste real explícito: pagamento recebido, evento idempotente, plano ativado/renovado, recusa, estorno, cancelamento. Só depois habilitar `EIXO_ASAAS_PRODUCTION_WEBHOOK_READY=1` e `EIXO_ASAAS_ENABLE_REAL_BILLING=1`.
9. Rotacionar a credencial Asaas exposta na conversa antes das primeiras cobranças comerciais.

## Importante
- O cofre DPAPI de Windows não funciona no Render/Linux; use gerenciador de segredos do Render.
- Um banco gratuito Render expira em 30 dias e não possui backup; e o serviço web gratuito pode suspender por inatividade. Não utilizar essas modalidades para pagamentos reais.
- Sem repositório acessível e infraestrutura paga confiável, **não há hospedagem comercial nem webhook ativo**.
