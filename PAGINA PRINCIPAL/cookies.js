/* =========================================================
   JOINHA SORVETES - AVISO DE COOKIES (LGPD)
   O Google Analytics só é carregado se a pessoa clicar em "Aceitar".
   O carrinho (localStorage) é necessário e não depende do aceite.
   >>> TROQUE pelo ID do Google Analytics 4 (formato G-XXXXXXXXXX) <<<
   ========================================================= */
(function () {
    'use strict';

    var GA_ID = 'G-XXXXXXXXXX';
    var CHAVE = 'joinha_cookies';
    var base = document.currentScript ? document.currentScript.src : location.href;
    var politica = new URL('../politica-de-privacidade.html', base).href;
    var aviso = null;
    var carregado = false;

    function lerEscolha() {
        try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
    }

    function guardar(v) {
        try { localStorage.setItem(CHAVE, v); } catch (e) {}
    }

    function configurado() {
        return /^G-[A-Z0-9]{6,}$/.test(GA_ID) && GA_ID !== 'G-XXXXXXXXXX';
    }

    function ligarAnalytics() {
        if (carregado || !configurado()) return;
        carregado = true;
        window['ga-disable-' + GA_ID] = false;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', GA_ID);
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
        document.head.appendChild(s);
    }

    function desligarAnalytics() {
        window['ga-disable-' + GA_ID] = true;
    }

    function esconder() {
        if (aviso) { aviso.remove(); aviso = null; }
    }

    function escolher(valor) {
        guardar(valor);
        if (valor === 'aceito') ligarAnalytics(); else desligarAnalytics();
        esconder();
    }

    function mostrar() {
        if (aviso) return;
        aviso = document.createElement('div');
        aviso.className = 'cookies-aviso';
        aviso.setAttribute('role', 'dialog');
        aviso.setAttribute('aria-label', 'Aviso de cookies');
        aviso.innerHTML =
            '<p>Usamos cookies de estatística (Google Analytics) para entender como o site é usado e melhorá-lo. ' +
            'O carrinho funciona sem eles. <a href="' + politica + '">Política de privacidade</a></p>' +
            '<div class="cookies-botoes">' +
            '<button type="button" data-escolha="recusado">Recusar</button>' +
            '<button type="button" data-escolha="aceito">Aceitar</button></div>';
        document.body.appendChild(aviso);
        aviso.addEventListener('click', function (e) {
            var b = e.target.closest('button[data-escolha]');
            if (b) escolher(b.dataset.escolha);
        });
    }

    function iniciar() {
        var escolha = lerEscolha();
        if (escolha === 'aceito') ligarAnalytics();
        else if (escolha === 'recusado') desligarAnalytics();
        else mostrar();

        /* link "Preferências de cookies" no rodapé */
        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-cookies]')) { e.preventDefault(); mostrar(); }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
