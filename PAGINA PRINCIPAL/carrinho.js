/* =========================================================
   JOINHA SORVETES - CARRINHO
   Funciona em qualquer página: basta carregar este arquivo.
   O carrinho fica salvo no navegador (vale para todas as páginas).

   Agora com: RETIRADA ou DELIVERY, nome do cliente, endereço
   de entrega, taxa de entrega e validação antes do envio.
   ========================================================= */
(function () {
    'use strict';

    /* >>> TROQUE pelo WhatsApp da loja: DDI + DDD + número, só dígitos <<< */
    var WHATSAPP = 'NUMERO_WHATSAPP';

    /* >>> Endereço da loja, mostrado para quem escolhe RETIRADA.
           Ex.: 'Rua das Flores, 123 - Centro'. Deixe '' para não mostrar. <<< */
    var ENDERECO_LOJA = '';

    /* >>> Taxa de entrega em reais. Ex.: 5 (soma no total), 0 (grátis)
           ou null (aparece "A combinar" e a loja informa pelo WhatsApp). <<< */
    var TAXA_ENTREGA = null;

    var CHAVE = 'joinha_carrinho';
    var CHAVE_PEDIDO = 'joinha_pedido';
    var itens = carregar();
    var pedido = carregarPedido();

    var TIPOS = {
        retirada: 'Retirada na loja',
        entrega: 'Entrega (delivery)'
    };

    /* campos obrigatórios em cada tipo, na ordem em que aparecem */
    var OBRIGATORIOS = {
        retirada: ['nome'],
        entrega: ['nome', 'rua', 'numero', 'bairro']
    };

    var MENSAGENS = {
        nome: 'Informe seu nome.',
        rua: 'Informe a rua.',
        numero: 'Informe o número (ou S/N).',
        bairro: 'Informe o bairro.'
    };

    /* ---------- utilidades ---------- */
    function carregar() {
        try { return JSON.parse(localStorage.getItem(CHAVE)) || []; }
        catch (e) { return []; }
    }

    function salvar() {
        try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) {}
    }

    /* dados do pedido (tipo + nome + endereço): ficam salvos para o cliente
       não precisar digitar tudo de novo na próxima compra */
    function carregarPedido() {
        var padrao = { modo: '', nome: '', rua: '', numero: '', bairro: '', comp: '' };
        try {
            var salvo = JSON.parse(localStorage.getItem(CHAVE_PEDIDO)) || {};
            Object.keys(padrao).forEach(function (k) {
                if (typeof salvo[k] === 'string') padrao[k] = salvo[k];
            });
            if (!TIPOS[padrao.modo]) padrao.modo = '';
        } catch (e) {}
        return padrao;
    }

    function salvarPedido() {
        try { localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido)); } catch (e) {}
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

    function $(id) { return document.getElementById(id); }

    /* ---------- ações ---------- */
    function adicionar(produto) {
        var item = itens.find(function (i) { return i.id === produto.id; });
        if (item) item.qtd += 1;
        else itens.push({ id: produto.id, nome: produto.nome, preco: produto.preco, img: produto.img, consultar: !!produto.consultar, qtd: 1 });
        atualizar();
        avisar(produto.nome + ' foi para o carrinho');
        document.querySelectorAll('.carrinho-btn, .carrinho-flutuante').forEach(function (b) {
            b.classList.remove('pulo');
            void b.offsetWidth;
            b.classList.add('pulo');
        });
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

    /* soma só dos produtos */
    function total() {
        return itens.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0);
    }

    function temConsultar() {
        return itens.some(function (i) { return i.consultar; });
    }

    function ehEntrega() {
        return pedido.modo === 'entrega';
    }

    /* valor da taxa que entra na conta (0 se for retirada ou "a combinar") */
    function taxaValor() {
        return ehEntrega() && typeof TAXA_ENTREGA === 'number' ? TAXA_ENTREGA : 0;
    }

    function textoTaxa() {
        if (typeof TAXA_ENTREGA !== 'number') return 'A combinar';
        return TAXA_ENTREGA > 0 ? moeda(TAXA_ENTREGA) : 'Grátis';
    }

    /* Texto do total: produtos + taxa, com aviso do que ainda será combinado */
    function textoTotal() {
        var t = total() + taxaValor();
        var extras = [];
        if (temConsultar()) extras.push('a consultar');
        if (ehEntrega() && typeof TAXA_ENTREGA !== 'number') extras.push('entrega');
        if (!extras.length) return moeda(t);
        return t > 0 ? moeda(t) + ' + ' + extras.join(' + ') : 'A consultar';
    }

    function enderecoTexto() {
        var e = pedido.rua.trim() + ', nº ' + pedido.numero.trim() + ' - ' + pedido.bairro.trim();
        if (pedido.comp.trim()) e += ' (' + pedido.comp.trim() + ')';
        return e;
    }

    /* ---------- validação ---------- */
    function mostrarErro(chave, msg) {
        var erro = $('ped-' + chave + '-erro');
        if (erro) { erro.textContent = msg; erro.hidden = false; }
        var campo = $('ped-' + chave);
        if (campo) {
            if (chave === 'tipo') {
                campo.classList.remove('erro');
                void campo.offsetWidth; /* reinicia a animação */
                campo.classList.add('erro');
            } else {
                campo.setAttribute('aria-invalid', 'true');
            }
        }
    }

    function limparErro(chave) {
        var erro = $('ped-' + chave + '-erro');
        if (erro) erro.hidden = true;
        var campo = $('ped-' + chave);
        if (campo) {
            campo.removeAttribute('aria-invalid');
            campo.classList.remove('erro');
        }
    }

    /* Retorna o primeiro campo com problema (ou null se estiver tudo certo) */
    function validar() {
        ['tipo', 'nome', 'rua', 'numero', 'bairro'].forEach(limparErro);

        if (!pedido.modo) {
            mostrarErro('tipo', 'Escolha entre retirada e delivery.');
            return document.querySelector('input[name="ped-tipo"]');
        }

        var primeiro = null;
        OBRIGATORIOS[pedido.modo].forEach(function (chave) {
            if (!pedido[chave].trim()) {
                mostrarErro(chave, MENSAGENS[chave]);
                if (!primeiro) primeiro = $('ped-' + chave);
            }
        });
        return primeiro;
    }

    function finalizar() {
        if (!itens.length) return;

        var invalido = validar();
        if (invalido) {
            var alvo = invalido.closest('.campo') || invalido.closest('fieldset') || invalido;
            alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            invalido.focus({ preventScroll: true });
            avisar(pedido.modo ? 'Preencha os campos destacados' : 'Escolha retirada ou delivery');
            return;
        }

        var obs = $('carrinho-obs').value.trim();
        var linhas = ['*Pedido - Joinha Sorvetes*', ''];

        linhas.push('*Cliente:* ' + pedido.nome.trim());
        linhas.push('*Recebimento:* ' + TIPOS[pedido.modo]);
        if (ehEntrega()) linhas.push('*Endereço:* ' + enderecoTexto());
        linhas.push('');

        itens.forEach(function (i) {
            linhas.push(i.qtd + 'x ' + i.nome + ' - ' + (i.consultar ? 'preço a consultar' : moeda(i.preco * i.qtd)));
        });

        linhas.push('');
        if (ehEntrega()) {
            linhas.push('Subtotal: ' + (temConsultar() && !total() ? 'a consultar' : moeda(total())));
            linhas.push('Taxa de entrega: ' + textoTaxa().toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }));
        }
        linhas.push('*Total: ' + textoTotal() + '*');
        if (obs) linhas.push('', 'Observações: ' + obs);

        window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(linhas.join('\n')), '_blank');
    }

    /* ---------- interface ---------- */
    var ICONE_LOJA =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 4.6 4h14.8L21 9.5"/>' +
        '<path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.5V20h14v-7.5"/><path d="M10 20v-4.5h4V20"/></svg>';

    var ICONE_PIN =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/>' +
        '<circle cx="12" cy="10" r="2.3"/></svg>';

    function opcaoTipo(valor, icone, titulo, sub) {
        return '<label class="entrega-opcao">' +
            '<input type="radio" name="ped-tipo" id="ped-tipo-' + valor + '" value="' + valor + '">' +
            '<span class="entrega-cartao">' + icone + '<strong>' + titulo + '</strong><small>' + sub + '</small></span>' +
            '</label>';
    }

    function campo(chave, rotulo, atributos, opcional) {
        return '<div class="campo">' +
            '<label for="ped-' + chave + '">' + rotulo +
            (opcional ? ' <small class="campo-opc">(opcional)</small>' : '') + '</label>' +
            '<input type="text" id="ped-' + chave + '" ' + atributos +
            ' aria-describedby="ped-' + chave + '-erro">' +
            '<span class="campo-erro" id="ped-' + chave + '-erro" hidden></span></div>';
    }

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

        /* Botão flutuante: aparece quando o botão do menu sai da tela
           (ex.: lá embaixo, nos milkshakes), para pagar sem voltar ao topo */
        var flutuante = document.createElement('button');
        flutuante.type = 'button';
        flutuante.className = 'carrinho-flutuante';
        flutuante.id = 'carrinho-flutuante';
        flutuante.setAttribute('aria-label', 'Abrir carrinho');
        flutuante.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>' +
            '<path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/></svg>' +
            '<span class="flutuante-texto">Carrinho</span>' +
            '<span class="flutuante-total" id="flutuante-total" hidden></span>' +
            '<span class="carrinho-contador" id="flutuante-contador">0</span>';
        document.body.appendChild(flutuante);
        flutuante.addEventListener('click', abrir);

        function mostrarFlutuante(mostrar) {
            flutuante.classList.toggle('visivel', mostrar);
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entradas) {
                mostrarFlutuante(!entradas[0].isIntersecting);
            }).observe(btn);
        } else {
            window.addEventListener('scroll', function () {
                mostrarFlutuante(btn.getBoundingClientRect().bottom < 0);
            }, { passive: true });
        }

        var fundo = document.createElement('div');
        fundo.className = 'carrinho-fundo';

        var subEntrega = typeof TAXA_ENTREGA === 'number'
            ? (TAXA_ENTREGA > 0 ? 'Taxa de ' + moeda(TAXA_ENTREGA) : 'Entrega grátis')
            : 'Levamos até você';

        var infoRetirada = ENDERECO_LOJA
            ? 'Retire em: <strong>' + escapar(ENDERECO_LOJA) + '</strong>'
            : 'Avisamos pelo WhatsApp quando o pedido estiver pronto para retirar.';

        var painel = document.createElement('aside');
        painel.className = 'carrinho-painel';
        painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-label', 'Seu carrinho');
        painel.innerHTML =
            '<div class="carrinho-topo"><h2>Seu carrinho</h2>' +
            '<button type="button" class="carrinho-fechar" aria-label="Fechar carrinho">&times;</button></div>' +

            '<div class="carrinho-rolagem">' +
            '<ul class="carrinho-lista" id="carrinho-lista"></ul>' +

            '<div class="carrinho-form" id="carrinho-form" hidden>' +

            '<fieldset class="entrega-tipo" id="ped-tipo">' +
            '<legend>Como você quer receber?</legend>' +
            '<div class="entrega-opcoes">' +
            opcaoTipo('retirada', ICONE_LOJA, 'Retirada', 'Busque na loja') +
            opcaoTipo('entrega', ICONE_PIN, 'Delivery', subEntrega) +
            '</div>' +
            '<span class="campo-erro" id="ped-tipo-erro" role="alert" hidden></span>' +
            '</fieldset>' +

            '<div class="carrinho-dados" id="carrinho-dados" hidden>' +
            campo('nome', 'Seu nome', 'maxlength="60" autocomplete="name" placeholder="Como podemos te chamar?"') +
            '<p class="retirada-info" id="bloco-retirada" hidden>' + infoRetirada + '</p>' +
            '<div class="bloco-entrega" id="bloco-entrega" hidden>' +
            '<div class="campo-linha">' +
            campo('rua', 'Rua / Avenida', 'maxlength="80" autocomplete="address-line1" placeholder="Nome da rua"') +
            campo('numero', 'Número', 'maxlength="10" autocomplete="off" placeholder="120 ou S/N"') +
            '</div>' +
            campo('bairro', 'Bairro', 'maxlength="50" autocomplete="off" placeholder="Seu bairro"') +
            campo('comp', 'Complemento ou ponto de referência', 'maxlength="80" autocomplete="off" placeholder="Ex.: casa azul, apto 12"', true) +
            '</div>' +
            '</div>' +

            '<div class="campo">' +
            '<label for="carrinho-obs">Observações do pedido <small class="campo-opc">(opcional)</small></label>' +
            '<textarea id="carrinho-obs" placeholder="Ex.: sabores, horário de retirada..."></textarea></div>' +

            '</div>' + /* fim .carrinho-form */
            '</div>' + /* fim .carrinho-rolagem */

            '<div class="carrinho-acoes">' +
            '<div class="carrinho-resumo" id="carrinho-resumo" hidden>' +
            '<div><span>Produtos</span><span id="resumo-produtos">R$ 0,00</span></div>' +
            '<div><span>Taxa de entrega</span><span id="resumo-taxa">A combinar</span></div></div>' +
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

        /* preenche com o que o cliente já tinha digitado antes */
        ['nome', 'rua', 'numero', 'bairro', 'comp'].forEach(function (k) { $('ped-' + k).value = pedido[k]; });
        if (pedido.modo) $('ped-tipo-' + pedido.modo).checked = true;

        btn.addEventListener('click', abrir);
        fundo.addEventListener('click', fechar);
        painel.querySelector('.carrinho-fechar').addEventListener('click', fechar);
        $('carrinho-finalizar').addEventListener('click', finalizar);
        $('carrinho-limpar').addEventListener('click', limpar);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });

        /* escolha de retirada / delivery */
        painel.addEventListener('change', function (e) {
            if (e.target.name !== 'ped-tipo') return;
            pedido.modo = e.target.value;
            salvarPedido();
            limparErro('tipo');
            /* o que era obrigatório muda com o tipo: limpa avisos antigos */
            ['nome', 'rua', 'numero', 'bairro'].forEach(limparErro);
            atualizar();
            var dados = $('carrinho-dados');
            dados.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        /* digitação: guarda os dados e some com o aviso de erro do campo */
        painel.addEventListener('input', function (e) {
            var t = e.target;
            if (!t.id || t.id.indexOf('ped-') !== 0) return;
            var chave = t.id.slice(4);
            if (chave === 'modo' || typeof pedido[chave] !== 'string') return;
            pedido[chave] = t.value;
            salvarPedido();
            limparErro(chave);
        });

        /* botões + / - / remover (delegação) */
        $('carrinho-lista').addEventListener('click', function (e) {
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
        var a = $('carrinho-aviso');
        a.textContent = texto;
        a.classList.add('visivel');
        clearTimeout(temporizador);
        temporizador = setTimeout(function () { a.classList.remove('visivel'); }, 1800);
    }

    /* mostra / esconde as partes do formulário conforme o tipo escolhido */
    function atualizarFormulario() {
        var temItens = itens.length > 0;
        var modo = pedido.modo;

        $('carrinho-form').hidden = !temItens;
        $('carrinho-dados').hidden = !modo;
        $('bloco-retirada').hidden = modo !== 'retirada';
        $('bloco-entrega').hidden = modo !== 'entrega';

        $('carrinho-obs').placeholder = modo === 'entrega'
            ? 'Ex.: sabores, troco para R$ 50, horário preferido...'
            : 'Ex.: sabores, horário de retirada...';

        /* resumo com taxa: só no delivery */
        $('carrinho-resumo').hidden = !(temItens && ehEntrega());
        $('resumo-produtos').textContent = temConsultar() && !total() ? 'A consultar' : moeda(total());
        $('resumo-taxa').textContent = textoTaxa();
    }

    function atualizar() {
        salvar();
        /* nos milkshakes, cada sabor conta 1 no contador, não importa a quantidade
           (o preço e a quantidade pedida continuam certos dentro do carrinho) */
        var qtdTotal = itens.reduce(function (s, i) {
            return s + (/^milkshake/i.test(i.nome) ? 1 : i.qtd);
        }, 0);
        $('carrinho-contador').textContent = qtdTotal;
        $('flutuante-contador').textContent = qtdTotal;

        var texto = textoTotal();
        var totalEl = $('carrinho-total');
        totalEl.textContent = texto;
        totalEl.classList.toggle('longo', texto.length > 14);

        var flutTotal = $('flutuante-total');
        flutTotal.textContent = texto;
        flutTotal.hidden = !itens.length || texto.length > 14;

        $('carrinho-finalizar').disabled = !itens.length;
        $('carrinho-limpar').hidden = !itens.length;
        atualizarFormulario();

        var lista = $('carrinho-lista');
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
                '<small>' + (i.consultar ? 'Preço a consultar' : moeda(i.preco) + ' cada') + '</small>' +
                '<div class="carrinho-qtd">' +
                '<button type="button" data-acao="menos" data-id="' + escapar(i.id) + '" aria-label="Diminuir quantidade">&minus;</button>' +
                '<span>' + i.qtd + '</span>' +
                '<button type="button" data-acao="mais" data-id="' + escapar(i.id) + '" aria-label="Aumentar quantidade">+</button>' +
                '</div></div>' +
                '<div class="carrinho-direita"><span class="carrinho-subtotal">' + (i.consultar ? 'A consultar' : moeda(i.preco * i.qtd)) + '</span>' +
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
            var secao = card.closest('[data-prefixo]');
            var prefixo = secao ? secao.getAttribute('data-prefixo') : '';
            btn.disabled = false;
            btn.dataset.nome = prefixo + titulo.textContent.trim();
            btn.dataset.preco = lerPreco(valor.textContent);
            /* sem número no preço (ex.: "A consultar") -> item entra no carrinho sem valor */
            if (!/\d/.test(valor.textContent)) btn.dataset.consultar = '1';
            else delete btn.dataset.consultar;
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
                img: b.dataset.img || '',
                consultar: b.dataset.consultar === '1'
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