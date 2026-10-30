'use strict';



require('dotenv').config();

const path = require('path');

const fs = require('fs');

const express = require('express');

const Database = require('better-sqlite3');

const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

const cors = require('cors');

const helmet = require('helmet');

const rateLimitModule = require('express-rate-limit');

const rateLimit = rateLimitModule.rateLimit || rateLimitModule;



const app = express();

const ROOT = __dirname;

const PORT = Number(process.env.PORT || 3000);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@joinha.local';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'JoinhaAdmin2026!';

const JWT_SECRET = process.env.JWT_SECRET || 'local-only-change-this-secret-before-publishing';

const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'server', 'joinha.sqlite');

const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);



if (IS_PRODUCTION && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'JoinhaAdmin2026!' || !process.env.JWT_SECRET || JWT_SECRET.length < 32 || /troque|change.?me|secret.?here/i.test(JWT_SECRET) || process.env.ADMIN_PASSWORD.length < 12)) {

     console.error('ERRO: configure ADMIN_EMAIL, ADMIN_PASSWORD e JWT_SECRET (com pelo menos 32 caracteres) no ambiente de produção.');

     process.exit(1);

}

if (!IS_PRODUCTION && (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET)) {

     console.warn('AVISO: usando credenciais de desenvolvimento. Não publique o servidor sem configurar o arquivo .env.');

}



fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');

db.pragma('foreign_keys = ON');



db.exec(`

     CREATE TABLE IF NOT EXISTS admins (

       id INTEGER PRIMARY KEY AUTOINCREMENT,

       email TEXT NOT NULL UNIQUE COLLATE NOCASE,

       password_hash TEXT NOT NULL,

       ativo INTEGER NOT NULL DEFAULT 1,

       criado_em TEXT NOT NULL

     );

     CREATE TABLE IF NOT EXISTS products (
       id TEXT PRIMARY KEY,
       nome TEXT NOT NULL,

       categoria TEXT NOT NULL CHECK(categoria IN ('picoles','milkshakes','potes','especiais')),

       imagem TEXT NOT NULL DEFAULT '',

       tamanhos TEXT NOT NULL DEFAULT '[]',

       upgrades TEXT NOT NULL DEFAULT '[]',

       obs INTEGER NOT NULL DEFAULT 1,

       ativo INTEGER NOT NULL DEFAULT 1,

       criado_em TEXT NOT NULL,

       atualizado_em TEXT NOT NULL
     );
     CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     );
     CREATE TABLE IF NOT EXISTS orders (

       id INTEGER PRIMARY KEY AUTOINCREMENT,

       numero TEXT NOT NULL UNIQUE,

       cliente TEXT NOT NULL,

       telefone TEXT NOT NULL DEFAULT '',

       modo TEXT NOT NULL CHECK(modo IN ('retirada','entrega')),

       endereco TEXT NOT NULL DEFAULT '',

       cep TEXT NOT NULL DEFAULT '',

       bairro TEXT NOT NULL DEFAULT '',

       itens TEXT NOT NULL,

       subtotal REAL NOT NULL,

       frete REAL,

       total REAL NOT NULL,

       status TEXT NOT NULL DEFAULT 'novo' CHECK(status IN ('novo','preparando','pronto','entregue')),

       observacoes TEXT NOT NULL DEFAULT '',

       criado_em TEXT NOT NULL,

       atualizado_em TEXT NOT NULL

     );

     CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

     CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(criado_em);

     CREATE TABLE IF NOT EXISTS delivery_areas (

       id TEXT PRIMARY KEY,

       bairro TEXT NOT NULL,

       taxa REAL NOT NULL DEFAULT 0,

       ativo INTEGER NOT NULL DEFAULT 1,

       atualizado_em TEXT NOT NULL

     );

`);



const productTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'products'").get()?.sql || '';

if (productTableSql && !/CHECK\s*\(\s*categoria\s+IN\s*\(\s*'picoles'\s*,\s*'milkshakes'\s*,\s*'potes'\s*,\s*'especiais'\s*\)\s*\)/i.test(productTableSql)) {

const existingRows = db.prepare('SELECT * FROM products').all();

     db.exec(`

       ALTER TABLE products RENAME TO products_legacy;

       CREATE TABLE products (

         id TEXT PRIMARY KEY,

         nome TEXT NOT NULL,

         categoria TEXT NOT NULL CHECK(categoria IN ('picoles','milkshakes','potes','especiais')),

         imagem TEXT NOT NULL DEFAULT '',

         tamanhos TEXT NOT NULL DEFAULT '[]',

         upgrades TEXT NOT NULL DEFAULT '[]',

         obs INTEGER NOT NULL DEFAULT 1,

         ativo INTEGER NOT NULL DEFAULT 1,

         criado_em TEXT NOT NULL,

         atualizado_em TEXT NOT NULL

       );

       INSERT INTO products (id, nome, categoria, imagem, tamanhos, upgrades, obs, ativo, criado_em, atualizado_em)

       SELECT id, nome, categoria, imagem, tamanhos, upgrades, obs, ativo, criado_em, atualizado_em

       FROM products_legacy;

       DROP TABLE products_legacy;

     `);

     if (existingRows.length) console.log(`Migração do catálogo concluída: ${existingRows.length} produtos preservados.`);

}



