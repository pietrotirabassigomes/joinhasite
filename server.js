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
    categoria TEXT NOT NULL CHECK(categoria IN ('picoles','milkshakes','potes')),
    imagem TEXT NOT NULL DEFAULT '',
    tamanhos TEXT NOT NULL DEFAULT '[]',
    upgrades TEXT NOT NULL DEFAULT '[]',
    obs INTEGER NOT NULL DEFAULT 1,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
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
if (productTableSql && !/CHECK\s*\(\s*categoria\s+IN\s*\(\s*'picoles'\s*,\s*'milkshakes'\s*,\s*'potes'\s*\)\s*\)/i.test(productTableSql)) {
  const existingRows = db.prepare('SELECT * FROM products').all();
  db.exec(`
    ALTER TABLE products RENAME TO products_legacy;
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL CHECK(categoria IN ('picoles','milkshakes','potes')),
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

const nowIso = () => new Date().toISOString();
const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
const seedPath = path.join(ROOT, 'server', 'seed-products.json');
const seedProducts = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : [];
const insertSeedProducts = (products) => {
  if (!Array.isArray(products) || !products.length) return;
  const insert = db.prepare(`INSERT INTO products
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
const totalPotes = db.prepare("SELECT COUNT(*) AS total FROM products WHERE categoria = 'potes'").get().total;
if (totalPotes === 0) {
  const potesSeed = seedProducts.filter((p) => p.categoria === 'potes');
  if (potesSeed.length) {
    insertSeedProducts(potesSeed);
    console.log(`Produtos de potes carregados: ${potesSeed.length} itens.`);
  }
}

app.disable('x-powered-by');
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
    obs: Boolean(row.obs), ativo: Boolean(row.ativo)
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
  if (!nome || nome.length > 100) return { erro: 'O nome deve ter entre 1 e 100 caracteres.' };
  if (!['picoles', 'milkshakes', 'potes'].includes(categoria)) return { erro: 'Categoria inválida.' };
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
  return { nome, categoria, imagem, tamanhos: tamanhos.map(t => ({ ...t, nome: t.nome.trim(), preco: money(t.preco) })), upgrades: upgrades.map(u => ({ nome: u.nome.trim(), preco: money(u.preco) })), obs, ativo };
}

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
    const tamanhos = safeJson(product.tamanhos, []);
    const tamanhoNome = String(item.tamanho || '');
    const tamanho = tamanhos.find(t => t.nome === tamanhoNome);
    if (!tamanho) return res.status(422).json({ erro: `O tamanho escolhido para ${product.nome} não existe mais. Atualize o cardápio.` });
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
  res.status(201).json({ id: Number(result.lastInsertRowid), email, criadoEm: nowIso() });
});

app.get('/api/admin/produtos', autenticar, (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY categoria, nome COLLATE NOCASE').all();
  res.json(rows.map(produtoPublico));
});
app.post('/api/admin/produtos', autenticar, (req, res) => {
  const validated = validarProduto(req.body || {});
  if (validated.erro) return res.status(400).json({ erro: validated.erro });
  const id = slug(req.body.id || validated.nome);
  if (db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return res.status(409).json({ erro: 'Já existe um produto com esse identificador. Escolha outro nome.' });
  const now = nowIso();
  db.prepare(`INSERT INTO products (id,nome,categoria,imagem,tamanhos,upgrades,obs,ativo,criado_em,atualizado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, validated.nome, validated.categoria, validated.imagem,
      JSON.stringify(validated.tamanhos), JSON.stringify(validated.upgrades), validated.obs ? 1 : 0, validated.ativo ? 1 : 0, now, now);
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
  res.json(produtoPublico(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
});
app.delete('/api/admin/produtos/:id', autenticar, (req, res) => {
  const result = db.prepare('UPDATE products SET ativo=0, atualizado_em=? WHERE id=?').run(nowIso(), req.params.id);
  if (!result.changes) return res.status(404).json({ erro: 'Produto não encontrado.' });
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
    return res.json(areaPublica(db.prepare('SELECT * FROM delivery_areas WHERE id=?').get(existente.id)));
  }
  db.prepare('INSERT INTO delivery_areas (id,bairro,taxa,ativo,atualizado_em) VALUES (?,?,?,?,?)').run(id, bairro, money(taxa), ativo ? 1 : 0, nowIso());
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
  res.json(areaPublica(db.prepare('SELECT * FROM delivery_areas WHERE id=?').get(req.params.id)));
});
app.delete('/api/admin/areas/:id', autenticar, (req, res) => {
  const result = db.prepare('DELETE FROM delivery_areas WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ erro: 'Bairro não encontrado.' });
  res.json({ ok: true });
});

// Não publique banco de dados, sementes de produtos, código do servidor ou dependências.
app.use((req, res, next) => {
  const pathname = req.path || '/';
  if (/^\/(?:server|node_modules|\.git)(?:\/|$)/i.test(pathname) || /^\/(?:server\.js|package(?:-lock)?\.json|\.gitignore)$/i.test(pathname)) {
    return res.status(404).send('Não encontrado.');
  }
  next();
});
app.use(express.static(ROOT, { extensions: ['html'], index: 'index.html', dotfiles: 'ignore' }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota da API não encontrada.' });
  return res.sendFile(path.join(ROOT, '404.html'), err => { if (err) next(); });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ erro: 'Ocorreu um erro no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Joinha Sorvetes rodando em http://localhost:${PORT}`);
  console.log(`Painel administrativo: http://localhost:${PORT}/admin/`);
  console.log('Entre com uma conta cadastrada na tabela de administradores.');
  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) console.warn('Configure .env antes de disponibilizar o sistema na internet.');
});
