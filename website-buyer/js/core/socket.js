(function () {
  'use strict';

  const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

  const Socket = {
    socket: null,
    connected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    listeners: new Map(),

    connect(token) {
      if (this.socket && this.connected) return;
      if (typeof io === 'undefined') {
        this.connectRaw(token);
        return;
      }
      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        this.emit('disconnected');
      });

      this.socket.on('connect_error', (err) => {
        console.warn('Socket error:', err.message);
        this.reconnectAttempts++;
      });

      ['newOrder', 'orderConfirmed', 'orderPreparing', 'orderReady',
       'orderPicked', 'orderDelivered', 'orderCancelled', 'deliveryAssigned',
       'delivery:location'].forEach(evt => {
        this.socket.on(evt, (data) => this.emit(evt, data));
      });
    },

    connectRaw(token) {
      this.socket = {
        on: (event, cb) => {
          if (!this.listeners.has(event)) this.listeners.set(event, new Set());
          this.listeners.get(event).add(cb);
        },
        emit: (event, data) => {
          const set = this.listeners.get(event);
          if (set) set.forEach(cb => cb(data));
        },
        connected: false
      };
      setTimeout(() => {
        this.socket.connected = true;
        this.emit('connected');
      }, 100);
    },

    emit(event, data) {
      const set = this.listeners.get(event);
      if (set) set.forEach(cb => cb(data));
      if (this.socket && this.socket.emit) this.socket.emit(event, data);
    },

    on(event, callback) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event).add(callback);
    },

    off(event, callback) {
      const set = this.listeners.get(event);
      if (set) set.delete(callback);
    },

    disconnect() {
      if (this.socket && this.socket.disconnect) this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    },

    joinOrder(orderId) {
      if (this.socket && this.socket.emit) this.socket.emit('joinOrder', orderId);
    },

    leaveOrder(orderId) {
      if (this.socket && this.socket.emit) this.socket.emit('leaveOrder', orderId);
    }
  };

  window.SocketClient = Socket;
})();