// Novos recursos: esgotado/estoque nos produtos, configuração da loja e log de auditoria.
const colunasProdutos = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
if (!colunasProdutos.includes('esgotado')) db.exec('ALTER TABLE products ADD COLUMN esgotado INTEGER NOT NULL DEFAULT 0');
if (!colunasProdutos.includes('estoque')) db.exec('ALTER TABLE products ADD COLUMN estoque INTEGER');
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, admin_email TEXT NOT NULL, acao TEXT NOT NULL,
    detalhe TEXT NOT NULL DEFAULT '', criado_em TEXT NOT NULL
  );
`);

const nowIso = () => new Date().toISOString();

const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const normalizeOpcao = (s) => normalize(s).replace(/[\s._-]+/g, '');

const slug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `produto-${Date.now()}`;

const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function dataHojeSaoPaulo() {

const values = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());

const p = Object.fromEntries(values.filter(v => v.type !== 'literal').map(v => [v.type, v.value]));

     return { ano: p.year, mes: p.month, dia: p.day, chave: `${p.year}${p.month}${p.day}`, inicioUtc: new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 3, 0, 0)) };

}

const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };



// Cria o primeiro administrador usando o .env somente quando o banco ainda não tem nenhum.

// Os próximos administradores são adicionados pela aba Administradores do painel.

const totalAdmins = db.prepare('SELECT COUNT(*) AS total FROM admins').get().total;

if (totalAdmins === 0) {

const emailInicial = String(ADMIN_EMAIL || '').trim().toLowerCase();

     if (!emailInicial || !String(ADMIN_PASSWORD || '')) {

       console.error('ERRO: configure ADMIN_EMAIL e ADMIN_PASSWORD para criar o primeiro administrador.');

       process.exit(1);

     }

     db.prepare('INSERT INTO admins (email, password_hash, ativo, criado_em) VALUES (?, ?, 1, ?)')

       .run(emailInicial, bcrypt.hashSync(ADMIN_PASSWORD, 12), nowIso());

     console.log(`Administrador inicial criado: ${emailInicial}`);

}



// Importa os itens do cardápio somente na primeira inicialização. Depois, o banco é a fonte principal.

// Potes e itens especiais usam ids com prefixo ("pote-...", "item-especial-...") para não
// colidir com os milkshakes: "creme", "flocos", "pistache" etc. existiam nas duas categorias,
// e o INSERT OR IGNORE descartava os potes repetidos.
const PREFIXO_ID = { potes: 'pote-', especiais: 'item-especial-' };
const RENOMEAR_POTES = {
  'chocolate-trufado-com-bombom': 'pote-chocolate-trufado-bombom',
  'provocante-com-avela': 'pote-provocante-avela'
};
// Itens especiais embutidos: se o seed-products.json estiver ausente ou desatualizado,
// o servidor ainda cadastra estes itens. Os PREÇOS ABAIXO SÃO DE EXEMPLO (R$ 15,00):
// acerte no painel (aba Cardápio) antes de receber pedidos.
const ESPECIAIS_PADRAO = [
  ['item-especial-banana-split', 'Banana Split', '01_banana_split.webp'],
  ['item-especial-morango-split', 'Morango Split', '02_morango_split.webp'],
  ['item-especial-abacaxi-split', 'Abacaxi Split', '03_abacaxi_split.webp'],
  ['item-especial-taca-kinder-bueno', 'Taça Kinder Bueno', '04_taca_kinder_bueno.webp'],
  ['item-especial-taca-tropical', 'Taça Tropical', '05_taca_tropical.webp'],
  ['item-especial-taca-sunday', 'Taça Sunday', '06_taca_sunday.webp'],
  ['item-especial-taca-explosao-de-nutella', 'Taça Explosão de Nutella', '07_taca_explosao_de_nutella.webp'],
  ['item-especial-taca-chocoball', 'Taça Chocoball', '08_taca_chocoball.webp'],
  ['item-especial-petit-gateau-unidade', 'Petit Gâteau (unidade)', '09_petit_gateau_unidade.webp'],
  ['item-especial-espeto-morango-chocolate', 'Espeto de Morango com Chocolate', '10_espeto_de_morango_com_chocolate.webp'],
  ['item-especial-espeto-uva-chocolate', 'Espeto de Uva com Chocolate', '11_espeto_de_uva_com_chocolate.webp'],
  ['item-especial-bubble-waffle-1', 'Bubble Waffle 1', '12_bubble_waffer_1.webp'],
  ['item-especial-bubble-waffle-2', 'Bubble Waffle 2', '13_bubble_waffer_2.webp']
].map(([id, nome, arquivo]) => ({
  id, nome, categoria: 'especiais', imagem: `/CARDAPIO/joinha_itens_especiais_recortes/${arquivo}`,
  tamanhos: [{ nome: 'Unidade', preco: 15 }],
  upgrades: [{ nome: 'Granulado Colorido', preco: 0 }, { nome: 'Chantilly', preco: 1 }],
  obs: true, ativo: true
}));

const seedPath = path.join(ROOT, 'server', 'seed-products.json');

const seedProducts = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : [];
if (!fs.existsSync(seedPath)) console.warn(`AVISO: ${seedPath} não encontrado. Usando só os itens embutidos no servidor.`);
// Aceita seed antigo: coloca o prefixo nos ids de potes/especiais e garante os itens especiais.
seedProducts.forEach((p) => {
  const prefixo = PREFIXO_ID[p.categoria];
  if (prefixo && !String(p.id).startsWith(prefixo)) p.id = RENOMEAR_POTES[p.id] || `${prefixo}${p.id}`;
});
if (!seedProducts.some((p) => p.categoria === 'especiais')) seedProducts.push(...ESPECIAIS_PADRAO);

const insertSeedProducts = (products) => {

     if (!Array.isArray(products) || !products.length) return;

const insert = db.prepare(`INSERT OR IGNORE INTO products

       (id,nome,categoria,imagem,tamanhos,upgrades,obs,ativo,criado_em,atualizado_em)

       VALUES (@id,@nome,@categoria,@imagem,@tamanhos,@upgrades,@obs,@ativo,@criado_em,@atualizado_em)`);

const insertMany = db.transaction((items) => {

items.forEach((p) => insert.run({

         id: p.id, nome: p.nome, categoria: p.categoria, imagem: p.imagem,

         tamanhos: JSON.stringify(p.tamanhos || []), upgrades: JSON.stringify(p.upgrades || []),

         obs: p.obs === false ? 0 : 1, ativo: p.ativo === false ? 0 : 1,

         criado_em: nowIso(), atualizado_em: nowIso()

       }));

     });

     insertMany(products);

};

const totalProducts = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;

if (totalProducts === 0) {

     insertSeedProducts(seedProducts);

     console.log(`Cardápio inicial carregado: ${seedProducts.length} produtos.`);

}

const potesSemPrefixo = db.prepare("SELECT id FROM products WHERE categoria = 'potes' AND id NOT LIKE 'pote-%'").all();
if (potesSemPrefixo.length) {
  const renomear = db.prepare('UPDATE products SET id = ? WHERE id = ?');
  const jaExiste = db.prepare('SELECT 1 FROM products WHERE id = ?');
  db.transaction(() => {
    potesSemPrefixo.forEach(({ id }) => {
      const novoId = RENOMEAR_POTES[id] || `pote-${id}`;
      if (!jaExiste.get(novoId)) renomear.run(novoId, id);
    });
  })();
  console.log(`Ids de potes atualizados: ${potesSemPrefixo.length} itens.`);
}

// Cadastra os potes e itens especiais do seed que ainda não existem no banco.
// Não altera nem reativa produtos que já existem (preços e edições do painel são preservados).
const idsExistentes = new Set(db.prepare('SELECT id FROM products').all().map((r) => r.id));
const faltando = seedProducts.filter((p) => (p.categoria === 'potes' || p.categoria === 'especiais') && !idsExistentes.has(p.id));
if (faltando.length) {
  insertSeedProducts(faltando);
  console.log(`Produtos novos carregados (potes/itens especiais): ${faltando.length} itens.`);
}

db.prepare('UPDATE products SET ativo = 0, atualizado_em = ? WHERE id IN (?, ?) AND ativo <> 0')
  .run(nowIso(), 'pote-napolitano-bombom-branco', 'pote-chocolate-trufado-bombom');

const potesMigrationName = 'potes-precos-2l-v1';
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(potesMigrationName)) {
  const migrationPath = path.join(ROOT, 'server', 'atualizar-potes.sql');
  db.exec(fs.readFileSync(migrationPath, 'utf8'));
  console.log('Migração dos preços e sabores dos potes aplicada.');
}


app.disable('x-powered-by');
// A plataforma de hospedagem fica na frente do Express; mantém o IP do cliente para rate limiting.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({

     origin(origin, callback) {

       if (!origin || !ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

       return callback(new Error('Origem não autorizada pelo servidor.'));

     }

}));

app.use(express.json({ limit: '250kb' }));

app.use(express.urlencoded({ extended: false, limit: '50kb' }));



const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' } });

const orderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { erro: 'Muitos pedidos enviados. Aguarde alguns minutos.' } });



function produtoPublico(row) {

     return {

       id: row.id, nome: row.nome, categoria: row.categoria, imagem: row.imagem,

       tamanhos: safeJson(row.tamanhos, []), upgrades: safeJson(row.upgrades, []),

       obs: Boolean(row.obs), ativo: Boolean(row.ativo), esgotado: Boolean(row.esgotado), estoque: row.estoque === null || row.estoque === undefined ? null : Number(row.estoque)

     };

}

function areaPublica(row) {

     return { id: row.id, bairro: row.bairro, taxa: Number(row.taxa), ativo: Boolean(row.ativo) };

}

function autenticar(req, res, next) {

const auth = req.headers.authorization || '';

const match = auth.match(/^Bearer\s+(.+)$/i);

     if (!match) return res.status(401).json({ erro: 'Faça login para acessar o painel.' });

     try {

const payload = jwt.verify(match[1], JWT_SECRET);

       if (payload.role !== 'admin') return res.status(403).json({ erro: 'Acesso não permitido.' });

req.admin = payload;

       next();

     } catch {

       return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });

     }

}

function validarProduto(body, existente = null) {

const nome = String(body.nome ?? existente?.nome ?? '').trim();

const categoria = String(body.categoria ?? existente?.categoria ?? 'milkshakes');

const imagem = String(body.imagem ?? existente?.imagem ?? '').trim();

const tamanhos = body.tamanhos ?? (existente ? safeJson(existente.tamanhos, []) : []);

const upgrades = body.upgrades ?? (existente ? safeJson(existente.upgrades, []) : []);

const obs = body.obs === undefined ? (existente ? Boolean(existente.obs) : true) : Boolean(body.obs);

const ativo = body.ativo === undefined ? (existente ? Boolean(existente.ativo) : true) : Boolean(body.ativo);
const esgotado = body.esgotado === undefined ? (existente ? Boolean(existente.esgotado) : false) : Boolean(body.esgotado);
const estoque = body.estoque === undefined ? (existente && existente.estoque != null ? Number(existente.estoque) : null) : (body.estoque === null || body.estoque === '' ? null : Number(body.estoque));
if (estoque !== null && (!Number.isInteger(estoque) || estoque < 0 || estoque > 100000)) return { erro: 'O estoque deve ser um número inteiro entre 0 e 100000 (ou vazio).' };

     if (!nome || nome.length > 100) return { erro: 'O nome deve ter entre 1 e 100 caracteres.' };

     if (!['picoles', 'milkshakes', 'potes', 'especiais'].includes(categoria)) return { erro: 'Categoria inválida.' };

     if (imagem.length > 500) return { erro: 'Caminho da imagem muito longo.' };

     if (!Array.isArray(tamanhos) || tamanhos.length < 1 || tamanhos.length > 12) return { erro: 'Cadastre de 1 a 12 tamanhos/preços.' };

     for (const t of tamanhos) {

       if (!t || typeof t.nome !== 'string' || !t.nome.trim() || t.nome.length > 40 || !Number.isFinite(Number(t.preco)) || Number(t.preco) < 0 || Number(t.preco) > 100000) {

         return { erro: 'Cada tamanho precisa de nome e preço válido.' };

       }

     }

     if (!Array.isArray(upgrades) || upgrades.length > 20) return { erro: 'Lista de adicionais inválida.' };

     for (const u of upgrades) {

       if (!u || typeof u.nome !== 'string' || !u.nome.trim() || u.nome.length > 60 || !Number.isFinite(Number(u.preco)) || Number(u.preco) < 0 || Number(u.preco) > 10000) {

         return { erro: 'Cada adicional precisa de nome e preço válido.' };

       }

     }

     return { nome, categoria, imagem, tamanhos: tamanhos.map(t => ({ ...t, nome: t.nome.trim(), preco: money(t.preco) })), upgrades: upgrades.map(u => ({ nome: u.nome.trim(), preco: money(u.preco) })), obs, ativo, esgotado, estoque };

}



function audit(req, acao, detalhe) {
  try {
    db.prepare('INSERT INTO audit_log (admin_email, acao, detalhe, criado_em) VALUES (?,?,?,?)')
      .run(req.admin?.email || '—', acao, String(detalhe || '').slice(0, 500), nowIso());
  } catch (e) { console.error('audit:', e.message); }
}
function lojaStatus() {
  const row = db.prepare("SELECT valor FROM settings WHERE chave = 'loja'").get();
  const v = safeJson(row?.valor, {});
  return { aberta: v.aberta !== false, mensagem: String(v.mensagem || '') };
}
// Público: o site consulta para exibir "Fechado no momento".
app.get('/api/loja', (req, res) => res.json(lojaStatus()));
app.get('/api/admin/loja', autenticar, (req, res) => res.json(lojaStatus()));
app.put('/api/admin/loja', autenticar, (req, res) => {
  if (typeof req.body?.aberta !== 'boolean') return res.status(400).json({ erro: 'Informe se a loja está aberta ou fechada.' });
  const mensagem = String(req.body.mensagem || '').trim().slice(0, 200);
  db.prepare("INSERT INTO settings (chave, valor) VALUES ('loja', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
    .run(JSON.stringify({ aberta: req.body.aberta, mensagem }));
  audit(req, req.body.aberta ? 'loja.abrir' : 'loja.fechar', mensagem);
  res.json(lojaStatus());
});
app.get('/api/admin/auditoria', autenticar, (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  res.json(rows.map((r) => ({ id: r.id, admin: r.admin_email, acao: r.acao, detalhe: r.detalhe, criadoEm: r.criado_em })));
});

app.get('/api/health', (req, res) => res.json({ ok: true, nome: 'Joinha Sorvetes API' }));

app.get('/api/produtos', (req, res) => {

const rows = db.prepare('SELECT * FROM products WHERE ativo = 1 ORDER BY categoria, nome COLLATE NOCASE').all();

     res.json(rows.map(produtoPublico));

});



// Consulta CEP usando a API pública ViaCEP.

app.get('/api/cep/:cep', async (req, res) => {

const cep = String(req.params.cep || '').replace(/\D/g, '');

     if (!/^\d{8}$/.test(cep)) return res.status(400).json({ erro: 'Digite um CEP com 8 números.' });

     try {

const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });

       if (!response.ok) throw new Error('ViaCEP indisponível');

const data = await response.json();

       if (data.erro) return res.status(404).json({ erro: 'CEP não encontrado.' });

       res.json({ cep: data.cep, logradouro: data.logradouro || '', complemento: data.complemento || '', bairro: data.bairro || '', localidade: data.localidade || '', uf: data.uf || '' });

     } catch {

       res.status(502).json({ erro: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.' });

     }

});



app.get('/api/frete', (req, res) => {

const bairro = String(req.query.bairro || '').trim();

     if (!bairro) return res.json({ atendido: null, taxa: null, mensagem: 'Informe o bairro para consultar a entrega.' });

const areas = db.prepare('SELECT * FROM delivery_areas').all();

const area = areas.find(a => normalize(a.bairro) === normalize(bairro));

     if (!area) return res.json({ atendido: true, taxa: null, mensagem: 'Taxa a combinar com a loja.' });

     if (!area.ativo) return res.json({ atendido: false, taxa: null, mensagem: 'Ainda não fazemos entregas neste bairro.' });

     res.json({ atendido: true, taxa: Number(area.taxa), mensagem: Number(area.taxa) === 0 ? 'Entrega grátis neste bairro.' : `Frete: R$ ${Number(area.taxa).toFixed(2).replace('.', ',')}.` });

});



app.post('/api/pedidos', orderLimiter, (req, res) => {
const lojaAtual = lojaStatus();
if (!lojaAtual.aberta) return res.status(503).json({ erro: lojaAtual.mensagem || 'A loja está fechada no momento. Volte em breve!', lojaFechada: true });

const body = req.body || {};

const cliente = String(body.cliente || '').trim();

const modo = String(body.modo || '');

const cep = String(body.cep || '').replace(/\D/g, '');

const bairro = String(body.bairro || '').trim();

const telefone = String(body.telefone || '').trim().slice(0, 30);

const endereco = String(body.endereco || '').trim().slice(0, 300);

const observacoes = String(body.observacoes || '').trim().slice(0, 1000);

     if (!cliente || cliente.length > 60) return res.status(400).json({ erro: 'Informe o nome do cliente.' });

     if (!['retirada', 'entrega'].includes(modo)) return res.status(400).json({ erro: 'Tipo de recebimento inválido.' });

     if (modo === 'entrega') {

       if (!/^\d{8}$/.test(cep)) return res.status(400).json({ erro: 'Informe um CEP válido com 8 números.' });

       if (!bairro || !endereco) return res.status(400).json({ erro: 'Informe o endereço de entrega completo.' });

const areaRows = db.prepare('SELECT * FROM delivery_areas').all();

const area = areaRows.find(a => normalize(a.bairro) === normalize(bairro));

       if (area && !area.ativo) return res.status(422).json({ erro: 'A loja não atende entregas neste bairro.' });

     }

     if (!Array.isArray(body.itens) || !body.itens.length || body.itens.length > 50) return res.status(400).json({ erro: 'O pedido precisa ter de 1 a 50 itens.' });



const produtos = db.prepare('SELECT * FROM products WHERE ativo = 1').all();

const produtosPorId = new Map(produtos.map(p => [p.id, p]));

const itensValidados = [];

let subtotal = 0;

     for (const item of body.itens) {

const productId = String(item.productId || '');

const product = produtosPorId.get(productId);

       if (!product) return res.status(422).json({ erro: `O produto "${String(item.nome || 'selecionado').slice(0, 80)}" não está disponível. Atualize o cardápio e tente novamente.` });

if (product.esgotado) return res.status(422).json({ erro: `${product.nome} está esgotado no momento. Remova do carrinho para continuar.` });
const tamanhos = safeJson(product.tamanhos, []);

const tamanhoNome = String(item.tamanho || '');

const tamanho = tamanhos.find(t => normalizeOpcao(t.nome) === normalizeOpcao(tamanhoNome));

       if (!tamanho) {
         const disponiveis = tamanhos.map(t => t.nome).filter(Boolean);
         return res.status(422).json({
           erro: `O tamanho selecionado para ${product.nome} não corresponde ao cadastro atual. Opções disponíveis: ${disponiveis.join(', ') || 'nenhuma'}. Remova esse item do carrinho e adicione novamente para escolher o tamanho atualizado.`,
           tamanhosDisponiveis: disponiveis
         });
       }

const extrasSolicitados = Array.isArray(item.upgrades) ? item.upgrades.map(v => String(v)) : [];

       if (extrasSolicitados.length > 2) return res.status(422).json({ erro: 'Selecione no máximo 2 adicionais por item.' });

const upgradesDisponiveis = safeJson(product.upgrades, []);

const extrasValidados = [];

       for (const nomeExtra of extrasSolicitados) {

const extra = upgradesDisponiveis.find(u => normalize(u.nome) === normalize(nomeExtra));

         if (!extra) return res.status(422).json({ erro: `O adicional "${nomeExtra}" não está disponível para ${product.nome}.` });

         extrasValidados.push({ nome: extra.nome, preco: Number(extra.preco) });

       }

const quantidade = Math.floor(Number(item.quantidade || item.qtd || 1));

       if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) return res.status(400).json({ erro: 'Quantidade inválida.' });

const unitario = money(Number(tamanho.preco) + extrasValidados.reduce((s, u) => s + Number(u.preco), 0));

const linha = money(unitario * quantidade);

       subtotal += linha;

       itensValidados.push({

         produtoId: product.id, nome: product.nome, tamanho: tamanho.nome, upgrades: extrasValidados,

         observacoes: String(item.observacoes || '').slice(0, 300), quantidade, precoUnitario: unitario, subtotal: linha,

         imagem: product.imagem

       });

     }

     subtotal = money(subtotal);

let frete = 0;

     if (modo === 'entrega') {

const areaRows = db.prepare('SELECT * FROM delivery_areas').all();

const area = areaRows.find(a => normalize(a.bairro) === normalize(bairro));

       frete = area && area.ativo ? Number(area.taxa) : null; // null significa taxa combinada via WhatsApp.

     }

const total = money(subtotal + (typeof frete === 'number' ? frete : 0));

const criadoEm = nowIso();

const temporaryNumber = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const insert = db.prepare(`INSERT INTO orders

       (numero,cliente,telefone,modo,endereco,cep,bairro,itens,subtotal,frete,total,status,observacoes,criado_em,atualizado_em)

       VALUES (@numero,@cliente,@telefone,@modo,@endereco,@cep,@bairro,@itens,@subtotal,@frete,@total,'novo',@observacoes,@criado_em,@atualizado_em)`);

const created = db.transaction(() => {

const result = insert.run({ numero: temporaryNumber, cliente, telefone, modo, endereco, cep: modo === 'entrega' ? cep : '', bairro: modo === 'entrega' ? bairro : '', itens: JSON.stringify(itensValidados), subtotal, frete, total, observacoes, criado_em: criadoEm, atualizado_em: criadoEm });

const id = Number(result.lastInsertRowid);

const day = dataHojeSaoPaulo().chave;

const numero = `JH-${day}-${String(id).padStart(4, '0')}`;

       db.prepare('UPDATE orders SET numero = ? WHERE id = ?').run(numero, id);

       return { id, numero };

     })();

res.status(201).json({ ok: true, id: created.id, numero: created.numero, subtotal, frete, total, itens: itensValidados, status: 'novo', criadoEm });

});



app.post('/api/admin/login', loginLimiter, (req, res) => {

const email = String(req.body?.email || '').trim().toLowerCase();

const password = String(req.body?.senha || '');

const admin = db.prepare('SELECT id, email, password_hash FROM admins WHERE email = ? COLLATE NOCASE AND ativo = 1').get(email);

     if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {

       return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

     }

const token = jwt.sign({ role: 'admin', email: admin.email, adminId: admin.id }, JWT_SECRET, { expiresIn: '8h', issuer: 'joinha-sorvetes' });

res.json({ token, email: admin.email, expiraEmHoras: 8 });

});



app.get('/api/admin/me', autenticar, (req, res) => res.json({ email: req.admin.email, role: req.admin.role }));



// Gerenciamento de usuários administradores (todas as rotas exigem login).

app.get('/api/admin/usuarios', autenticar, (req, res) => {

const rows = db.prepare('SELECT id, email, criado_em FROM admins WHERE ativo = 1 ORDER BY criado_em, id').all();

res.json(rows.map(row => ({ id: row.id, email: row.email, criadoEm: row.criado_em })));

});

app.post('/api/admin/usuarios', autenticar, (req, res) => {

const email = String(req.body?.email || '').trim().toLowerCase();

const senha = String(req.body?.senha || '');

     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {

       return res.status(400).json({ erro: 'Digite um e-mail válido.' });

     }

     if (senha.length < 12 || senha.length > 128) {

       return res.status(400).json({ erro: 'A senha do novo administrador deve ter entre 12 e 128 caracteres.' });

     }

     if (db.prepare('SELECT id FROM admins WHERE email = ? COLLATE NOCASE').get(email)) {

       return res.status(409).json({ erro: 'Já existe um administrador com esse e-mail.' });

     }

const result = db.prepare('INSERT INTO admins (email, password_hash, ativo, criado_em) VALUES (?, ?, 1, ?)')

       .run(email, bcrypt.hashSync(senha, 12), nowIso());

audit(req, 'admin.criar', email);
res.status(201).json({ id: Number(result.lastInsertRowid), email, criadoEm: nowIso() });

});



app.get('/api/admin/produtos', autenticar, (req, res) => {

const rows = db.prepare('SELECT * FROM products ORDER BY categoria, nome COLLATE NOCASE').all();

res.json(rows.map(produtoPublico));

});

app.post('/api/admin/produtos', autenticar, (req, res) => {

const validated = validarProduto(req.body || {});

     if (validated.erro) return res.status(400).json({ erro: validated.erro });

let id = slug(req.body.id || validated.nome);
     const prefixoId = PREFIXO_ID[validated.categoria];
     if (prefixoId && !id.startsWith(prefixoId)) id = prefixoId + id;

     if (db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return res.status(409).json({ erro: 'Já existe um produto com esse identificador. Escolha outro nome.' });

const now = nowIso();

     db.prepare(`INSERT INTO products (id,nome,categoria,imagem,tamanhos,upgrades,obs,ativo,criado_em,atualizado_em)

       VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, validated.nome, validated.categoria, validated.imagem,

         JSON.stringify(validated.tamanhos), JSON.stringify(validated.upgrades), validated.obs ? 1 : 0, validated.ativo ? 1 : 0, now, now);

