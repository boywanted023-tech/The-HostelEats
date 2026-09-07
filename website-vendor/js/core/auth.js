(function () {
  'use strict';

  const Auth = {
    user: null,
    _readyPromise: null,
    _resolveReady: null,
    _redirected: false,

    init() {
      this._readyPromise = new Promise((resolve) => { this._resolveReady = resolve; });
      this._bootstrap();
      return this._readyPromise;
    },

    async _bootstrap() {
      const isLoginPage = window.location.pathname.includes('login');
      try {
        const res = await window.Api.auth.me();
        this.user = res.user;
        if (!['vendor', 'admin'].includes(this.user.role) && !isLoginPage) {
          this._redirected = true;
          window.location.href = '/login.html';
          return;
        }
        if (isLoginPage) {
          this._redirected = true;
          window.location.href = '/';
          return;
        }
        window.dispatchEvent(new CustomEvent('auth:ready', { detail: this.user }));
      } catch (err) {
        this.user = null;
        if (!isLoginPage) {
          this._redirected = true;
          window.location.href = '/login.html';
        } else {
          window.dispatchEvent(new CustomEvent('auth:missing'));
        }
      } finally {
        if (this._resolveReady) this._resolveReady(this.user);
      }
    },

    ready() { return this._readyPromise || this.init(); },

    async login(email, password) {
      const res = await window.Api.auth.login({ email, password });
      this.user = res.user;
      if (!['vendor', 'admin'].includes(this.user.role)) {
        throw new Error('Vendor account required');
      }
      window.location.href = '/';
      return res;
    },

    async logout() {
      try { await window.Api.auth.logout(); } catch {}
      this.user = null;
      window.location.href = '/login.html';
    }
  };

  window.Auth = Auth;
  Auth.init();
})();