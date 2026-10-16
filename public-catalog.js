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

  function money(v) {
    var n = Number(v);
    return isFinite(n) ? '$' + n.toFixed(2) : String(v);
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
      if (!o) continue;
      if (o.hidden) { var w = wrapperOf(card); if (w && w.parentNode) w.parentNode.removeChild(w); continue; }
      if (o.name) { var t = card.querySelector('.card-title'); if (t) t.textContent = o.name; }
      if (o.price != null && o.price !== '') {
        var p = card.querySelector('.s90-product-price');
        if (p) p.textContent = 'Price: ' + money(o.price);
      }
      if (o.image) { var im = card.querySelector('img'); if (im) { im.setAttribute('src', o.image); im.removeAttribute('srcset'); } }
      if (o.category) card.setAttribute('data-category', o.category);
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
    body.appendChild(el('p', 'card-text fw-bold s90-product-price', 'Price: ' + money(prod.price)));
    card.appendChild(img);
    card.appendChild(body);
    col.appendChild(card);
    container.appendChild(col);
  });
})();