db.prepare('UPDATE products SET esgotado=?,estoque=? WHERE id=?').run(validated.esgotado ? 1 : 0, validated.estoque, id);
audit(req, 'produto.criar', validated.nome);
res.status(201).json(produtoPublico(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));

});

app.put('/api/admin/produtos/:id', autenticar, (req, res) => {

const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

     if (!existing) return res.status(404).json({ erro: 'Produto não encontrado.' });

const validated = validarProduto(req.body || {}, existing);

     if (validated.erro) return res.status(400).json({ erro: validated.erro });

     db.prepare(`UPDATE products SET nome=?,categoria=?,imagem=?,tamanhos=?,upgrades=?,obs=?,ativo=?,atualizado_em=? WHERE id=?`)

       .run(validated.nome, validated.categoria, validated.imagem, JSON.stringify(validated.tamanhos), JSON.stringify(validated.upgrades),

         validated.obs ? 1 : 0, validated.ativo ? 1 : 0, nowIso(), req.params.id);

db.prepare('UPDATE products SET esgotado=?,estoque=? WHERE id=?').run(validated.esgotado ? 1 : 0, validated.estoque, req.params.id);
const mud = [];
if (existing.nome !== validated.nome) mud.push(`nome (antes: ${existing.nome})`);
if (existing.tamanhos !== JSON.stringify(validated.tamanhos)) mud.push('tamanhos/preços');
if (Boolean(existing.ativo) !== validated.ativo) mud.push(validated.ativo ? 'exibido no cardápio' : 'ocultado');
if (Boolean(existing.esgotado) !== validated.esgotado) mud.push(validated.esgotado ? 'marcado como esgotado' : 'voltou ao estoque');
if ((existing.estoque ?? null) !== validated.estoque) mud.push(`estoque ${existing.estoque ?? '—'} → ${validated.estoque ?? '—'}`);
if (mud.length) audit(req, 'produto.editar', `${validated.nome}: ${mud.join('; ')}`);
res.json(produtoPublico(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));

});

