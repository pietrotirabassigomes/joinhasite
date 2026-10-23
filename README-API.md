# Joinha Sorvetes — API, painel de pedidos e administração

Esta cópia adiciona um backend Node.js/Express com banco SQLite, login de administrador, painel de pedidos, gerenciamento de produtos e cálculo de frete por bairro. O cardápio inicial inclui os **20 picolés e 36 milkshakes** que já estavam no HTML.

## Como executar no computador

1. Instale o **Node.js 22 ou mais recente**.
2. Abra a pasta do projeto no VS Code. É a pasta que contém `package.json` e `server.js`.
3. Crie o arquivo de configuração. No terminal do VS Code, use um destes comandos:
   - PowerShell: `Copy-Item .env.example .env`
   - Prompt de Comando: `copy .env.example .env`
4. Abra `.env` e troque `ADMIN_PASSWORD` e `JWT_SECRET` por valores só seus. Use uma chave JWT longa e aleatória; não envie o `.env` ao GitHub.
5. No terminal, execute:

   ```bash
   npm install
   npm start
   ```

6. Abra `http://localhost:3000` para ver o site e `http://localhost:3000/admin/` para entrar no painel.

Com o `.env.example` sem alterações, o login local inicial é `admin@joinha.local` e a senha `JoinhaAdmin2026!`. **Troque a senha antes de publicar ou permitir acesso de outras pessoas.** Se iniciar sem criar `.env`, o servidor usa credenciais de desenvolvimento e avisa isso no terminal.

## O que entrou

- **Pedidos:** o checkout tenta registrar o pedido no banco antes de abrir o WhatsApp. O painel mostra itens, endereço, subtotal, frete, total, horário e status (`novo`, `preparando`, `pronto`, `entregue`). O total é recalculado pelo servidor a partir dos preços salvos.
- **Cardápio:** a aba “Cardápio” permite alterar nomes, imagens, tamanhos e preços, adicionais, observações e disponibilidade. Também permite cadastrar produtos. O site consulta `GET /api/produtos` e atualiza os cards quando a API estiver ligada.
- **Login:** token JWT de administrador com validade de 8 horas, senha comparada com hash bcrypt e limitação de tentativas de login.
- **Entrega:** o campo CEP consulta o ViaCEP e pode preencher rua/bairro. Em “Entrega e frete”, configure a taxa por bairro ou desmarque “Atendemos” para bloquear esse bairro. Bairros não cadastrados ficam como “frete a combinar”.
- **Relatório:** mostra pedidos e vendas de hoje, pedidos pendentes e vendas de pedidos entregues.

O banco fica em `server/joinha.sqlite` e é criado automaticamente ao iniciar o servidor. O cardápio inicial é importado somente quando o banco ainda não possui produtos. Para zerar uma instalação local de teste, pare o servidor e apague o arquivo SQLite; isso apaga também o histórico de pedidos e as regras de entrega.

## Antes de usar com clientes reais

- Em `PAGINA PRINCIPAL/carrinho.js`, substitua `NUMERO_WHATSAPP` pelo telefone real da loja, só com números e código do país/DDD.
- O site precisa acessar a API para que os pedidos entrem no painel. Abrir o HTML diretamente com `file://` ou hospedar somente em GitHub Pages não executa Node.js. Para isso, hospede o backend em um serviço que execute Node.js e tenha **armazenamento persistente** para o SQLite.
- Se o frontend e backend estiverem em domínios diferentes, configure `FRONTEND_ORIGIN` no backend e informe a URL pública do backend em `api-config.js`, por exemplo `window.JOINHA_API_URL = 'https://api.seudominio.com';`.
- Use HTTPS, uma senha forte, uma `JWT_SECRET` exclusiva e backups do arquivo SQLite. Não use as credenciais de desenvolvimento em produção.
- O checkout mantém uma opção de emergência: se a API não responder, pergunta se deseja continuar para o WhatsApp. Esse pedido **não ficará salvo no painel**.

## Rotas principais

- `GET /api/produtos` — produtos disponíveis para o cardápio.
- `POST /api/pedidos` — registra pedido e calcula os valores no servidor.
- `GET /api/cep/:cep` — consulta CEP via ViaCEP.
- `GET /api/frete?bairro=Centro` — consulta frete e atendimento.
- `POST /api/admin/login` — login do administrador.
- `/api/admin/produtos`, `/api/admin/pedidos`, `/api/admin/areas` — rotas protegidas do painel.
