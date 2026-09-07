(function () {
  'use strict';

  const Helpers = {
    toast(message, type = 'info', duration = 3000) {
      const el = document.getElementById('toast');
      if (!el) { console.log('Toast:', message); return; }
      el.textContent = message;
      el.className = 'toast show ' + type;
      setTimeout(() => { el.className = 'toast'; }, duration);
    },

    formatCurrency(amount) {
      return '₹' + Number(amount || 0).toFixed(0);
    },

    formatDate(date) {
      const d = new Date(date);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    formatDateTime(date) {
      const d = new Date(date);
      return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    },

    getQueryParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    },

    redirect(url) { window.location.href = url; },

    debounce(fn, delay = 300) {
      let timer;
      return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    },

    escape(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    },

    render(template, data) {
      return template.replace(/{{(\w+)}}/g, (_, key) => this.escape(data[key]));
    },

    getCart() {
      try { return JSON.parse(localStorage.getItem('cart') || '{}'); }
      catch { return {}; }
    },

    setCart(cart) {
      localStorage.setItem('cart', JSON.stringify(cart));
      this.updateCartBadge();
    },

    updateCartBadge() {
      const badge = document.getElementById('cartBadge');
      if (!badge) return;
      const cart = this.getCart();
      const items = Array.isArray(cart.items) ? cart.items : [];
      const count = items.reduce((s, i) => s + (i.quantity || 0), 0);
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    },

    sessionId() {
      let id = sessionStorage.getItem('sid');
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('sid', id);
      }
      return id;
    },

    async fetchCsrf() {
      try {
        await fetch((window.Api?.BASE || 'http://localhost:5000/api') + '/auth/csrf', { credentials: 'include' });
      } catch {}
    }
  };

  window.Helpers = Helpers;
  Helpers.fetchCsrf();
  document.addEventListener('DOMContentLoaded', () => Helpers.updateCartBadge());
})();