app.delete('/api/admin/produtos/:id', autenticar, (req, res) => {

const result = db.prepare('UPDATE products SET ativo=0, atualizado_em=? WHERE id=?').run(nowIso(), req.params.id);

     if (!result.changes) return res.status(404).json({ erro: 'Produto não encontrado.' });
     audit(req, 'produto.ocultar', req.params.id);

res.json({ ok: true });

});



function pedidoAdmin(row) {

     return {

       id: row.id, numero: row.numero, cliente: row.cliente, telefone: row.telefone, modo: row.modo,

       endereco: row.endereco, cep: row.cep, bairro: row.bairro, itens: safeJson(row.itens, []),

       subtotal: row.subtotal, frete: row.frete, total: row.total, status: row.status,

       observacoes: row.observacoes, criadoEm: row.criado_em, atualizadoEm: row.atualizado_em

     };

}

app.get('/api/admin/pedidos', autenticar, (req, res) => {

const status = String(req.query.status || 'todos');

const rows = status === 'todos'

       ? db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 300').all()

       : db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 300').all(status);

res.json(rows.map(pedidoAdmin));

});

app.patch('/api/admin/pedidos/:id/status', autenticar, (req, res) => {

const status = String(req.body?.status || '');

     if (!['novo','preparando','pronto','entregue'].includes(status)) return res.status(400).json({ erro: 'Status inválido.' });

const result = db.prepare('UPDATE orders SET status=?,atualizado_em=? WHERE id=?').run(status, nowIso(), Number(req.params.id));

     if (!result.changes) return res.status(404).json({ erro: 'Pedido não encontrado.' });
audit(req, 'pedido.status', `${db.prepare('SELECT numero FROM orders WHERE id=?').get(Number(req.params.id))?.numero || '#' + req.params.id} → ${status}`);

res.json(pedidoAdmin(db.prepare('SELECT * FROM orders WHERE id=?').get(Number(req.params.id))));

});

