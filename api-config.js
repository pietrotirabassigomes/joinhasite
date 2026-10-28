/* Configurações públicas do site Joinha Sorvetes.
   Preencha os campos comerciais antes de receber pedidos reais.
   Se frontend e API forem publicados juntos, deixe JOINHA_API_URL vazio. */
(function () {
    'use strict';
    window.JOINHA_API_URL = ''; // Se a API estiver em outro host, informe a URL HTTPS aqui.
    // WhatsApp da loja: código do país + DDD + número, somente dígitos. Ex.: 5511999999999
    window.JOINHA_WHATSAPP = ''; // Preencha com DDI + DDD + número, sem espaços. Ex.: 5511999999999
    window.JOINHA_WHATSAPP = String(window.JOINHA_WHATSAPP).replace(/\D/g, '');
    window.JOINHA_INSTAGRAM_URL = ''; // Ex.: https://www.instagram.com/sua_loja/
    window.JOINHA_FACEBOOK_URL = ''; // Link oficial da página no Facebook
    window.JOINHA_ADDRESS = ''; // Endereço para retirada/rodapé
    window.JOINHA_CNPJ = '';
    window.JOINHA_LEGAL_NAME = ''; // Razão social da empresa
    window.JOINHA_PHONE = ''; // Telefone comercial
    window.JOINHA_EMAIL = ''; // E-mail de contato e privacidade
    window.JOINHA_HOURS = ''; // Dias e horários de atendimento

    if (!document || !document.querySelectorAll) return;
    var urls = {
        whatsapp: window.JOINHA_WHATSAPP && /^\d{10,15}$/.test(window.JOINHA_WHATSAPP)
            ? 'https://wa.me/' + window.JOINHA_WHATSAPP : '',
        instagram: window.JOINHA_INSTAGRAM_URL,
        facebook: window.JOINHA_FACEBOOK_URL
    };
    document.querySelectorAll('[data-site-link]').forEach(function (link) {
        var key = link.getAttribute('data-site-link');
        var url = urls[key] || '';
        if (url && /^https:\/\//i.test(url)) {
            link.href = url;
            link.hidden = false;
            link.style.display = '';
        } else {
            link.hidden = true;
            link.style.display = 'none';
        }
    });
    document.querySelectorAll('p[data-site-socials]').forEach(function (group) {
        var links = Array.from(group.querySelectorAll('a[data-site-link]'));
        group.style.display = links.some(function (link) { return !link.hidden; }) ? '' : 'none';
        group.querySelectorAll('[data-site-separator]').forEach(function (sep, index) {
            sep.hidden = !(links[index] && links[index + 1] && !links[index].hidden && !links[index + 1].hidden);
            sep.style.display = sep.hidden ? 'none' : '';
        });
    });
    var privacyContact = window.JOINHA_EMAIL || (window.JOINHA_PHONE ? 'Telefone: ' + window.JOINHA_PHONE : (window.JOINHA_WHATSAPP ? 'WhatsApp: +' + window.JOINHA_WHATSAPP : ''));
    var legalParts = [window.JOINHA_LEGAL_NAME, window.JOINHA_CNPJ ? 'CNPJ ' + window.JOINHA_CNPJ : ''].filter(Boolean);
    var contacts = { address: window.JOINHA_ADDRESS, cnpj: window.JOINHA_CNPJ ? 'CNPJ: ' + window.JOINHA_CNPJ : '', phone: window.JOINHA_PHONE ? 'Telefone: ' + window.JOINHA_PHONE : '', email: window.JOINHA_EMAIL ? 'E-mail: ' + window.JOINHA_EMAIL : '', hours: window.JOINHA_HOURS, legal: legalParts.length ? 'Identificação empresarial: ' + legalParts.join(' · ') + '.' : '', privacy: privacyContact ? 'Contato para assuntos de privacidade: ' + privacyContact + '.' : '' };
    document.querySelectorAll('[data-site-contact]').forEach(function (item) {
        var value = contacts[item.getAttribute('data-site-contact')] || '';
        if (value.trim()) { item.textContent = value; item.hidden = false; item.style.display = ''; }
        else { item.hidden = true; item.style.display = 'none'; }
    });
})();
