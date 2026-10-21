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
        }
    };

    var SELETOR_CARDS = CONFIG.milkshakes.seletor + ', ' + CONFIG.picoles.seletor;

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
        return card.closest('.cards-milkshakes') ? 'milkshakes' : 'picoles';
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
        var prefixo = secao.getAttribute('data-prefixo') || '';

        atual = { card: card, tipo: tipo, cfg: CONFIG[tipo], nome: nome, nomeCompleto: prefixo + nome };
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
            produto: atual.nomeCompleto,
            categoria: atual.tipo,
            tamanho: s.tamanho.nome,
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