app.get('/api/admin/relatorio', autenticar, (req, res) => {

const day = dataHojeSaoPaulo();

const start = day.inicioUtc.toISOString();

const tomorrow = new Date(day.inicioUtc.getTime() + 24 * 60 * 60 * 1000).toISOString();

const hoje = db.prepare('SELECT COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS vendas FROM orders WHERE criado_em >= ? AND criado_em < ?').get(start, tomorrow);

const entregues = db.prepare("SELECT COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS vendas FROM orders WHERE status='entregue'").get();

const pendentes = db.prepare("SELECT COUNT(*) AS total FROM orders WHERE status IN ('novo','preparando','pronto')").get().total;

res.json({ pedidosHoje: hoje.pedidos, vendasHoje: money(hoje.vendas), pedidosEntregues: entregues.pedidos, vendasEntregues: money(entregues.vendas), pendentes });

});



app.get('/api/admin/areas', autenticar, (req, res) => {

res.json(db.prepare('SELECT * FROM delivery_areas ORDER BY bairro COLLATE NOCASE').all().map(areaPublica));

});

app.post('/api/admin/areas', autenticar, (req, res) => {

const bairro = String(req.body?.bairro || '').trim();

const taxa = Number(req.body?.taxa);

const ativo = req.body?.ativo === undefined ? true : Boolean(req.body.ativo);

     if (!bairro || bairro.length > 80) return res.status(400).json({ erro: 'Informe um bairro válido.' });

     if (!Number.isFinite(taxa) || taxa < 0 || taxa > 1000) return res.status(400).json({ erro: 'Informe uma taxa válida.' });

const id = slug(bairro);

const existente = db.prepare('SELECT * FROM delivery_areas').all().find(a => normalize(a.bairro) === normalize(bairro));

     if (existente) {

       db.prepare('UPDATE delivery_areas SET bairro=?,taxa=?,ativo=?,atualizado_em=? WHERE id=?').run(bairro, money(taxa), ativo ? 1 : 0, nowIso(), existente.id);

       audit(req, 'frete.editar', `${bairro}: R$ ${money(taxa)} · ${ativo ? 'atende' : 'não atende'}`);
       return res.json(areaPublica(db.prepare('SELECT * FROM delivery_areas WHERE id=?').get(existente.id)));

     }

     db.prepare('INSERT INTO delivery_areas (id,bairro,taxa,ativo,atualizado_em) VALUES (?,?,?,?,?)').run(id, bairro, money(taxa), ativo ? 1 : 0, nowIso());

audit(req, 'frete.criar', `${bairro}: R$ ${money(taxa)} · ${ativo ? 'atende' : 'não atende'}`);
res.status(201).json(areaPublica(db.prepare('SELECT * FROM delivery_areas WHERE id=?').get(id)));

});

