/* =========================================================
   JOINHA SORVETES - JANELA DE OPÇÕES DO PRODUTO
   Ao clicar num picolé ou milkshake (no card ou no botão
   "Adicionar ao carrinho") abre uma janela para escolher o
   tamanho (obrigatório), upgrades e observações.

   Para mudar tamanhos, preços ou upgrades, edite o CONFIG abaixo.
   ========================================================= */
(function () {
    'use strict';

    /* ---------------- CONFIGURAÇÃO ---------------- */
    var CONFIG = {
        milkshakes: {
            seletor: '.cards-milkshakes .card',
            precoNoCard: true,   /* troca "A consultar" por "A partir de R$ ..." no card */
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
            precoNoCard: false,
            /* ATENÇÃO: ajuste este preço para o real */
            tamanhos: [
                { nome: 'Unidade', desc: '1 picolé', preco: 2.5 }
            ],
            upgrades: null,
            obs: true
        },
        potes: {
            seletor: '.cards-potes .card',
            precoNoCard: false,  /* mude para true quando os preços forem os reais */
            /* Reserva, usada só se a API estiver fora do ar. Os preços reais ficam no painel. */
            tamanhos: [
                { nome: 'Pote 2L', preco: 50 }
            ],
            precosFallback: {
                'pote-abacaxi-suico': 33,
                'pote-coco-branco': 30,
                'pote-maracuja-trufado': 33,
                'pote-unicornio': 38,
                'pote-ferrero-rocher-com-avela': 38,
                'pote-pistache': 38,
                'pote-creme': 30,
                'pote-napolitano': 30,
                'pote-chocolate-trufado': 33,
                'pote-olho-de-sogra': 33,
                'pote-trufado-provocante': 38,
                'pote-provocante-avela': 38,
                'pote-flocos': 30,
                'pote-acai-puro': 38,
                'pote-floresta-suprema': 38,
                'pote-iogurte-com-morango': 50,
                'pote-chocomenta': 38,
                'pote-super-chocolate': 38
            },
            upgrades: null,
            obs: true
        },
        especiais: {
            seletor: '.cards-especiais .card',
            precoNoCard: false,  /* mude para true quando os preços abaixo forem os reais */
            /* Reserva, usada só se a API estiver fora do ar. Os preços reais ficam no painel. */
            tamanhos: [
                { nome: 'Unidade', preco: 15 }
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
        /* Pronto para quando criar esta seção no cardapio.html
           (<section class="cards cards-bolos">) */
        bolos: {
            seletor: '.cards-bolos .card',
            precoNoCard: false,
            /* ATENÇÃO: preços de exemplo, ajuste para os reais */
            tamanhos: [
                { nome: 'Fatia', preco: 10 },
                { nome: 'Bolo inteiro', preco: 80 }
            ],
            upgrades: null,
            obs: true
        }
    };

    var API_BASE = String(window.JOINHA_API_URL || '').replace(/\/$/, '');
    var SELETOR_CARDS = Object.keys(CONFIG).map(function (k) { return CONFIG[k].seletor; }).join(', ');

    /* ---------------- UTILITÁRIOS ---------------- */
    function moeda(v) {
        return 'R$ ' + v.toFixed(2).replace('.', ',');
    }

    function esc(t) {
        return String(t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function tipoDoCard(card) {
        var chaves = Object.keys(CONFIG);
        for (var i = 0; i < chaves.length; i++) {
            if (card.matches(CONFIG[chaves[i]].seletor)) return chaves[i];
        }
        return 'picoles';
    }

    function slugProduto(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    /* ---------------- PREÇO NO CARD ("A partir de") ----------------
       Só nas categorias com precoNoCard: true no CONFIG. */
    Object.keys(CONFIG).forEach(function (k) {
        var c = CONFIG[k];
        if (!c.precoNoCard) return;
        var menor = Math.min.apply(null, c.tamanhos.map(function (t) { return t.preco; }));
        var rotulo = c.tamanhos.length > 1 ? 'A partir de' : 'Por apenas';
        document.querySelectorAll(c.seletor + ' .preco').forEach(function (p) {
            var sp = p.querySelector('span'), st = p.querySelector('strong');
            if (sp) sp.textContent = rotulo;
            if (st) st.textContent = moeda(menor);
        });
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

        var sabores = '';
        if (cfg.sabores) {
            sabores = grupoHTML('sabores', esc(cfg.sabores.titulo), 'Escolha exatamente ' + cfg.sabores.max + ' sabores', true,
                cfg.sabores.itens.map(function (sabor, i) {
                    return '<label class="op-opcao op-opcao--check"><span class="op-info"><strong>' + esc(sabor) + '</strong></span>' +
                        '<input type="number" name="op-sabor" data-sabor-index="' + i + '" min="0" max="20" step="1" value="0" aria-label="Quantidade de ' + esc(sabor) + '"></label>';
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
            (sabores || '') +
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
            ups.push(cfg.upgrades ? cfg.upgrades.itens[+c.value] : null);
        });
        var sabores = [];
        if (cfg.sabores) {
            cfg.sabores.itens.forEach(function (sabor, i) {
                var input = janela.querySelector('input[name="op-sabor"][data-sabor-index="' + i + '"]');
                var qtd = input ? (parseInt(input.value, 10) || 0) : 0;
                for (var j = 0; j < qtd; j++) {
                    sabores.push(sabor);
                }
            });
        }
        var total = (tamanho ? tamanho.preco : 0) + ups.reduce(function (s, u) { return s + (u ? u.preco : 0); }, 0);
        return { tamanho: tamanho, upgrades: ups.filter(Boolean), sabores: sabores, total: total };
    }

    function atualizar() {
        var s = selecao();
        var botao = janela.querySelector('.op-adicionar');
        var selo = janela.querySelector('[data-grupo="tamanho"] .op-obrig');
        var saboresOk = !atual.cfg.sabores || s.sabores.length === atual.cfg.sabores.max;

        janela.querySelector('#op-total').textContent = moeda(s.total);

        if (s.tamanho && saboresOk) {
            botao.classList.remove('pendente');
            botao.textContent = 'Adicionar ao carrinho';
            if (selo) { selo.textContent = 'Ok'; selo.classList.add('ok'); }
            janela.querySelector('[data-grupo="tamanho"]').classList.remove('erro');
        } else {
            botao.classList.add('pendente');
            botao.textContent = s.tamanho ? 'Escolha os 20 sabores' : 'Escolha o tamanho';
        }

        /* limite de upgrades */
        if (atual.cfg.upgrades) {
            var marcados = janela.querySelectorAll('input[name="op-upgrade"]:checked').length;
            janela.querySelectorAll('input[name="op-upgrade"]').forEach(function (c) {
                c.disabled = !c.checked && marcados >= atual.cfg.upgrades.max;
            });
        }

        if (atual.cfg.sabores) {
            var marcadosSabores = s.sabores.length;
            var grupoSabores = janela.querySelector('[data-grupo="sabores"]');
            var obrigatorioSabores = grupoSabores ? grupoSabores.querySelector('.op-obrig') : null;
            if (obrigatorioSabores) {
                obrigatorioSabores.textContent = marcadosSabores === atual.cfg.sabores.max ? 'Ok' : (marcadosSabores + '/' + atual.cfg.sabores.max);
                obrigatorioSabores.classList.toggle('ok', marcadosSabores === atual.cfg.sabores.max);
            }
            if (grupoSabores && marcadosSabores !== atual.cfg.sabores.max) {
                grupoSabores.classList.add('erro');
            } else if (grupoSabores) {
                grupoSabores.classList.remove('erro');
            }
        }
    }

    /* ---------------- ABRIR / FECHAR ---------------- */
    /* Procura o produto do card no catálogo da API.
       Só considera produtos da MESMA categoria do card: nomes como "Creme" ou "Flocos"
       existem em milkshakes e em potes, e sem esse filtro um pote podia virar milkshake. */
    function acharNoCatalogo(lista, tipo, id, nome) {
        var slugNome = slugProduto(nome);
        var daCategoria = (lista || []).filter(function (p) { return !p.categoria || p.categoria === tipo; });
        return daCategoria.find(function (p) { return p.id === id; }) ||
            daCategoria.find(function (p) { return slugProduto(p.nome) === slugNome; }) ||
            daCategoria.find(function (p) { return slugProduto(p.nome).replace(/^picole-de-/, '') === slugNome; }) || null;
    }

    async function buscarProdutoAtual(card, nome, tipo) {
        var id = card.dataset.produtoId || slugProduto(nome);
        try {
            var resposta = await fetch(API_BASE + '/api/produtos', {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (resposta.ok) {
                var produtos = await resposta.json();
                if (Array.isArray(produtos)) {
                    window.JoinhaCatalogo = produtos;
                    return { consultado: true, produto: acharNoCatalogo(produtos, tipo, id, nome) };
                }
            }
        } catch (erro) {
            // Se a API estiver indisponível, o cardápio local continua podendo abrir.
        }
        return { consultado: false, produto: acharNoCatalogo(window.JoinhaCatalogo, tipo, id, nome) };
    }

    function listarSaboresCaixa() {
        return Array.from(document.querySelectorAll('.cards-picoles .card'))
            .filter(function (item) {
                return item.dataset.produtoId !== 'caixa-de-picole';
            })
            .map(function (item) {
                var titulo = item.querySelector('h3');
                return titulo ? titulo.textContent.trim() : '';
            })
            .filter(Boolean);
    }

    async function abrir(card) {
        var tipo = tipoDoCard(card);
        var secao = card.closest('.cards');
        var nome = card.querySelector('h3').textContent.trim();
        var prefixo = secao ? (secao.getAttribute('data-prefixo') || '') : '';
        var produtoId = card.dataset.produtoId || slugProduto(nome);
        var eCaixaPicoles = produtoId === 'caixa-de-picole' || /caixa de picole/i.test(nome);
        var resultadoProduto = await buscarProdutoAtual(card, nome, tipo);
        var produtoApi = resultadoProduto.produto;
        var cfgBase = CONFIG[tipo];
        if (resultadoProduto.consultado && !produtoApi) {
            /* Produto ausente: só bloqueia se a API já tem produtos dessa categoria
               (aí ele foi removido do cardápio). Se a categoria ainda não existe na API,
               usa o CONFIG local para o cardápio continuar funcionando. */
            var categoriaNaApi = (window.JoinhaCatalogo || []).some(function (p) { return p.categoria === tipo; });
            if (categoriaNaApi) {
                window.alert('Este produto não está mais disponível no cardápio. Atualize a página e escolha outro produto.');
                return;
            }
        }
        if (produtoApi) card.dataset.produtoId = produtoApi.id;
        var tamanhosBase = produtoApi && Array.isArray(produtoApi.tamanhos) && produtoApi.tamanhos.length
            ? produtoApi.tamanhos
            : cfgBase.tamanhos;
        if (tipo === 'potes' && !produtoApi) {
            var precoFallback = cfgBase.precosFallback[card.dataset.produtoId];
            if (Number.isFinite(precoFallback)) tamanhosBase = [{ nome: 'Pote 2L', preco: precoFallback }];
        }
        var cfg = {
            seletor: cfgBase.seletor,
            tamanhos: tamanhosBase.filter(function (t) { return !(tipo === 'picoles' && /caixa/i.test(t.nome)); }),
            /* Potes não têm adicionais, mesmo que a API envie algum */
            upgrades: tipo === 'potes' ? null : (produtoApi ? ((produtoApi.upgrades || []).length ? { titulo: 'Adicionais', max: 2, itens: produtoApi.upgrades } : null) : cfgBase.upgrades),
            obs: produtoApi ? produtoApi.obs !== false : cfgBase.obs
        };
        if (eCaixaPicoles) {
            cfg.tamanhos = [{ nome: 'Caixa com 20 picolés', preco: 40 }];
            cfg.upgrades = null;
            cfg.sabores = {
                titulo: 'Escolha os sabores',
                max: 20,
                itens: listarSaboresCaixa()
            };
        }
        atual = { card: card, tipo: tipo, cfg: cfg, nome: nome, nomeCompleto: prefixo + nome, produtoId: produtoId };
        render(atual);
        if (cfg.tamanhos.length === 1) {
            var unico = janela.querySelector('input[name="op-tamanho"]');
            if (unico) unico.checked = true;
        }
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

        if (atual.cfg.sabores && s.sabores.length !== atual.cfg.sabores.max) {
            var saboresGrupo = janela.querySelector('[data-grupo="sabores"]');
            if (saboresGrupo) {
                saboresGrupo.classList.remove('fechado', 'erro');
                void saboresGrupo.offsetWidth;
                saboresGrupo.classList.add('erro');
                saboresGrupo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        var obsEl = janela.querySelector('#op-obs');
        var obs = obsEl ? obsEl.value.trim() : '';
        var extras = s.upgrades.map(function (u) { return u.nome; });

        /* nome que aparece no carrinho */
        var nomeItem = atual.nome + ' (' + s.tamanho.nome + ')' +
            (s.sabores.length ? ' - ' + s.sabores.join(', ') : '') +
            (extras.length ? ' + ' + extras.join(', ') : '') +
            (obs ? ' - Obs: ' + obs : '');

        var detalhe = {
            produtoId: atual.produtoId,
            produto: atual.nomeCompleto,
            categoria: atual.tipo,
            tamanho: s.tamanho.nome,
            sabores: s.sabores,
            upgrades: extras,
            observacoes: obs,
            preco: s.total
        };

        /* Avisa quem quiser escutar (ex.: o carrinho) */
        document.dispatchEvent(new CustomEvent('joinha:produto-configurado', { detail: detalhe }));

        /* Compatível com o carrinho atual: preenche o card com o item
           escolhido, dispara o clique original e devolve o card ao normal. */
        var card = atual.card;
        var h3 = card.querySelector('h3');
        var forte = card.querySelector('.preco strong');
        var botao = card.querySelector('.botao-card');
        var h3Orig = h3.textContent;
        var forteOrig = forte ? forte.textContent : '';

        h3.textContent = nomeItem;
        if (forte) forte.textContent = moeda(s.total);

        liberar = true;
        try { botao.click(); } finally { liberar = false; }

        h3.textContent = h3Orig;
        if (forte) forte.textContent = forteOrig;

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
    janela.addEventListener('input', function (e) {
        if (!e.target.matches('input[name="op-sabor"]')) return;
        if (!atual || !atual.cfg || !atual.cfg.sabores) return;

        var totalAtual = 0;
        janela.querySelectorAll('input[name="op-sabor"]').forEach(function (input) {
            if (input !== e.target) totalAtual += (parseInt(input.value, 10) || 0);
        });

        var valor = (parseInt(e.target.value, 10) || 0);
        var restante = atual.cfg.sabores.max - totalAtual;
        if (valor > restante) e.target.value = Math.max(0, restante);
        if (valor < 0) e.target.value = 0;
        atualizar();
    });

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