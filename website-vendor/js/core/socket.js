(function () {
  'use strict';

  const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

  const Socket = {
    socket: null,
    connected: false,
    listeners: new Map(),

    connect(token) {
      if (this.socket && this.connected) return;
      if (typeof io === 'undefined') {
        this.socket = {
          on: (event, cb) => {
            if (!this.listeners.has(event)) this.listeners.set(event, new Set());
            this.listeners.get(event).add(cb);
          },
          emit: () => {}
        };
        setTimeout(() => this.emit('connected'), 100);
        this.connected = true;
        return;
      }
      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true
      });

      this.socket.on('connect', () => { this.connected = true; this.emit('connected'); });
      this.socket.on('disconnect', () => { this.connected = false; this.emit('disconnected'); });

      ['newOrder', 'orderConfirmed', 'orderPreparing', 'orderReady', 'orderPicked', 'orderDelivered', 'orderCancelled'].forEach(evt => {
        this.socket.on(evt, (data) => this.emit(evt, data));
      });
    },

    on(event, callback) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event).add(callback);
    },

    emit(event, data) {
      const set = this.listeners.get(event);
      if (set) set.forEach(cb => cb(data));
    },

    disconnect() {
      if (this.socket && this.socket.disconnect) this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  };

  window.SocketClient = Socket;
})();