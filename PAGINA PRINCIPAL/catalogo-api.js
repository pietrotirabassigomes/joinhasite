/* Carrega o catálogo salvo no banco sem quebrar o site caso a API não esteja ligada. */
(function () {
    'use strict';
    var API_BASE = String(window.JOINHA_API_URL || '').replace(/\/$/, '');

    function slug(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function moeda(valor) {
        return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function prefixoDoSite() {
        var logo = document.querySelector('header img');
        if (!logo) return '';
        var caminho = new URL(logo.getAttribute('src') || logo.src, window.location.href).pathname;
        var marcador = caminho.lastIndexOf('/img/');
        return marcador >= 0 ? caminho.slice(0, marcador) : '';
    }

    function urlImagem(caminho) {
        if (!caminho) return '';
        if (/^https?:\/\//i.test(caminho)) return caminho;
        var prefixo = prefixoDoSite();
        var relativo = String(caminho).replace(/^\/+/, '');
        return (prefixo + '/' + relativo).replace(/\/{2,}/g, '/');
    }

    function criarCard(produto, container) {
        var card = document.createElement('article');
        card.className = 'card';
        var imagem = document.createElement('img');
        imagem.loading = 'lazy';
        imagem.decoding = 'async';
        if (produto.categoria === 'milkshakes' || produto.categoria === 'potes') imagem.className = 'milkshake-img';
        var conteudo = document.createElement('div');
        conteudo.className = 'card-conteudo';
        var titulo = document.createElement('h3');
        var preco = document.createElement('p');
        preco.className = 'preco milkshake-preco';
        var rotulo = document.createElement('span');
        var valor = document.createElement('strong');
        preco.append(rotulo, valor);
        var botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'botao-card';
        botao.textContent = 'Adicionar ao carrinho';
        conteudo.append(titulo, preco, botao);
        card.append(imagem, conteudo);
        container.appendChild(card);
        return card;
    }

    function atualizarCard(card, produto) {
        card.dataset.produtoId = produto.id;
        card.dataset.categoria = produto.categoria;
        card.style.display = '';
        var titulo = card.querySelector('h3');
        var imagem = card.querySelector('img');
        var forte = card.querySelector('.preco strong');
        var rotulo = card.querySelector('.preco span');
        if (titulo) titulo.textContent = produto.nome;
        if (imagem) {
            imagem.src = urlImagem(produto.imagem || '');
            imagem.alt = produto.categoria === 'milkshakes' ? 'Milkshake de ' + produto.nome : produto.categoria === 'potes' ? 'Pote de ' + produto.nome : produto.nome;
        }
        if (imagem && (produto.categoria === 'milkshakes' || produto.categoria === 'potes')) imagem.classList.add('milkshake-img');
        var precos = (produto.tamanhos || []).map(function (t) { return Number(t.preco); }).filter(Number.isFinite);
        if (forte && precos.length) forte.textContent = moeda(Math.min.apply(null, precos));
        if (rotulo) rotulo.textContent = produto.categoria === 'milkshakes' || produto.categoria === 'potes' ? 'A partir de' : 'Por apenas';
        var botao = card.querySelector('.botao-card');
        if (botao) {
            botao.dataset.img = imagem ? imagem.src : '';
            botao.dataset.nome = produto.categoria === 'milkshakes' ? 'Milkshake de ' + produto.nome : produto.categoria === 'potes' ? 'Pote de ' + produto.nome : produto.nome;
            botao.dataset.preco = precos.length ? String(Math.min.apply(null, precos)) : '0';
            botao.textContent = 'Adicionar ao carrinho';
            botao.disabled = false;
        }
    }

    async function carregarCatalogo() {
        try {
            var resposta = await fetch(API_BASE + '/api/produtos', { headers: { Accept: 'application/json' } });
            if (!resposta.ok) throw new Error('API indisponível');
            var produtos = await resposta.json();
            if (!Array.isArray(produtos)) throw new Error('Resposta inválida');
            window.JoinhaCatalogo = produtos;

            var categorias = {
                picoles: document.querySelector('.cards-picoles'),
                milkshakes: document.querySelector('.cards-milkshakes'),
                potes: document.querySelector('.cards-potes')
            };
            Object.keys(categorias).forEach(function (categoria) {
                var container = categorias[categoria];
                if (!container) return;
                var cards = Array.from(container.querySelectorAll('.card'));
                cards.forEach(function (card) { card.style.display = 'none'; });
                produtos.filter(function (p) { return p.categoria === categoria; }).forEach(function (produto) {
                    var card = cards.find(function (c) {
                        return c.dataset.produtoId === produto.id || slug(c.querySelector('h3') && c.querySelector('h3').textContent) === produto.id;
                    });
                    if (!card) card = criarCard(produto, container);
                    atualizarCard(card, produto);
                });
            });
            document.dispatchEvent(new CustomEvent('joinha:catalogo-pronto', { detail: { produtos: produtos } }));
        } catch (erro) {
            // Sem API, o cardápio HTML original permanece funcionando como antes.
            console.info('Joinha: usando o cardápio local porque a API não respondeu.');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', carregarCatalogo);
    else carregarCatalogo();
})();