app.put('/api/admin/areas/:id', autenticar, (req, res) => {

const existing = db.prepare('SELECT * FROM delivery_areas WHERE id=?').get(req.params.id);

     if (!existing) return res.status(404).json({ erro: 'Bairro não encontrado.' });

const bairro = String(req.body?.bairro ?? existing.bairro).trim();

const taxa = Number(req.body?.taxa ?? existing.taxa);

const ativo = req.body?.ativo === undefined ? Boolean(existing.ativo) : Boolean(req.body.ativo);

     if (!bairro || bairro.length > 80 || !Number.isFinite(taxa) || taxa < 0 || taxa > 1000) return res.status(400).json({ erro: 'Confira o bairro e a taxa.' });

     db.prepare('UPDATE delivery_areas SET bairro=?,taxa=?,ativo=?,atualizado_em=? WHERE id=?').run(bairro, money(taxa), ativo ? 1 : 0, nowIso(), req.params.id);

     audit(req, 'frete.editar', `${bairro}: R$ ${money(taxa)} · ${ativo ? 'atende' : 'não atende'}`);
     res.json(areaPublica(db.prepare('SELECT * FROM delivery_areas WHERE id=?').get(req.params.id)));

});

app.delete('/api/admin/areas/:id', autenticar, (req, res) => {

const result = db.prepare('DELETE FROM delivery_areas WHERE id=?').run(req.params.id);

     if (!result.changes) return res.status(404).json({ erro: 'Bairro não encontrado.' });
     audit(req, 'frete.excluir', req.params.id);

     res.json({ ok: true });

});



