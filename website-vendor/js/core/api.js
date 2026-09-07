(function () {
  'use strict';

  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : '/api';

  const Api = {
    BASE: API_BASE,

    async request(path, options = {}) {
      const method = (options.method || 'GET').toUpperCase();
      const headers = {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': window.Security.deviceFingerprint,
        ...options.headers
      };
      const csrf = window.Security.getCsrfToken();
      if (csrf && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrf;

      const config = { method, headers, credentials: 'include' };
      if (options.body && method !== 'GET') {
        config.body = JSON.stringify(window.Security.sanitizeObject(options.body));
      }

      try {
        const res = await fetch(this.BASE + path, config);
        if (res.status === 401) {
          const refreshed = await this.tryRefresh();
          if (refreshed) {
            const retry = await fetch(this.BASE + path, { ...config, headers: { ...headers, 'X-Retry': '1' } });
            return await this.handleResponse(retry);
          }
          window.Auth.logout();
          throw new Error('Session expired');
        }
        return await this.handleResponse(res);
      } catch (err) {
        if (!navigator.onLine) throw new Error('No internet connection');
        throw err;
      }
    },

    async handleResponse(res) {
      let data;
      try { data = await res.json(); } catch { throw new Error('Invalid server response'); }
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Request failed');
      }
      if (data.data !== undefined) return data.data;
      const { success, message, ...rest } = data;
      return rest;
    },

    async tryRefresh() {
      try {
        const res = await fetch(this.BASE + '/auth/refresh', { method: 'POST', credentials: 'include' });
        return res.ok;
      } catch { return false; }
    },

    get(path) { return this.request(path); },
    post(path, body) { return this.request(path, { method: 'POST', body }); },
    put(path, body) { return this.request(path, { method: 'PUT', body }); },
    delete(path) { return this.request(path, { method: 'DELETE' }); },

    auth: {
      login: (data) => Api.post('/auth/login', data),
      logout: () => Api.post('/auth/logout', {}),
      me: () => Api.get('/auth/me'),
      updateProfile: (data) => Api.put('/auth/me', data)
    },
    vendor: {
      profile: () => Api.get('/vendor/profile'),
      updateProfile: (data) => Api.put('/vendor/profile', data),
      toggleOpen: () => Api.put('/vendor/toggle-open', {}),
      menu: () => Api.get('/vendor/menu'),
      addItem: (data) => Api.post('/vendor/menu', data),
      updateItem: (id, data) => Api.put('/vendor/menu/' + id, data),
      deleteItem: (id) => Api.delete('/vendor/menu/' + id),
      orders: (params) => Api.get('/vendor/orders' + (params ? '?' + new URLSearchParams(params) : '')),
      updateOrderStatus: (id, data) => Api.put('/vendor/orders/' + id + '/status', data),
      dashboard: () => Api.get('/vendor/dashboard'),
      earnings: (params) => Api.get('/vendor/earnings' + (params ? '?' + new URLSearchParams(params) : ''))
    }
  };

  window.Api = Api;
})();