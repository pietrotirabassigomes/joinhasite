# Joinha Sorvetes — site, pedidos e painel

O projeto mantém a estrutura atual do site, cardápio e painel administrativo. O backend usa Node.js/Express e SQLite para cadastrar produtos e registrar pedidos. **Hospede como aplicação Node.js**, não como site estático puro, para que checkout, login e painel funcionem.

## Antes de publicar

1. Abra `api-config.js` e preencha `JOINHA_WHATSAPP` com o telefone comercial no formato `55 + DDD + número`, só dígitos. O checkout fica bloqueado até esse campo conter um telefone válido, evitando pedidos enviados a um link fictício.
2. No mesmo arquivo, informe os links oficiais em `JOINHA_INSTAGRAM_URL` e `JOINHA_FACEBOOK_URL` (com `https://`) e os campos disponíveis: endereço, razão social, CNPJ, telefone, e-mail e horário de atendimento. Campos vazios ficam ocultos.
3. Confirme preços, tamanhos, adicionais e disponibilidade na aba **Cardápio** do painel. Os preços presentes no seed podem ser exemplos; não aceite pedidos reais sem revisar.
4. Atualize os dados legais e de contato da política de privacidade conforme a empresa real.
5. Configure uma senha administrativa forte (mínimo 12 caracteres), um e-mail próprio e uma chave JWT com pelo menos 32 caracteres. Não coloque esses segredos em `api-config.js`, no Git ou neste README.
6. Não envie `.env`, `node_modules`, `.git` ou o arquivo SQLite para o repositório. O banco será criado no primeiro boot e deve ficar em disco persistente.

## Publicar no Render (frontend + API juntos)

O arquivo `render.yaml` configura o projeto como serviço Node.js, define `/api/health` como verificação de saúde e monta um disco persistente em `/var/data` para não perder pedidos a cada novo deploy. A hospedagem com disco persistente requer um plano que ofereça esse recurso.

1. Envie a pasta do projeto ao seu repositório GitHub, sem `.env`, `node_modules`, `.git` e sem dados SQLite no repositório de publicação.
2. No Render, crie um **Blueprint** a partir do repositório e revise o `render.yaml`.
3. Antes de finalizar o primeiro deploy, cadastre as variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD` em **Environment**. Use valores únicos; a senha deve ter pelo menos 12 caracteres. `JWT_SECRET` é gerado pela configuração do serviço.
4. Depois que o Render mostrar a URL pública, abra o site e teste `/api/health`, o cardápio e `/admin/`. O painel fica em `https://SEU-SERVICO.onrender.com/admin/`.
5. Se tiver domínio próprio, configure-o no Render e defina `SITE_URL` com a URL final HTTPS, sem barra no fim. O backend gera `robots.txt` e `sitemap.xml` usando esse domínio ou o host do deploy.
6. Entre no painel e revise os preços e as áreas/taxas de entrega antes de divulgar o site. Faça um pedido de teste e confirme se ele aparece no painel e se abre o WhatsApp comercial.

## Publicar usando Docker

O `Dockerfile` usa Node.js 22 e instala as dependências de produção. Para preservar os pedidos, monte um volume persistente em `/var/data` e configure `DB_FILE=/var/data/joinha.sqlite`, além de `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `JWT_SECRET`. Exponha a porta definida pela variável `PORT` (o padrão local é 3000).

## Rodar localmente

Requisitos: Node.js 22.13 ou superior (nada mais — sem Python, sem compilador).

```bash
cp .env.example .env
```
Edite `.env` e defina sua senha administrativa e `JWT_SECRET`. Depois execute:

```bash
npm ci
npm run check
npm start
```

Abra `http://localhost:3000`, o cardápio em `/CARDAPIO/cardapio.html` e o painel em `/admin/`. Na primeira execução o servidor cria o banco e importa o catálogo inicial de `server/seed-products.json`. Migrações pendentes do catálogo, como `server/atualizar-potes.sql`, são aplicadas uma única vez ao iniciar o servidor. O arquivo `.env.example` é só um modelo e não deve ser usado como configuração final de produção.

## Observações importantes

- `api-config.js` é público: coloque nele somente URLs e dados comerciais destinados a visitantes. Nunca coloque senha, token secreto ou credenciais de banco nesse arquivo.
- Se publicar frontend e API no mesmo host, mantenha `JOINHA_API_URL` vazio. Se estiverem em hosts separados, informe a URL pública da API em `JOINHA_API_URL` e configure `FRONTEND_ORIGIN` no servidor com a origem exata do frontend.
- O SQLite precisa de armazenamento persistente. Hospedagem que apaga o disco ao reiniciar pode perder histórico de pedidos. Faça backups regulares do arquivo do banco.
- `.htaccess` contém regras para servidores Apache, mas **não substitui o backend Node.js**. GitHub Pages/Netlify estático, sozinho, não executa a API ou o painel com banco.
- Os links de Instagram/Facebook, WhatsApp, dados da loja e domínio não podiam ser completados automaticamente porque não vieram no pacote; configure-os antes de receber clientes reais.
