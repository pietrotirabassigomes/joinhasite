/* =========================================================
   JOINHA SORVETES - BUSCA DE SABORES + ABERTO/FECHADO
   Para mudar os horários, edite HORARIOS logo abaixo.
   ========================================================= */
(function () {
    'use strict';

    /* ---------------- HORÁRIOS (edite aqui) ----------------
       Dias: 0 = domingo, 1 = segunda ... 6 = sábado.
       Use 'HH:MM'. Dia sem horário (null) = fechado o dia todo.-
       Se fechar depois da meia-noite, use 'abre' > 'fecha' (ex.: 18:00 -> 01:00). */
    var HORARIOS = {
        0: { abre: '09:00', fecha: '20:00' },
        1: { abre: '09:00', fecha: '20:00' },
        2: { abre: '09:00', fecha: '20:00' },
        3: { abre: '09:00', fecha: '20:00' },
        4: { abre: '09:00', fecha: '20:00' },
        5: { abre: '09:00', fecha: '20:00' },
        6: { abre: '09:00', fecha: '20:00' }
    };
    var FUSO = 'America/Sao_Paulo';
    var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    /* ---------------- UTILIDADES ---------------- */
    function minutos(hhmm) {
        var p = hhmm.split(':');
        return (+p[0]) * 60 + (+p[1]);
    }
    function hora(hhmm) {            /* 09:00 -> 9h | 18:30 -> 18h30 */
        var p = hhmm.split(':');
        return (+p[0]) + 'h' + (p[1] === '00' ? '' : p[1]);
    }
    function agoraBR() {             /* horário de Brasília, mesmo se o aparelho estiver em outro fuso */
        try {
            var partes = new Intl.DateTimeFormat('en-US', {
                timeZone: FUSO, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
            }).formatToParts(new Date());
            var o = {};
            partes.forEach(function (p) { o[p.type] = p.value; });
            var mapa = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
            return { dia: mapa[o.weekday], min: (+o.hour % 24) * 60 + (+o.minute) };
        } catch (e) {
            var d = new Date();
            return { dia: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
        }
    }
    function semAcento(t) {
        return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    /* ---------------- STATUS: ABERTO / FECHADO ---------------- */
    function calcularStatus() {
        var n = agoraBR();
        var hoje = HORARIOS[n.dia];
        var ontem = HORARIOS[(n.dia + 6) % 7];

        /* ainda no turno de ontem que passou da meia-noite? */
        if (ontem && minutos(ontem.abre) > minutos(ontem.fecha) && n.min < minutos(ontem.fecha)) {
            return { aberto: true, texto: 'Aberto agora', detalhe: 'Fechamos às ' + hora(ontem.fecha) };
        }
        if (hoje) {
            var ab = minutos(hoje.abre), fe = minutos(hoje.fecha);
            var viraNoite = ab > fe;
            var dentro = viraNoite ? (n.min >= ab) : (n.min >= ab && n.min < fe);
            if (dentro) {
                var falta = viraNoite ? (24 * 60 - n.min + fe) : (fe - n.min);
                var aviso = falta <= 30 ? 'Fechando em ' + falta + ' min' : 'Fechamos às ' + hora(hoje.fecha);
                return { aberto: true, texto: 'Aberto agora', detalhe: aviso, fechando: falta <= 30 };
            }
            if (n.min < ab) {
                return { aberto: false, texto: 'Fechado agora', detalhe: 'Abrimos hoje às ' + hora(hoje.abre) };
            }
        }
        /* procura o próximo dia com expediente */
        for (var i = 1; i <= 7; i++) {
            var d = (n.dia + i) % 7;
            if (HORARIOS[d]) {
                var quando = i === 1 ? 'amanhã' : DIAS[d];
                return { aberto: false, texto: 'Fechado agora', detalhe: 'Abrimos ' + quando + ' às ' + hora(HORARIOS[d].abre) };
            }
        }
        return { aberto: false, texto: 'Fechado', detalhe: '' };
    }

    function montarStatus() {
        var faixa = document.createElement('div');
        faixa.className = 'status-loja';
        faixa.setAttribute('role', 'status');
        faixa.setAttribute('aria-live', 'polite');
        faixa.innerHTML = '<span class="status-ponto" aria-hidden="true"></span>' +
            '<strong class="status-texto"></strong><span class="status-detalhe"></span>';
        document.body.insertBefore(faixa, document.body.firstChild);

        function atualizar() {
            var s = calcularStatus();
            faixa.classList.toggle('aberto', s.aberto);
            faixa.classList.toggle('fechado', !s.aberto);
            faixa.classList.toggle('fechando', !!s.fechando);
            faixa.querySelector('.status-texto').textContent = s.texto;
            faixa.querySelector('.status-detalhe').textContent = s.detalhe;
            document.documentElement.setAttribute('data-loja', s.aberto ? 'aberta' : 'fechada');
            document.documentElement.setAttribute('data-loja-detalhe', s.detalhe);
        }
        atualizar();
        setInterval(atualizar, 30000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) atualizar(); });
    }

    /* ---------------- BUSCA E FILTROS ---------------- */
    function montarBusca() {
        var principal = document.querySelector('main');
        var h1 = principal && principal.querySelector('.titulo');
        if (!principal || !h1) return;

        var secoes = [
            { chave: 'picoles',    titulo: document.getElementById('picoles'),    grade: principal.querySelector('.cards-picoles'),    rotulo: 'Picolés' },
            { chave: 'milkshakes', titulo: document.getElementById('milkshakes'), grade: principal.querySelector('.cards-milkshakes'), rotulo: 'Milk Shakes' },
            { chave: 'potes',      titulo: document.getElementById('potes'),      grade: principal.querySelector('.cards-potes'),      rotulo: 'Potes' }
        ].filter(function (s) { return s.titulo && s.grade; });
        if (!secoes.length) return;

        secoes.forEach(function (s) {
            s.cards = Array.prototype.slice.call(s.grade.querySelectorAll('.card'));
            s.cards.forEach(function (c) {
                var h = c.querySelector('h3');
                c._texto = semAcento(h ? h.textContent : '');
            });
        });
        var totalCards = secoes.reduce(function (n, s) { return n + s.cards.length; }, 0);

        var barra = document.createElement('div');
        barra.className = 'busca-barra';
        barra.innerHTML =
            '<div class="busca-caixa">' +
              '<svg class="busca-icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
              '<input type="search" id="busca-campo" class="busca-campo" placeholder="Buscar sabor (ex.: morango, ninho...)" ' +
                     'autocomplete="off" enterkeyhint="search" aria-label="Buscar sabor no cardápio">' +
              '<button type="button" class="busca-limpar" aria-label="Limpar busca" hidden>&times;</button>' +
            '</div>' +
            '<div class="busca-chips" role="group" aria-label="Filtrar por categoria">' +
              '<button type="button" class="busca-chip ativo" data-filtro="todos" aria-pressed="true">Todos</button>' +
              secoes.map(function (s) {
                  return '<button type="button" class="busca-chip" data-filtro="' + s.chave + '" aria-pressed="false">' + s.rotulo + '</button>';
              }).join('') +
            '</div>' +
            '<p class="busca-contagem" id="busca-contagem" role="status" aria-live="polite"></p>';

        var vazio = document.createElement('div');
        vazio.className = 'busca-vazio';
        vazio.hidden = true;
        vazio.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8.5 11h5"/></svg>' +
            '<strong>Nenhum sabor encontrado</strong>' +
            '<span id="busca-vazio-texto">Tente outra palavra.</span>' +
            '<button type="button" class="busca-vazio-botao">Limpar busca</button>';

        /* a barra fica logo abaixo do título "Cardápio" */
        h1.insertAdjacentElement('afterend', barra);
        barra.insertAdjacentElement('afterend', vazio);

        var campo = barra.querySelector('#busca-campo');
        var limpar = barra.querySelector('.busca-limpar');
        var contagem = barra.querySelector('#busca-contagem');
        var chips = barra.querySelectorAll('.busca-chip');
        var filtro = 'todos';

        function aplicar() {
            var termos = semAcento(campo.value).split(/\s+/).filter(Boolean);
            var achados = 0;
            var emBreve = principal.querySelectorAll('.em-breve');

            secoes.forEach(function (s) {
                var cat = filtro === 'todos' || filtro === s.chave;
                var visiveis = 0;
                s.cards.forEach(function (c) {
                    var ok = cat && termos.every(function (t) { return c._texto.indexOf(t) !== -1; });
                    c.hidden = !ok;
                    if (ok) visiveis++;
                });
                s.grade.hidden = visiveis === 0;
                s.titulo.hidden = visiveis === 0;
                achados += visiveis;
            });

            /* "Em breve" só aparece quando não há busca nem filtro */
            var limpo = !termos.length && filtro === 'todos';
            emBreve.forEach(function (e) { e.hidden = !limpo; });

            limpar.hidden = !campo.value;
            vazio.hidden = achados !== 0;
            if (achados === 0) {
                vazio.querySelector('#busca-vazio-texto').textContent = termos.length
                    ? 'Não achamos "' + campo.value.trim() + '". Confira a escrita ou tente outra palavra.'
                    : 'Nada nesta categoria.';
            }

            if (limpo) contagem.textContent = totalCards + ' sabores no cardápio';
            else contagem.textContent = achados === 1 ? '1 sabor encontrado' : achados + ' sabores encontrados';
        }

        function definirFiltro(valor) {
            filtro = valor;
            chips.forEach(function (c) {
                var on = c.dataset.filtro === valor;
                c.classList.toggle('ativo', on);
                c.setAttribute('aria-pressed', on);
            });
            aplicar();
        }
        function limparTudo() {
            campo.value = '';
            definirFiltro('todos');
            campo.focus();
        }

        campo.addEventListener('input', aplicar);
        campo.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && campo.value) { e.preventDefault(); limparTudo(); }
            if (e.key === 'Enter') { campo.blur(); }          /* fecha o teclado no celular */
        });
        limpar.addEventListener('click', limparTudo);
        vazio.querySelector('.busca-vazio-botao').addEventListener('click', limparTudo);
        barra.querySelector('.busca-chips').addEventListener('click', function (e) {
            var b = e.target.closest('.busca-chip');
            if (b) definirFiltro(b.dataset.filtro);
        });

        /* links do menu de categorias (#picoles, #milkshakes...) voltam a mostrar tudo */
        window.addEventListener('hashchange', function () {
            if (campo.value || filtro !== 'todos') { campo.value = ''; definirFiltro('todos'); }
        });

        aplicar();
    }

    function iniciar() {
        montarStatus();
        montarBusca();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
