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

    formatCurrency(amount) { return '₹' + Number(amount || 0).toFixed(0); },

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

    debounce(fn, delay = 300) {
      let timer;
      return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    },

    escape(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    },

    playAlert() {
      const audio = document.getElementById('alertSound');
      if (audio) { audio.play().catch(() => {}); }
    },

    async fetchCsrf() {
      try {
        const base = window.Api?.BASE || 'http://localhost:5000/api';
        await fetch(base + '/auth/csrf', { credentials: 'include' });
      } catch {}
    },

    initSidebar() {
      const sidebar = document.getElementById('sidebar');
      const toggle = document.getElementById('menuToggle');
      const close = document.getElementById('sidebarClose');
      if (toggle) toggle.addEventListener('click', () => sidebar?.classList.toggle('open'));
      if (close) close.addEventListener('click', () => sidebar?.classList.remove('open'));
      const logoutLink = document.getElementById('logoutLink');
      if (logoutLink) logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Logout?')) window.Auth.logout();
      });
    }
  };

  window.Helpers = Helpers;
  Helpers.fetchCsrf();
  document.addEventListener('DOMContentLoaded', () => Helpers.initSidebar());
})();