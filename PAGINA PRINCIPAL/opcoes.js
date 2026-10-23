/* =========================================================
   JOINHA SORVETES - JANELA DE OPÇÕES DO PRODUTO
   Ao clicar em picolé, milkshake ou pote (no card ou no botão
   "Adicionar ao carrinho") abre uma janela para escolher tamanho,
   adicionais e observações. A integração com o catálogo considera categoria e sabor.

   Para mudar tamanhos, preços ou upgrades, edite o CONFIG abaixo.
   ========================================================= */
(function () {
    'use strict';

    /* ---------------- CONFIGURAÇÃO ---------------- */
    var CONFIG = {
        milkshakes: {
            seletor: '.cards-milkshakes .card',
            tamanhos: [
                { nome: '400ml', preco: 16 },
                { nome: '300ml', preco: 15 }
            ],
            upgrades: {
                titulo: 'Vai um Upgrade Ai?',
                max: 2,
                itens: [
                    { nome: 'Granulado Colorido', preco: 0 },
                    { nome: 'Chantilly', preco: 1 }
                ]
            },
            obs: true
        },
        picoles: {
            seletor: '.cards-picoles .card',
            /* ATENÇÃO: ajuste estes tamanhos e preços para os reais */
            tamanhos: [
                { nome: 'Unidade', desc: '1 picolé', preco: 2.5 },
                { nome: 'Caixa com 20', desc: '20 picolés', preco: 50 }
            ],
            upgrades: null,
            obs: true
        },
        potes: {
            seletor: '.cards-potes .card',
            tamanhos: [
                { nome: 'Pote 1L', desc: '1 litro', preco: 28 },
                { nome: 'Pote 2L', desc: '2 litros', preco: 45 }
            ],
            upgrades: {
                titulo: 'Adicionais do pote',
                max: 2,
                itens: [
                    { nome: 'Cobertura', preco: 0 },
                    { nome: 'Chantilly', preco: 3 }
                ]
            },
            obs: true
        }
    };

    var SELETOR_CARDS = CONFIG.milkshakes.seletor + ', ' + CONFIG.picoles.seletor + ', ' + CONFIG.potes.seletor;

    /* ---------------- UTILITÁRIOS ---------------- */
    function numeroPreco(valor) {
        if (typeof valor === 'number') return isFinite(valor) ? valor : NaN;
        if (valor === null || valor === undefined || valor === '') return NaN;
        var texto = String(valor).trim().replace(/[^0-9,.-]/g, '');
        if (texto.indexOf(',') !== -1) texto = texto.replace(/\./g, '').replace(',', '.');
        var numero = Number(texto);
        return isFinite(numero) ? numero : NaN;
    }

    function moeda(v) {
        var n = numeroPreco(v);
        if (!isFinite(n)) n = 0;
        return 'R$ ' + n.toFixed(2).replace('.', ',');
    }

    function esc(t) {
        return String(t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function tipoDoCard(card) {
        if (card.closest('.cards-potes')) return 'potes';
        if (card.closest('.cards-milkshakes')) return 'milkshakes';
        return 'picoles';
    }

    function slugProduto(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function categoriaNormalizada(valor) {
        if (valor && typeof valor === 'object') valor = valor.nome || valor.name || valor.titulo || valor.title || '';
        var c = slugProduto(valor);
        if (c.indexOf('pote') !== -1 || c.indexOf('sorvete-de-massa') !== -1) return 'potes';
        if (c.indexOf('milkshake') !== -1 || c.indexOf('milk-shake') !== -1 || c.indexOf('milk-shakes') !== -1) return 'milkshakes';
        if (c.indexOf('picole') !== -1 || c.indexOf('picoles') !== -1) return 'picoles';
        return '';
    }

    function categoriaApi(produto) {
        var campos = [produto.categoria, produto.category, produto.tipo, produto.type,
            produto.categoriaNome, produto.category_name, produto.tipo_produto];
        for (var i = 0; i < campos.length; i++) {
            var categoria = categoriaNormalizada(campos[i]);
            if (categoria) return categoria;
        }
        /* Alguns catálogos guardam a categoria no próprio slug/ID do produto. */
        var porId = categoriaNormalizada(idApi(produto));
        if (porId) return porId;
        var nome = slugProduto(nomeApi(produto));
        if (/^pote-(de-)?/.test(nome) || nome.indexOf('sorvete-de-massa') === 0) return 'potes';
        if (/^milk-?shake-(de-)?/.test(nome)) return 'milkshakes';
        if (/^picole-(de-)?/.test(nome)) return 'picoles';
        return '';
    }

    function idApi(produto) {
        var id = produto.id;
        if (id === undefined || id === null || id === '') id = produto.produtoId;
        if (id === undefined || id === null || id === '') id = produto.product_id;
        if (id === undefined || id === null || id === '') id = produto.slug;
        return id === undefined || id === null ? '' : String(id);
    }

    function nomeApi(produto) {
        return produto.nome || produto.name || produto.titulo || produto.title || produto.produto || produto.nomeProduto || '';
    }

    function nomeProdutoNormalizado(valor, tipo) {
        var nome = slugProduto(valor);
        var prefixos = {
            potes: ['pote-de-', 'pote-', 'sorvete-de-massa-de-', 'sorvete-de-massa-'],
            milkshakes: ['milkshake-de-', 'milk-shake-de-', 'milkshakes-de-', 'milk-shakes-de-'],
            picoles: ['picole-de-', 'picole-']
        }[tipo] || [];
        prefixos.forEach(function (prefixo) {
            if (nome.indexOf(prefixo) === 0) nome = nome.slice(prefixo.length);
        });
        return nome;
    }

    function catalogoApi() {
        if (Array.isArray(window.JoinhaCatalogo)) return window.JoinhaCatalogo;
        if (window.JoinhaCatalogo && Array.isArray(window.JoinhaCatalogo.produtos)) return window.JoinhaCatalogo.produtos;
        return [];
    }

    function encontrarProdutoApi(card, tipo, nome) {
        var lista = catalogoApi();
        if (!lista.length) return null;

        var idCard = String(card.dataset.produtoId || '').trim();
        if (idCard) {
            var exato = lista.find(function (p) {
                var cat = categoriaApi(p);
                return idApi(p) === idCard && (!cat || cat === tipo);
            });
            if (exato) return exato;
        }

        var nomeSlug = nomeProdutoNormalizado(nome, tipo);
        var mesmoNome = lista.filter(function (p) { return nomeProdutoNormalizado(nomeApi(p), tipo) === nomeSlug; });
        var daCategoria = mesmoNome.filter(function (p) { return categoriaApi(p) === tipo; });
        if (daCategoria.length) return daCategoria[0];
        if (mesmoNome.length === 1) return mesmoNome[0];

        var mesmoId = lista.filter(function (p) {
            return slugProduto(idApi(p)) === (idCard ? slugProduto(idCard) : nomeSlug);
        });
        var mesmoIdCategoria = mesmoId.filter(function (p) {
            var cat = categoriaApi(p);
            return !cat || cat === tipo;
        });
        if (mesmoIdCategoria.length) return mesmoIdCategoria[0];
        return null;
    }

    function tamanhosApi(produtoApi) {
        if (!produtoApi || !Array.isArray(produtoApi.tamanhos) || !produtoApi.tamanhos.length) return null;
        var tamanhos = produtoApi.tamanhos.map(function (t, i) {
            var nome = t.nome || t.name || t.tamanho || t.label || ('Opção ' + (i + 1));
            var precoBruto = t.preco;
            if (precoBruto === undefined) precoBruto = t.price;
            if (precoBruto === undefined) precoBruto = t.valor;
            var preco = numeroPreco(precoBruto);
            if (!isFinite(preco) || preco < 0) return null;
            return { nome: String(nome), desc: t.desc || t.descricao || t.description || '', preco: preco };
        }).filter(Boolean);
        return tamanhos.length ? tamanhos : null;
    }

    function upgradesApi(produtoApi, upgradesBase) {
        if (!produtoApi || !Object.prototype.hasOwnProperty.call(produtoApi, 'upgrades')) return upgradesBase;
        if (produtoApi.upgrades === null) return null;
        if (!Array.isArray(produtoApi.upgrades)) return upgradesBase;
        if (!produtoApi.upgrades.length) return null;
        var itens = produtoApi.upgrades.map(function (u) {
            var preco = numeroPreco(u.preco !== undefined ? u.preco : (u.price !== undefined ? u.price : u.valor));
            if (!isFinite(preco) || preco < 0) preco = 0;
            return { nome: String(u.nome || u.name || u.titulo || u.title || 'Adicional'), preco: preco };
        });
        return { titulo: produtoApi.tituloUpgrades || produtoApi.upgradesTitulo || 'Adicionais', max: Number(produtoApi.maxUpgrades) > 0 ? Number(produtoApi.maxUpgrades) : 2, itens: itens };
    }

    /* Remove repetidos dentro de cada categoria. Sabores iguais em categorias
       diferentes (ex.: milkshake e pote) continuam sendo produtos distintos. */
    function removerCardsRepetidos() {
        document.querySelectorAll('.cards-picoles, .cards-milkshakes, .cards-potes').forEach(function (secao) {
            var vistos = Object.create(null);
            Array.prototype.slice.call(secao.querySelectorAll('.card')).forEach(function (card) {
                var titulo = card.querySelector('h3');
                if (!titulo) return;
                var chave = slugProduto(titulo.textContent.trim());
                if (!chave) return;
                if (vistos[chave]) {
                    card.remove();
                } else {
                    vistos[chave] = true;
                }
            });
        });
    }

    removerCardsRepetidos();
    if (window.MutationObserver && document.body) {
        var observadorCards = new MutationObserver(function () { removerCardsRepetidos(); });
        observadorCards.observe(document.body, { childList: true, subtree: true });
    }

    /* ---------------- "A PARTIR DE" NOS MILKSHAKES ---------------- */
    var menor = Math.min.apply(null, CONFIG.milkshakes.tamanhos.map(function (t) { return t.preco; }));
    document.querySelectorAll(CONFIG.milkshakes.seletor + ' .preco').forEach(function (p) {
        var s = p.querySelector('span'), st = p.querySelector('strong');
        if (s) s.textContent = 'A partir de';
        if (st) st.textContent = moeda(menor);
    });

    /* ---------------- MONTAGEM DA JANELA ---------------- */
    var fundo = document.createElement('div');
    fundo.className = 'op-fundo';

    var janela = document.createElement('div');
    janela.className = 'op-janela';
    janela.setAttribute('role', 'dialog');
    janela.setAttribute('aria-modal', 'true');
    janela.setAttribute('aria-labelledby', 'op-titulo');

    document.body.appendChild(fundo);
    document.body.appendChild(janela);

    var atual = null;      /* { card, tipo, cfg, nome, nomeCompleto } */
    var anterior = null;   /* elemento com foco antes de abrir */
    var liberar = false;   /* deixa o clique passar para o carrinho */

    function grupoHTML(id, titulo, sub, obrigatorio, corpo) {
        return '<section class="op-grupo" data-grupo="' + id + '">' +
            '<button type="button" class="op-grupo-topo" aria-expanded="true">' +
            '<div><strong>' + titulo + '</strong><small>' + sub + '</small></div>' +
            (obrigatorio ? '<span class="op-obrig">Obrigatório</span>' : '') +
            '<span class="op-seta" aria-hidden="true"></span></button>' +
            '<div class="op-lista">' + corpo + '</div></section>';
    }

    function render(info) {
        var cfg = info.cfg;
        var img = info.card.querySelector('img');

        var tamanhos = cfg.tamanhos.map(function (t, i) {
            return '<label class="op-opcao"><input type="radio" name="op-tamanho" value="' + i + '">' +
                '<span class="op-marca"></span><span class="op-info"><strong>' + esc(t.nome) + '</strong>' +
                '<em>' + moeda(t.preco) + '</em>' +
                (t.desc ? '<small>' + esc(t.desc) + '</small>' : '') + '</span></label>';
        }).join('');

        var upgrades = '';
        if (cfg.upgrades) {
            upgrades = grupoHTML('upgrades', esc(cfg.upgrades.titulo), 'Escolha até ' + cfg.upgrades.max + ' itens', false,
                cfg.upgrades.itens.map(function (u, i) {
                    return '<label class="op-opcao op-opcao--check"><input type="checkbox" name="op-upgrade" value="' + i + '">' +
                        '<span class="op-marca"></span><span class="op-info"><strong>' + esc(u.nome) + '</strong>' +
                        (u.preco ? '<em>+ ' + moeda(u.preco) + '</em>' : '') + '</span></label>';
                }).join(''));
        }

        var obs = cfg.obs
            ? '<div class="op-grupo-topo" style="cursor:default"><div><strong>Observações</strong></div></div>' +
              '<div class="op-obs"><textarea id="op-obs" maxlength="140" placeholder="Ex.: Sem canudo, pouco gelo, etc."></textarea></div>'
            : '';

        janela.innerHTML =
            '<div class="op-topo"><button type="button" class="op-voltar" aria-label="Fechar">&#8249;</button>' +
            '<span>Detalhes do produto</span></div>' +
            '<div class="op-corpo">' +
            '<div class="op-produto"><div class="op-foto' + (info.tipo === 'picoles' ? ' op-foto--picole' : '') + '">' +
            '<img src="' + (img ? img.getAttribute('src') : '') + '" alt=""></div>' +
            '<h2 id="op-titulo">' + esc(info.nomeCompleto) + '</h2></div>' +
            grupoHTML('tamanho', 'Selecione o tamanho', 'Escolha 1 item', true, tamanhos) +
            upgrades + obs +
            '</div>' +
            '<div class="op-rodape"><div class="op-total"><small>Total</small><strong id="op-total">R$ 0,00</strong></div>' +
            '<button type="button" class="op-adicionar pendente">Escolha o tamanho</button></div>';
    }

    /* ---------------- ESTADO / TOTAL ---------------- */
    function selecao() {
        var cfg = atual.cfg;
        var t = janela.querySelector('input[name="op-tamanho"]:checked');
        var tamanho = t ? cfg.tamanhos[+t.value] : null;
        var ups = [];
        janela.querySelectorAll('input[name="op-upgrade"]:checked').forEach(function (c) {
            ups.push(cfg.upgrades.itens[+c.value]);
        });
        var total = (tamanho ? tamanho.preco : 0) + ups.reduce(function (s, u) { return s + u.preco; }, 0);
        return { tamanho: tamanho, upgrades: ups, total: total };
    }

    function atualizar() {
        var s = selecao();
        var botao = janela.querySelector('.op-adicionar');
        var selo = janela.querySelector('[data-grupo="tamanho"] .op-obrig');

        janela.querySelector('#op-total').textContent = moeda(s.total);

        if (s.tamanho) {
            botao.classList.remove('pendente');
            botao.textContent = 'Adicionar ao carrinho';
            if (selo) { selo.textContent = 'Ok'; selo.classList.add('ok'); }
            janela.querySelector('[data-grupo="tamanho"]').classList.remove('erro');
        } else {
            botao.classList.add('pendente');
            botao.textContent = 'Escolha o tamanho';
        }

        /* limite de upgrades */
        if (atual.cfg.upgrades) {
            var marcados = janela.querySelectorAll('input[name="op-upgrade"]:checked').length;
            janela.querySelectorAll('input[name="op-upgrade"]').forEach(function (c) {
                c.disabled = !c.checked && marcados >= atual.cfg.upgrades.max;
            });
        }
    }

    /* ---------------- ABRIR / FECHAR ---------------- */
    function abrir(card) {
        var tipo = tipoDoCard(card);
        var secao = card.closest('.cards');
        var nome = card.querySelector('h3').textContent.trim();
        var prefixo = secao ? (secao.getAttribute('data-prefixo') || '') : '';
        var produtoApi = encontrarProdutoApi(card, tipo, nome);
        var cfgBase = CONFIG[tipo];
        var tamanhosProduto = tamanhosApi(produtoApi);
        var cfg = {
            seletor: cfgBase.seletor,
            tamanhos: tamanhosProduto || cfgBase.tamanhos,
            upgrades: upgradesApi(produtoApi, cfgBase.upgrades),
            obs: produtoApi && produtoApi.obs !== undefined ? produtoApi.obs !== false : cfgBase.obs
        };
        var precoCard = card.querySelector('.preco');
        if (precoCard && cfg.tamanhos.length && tipo !== 'picoles') {
            var menorPreco = Math.min.apply(null, cfg.tamanhos.map(function (t) { return numeroPreco(t.preco); }).filter(function (v) { return isFinite(v); }));
            var spanPreco = precoCard.querySelector('span');
            var fortePreco = precoCard.querySelector('strong');
            if (isFinite(menorPreco)) {
                if (spanPreco) spanPreco.textContent = 'A partir de';
                if (fortePreco) fortePreco.textContent = moeda(menorPreco);
            }
        }
        var apiId = produtoApi ? idApi(produtoApi) : '';
        atual = { card: card, tipo: tipo, cfg: cfg, nome: nome, nomeCompleto: prefixo + nome, produtoId: apiId || card.dataset.produtoId || slugProduto(nome) };
        render(atual);
        atualizar();

        anterior = document.activeElement;
        document.body.classList.add('op-aberto');
        janela.querySelector('.op-corpo').scrollTop = 0;
        janela.querySelector('.op-voltar').focus();
    }

    function fechar() {
        document.body.classList.remove('op-aberto');
        if (anterior && anterior.focus) anterior.focus();
    }

    /* ---------------- ENVIO AO CARRINHO ---------------- */
    function adicionar() {
        var s = selecao();

        if (!s.tamanho) {
            var g = janela.querySelector('[data-grupo="tamanho"]');
            g.classList.remove('fechado', 'erro');
            void g.offsetWidth; /* reinicia a animação */
            g.classList.add('erro');
            g.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        var obsEl = janela.querySelector('#op-obs');
        var obs = obsEl ? obsEl.value.trim() : '';
        var extras = s.upgrades.map(function (u) { return u.nome; });

        /* nome que aparece no carrinho */
        var nomeItem = atual.nome + ' (' + s.tamanho.nome + ')' +
            (extras.length ? ' + ' + extras.join(', ') : '') +
            (obs ? ' - Obs: ' + obs : '');

        var detalhe = {
            produtoId: atual.produtoId,
            produto: atual.nomeCompleto,
            categoria: atual.tipo,
            tamanho: s.tamanho.nome,
            upgrades: extras,
            observacoes: obs,
            preco: s.total
        };

        /* Use apenas um caminho de envio para não inserir o mesmo item duas vezes.
           Integração estruturada tem prioridade; o clique legado fica como fallback. */
        var carrinho = window.JoinhaCarrinho;
        if (carrinho && typeof carrinho.adicionarProdutoConfigurado === 'function') {
            carrinho.adicionarProdutoConfigurado(detalhe);
            fechar();
            return;
        }

        /* Compatibilidade com o carrinho atual, que lê os dados do card clicado. */
        var card = atual.card;
        var h3 = card.querySelector('h3');
        var forte = card.querySelector('.preco strong');
        var botao = card.querySelector('.botao-card');
        if (!botao || !h3) {
            console.error('[Joinha] Não foi possível adicionar o produto: card ou botão ausente.', detalhe);
            return;
        }
        var h3Orig = h3.textContent;
        var forteOrig = forte ? forte.textContent : '';

        h3.textContent = nomeItem;
        if (forte) forte.textContent = moeda(s.total);

        liberar = true;
        try { botao.click(); } finally {
            liberar = false;
            h3.textContent = h3Orig;
            if (forte) forte.textContent = forteOrig;
        }

        fechar();
    }

    /* ---------------- EVENTOS ---------------- */

    /* Intercepta o clique nos cards antes do carrinho */
    document.addEventListener('click', function (e) {
        if (liberar) return;
        var card = e.target.closest(SELETOR_CARDS);
        if (!card) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        abrir(card);
    }, true);

    fundo.addEventListener('click', fechar);

    janela.addEventListener('click', function (e) {
        if (e.target.closest('.op-voltar')) return fechar();
        if (e.target.closest('.op-adicionar')) return adicionar();

        var topo = e.target.closest('button.op-grupo-topo');
        if (topo) {
            var g = topo.parentNode;
            g.classList.toggle('fechado');
            topo.setAttribute('aria-expanded', !g.classList.contains('fechado'));
        }
    });

    janela.addEventListener('change', atualizar);

    document.addEventListener('keydown', function (e) {
        if (!document.body.classList.contains('op-aberto')) return;

        if (e.key === 'Escape') return fechar();

        /* mantém o foco dentro da janela */
        if (e.key === 'Tab') {
            var foc = janela.querySelectorAll('button, input:not(:disabled), textarea');
            if (!foc.length) return;
            var primeiro = foc[0], ultimo = foc[foc.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        }
    });
})();
