(function () {
  'use strict';

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  const Security = {
    deviceFingerprint: null,

    init() {
      this.deviceFingerprint = this.generateFingerprint();
      sessionStorage.setItem('dfp', this.deviceFingerprint);
      this.startSessionTimeout();
    },

    generateFingerprint() {
      const stored = sessionStorage.getItem('dfp');
      if (stored) { this.deviceFingerprint = stored; return stored; }
      const data = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || ''
      ].join('|');
      let h = 0;
      for (let i = 0; i < data.length; i++) {
        h = ((h << 5) - h) + data.charCodeAt(i);
        h |= 0;
      }
      this.deviceFingerprint = Math.abs(h).toString(16);
      return this.deviceFingerprint;
    },

    sanitize(input) {
      if (typeof input !== 'string') return input;
      return input.replace(/[<>$`]/g, '').trim().slice(0, 1000);
    },

    sanitizeObject(obj) {
      if (Array.isArray(obj)) return obj.map(o => this.sanitizeObject(o));
      if (obj && typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, this.sanitizeObject(v)]));
      }
      if (typeof obj === 'string') return this.sanitize(obj);
      return obj;
    },

    getCsrfToken() {
      const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    },

    startSessionTimeout() {
      let timer;
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          window.dispatchEvent(new CustomEvent('session-timeout'));
          window.Auth.logout();
        }, SESSION_TIMEOUT_MS);
      };
      ['click', 'keypress', 'scroll', 'mousemove'].forEach(evt =>
        document.addEventListener(evt, reset, { passive: true })
      );
      reset();
    }
  };

  window.Security = Security;
  Security.init();
})();