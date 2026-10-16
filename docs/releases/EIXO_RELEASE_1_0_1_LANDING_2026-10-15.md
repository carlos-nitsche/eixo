# EIXO OS 1.0.1 — Página de apresentação comercial

Data: 15/10/2026. Projeto: C:\Jogos\EIXO.

## Objetivo e diretrizes
Reestruturar a landing page da marca para que visitantes entendam os benefícios, módulos e possibilidades do EIXO antes de analisar os planos. Mensagens persuasivas, concretas e verificáveis. Sem avaliações inventadas, usuários falsos, falsas contagens de adesão, limitação de estoque ou alegação de que a cobrança está habilitada.

## Implementação
- `src/LandingPage.tsx`: novo posicionamento e copy do hero, links para recursos/demonstração/planos, comparação dinâmica de custos mensais equivalentes e FAQ expandido.
- `src/LandingShowcase.tsx`: painel demonstrativo de agenda, finanças e tarefas, com dados claramente identificados como fictícios; oito cartões de módulos reais; seção explicando dispersão das rotinas versus visão integrada; seção do assistente local por texto com reconhecimento de comandos conhecidos e confirmação explícita; onboarding em três passos.
- `src/landing.css`: identidade EIXO (dark/light e verde menta), acabamento editorial, hierarquia visual, cartões com cores semânticas, responsividade 320–1440 px, foco visível e movimento reduzido.
- `src/App.tsx`: indicação da versão 1.0.1.
- `tests/landing-e2e.mjs`: valida hero atualizado, grade com oito áreas, indicador de demonstração fictícia e conserva as verificações de preços reais, navegação por teclado, login/cadastro e ausência de gravação de dados.

## Responsabilidade comercial
- Os preços vêm exclusivamente de `GET /api/plans`, inclusive valores promocionais já cadastrados no backend.
- Para os planos semestral e anual, a equivalência mensal é calculada matematicamente a partir dos preços atuais, sem prometer cobranças mensais nesses planos.
- A prévia pública continua sem cadastro e sem cobrança online. O botão principal nesse modo leva à seção de planos, sem prometer compra liberada.
- O Assistente EIXO não é um LLM generativo; descreve interpretação de comandos textuais conhecidos e revisão antes de gravar, sem API externa.
- O dashboard visual da landing não contém dados reais nem métricas de clientes.
- Nenhuma alteração em dados de assinaturas, políticas de cobrança, webhook ou credenciais.

## Testes
- Compilação: `npm run build`.
- Segurança do backend: `npm run test:production-guards` (8/8).
- Landing E2E: `node tests/landing-e2e.mjs`, 87 verificações em dark/light e 8 tamanhos entre 320 e 1440 pixels, sem overflow, com tablist navegável pelo teclado e preços iguais ao catálogo da API.
- As capturas de QA estão em `tests/visual-results/landing-{dark|light}-{390|1440}.png` no computador do operador.
