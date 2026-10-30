(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const API_BASE = String(window.JOINHA_API_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = 'joinha-admin-token';
  let token = sessionStorage.getItem(TOKEN_KEY) || '';
  let produtos = [];
  let pedidos = [];
  let bairros = [];
  let todosPedidos = [];
  let loja = { aberta: true, mensagem: '' };

  const dinheiro = (valor) => typeof valor !== 'number' || !Number.isFinite(valor)
    ? 'A combinar'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataHora = (valor) => {
    try { return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return valor || ''; }
  };
  const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function urlImagem(caminho) {
    if (!caminho) return '';
    if (/^https?:\/\//i.test(caminho)) return caminho;
    const logo = document.querySelector('.marca img');
    const path = logo ? new URL(logo.getAttribute('src') || logo.src, window.location.href).pathname : '';
    const marker = path.lastIndexOf('/img/');
    const prefix = marker >= 0 ? path.slice(0, marker) : '';
    return (prefix + '/' + String(caminho).replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
  }

  async function api(path, options = {}) {
    const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    if (options.body && typeof options.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : {};
    if (response.status === 401 && path !== '/api/admin/login') {
      sair();
      throw new Error(data.erro || 'Sua sessão expirou. Entre novamente.');
    }
    if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a solicitação.');
    return data;
  }

  function mensagemGlobal(texto, erro = false) {
    const el = $('aviso-global');
    el.textContent = texto;
    el.classList.toggle('erro', erro);
    el.hidden = !texto;
    if (texto) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mostrarPainel(email) {
    $('login-area').hidden = true;
    $('painel').hidden = false;
    $('sair').hidden = false;
    $('ola-admin').textContent = 'Conectado como ' + email + '. Gerencie pedidos, sabores e entregas.';
    carregarTudo().catch((err) => mensagemGlobal(err.message, true));
  }

  function sair() {
    token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    $('painel').hidden = true;
    $('sair').hidden = true;
    $('loja-toggle').hidden = true;
    $('login-area').hidden = false;
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('login-erro').hidden = true;
    const botao = event.currentTarget.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: { email: $('email').value.trim(), senha: $('senha').value }
      });
      token = data.token;
      sessionStorage.setItem(TOKEN_KEY, token);
      mostrarPainel(data.email);
    } catch (err) {
      $('login-erro').textContent = err.message;
      $('login-erro').hidden = false;
    } finally {
      botao.disabled = false;
      botao.textContent = 'Entrar no painel';
    }
  });
  $('sair').addEventListener('click', sair);

  document.querySelectorAll('.aba').forEach((button) => button.addEventListener('click', () => abrirAba(button.dataset.aba)));
  document.querySelectorAll('[data-ir]').forEach((button) => button.addEventListener('click', () => abrirAba(button.dataset.ir)));
  function abrirAba(nome) {
    document.querySelectorAll('.aba').forEach((button) => button.classList.toggle('ativa', button.dataset.aba === nome));
    document.querySelectorAll('[data-secao]').forEach((secao) => secao.classList.toggle('ativa', secao.dataset.secao === nome));
    if (nome === 'pedidos') carregarPedidos().catch(err => mensagemGlobal(err.message, true));
    if (nome === 'produtos') carregarProdutos().catch(err => mensagemGlobal(err.message, true));
    if (nome === 'entrega') carregarBairros().catch(err => mensagemGlobal(err.message, true));
    if (nome === 'admins') carregarAdmins().catch(err => mensagemGlobal(err.message, true));
    if (nome === 'historico') carregarHistorico().catch(err => mensagemGlobal(err.message, true));
  }

  async function carregarTudo() {
    await Promise.all([carregarRelatorio(), carregarPedidos(), carregarProdutos(), carregarBairros(), carregarLoja()]);
  }
  $('atualizar-tudo').addEventListener('click', () => carregarTudo().then(() => mensagemGlobal('Dados atualizados.')).catch(err => mensagemGlobal(err.message, true)));

  async function carregarRelatorio() {
    const r = await api('/api/admin/relatorio');
    $('pedidos-hoje').textContent = r.pedidosHoje;
    $('vendas-hoje').textContent = dinheiro(r.vendasHoje);
    $('pedidos-pendentes').textContent = r.pendentes;
    $('pedidos-entregues').textContent = r.pedidosEntregues;
    $('vendas-entregues').textContent = dinheiro(r.vendasEntregues);
    try { todosPedidos = await api('/api/admin/pedidos?status=todos'); renderAnalise(); } catch (e) { /* análises indisponíveis */ }
  }

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function intervalo() {
    const p = $('periodo').value, ini = new Date(); ini.setHours(0, 0, 0, 0);
    let fim = new Date(ini); fim.setDate(fim.getDate() + 1);
    if (p === 'ontem') { fim = new Date(ini); ini.setDate(ini.getDate() - 1); }
    else if (p === '7' || p === '30') ini.setDate(ini.getDate() - (Number(p) - 1));
    else if (p === 'custom') {
      const de = $('periodo-de').value, ate = $('periodo-ate').value;
      if (de) ini.setTime(new Date(de + 'T00:00:00').getTime());
      if (ate) { fim = new Date(ate + 'T00:00:00'); fim.setDate(fim.getDate() + 1); }
    }
    return [ini, fim];
  }
  function renderAnalise() {
    const [ini, fim] = intervalo();
    const lista = todosPedidos.filter((o) => { const d = new Date(o.criadoEm); return d >= ini && d < fim; });
    const fat = lista.reduce((s, o) => s + (Number(o.total) || 0), 0);
    $('an-fat').textContent = dinheiro(fat); $('an-qtd').textContent = lista.length;
    $('an-ticket').textContent = lista.length ? dinheiro(fat / lista.length) : '—';
    const vendidos = {}; const horas = {};
    lista.forEach((o) => {
      (o.itens || []).forEach((i) => { vendidos[i.nome] = (vendidos[i.nome] || 0) + (Number(i.quantidade) || 1); });
      const h = new Date(o.criadoEm).getHours(); horas[h] = (horas[h] || 0) + 1;
    });
    const top = $('an-top'); top.replaceChildren();
    const ranking = Object.entries(vendidos).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!ranking.length) { const li = document.createElement('li'); li.textContent = 'Sem vendas no período'; top.append(li); }
    ranking.forEach(([nome, qtd]) => { const li = document.createElement('li'); li.textContent = nome + ' '; const s = document.createElement('small'); s.textContent = qtd + ' un.'; li.append(s); top.append(li); });
    const picos = $('an-picos'); picos.replaceChildren();
    const lh = Object.entries(horas).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = lh.length ? lh[0][1] : 1;
    if (!lh.length) picos.textContent = 'Sem pedidos no período';
    lh.forEach(([h, n]) => { const r = document.createElement('div'); r.className = 'pico'; const a = document.createElement('span'); a.textContent = String(h).padStart(2, '0') + 'h'; const b = document.createElement('span'); const bar = document.createElement('i'); bar.style.width = Math.round(n / max * 100) + '%'; b.append(bar); const c = document.createElement('span'); c.textContent = n; r.append(a, b, c); picos.append(r); });
  }
  $('periodo').addEventListener('change', () => { $('periodo-custom').hidden = $('periodo').value !== 'custom'; renderAnalise(); });
  $('periodo-de').addEventListener('change', renderAnalise); $('periodo-ate').addEventListener('change', renderAnalise);

  function linkWhats(p) {
    let n = String(p.telefone || '').replace(/\D/g, ''); if (n.length <= 11) n = '55' + n;
    const msg = `Olá ${String(p.cliente || '').split(' ')[0]}, seu pedido ${p.numero} da Joinha Sorvetes ` + (p.status === 'pronto' ? (p.modo === 'entrega' ? 'está pronto e já vai sair para entrega!' : 'está pronto para retirada!') : p.status === 'entregue' ? 'foi entregue. Obrigado pela preferência!' : 'foi recebido e já estamos cuidando dele!');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  }
  function imprimir(p) {
    const w = window.open('', '_blank', 'width=380,height=640'); if (!w) { mensagemGlobal('Permita pop-ups para imprimir o comprovante.', true); return; }
    const itens = (p.itens || []).map((i) => { const ex = (i.upgrades || []).map((u) => typeof u === 'string' ? u : u.nome).join(', '); return `<p>${esc(i.quantidade || 1)}x ${esc(i.nome)} (${esc(i.tamanho)})${ex ? '<br>&nbsp;&nbsp;+ ' + esc(ex) : ''}<span>${esc(dinheiro(i.subtotal))}</span></p>`; }).join('');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(p.numero)}</title><style>@page{margin:0}body{font:12px/1.35 "Courier New",monospace;width:72mm;margin:0 auto;padding:4mm 0;color:#000}h1{font-size:15px;text-align:center;margin:0 0 4px}hr{border:0;border-top:1px dashed #000;margin:6px 0}p{margin:3px 0}p span{float:right}.t{font-size:14px;font-weight:bold}</style><h1>JOINHA SORVETES</h1><p><b>${esc(p.numero)}</b> · ${esc(dataHora(p.criadoEm))}</p><p>Cliente: ${esc(p.cliente)}</p>${p.telefone ? '<p>Tel: ' + esc(p.telefone) + '</p>' : ''}<p>${p.modo === 'entrega' ? 'ENTREGA: ' + esc(p.endereco) + ' - ' + esc(p.bairro) : 'RETIRADA NA LOJA'}</p><hr>${itens}<hr><p>Subtotal<span>${esc(dinheiro(p.subtotal))}</span></p>${p.modo === 'entrega' ? '<p>Frete<span>' + esc(dinheiro(p.frete)) + '</span></p>' : ''}<p class="t">TOTAL<span>${esc(dinheiro(p.total))}</span></p>${p.observacoes ? '<hr><p>Obs: ' + esc(p.observacoes) + '</p>' : ''}<script>onload=()=>{print();}<\/script>`);
    w.document.close();
  }
  function filtrarPedidos() {
    const q = normalizar($('busca-pedidos').value);
    let l = pedidos.filter((p) => !q || normalizar([p.numero, p.cliente, p.telefone, p.bairro].join(' ')).includes(q));
    if ($('agrupar-bairro').checked) l = l.slice().sort((a, b) => (a.modo === 'entrega' ? 0 : 1) - (b.modo === 'entrega' ? 0 : 1) || normalizar(a.bairro).localeCompare(normalizar(b.bairro)));
    return l;
  }
  $('busca-pedidos').addEventListener('input', () => renderPedidos());
  $('agrupar-bairro').addEventListener('change', () => renderPedidos());

  function renderLoja() {
    const b = $('loja-toggle'); b.hidden = false;
    b.textContent = loja.aberta ? '🟢 Loja aberta' : '🔴 Loja fechada';
    b.classList.toggle('loja-fechada', !loja.aberta);
  }
  async function carregarLoja() { loja = await api('/api/admin/loja'); renderLoja(); }
  $('loja-toggle').addEventListener('click', async () => {
    const abrir = !loja.aberta; let msg = loja.mensagem;
    if (!abrir) { msg = window.prompt('Mensagem para os clientes (opcional):', msg || 'Fechado no momento. Voltamos em breve!'); if (msg === null) return; }
    else if (!window.confirm('Reabrir a loja e liberar novos pedidos?')) return;
    try { loja = await api('/api/admin/loja', { method: 'PUT', body: { aberta: abrir, mensagem: abrir ? '' : msg } }); renderLoja(); mensagemGlobal(abrir ? 'Loja aberta: novos pedidos liberados.' : 'Loja fechada: novos pedidos bloqueados no site.'); }
    catch (err) { mensagemGlobal(err.message, true); }
  });
  const ROTULOS = { 'produto.criar': 'Produto criado', 'produto.editar': 'Produto editado', 'produto.ocultar': 'Produto ocultado', 'pedido.status': 'Status do pedido', 'admin.criar': 'Administrador criado', 'frete.criar': 'Frete criado', 'frete.editar': 'Frete alterado', 'frete.excluir': 'Frete excluído', 'loja.abrir': 'Loja aberta', 'loja.fechar': 'Loja fechada' };
  async function carregarHistorico() {
    const logs = await api('/api/admin/auditoria'); const body = $('tabela-historico'); body.replaceChildren();
    if (!logs.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 4; td.textContent = 'Nenhuma alteração registrada ainda.'; tr.append(td); body.append(tr); return; }
    logs.forEach((l) => { const tr = document.createElement('tr'); [dataHora(l.criadoEm), l.admin, ROTULOS[l.acao] || l.acao, l.detalhe].forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.append(td); }); body.append(tr); });
  }

  $('filtro-status').addEventListener('change', () => carregarPedidos().catch(err => mensagemGlobal(err.message, true)));
  async function carregarPedidos() {
    const filtro = encodeURIComponent($('filtro-status').value || 'todos');
    pedidos = await api('/api/admin/pedidos?status=' + filtro);
    renderPedidos();
  }
  function renderPedidos() {
    const root = $('lista-pedidos');
    root.replaceChildren();
    const lista = filtrarPedidos(); let grupoAtual = null;
    if (!lista.length) {
      const p = document.createElement('p'); p.className = 'vazio'; p.textContent = 'Nenhum pedido encontrado nesse filtro.'; root.append(p); return;
    }
    lista.forEach((pedido) => {
      if ($('agrupar-bairro').checked) { const g = pedido.modo === 'entrega' ? (pedido.bairro || 'Sem bairro') : 'Retiradas na loja'; if (g !== grupoAtual) { grupoAtual = g; const h = document.createElement('h3'); h.className = 'grupo-bairro'; h.textContent = g; root.append(h); } }
      const card = document.createElement('article'); card.className = 'pedido-card';
      const head = document.createElement('div'); head.className = 'pedido-cabecalho';
      const bloco = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = pedido.numero + ' · ' + pedido.cliente;
      const date = document.createElement('p'); date.textContent = dataHora(pedido.criadoEm);
      bloco.append(title, date);
      const total = document.createElement('strong'); total.className = 'pedido-total'; total.textContent = dinheiro(pedido.total);
      head.append(bloco, total); card.append(head);

      const details = document.createElement('div'); details.className = 'pedido-detalhes';
      const via = document.createElement('span'); via.textContent = 'Recebimento: ' + (pedido.modo === 'entrega' ? 'Delivery' : 'Retirada');
      const freight = document.createElement('span'); freight.textContent = 'Frete: ' + (pedido.modo === 'entrega' ? dinheiro(pedido.frete) : '—');
      const address = document.createElement('span'); address.textContent = pedido.modo === 'entrega' ? 'Endereço: ' + (pedido.endereco || '—') + (pedido.cep ? ' · CEP ' + pedido.cep : '') : 'Endereço: retirada na loja';
      const bairro = document.createElement('span'); bairro.textContent = 'Bairro: ' + (pedido.bairro || '—');
      details.append(via, freight, address, bairro); card.append(details);

      const itemBox = document.createElement('div'); itemBox.className = 'pedido-itens';
      (pedido.itens || []).forEach((item) => {
        const p = document.createElement('p');
        const extras = (item.upgrades || []).map(u => typeof u === 'string' ? u : u.nome).join(', ');
        p.textContent = `${item.quantidade || 1}× ${item.nome} (${item.tamanho})${extras ? ' + ' + extras : ''} · ${dinheiro(item.subtotal)}`;
        itemBox.append(p);
      });
      const subtotal = document.createElement('p'); subtotal.textContent = 'Subtotal: ' + dinheiro(pedido.subtotal); itemBox.append(subtotal);
      if (pedido.observacoes) { const obs = document.createElement('p'); obs.textContent = 'Observações: ' + pedido.observacoes; itemBox.append(obs); }
      card.append(itemBox);

      const footer = document.createElement('div'); footer.className = 'pedido-rodape';
      const label = document.createElement('label'); label.className = 'pedido-status'; label.append(document.createTextNode('Status '));
      const dot = document.createElement('span'); dot.className = 'status-bolinha status-' + pedido.status; dot.setAttribute('aria-hidden', 'true'); label.append(dot);
      const select = document.createElement('select');
      [['novo','Novo'],['preparando','Preparando'],['pronto','Pronto'],['entregue','Entregue']].forEach(([value, text]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = text; option.selected = value === pedido.status; select.append(option);
      });
      select.setAttribute('aria-label', 'Status do pedido ' + pedido.numero);
      select.addEventListener('change', async () => {
        select.disabled = true;
        try {
          await api(`/api/admin/pedidos/${pedido.id}/status`, { method: 'PATCH', body: { status: select.value } });
          await Promise.all([carregarRelatorio(), carregarPedidos()]);
          mensagemGlobal('Status do pedido ' + pedido.numero + ' atualizado.');
        } catch (err) { mensagemGlobal(err.message, true); select.value = pedido.status; }
        finally { select.disabled = false; }
      });
      label.append(select);
      footer.append(label);
      const ac = document.createElement('div'); ac.className = 'acoes-pedido';
      if (pedido.telefone) { const tel = document.createElement('span'); tel.textContent = 'Contato: ' + pedido.telefone; ac.append(tel); const z = document.createElement('a'); z.className = 'tabela-botao btn-zap'; z.href = linkWhats(pedido); z.target = '_blank'; z.rel = 'noopener'; z.textContent = 'WhatsApp'; ac.append(z); }
      const pr = document.createElement('button'); pr.type = 'button'; pr.className = 'tabela-botao'; pr.textContent = 'Imprimir'; pr.addEventListener('click', () => imprimir(pedido)); ac.append(pr); footer.append(ac);
      card.append(footer); root.append(card);
    });
  }

  $('admin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('admin-erro').hidden = true;
    const botao = event.currentTarget.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Adicionando…';
    try {
      await api('/api/admin/usuarios', {
        method: 'POST',
        body: { email: $('novo-admin-email').value.trim(), senha: $('novo-admin-senha').value }
      });
      $('admin-form').reset();
      await carregarAdmins();
      mensagemGlobal('Novo administrador cadastrado. Ele já pode entrar com o e-mail e a senha definidos.');
    } catch (err) {
      $('admin-erro').textContent = err.message;
      $('admin-erro').hidden = false;
    } finally {
      botao.disabled = false;
      botao.textContent = 'Adicionar administrador';
    }
  });

  async function carregarAdmins() {
    const admins = await api('/api/admin/usuarios');
    const body = $('tabela-admins');
    body.replaceChildren();
    if (!admins.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 2;
      td.textContent = 'Nenhum administrador cadastrado.';
      tr.append(td); body.append(tr); return;
    }
    admins.forEach((admin) => {
      const tr = document.createElement('tr');
      const email = document.createElement('td');
      email.textContent = admin.email;
      const criado = document.createElement('td');
      criado.textContent = dataHora(admin.criadoEm);
      tr.append(email, criado);
      body.append(tr);
    });
  }

  $('novo-produto').addEventListener('click', () => {
    resetProdutoForm();
    $('produto-form').hidden = false;
    $('produto-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('cancelar-produto').addEventListener('click', () => { $('produto-form').hidden = true; });
  function resetProdutoForm(produto) {
    $('produto-form').reset();
    $('produto-id-original').value = produto ? produto.id : '';
    $('produto-form-titulo').textContent = produto ? 'Editar produto' : 'Novo produto';
    $('produto-nome').value = produto ? produto.nome : '';
    $('produto-categoria').value = produto ? produto.categoria : 'milkshakes';
    $('produto-imagem').value = produto ? produto.imagem : '';
    $('produto-tamanhos').value = produto ? (produto.tamanhos || []).map(t => t.nome + '=' + String(t.preco).replace('.', ',')).join('\n') : '300ml=15\n400ml=16';
    $('produto-upgrades').value = produto ? (produto.upgrades || []).map(u => u.nome + '=' + String(u.preco).replace('.', ',')).join('\n') : 'Granulado Colorido=0\nChantilly=1';
    $('produto-obs').checked = produto ? produto.obs : true;
    $('produto-ativo').checked = produto ? produto.ativo : true;
    $('produto-esgotado').checked = produto ? Boolean(produto.esgotado) : false;
    $('produto-estoque').value = produto && produto.estoque != null ? produto.estoque : '';
    $('produto-erro').hidden = true;
  }
  function lerPares(texto, comDescricao = false) {
    return String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((linha) => {
      const pos = linha.lastIndexOf('=');
      if (pos < 1) throw new Error('Use o formato nome=preço, uma opção por linha.');
      const nome = linha.slice(0, pos).trim();
      const valor = Number(linha.slice(pos + 1).replace(',', '.').trim());
      if (!nome || !Number.isFinite(valor) || valor < 0) throw new Error('Confira o nome e o preço de cada opção.');
      return { nome, preco: valor };
    });
  }
  $('produto-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('produto-erro').hidden = true;
    let tamanhos, upgrades;
    try {
      tamanhos = lerPares($('produto-tamanhos').value);
      upgrades = lerPares($('produto-upgrades').value);
      if (!tamanhos.length) throw new Error('Cadastre ao menos um tamanho com preço.');
    } catch (err) { $('produto-erro').textContent = err.message; $('produto-erro').hidden = false; return; }
    const originalId = $('produto-id-original').value;
    const dados = {
      nome: $('produto-nome').value.trim(), categoria: $('produto-categoria').value,
      imagem: $('produto-imagem').value.trim(), tamanhos, upgrades,
      obs: $('produto-obs').checked, ativo: $('produto-ativo').checked,
      esgotado: $('produto-esgotado').checked, estoque: $('produto-estoque').value === '' ? null : Number($('produto-estoque').value)
    };
    const botao = event.currentTarget.querySelector('button[type="submit"]');
    botao.disabled = true; botao.textContent = 'Salvando…';
    try {
      await api(originalId ? '/api/admin/produtos/' + encodeURIComponent(originalId) : '/api/admin/produtos', {
        method: originalId ? 'PUT' : 'POST', body: dados
      });
      $('produto-form').hidden = true;
      await carregarProdutos();
      mensagemGlobal('Produto salvo. O cardápio será atualizado quando o site consultar a API.');
    } catch (err) {
      $('produto-erro').textContent = err.message; $('produto-erro').hidden = false;
    } finally { botao.disabled = false; botao.textContent = 'Salvar produto'; }
  });

  ['busca-produtos', 'filtro-categoria', 'filtro-disp'].forEach((id) => $(id).addEventListener(id === 'busca-produtos' ? 'input' : 'change', () => renderProdutos()));
  async function carregarProdutos() {
    produtos = await api('/api/admin/produtos');
    renderProdutos();
  }
  function renderProdutos() {
    const body = $('tabela-produtos'); body.replaceChildren();
    const q = normalizar($('busca-produtos').value), cat = $('filtro-categoria').value, disp = $('filtro-disp').value;
    const lista = produtos.filter((p) => (!q || normalizar(p.nome).includes(q)) && (!cat || p.categoria === cat) && (disp === '' || (disp === 'esg' ? (p.esgotado || (p.estoque != null && p.estoque < 2)) : String(p.ativo ? 1 : 0) === disp)));
    $('contagem-produtos').textContent = lista.length + ' de ' + produtos.length + ' produtos';
    if (!lista.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 5; td.textContent = 'Nenhum produto cadastrado.'; tr.append(td); body.append(tr); return; }
    lista.forEach((produto) => {
      const tr = document.createElement('tr');
      const tdNome = document.createElement('td');
      if (produto.imagem) { const img = document.createElement('img'); img.className = 'prod-img'; img.src = urlImagem(produto.imagem); img.alt = ''; img.loading = 'lazy'; tdNome.append(img); }
      const nome = document.createElement('span'); nome.className = 'prod-nome'; nome.textContent = produto.nome; tdNome.append(nome);
      const categoria = document.createElement('td');
      categoria.textContent = produto.categoria === 'milkshakes' ? 'Milkshake' : produto.categoria === 'potes' ? 'Pote' : 'Picolé';
      const preco = document.createElement('td'); const prices = (produto.tamanhos || []).map(t => Number(t.preco)).filter(Number.isFinite); preco.textContent = prices.length ? dinheiro(Math.min(...prices)) + (prices.length > 1 ? ' em diante' : '') : '—';
      const status = document.createElement('td'); const badge = document.createElement('span'); badge.className = 'pill' + (produto.ativo ? '' : ' off'); badge.textContent = produto.ativo ? 'No cardápio' : 'Oculto'; status.className = 'status-pills'; status.append(badge);
      const pill = (txt, cls) => { const s = document.createElement('span'); s.className = 'pill ' + cls; s.textContent = txt; status.append(s); };
      if (produto.esgotado) pill('Esgotado', 'off'); else if (produto.estoque != null && produto.estoque < 2) pill('Estoque baixo (' + produto.estoque + ')', 'warn'); else if (produto.estoque != null) pill('Estoque: ' + produto.estoque, '');
      const actions = document.createElement('td'); actions.style.whiteSpace = 'nowrap';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'tabela-botao'; edit.textContent = 'Editar';
      edit.addEventListener('click', () => { resetProdutoForm(produto); $('produto-form').hidden = false; $('produto-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'tabela-botao' + (produto.ativo ? ' perigo' : ''); toggle.style.marginLeft = '6px'; toggle.textContent = produto.ativo ? 'Ocultar' : 'Exibir';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        try { await api('/api/admin/produtos/' + encodeURIComponent(produto.id), { method: 'PUT', body: Object.assign({}, produto, { ativo: !produto.ativo }) }); await carregarProdutos(); mensagemGlobal(produto.ativo ? 'Produto ocultado do cardápio.' : 'Produto voltou ao cardápio.'); }
        catch (err) { mensagemGlobal(err.message, true); }
        finally { toggle.disabled = false; }
      });
      const esg = document.createElement('button'); esg.type = 'button'; esg.className = 'tabela-botao' + (produto.esgotado ? '' : ' perigo'); esg.style.marginLeft = '6px'; esg.textContent = produto.esgotado ? 'Voltou' : 'Esgotou';
      esg.addEventListener('click', async () => {
        esg.disabled = true;
        try { await api('/api/admin/produtos/' + encodeURIComponent(produto.id), { method: 'PUT', body: Object.assign({}, produto, { esgotado: !produto.esgotado }) }); await carregarProdutos(); mensagemGlobal(produto.esgotado ? 'Produto voltou a ficar disponível.' : 'Produto marcado como esgotado.'); }
        catch (err) { mensagemGlobal(err.message, true); }
        finally { esg.disabled = false; }
      });
      actions.append(edit, esg, toggle); tr.append(tdNome, categoria, preco, status, actions); body.append(tr);
    });
  }

  $('bairro-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const botao = event.currentTarget.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      await api('/api/admin/areas', { method: 'POST', body: {
        bairro: $('bairro-nome').value.trim(), taxa: Number(String($('bairro-taxa').value).replace(',', '.')),
        ativo: $('bairro-ativo').checked
      }});
      $('bairro-nome').value = '';
      await carregarBairros();
      mensagemGlobal('Regra de entrega salva.');
    } catch (err) { mensagemGlobal(err.message, true); }
    finally { botao.disabled = false; }
  });
  async function carregarBairros() {
    bairros = await api('/api/admin/areas');
    renderBairros();
  }
  function renderBairros() {
    const root = $('lista-bairros'); root.replaceChildren();
    if (!bairros.length) { const p = document.createElement('p'); p.className = 'vazio'; p.textContent = 'Nenhum bairro cadastrado ainda. Adicione o primeiro acima.'; root.append(p); return; }
    bairros.forEach((bairro) => {
      const row = document.createElement('div'); row.className = 'bairro-item';
      const nameWrap = document.createElement('div'); const name = document.createElement('strong'); name.textContent = bairro.bairro; const subtitle = document.createElement('small'); subtitle.textContent = bairro.ativo ? 'Entrega disponível' : 'Entrega não atendida'; nameWrap.append(name, subtitle);
      const feeWrap = document.createElement('div'); const feeLabel = document.createElement('label'); feeLabel.textContent = 'Frete (R$)'; feeLabel.style.fontSize = '11px'; feeLabel.style.fontWeight = '700'; const fee = document.createElement('input'); fee.type = 'number'; fee.min = '0'; fee.max = '1000'; fee.step = '0.5'; fee.value = bairro.taxa; fee.setAttribute('aria-label', 'Taxa para ' + bairro.bairro); feeWrap.append(feeLabel, fee);
      const checkLabel = document.createElement('label'); checkLabel.className = 'check-linha'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = bairro.ativo; checkLabel.append(check, document.createTextNode('Atendemos'));
      const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '6px';
      const save = document.createElement('button'); save.type = 'button'; save.className = 'tabela-botao'; save.textContent = 'Salvar';
      save.addEventListener('click', async () => {
        save.disabled = true;
        try { await api('/api/admin/areas/' + encodeURIComponent(bairro.id), { method: 'PUT', body: { bairro: name.textContent, taxa: Number(fee.value), ativo: check.checked } }); await carregarBairros(); mensagemGlobal('Frete do bairro atualizado.'); }
        catch (err) { mensagemGlobal(err.message, true); }
        finally { save.disabled = false; }
      });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'tabela-botao perigo'; del.textContent = 'Excluir';
      del.addEventListener('click', async () => {
        if (!window.confirm('Excluir a regra de entrega para ' + bairro.bairro + '?')) return;
        del.disabled = true;
        try { await api('/api/admin/areas/' + encodeURIComponent(bairro.id), { method: 'DELETE' }); await carregarBairros(); mensagemGlobal('Regra de entrega removida.'); }
        catch (err) { mensagemGlobal(err.message, true); }
        finally { del.disabled = false; }
      });
      actions.append(save, del); row.append(nameWrap, feeWrap, checkLabel, actions); root.append(row);
    });
  }

  if (token) {
    api('/api/admin/me').then((data) => mostrarPainel(data.email)).catch(() => sair());
  }
})();v