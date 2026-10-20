/* =========================================================
   JOINHA SORVETES - JANELA DE CATEGORIAS DO CARDÁPIO
   Abre ao clicar em "Cardápio" no menu (e no botão "Conheça nosso
   cardápio" da página inicial). Os caminhos são calculados a partir
   do link do menu, então funciona na página inicial e no cardápio.
   Para mudar as categorias, edite a lista abaixo.
   ========================================================= */
(function () {
    'use strict';

    var link = document.querySelector('nav a[href$="cardapio.html"]');
    if (!link) return;

    var base = link.href; /* endereço completo do cardapio.html */
    function caminho(rel) { return new URL(rel, base).href; }

    var categorias = [
        { nome: 'Picolés',           desc: 'Sabores de frutas e cremes',       hash: '#picoles',    img: 'picoles%20img/picole-morango.png' },
        { nome: 'Milk Shakes',       desc: 'Cremosos e geladinhos',            hash: '#milkshakes', img: '../img/milkshake.png' },
        { nome: 'Potes',             desc: 'Sorvete de massa de 2 litros',     hash: '#potes',      img: '../img/Pote.png' },
        { nome: 'Bolos',             desc: 'Para festas e momentos especiais', hash: '#bolos',      img: '../img/bolo.png' },
        { nome: 'Caixas de Picolé',  desc: 'Caixa com 20 unidades',            hash: '#caixas',     img: '../img/ciaxa.png' }
    ];

    var fundo = document.createElement('div');
    fundo.className = 'menu-fundo';

    var janela = document.createElement('div');
    janela.className = 'menu-janela';
    janela.setAttribute('role', 'dialog');
    janela.setAttribute('aria-modal', 'true');
    janela.setAttribute('aria-labelledby', 'menu-titulo');

    janela.innerHTML =
        '<div class="menu-topo"><div><h2 id="menu-titulo">O que você quer hoje?</h2>' +
        '<p>Escolha uma categoria do cardápio</p></div>' +
        '<button type="button" class="menu-fechar" aria-label="Fechar">&times;</button></div>' +
        '<div class="menu-grade">' +
        categorias.map(function (c) {
            return '<a class="menu-opcao" href="' + caminho('cardapio.html') + c.hash + '">' +
                '<img src="' + caminho(c.img) + '" alt="">' +
                '<strong>' + c.nome + '</strong><span>' + c.desc + '</span></a>';
        }).join('') +
        '</div>' +
        '<a class="menu-ver-tudo" href="' + caminho('cardapio.html') + '">Ver cardápio completo</a>';

    document.body.appendChild(fundo);
    document.body.appendChild(janela);

    var anterior = null;

    function abrir() {
        anterior = document.activeElement;
        document.body.classList.add('menu-aberto');
        janela.querySelector('.menu-fechar').focus();
    }

    function fechar() {
        document.body.classList.remove('menu-aberto');
        if (anterior) anterior.focus();
    }

    function interceptar(e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return; /* deixa abrir em nova aba */
        e.preventDefault();
        abrir();
    }

    link.addEventListener('click', interceptar);
    document.querySelectorAll('.botao[href$="cardapio.html"]').forEach(function (b) {
        b.addEventListener('click', interceptar);
    });

    fundo.addEventListener('click', fechar);
    janela.querySelector('.menu-fechar').addEventListener('click', fechar);

    /* ao escolher uma categoria, fecha a janela (o link leva à seção) */
    janela.addEventListener('click', function (e) {
        if (e.target.closest('a')) document.body.classList.remove('menu-aberto');
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) fechar();
    });
})();
