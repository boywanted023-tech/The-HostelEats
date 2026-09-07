(function () {
  'use strict';

  const Auth = {
    user: null,
    _readyPromise: null,
    _resolveReady: null,

    init() {
      this._readyPromise = new Promise((resolve) => { this._resolveReady = resolve; });
      this._bootstrap();
      return this._readyPromise;
    },

    async _bootstrap() {
      try {
        const res = await window.Api.auth.me();
        this.user = res.user;
        window.dispatchEvent(new CustomEvent('auth:ready', { detail: this.user }));
      } catch (err) {
        this.user = null;
        window.dispatchEvent(new CustomEvent('auth:missing'));
      } finally {
        if (this._resolveReady) this._resolveReady(this.user);
      }
    },

    ready() { return this._readyPromise || this.init(); },

    async login(email, password) {
      const res = await window.Api.auth.login({ email, password });
      if (res.requiresTwoFactor) {
        sessionStorage.setItem('pending2FA', res.userId);
        window.location.href = '/profile.html?2fa=1';
        return res;
      }
      this.user = res.user;
      window.location.href = '/';
      return res;
    },

    async register(data) {
      const res = await window.Api.auth.register(data);
      this.user = res.user;
      window.location.href = '/';
      return res;
    },

    async logout() {
      try { await window.Api.auth.logout(); } catch {}
      this.user = null;
      window.location.href = '/';
    },

    isLoggedIn() { return !!this.user; },
    isCustomer() { return this.user?.role === 'customer'; },
    requireAuth() {
      if (!this.user) { window.location.href = '/profile.html'; throw new Error('Not authenticated'); }
      return this.user;
    }
  };

  window.Auth = Auth;
  Auth.init();
})();