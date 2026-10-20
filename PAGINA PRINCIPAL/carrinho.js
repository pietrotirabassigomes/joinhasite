/* =========================================================
   JOINHA SORVETES - CARRINHO
   Funciona em qualquer página: basta carregar este arquivo.
   O carrinho fica salvo no navegador (vale para todas as páginas).
   ========================================================= */
(function () {
    'use strict';

    /* >>> TROQUE pelo WhatsApp da loja: DDI + DDD + número, só dígitos <<< */
    var WHATSAPP = '5515991511592';

    var CHAVE = 'joinha_carrinho';
    var itens = carregar();

    /* ---------- utilidades ---------- */
    function carregar() {
        try { return JSON.parse(localStorage.getItem(CHAVE)) || []; }
        catch (e) { return []; }
    }

    function salvar() {
        try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) {}
    }

    function moeda(v) {
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function escapar(t) {
        var d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    function slug(t) {
        return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    /* "R$ 12,50" -> 12.5 */
    function lerPreco(texto) {
        var m = String(texto).match(/\d[\d.,]*/);
        if (!m) return 0;
        var n = m[0];
        if (n.indexOf(',') > -1) n = n.replace(/\./g, '').replace(',', '.');
        return parseFloat(n) || 0;
    }

    /* ---------- ações ---------- */
    function adicionar(produto) {
        var item = itens.find(function (i) { return i.id === produto.id; });
        if (item) item.qtd += 1;
        else itens.push({ id: produto.id, nome: produto.nome, preco: produto.preco, img: produto.img, qtd: 1 });
        atualizar();
        avisar(produto.nome + ' foi para o carrinho');
        var btn = document.querySelector('.carrinho-btn');
        btn.classList.remove('pulo');
        void btn.offsetWidth;
        btn.classList.add('pulo');
    }

    function mudarQtd(id, delta) {
        var item = itens.find(function (i) { return i.id === id; });
        if (!item) return;
        item.qtd += delta;
        if (item.qtd < 1) itens = itens.filter(function (i) { return i.id !== id; });
        atualizar();
    }

    function remover(id) {
        itens = itens.filter(function (i) { return i.id !== id; });
        atualizar();
    }

    function limpar() {
        itens = [];
        atualizar();
    }

    function total() {
        return itens.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0);
    }

    function finalizar() {
        if (!itens.length) return;
        var obs = document.getElementById('carrinho-obs').value.trim();
        var linhas = ['*Pedido - Joinha Sorvetes*', ''];
        itens.forEach(function (i) {
            linhas.push(i.qtd + 'x ' + i.nome + ' - ' + moeda(i.preco * i.qtd));
        });
        linhas.push('', '*Total: ' + moeda(total()) + '*');
        if (obs) linhas.push('', 'Observações: ' + obs);
        window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(linhas.join('\n')), '_blank');
    }

    /* ---------- interface ---------- */
    function montarInterface() {
        var nav = document.querySelector('nav') || document.body;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'carrinho-btn';
        btn.setAttribute('aria-label', 'Abrir carrinho');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>' +
            '<path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/></svg>' +
            'Carrinho <span class="carrinho-contador" id="carrinho-contador">0</span>';
        nav.appendChild(btn);

        var fundo = document.createElement('div');
        fundo.className = 'carrinho-fundo';

        var painel = document.createElement('aside');
        painel.className = 'carrinho-painel';
        painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-label', 'Seu carrinho');
        painel.innerHTML =
            '<div class="carrinho-topo"><h2>Seu carrinho</h2>' +
            '<button type="button" class="carrinho-fechar" aria-label="Fechar carrinho">&times;</button></div>' +
            '<ul class="carrinho-lista" id="carrinho-lista"></ul>' +
            '<div class="carrinho-rodape">' +
            '<div><label for="carrinho-obs">Observações do pedido</label>' +
            '<textarea id="carrinho-obs" placeholder="Ex.: sabores, horário de retirada..."></textarea></div>' +
            '<div class="carrinho-total"><span>Total</span><strong id="carrinho-total">R$ 0,00</strong></div>' +
            '<button type="button" class="carrinho-finalizar" id="carrinho-finalizar">Enviar pedido pelo WhatsApp</button>' +
            '<button type="button" class="carrinho-limpar" id="carrinho-limpar">Esvaziar carrinho</button>' +
            '</div>';

        var aviso = document.createElement('div');
        aviso.className = 'carrinho-aviso';
        aviso.id = 'carrinho-aviso';
        aviso.setAttribute('role', 'status');

        document.body.appendChild(fundo);
        document.body.appendChild(painel);
        document.body.appendChild(aviso);

        btn.addEventListener('click', abrir);
        fundo.addEventListener('click', fechar);
        painel.querySelector('.carrinho-fechar').addEventListener('click', fechar);
        document.getElementById('carrinho-finalizar').addEventListener('click', finalizar);
        document.getElementById('carrinho-limpar').addEventListener('click', limpar);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });

        /* botões + / - / remover (delegação) */
        document.getElementById('carrinho-lista').addEventListener('click', function (e) {
            var b = e.target.closest('button[data-acao]');
            if (!b) return;
            var id = b.getAttribute('data-id');
            if (b.dataset.acao === 'mais') mudarQtd(id, 1);
            if (b.dataset.acao === 'menos') mudarQtd(id, -1);
            if (b.dataset.acao === 'remover') remover(id);
        });
    }

    function abrir() {
        document.body.classList.add('carrinho-aberto');
        document.querySelector('.carrinho-fechar').focus();
    }

    function fechar() {
        document.body.classList.remove('carrinho-aberto');
    }

    var temporizador;
    function avisar(texto) {
        var a = document.getElementById('carrinho-aviso');
        a.textContent = texto;
        a.classList.add('visivel');
        clearTimeout(temporizador);
        temporizador = setTimeout(function () { a.classList.remove('visivel'); }, 1800);
    }

    function atualizar() {
        salvar();
        var qtdTotal = itens.reduce(function (s, i) { return s + i.qtd; }, 0);
        document.getElementById('carrinho-contador').textContent = qtdTotal;
        document.getElementById('carrinho-total').textContent = moeda(total());
        document.getElementById('carrinho-finalizar').disabled = !itens.length;
        document.getElementById('carrinho-limpar').hidden = !itens.length;

        var lista = document.getElementById('carrinho-lista');
        if (!itens.length) {
            lista.innerHTML =
                '<li class="carrinho-vazio"><strong>Seu carrinho está vazio</strong>' +
                'Escolha seus sabores no cardápio e eles aparecem aqui.</li>';
            return;
        }
        lista.innerHTML = itens.map(function (i) {
            var foto = i.img
                ? '<img src="' + escapar(i.img) + '" alt="">'
                : '<span class="carrinho-sem-foto"></span>';
            return '<li class="carrinho-item">' + foto +
                '<div class="carrinho-info"><strong>' + escapar(i.nome) + '</strong>' +
                '<small>' + moeda(i.preco) + ' cada</small>' +
                '<div class="carrinho-qtd">' +
                '<button type="button" data-acao="menos" data-id="' + escapar(i.id) + '" aria-label="Diminuir quantidade">&minus;</button>' +
                '<span>' + i.qtd + '</span>' +
                '<button type="button" data-acao="mais" data-id="' + escapar(i.id) + '" aria-label="Aumentar quantidade">+</button>' +
                '</div></div>' +
                '<div class="carrinho-direita"><span class="carrinho-subtotal">' + moeda(i.preco * i.qtd) + '</span>' +
                '<button type="button" class="carrinho-remover" data-acao="remover" data-id="' + escapar(i.id) + '">Remover</button></div>' +
                '</li>';
        }).join('');
    }

    /* ---------- botões "adicionar" nos produtos ---------- */
    /* 1) Cards do cardápio (com .preco): o botão do card vira "Adicionar".
       2) Qualquer elemento com data-nome + data-preco também funciona. */
    function prepararProdutos() {
        document.querySelectorAll('.card .preco').forEach(function (precoEl) {
            var card = precoEl.closest('.card');
            var titulo = card.querySelector('h3');
            if (!titulo) return;
            var valor = precoEl.querySelector('strong') || precoEl;

            var btn = card.querySelector('.botao-card');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'botao-card';
                (card.querySelector('.card-conteudo') || card).appendChild(btn);
            }
            btn.textContent = 'Adicionar ao carrinho';
            btn.removeAttribute('href');
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.style.cursor = 'pointer';
            btn.dataset.nome = titulo.textContent.trim();
            btn.dataset.preco = lerPreco(valor.textContent);
            var img = card.querySelector('img');
            if (img) btn.dataset.img = img.src; /* caminho completo, funciona de qualquer pasta */
        });

        document.addEventListener('click', function (e) {
            var b = e.target.closest('[data-nome][data-preco]');
            if (!b) return;
            e.preventDefault();
            adicionar({
                id: b.dataset.id || slug(b.dataset.nome),
                nome: b.dataset.nome,
                preco: parseFloat(b.dataset.preco) || 0,
                img: b.dataset.img || ''
            });
        });

        document.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.botao-card[role="button"]')) {
                e.preventDefault();
                e.target.click();
            }
        });
    }

    /* sincroniza entre abas/páginas abertas */
    window.addEventListener('storage', function (e) {
        if (e.key === CHAVE) { itens = carregar(); atualizar(); }
    });

    function iniciar() {
        montarInterface();
        prepararProdutos();
        atualizar();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
