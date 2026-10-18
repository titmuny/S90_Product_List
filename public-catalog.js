/* S90 public catalog loader.
 * Reads catalog.json (written by the local admin dashboard) and applies it to the page BEFORE script.js runs:
 *  - overrides: change / hide existing hard-coded products (matched by exact SKU)
 *  - products : extra products created in the dashboard
 * Loaded with "defer" before script.js, so the DOM is fully parsed and script.js sees the final cards. */
(function () {
  'use strict';
  function loadCatalog() {
    try {
      var xhr = new XMLHttpRequest();
      // Synchronous on purpose: script.js captures the product cards when it starts, so they must exist first.
      xhr.open('GET', 'catalog.json?_=' + Date.now(), false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return JSON.parse(xhr.responseText);
    } catch (e) { /* ignore: site keeps working with its built-in products */ }
    return null;
  }

  var catalog = loadCatalog();
  if (!catalog) return;
  var overrides = catalog.overrides || {};
  var products = Array.isArray(catalog.products) ? catalog.products : [];
  var showPrices = !(catalog.settings && catalog.settings.showPrices === false);

  function telegramContactUrl() {
    return 'https://t.me/S90constructionsupply_1';
  }

  function money(v) {
    var n = Number(v);
    return isFinite(n) ? '$' + n.toFixed(2) : String(v);
  }
  // "5" / "$5" -> "$5.00"; anything else (e.g. "$1x.xx") is shown exactly as typed
  function itemPrice(v) {
    var t = String(v == null ? '' : v).trim().replace(/^=\s*/, '');
    if (/^\$?\d+(\.\d+)?$/.test(t)) return '$' + Number(t.replace('$', '')).toFixed(2);
    return t;
  }
  function buildList(items) {
    var ul = document.createElement('ul');
    ul.className = 'items';
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(it.name + (it.price ? ' ' : '')));
      if (it.price) {
        var b = document.createElement('b');
        b.className = 'multi-price';
        b.textContent = '= ' + itemPrice(it.price);
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    return ul;
  }
  function applyPriceVisibility(card, override) {
    var visible = override && typeof override.showPrice === 'boolean' ? override.showPrice : showPrices;
    var prices = card.querySelectorAll('.s90-product-price, .multi-price');
    for (var i = 0; i < prices.length; i++) {
      var price = prices[i];
      if (price.classList.contains('multi-price')) {
        if (visible) {
          if (price.tagName === 'A' && price.dataset.s90OriginalText) {
            var amount = document.createElement('b');
            amount.className = 'multi-price';
            amount.textContent = price.dataset.s90OriginalText;
            price.parentNode.replaceChild(amount, price);
          } else price.style.display = '';
        } else if (price.tagName !== 'A') {
          var link = document.createElement('a');
          link.className = 'multi-price s90-contact-price';
          link.href = telegramContactUrl();
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = 'Contact Us';
          link.dataset.s90OriginalText = price.textContent;
          price.parentNode.replaceChild(link, price);
        }
      } else if (!visible) {
        if (!price.dataset.s90OriginalText) price.dataset.s90OriginalText = price.textContent;
        price.innerHTML = 'Price: <a class="s90-contact-price" href="' + telegramContactUrl() + '" target="_blank" rel="noopener">Contact Us</a>';
        price.style.display = '';
      } else {
        if (price.dataset.s90OriginalText) price.textContent = price.dataset.s90OriginalText;
        price.style.display = '';
      }
    }
  }
  function wrapperOf(card) {
    return card.closest('[class*="col-"]') || card.parentElement || card;
  }
  function skuOf(card) {
    var nodes = card.querySelectorAll('.card-text');
    for (var i = 0; i < nodes.length; i++) {
      var m = /sku\s*:\s*([^\s|,;]+)/i.exec(nodes[i].textContent);
      if (m) return m[1];
    }
    return '';
  }

  // ---- 1) overrides on hard-coded products ----
  var hasOverrides = Object.keys(overrides).length > 0;
  if (hasOverrides) {
    var all = document.querySelectorAll('.card');
    for (var i = 0; i < all.length; i++) {
      var card = all[i];
      var sku = skuOf(card);
      var o = sku && Object.prototype.hasOwnProperty.call(overrides, sku) ? overrides[sku] : null;
      if (!o) { applyPriceVisibility(card, null); continue; }
      if (o.hidden) { var w = wrapperOf(card); if (w && w.parentNode) w.parentNode.removeChild(w); continue; }
      if (o.name) { var t = card.querySelector('.card-title'); if (t) t.textContent = o.name; }
      if (o.price != null && o.price !== '') {
        var p = card.querySelector('.s90-product-price');
        if (p) p.textContent = 'Price: ' + money(o.price);
      }
      if (Array.isArray(o.items) && o.items.length) {
        var list = buildList(o.items);
        var oldUl = card.querySelector('ul.items');
        var oldPrice = card.querySelector('.s90-product-price');
        if (oldUl) oldUl.parentNode.replaceChild(list, oldUl);
        else if (oldPrice) oldPrice.parentNode.replaceChild(list, oldPrice);
        else { var holder = card.querySelector('.card-body > div') || card.querySelector('.card-body'); if (holder) holder.appendChild(list); }
        var extraPrice = card.querySelector('.s90-product-price'); // old single price no longer shown
        if (extraPrice && extraPrice.parentNode) extraPrice.parentNode.removeChild(extraPrice);
      }
      if (o.image) { var im = card.querySelector('img'); if (im) { im.setAttribute('src', o.image); im.removeAttribute('srcset'); } }
      if (o.category) card.setAttribute('data-category', o.category);
      applyPriceVisibility(card, o);
    }
  }

  // ---- 2) dashboard-created products ----
  var visible = products.filter(function (x) { return x && x.visible !== false && x.sku && x.name; });
  if (!visible.length) return;

  var cards = Array.prototype.filter.call(
    document.querySelectorAll('.card.box:not(.hero-banner-card)'),
    function (c) { return !c.closest('.no-filter'); });
  var last = cards[cards.length - 1];
  var container = last ? wrapperOf(last).parentNode : document.querySelector('.row.g-0');
  if (!container) return;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  visible.forEach(function (prod) {
    var col = el('div', 'col-6 col-sm-6 col-md-4 col-lg-3');
    var card = el('div', 'card h-100 d-flex flex-column box s90-square-card');
    card.setAttribute('data-category', prod.category || '');
    card.setAttribute('data-managed', '1');
    var img = el('img', 'card-img-top s90-product-image');
    img.setAttribute('src', prod.image);
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('alt', prod.name);
    var body = el('div', 'card-body d-flex flex-column');
    var top = el('div');
    top.appendChild(el('h5', 'card-title txt-card', prod.name));
    top.appendChild(el('p', 'card-text', 'SKU: ' + prod.sku));
    body.appendChild(top);
    if (Array.isArray(prod.items) && prod.items.length) top.appendChild(buildList(prod.items));
    else { var price = el('p', 'card-text fw-bold s90-product-price', 'Price: ' + money(prod.price)); body.appendChild(price); }
    card.appendChild(img);
    card.appendChild(body);
    col.appendChild(card);
    applyPriceVisibility(card, null);
    container.appendChild(col);
  });
})();