// Gere robots.txt e sitemap com o domínio usado no deploy (ou SITE_URL, se informado).
function origemPublica(req) {
  const configurada = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(configurada)) return configurada;
  return `${req.protocol}://${req.get('host')}`;
}
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${origemPublica(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const base = origemPublica(req);
  const xmlEscape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const urls = [
    { path: '/', priority: '1.0' },
    { path: '/CARDAPIO/cardapio.html', priority: '0.9' },
    { path: '/politica-de-privacidade.html', priority: '0.3' }
  ];
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(item => `<url><loc>${xmlEscape(base + item.path)}</loc><priority>${item.priority}</priority></url>`).join('') +
    '</urlset>';
  res.type('application/xml').send(body);
});

// Não publique banco de dados, sementes de produtos, código do servidor ou dependências.

app.use((req, res, next) => {

const pathname = req.path || '/';

     if (/^\/(?:server|node_modules|\.git|anotacoes|ANOTA[^/]*)(?:\/|$)/i.test(pathname) || /^\/(?:server\.js|package(?:-lock)?\.json|\.gitignore|README-API\.md|Dockerfile|render\.yaml|\.node-version|\.dockerignore)$/i.test(pathname)) {

       return res.status(404).send('Não encontrado.');

     }

     next();

});

app.use(express.static(ROOT, {
  extensions: ['html'],
  index: 'index.html',
  dotfiles: 'ignore',
  setHeaders(res, filePath) {
    if (/\.html?$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    else if (/\.(?:css|js|png|webp|jpg|jpeg|svg|woff2?)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));

app.get('*', (req, res, next) => {

     if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota da API não encontrada.' });

     return res.status(404).sendFile(path.join(ROOT, '404.html'), err => { if (err) next(); });

});



app.use((err, req, res, next) => {

     console.error(err.message);

     if (res.headersSent) return next(err);
     if (err.message === 'Origem não autorizada pelo servidor.') return res.status(403).json({ erro: 'Origem não autorizada.' });

     res.status(500).json({ erro: 'Ocorreu um erro no servidor.' });

});



app.listen(PORT, () => {

     const resumo = db.prepare('SELECT categoria, COUNT(*) AS n FROM products WHERE ativo = 1 GROUP BY categoria').all().map(r => `${r.categoria}: ${r.n}`).join(' | ');
     console.log(`Produtos ativos no cardápio -> ${resumo}`);

     console.log(`Joinha Sorvetes rodando em http://localhost:${PORT}`);

     console.log(`Painel administrativo: http://localhost:${PORT}/admin/`);

     console.log('Entre com uma conta cadastrada na tabela de administradores.');

     if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) console.warn('Configure .env antes de disponibilizar o sistema na internet.');

});