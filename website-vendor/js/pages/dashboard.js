(function () {
  'use strict';

  async function loadDashboard() {
    try {
      const res = await window.Api.vendor.dashboard();
      const counts = res.counts;
      const stats = res.stats;

      document.getElementById('statPending').textContent = counts.pending;
      document.getElementById('statActive').textContent = counts.confirmed + counts.preparing + counts.ready;
      document.getElementById('statDelivered').textContent = counts.delivered;
      document.getElementById('statRevenue').textContent = window.Helpers.formatCurrency(stats.totalRevenue);

      const recent = res.recent || [];
      const wrap = document.getElementById('recentOrders');
      if (!recent.length) {
        wrap.innerHTML = '<p style="text-align:center;color:#999">No orders yet</p>';
        return;
      }
      wrap.innerHTML = recent.map(o => `
        <div class="order-card">
          <div class="order-card-head">
            <div>
              <div class="order-id">${o.orderId}</div>
              <div style="font-size:12px;color:#7F8C8D">${window.Helpers.formatDateTime(o.createdAt)}</div>
            </div>
            <span class="status-pill status-${o.status}">${o.status}</span>
          </div>
          <div style="font-size:13px">${window.Helpers.formatCurrency(o.totalAmount)} • ${o.items.length} items</div>
        </div>
      `).join('');
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  async function loadProfile() {
    try {
      const res = await window.Api.vendor.profile();
      const toggle = document.getElementById('shopOpenToggle');
      if (toggle) {
        toggle.checked = !!res.vendor.isOpen;
        toggle.addEventListener('change', async () => {
          try {
            await window.Api.vendor.toggleOpen();
            window.Helpers.toast('Shop status updated', 'success');
          } catch (err) { window.Helpers.toast(err.message, 'error'); toggle.checked = !toggle.checked; }
        });
      }
    } catch (err) { window.Helpers.toast(err.message, 'error'); }
  }

  function setupSocket() {
    if (!window.Auth?.user) return;
    window.SocketClient.connect();
    window.SocketClient.on('newOrder', () => {
      window.Helpers.playAlert();
      window.Helpers.toast('🔔 New order received!', 'success', 5000);
      loadDashboard();
    });
    window.SocketClient.on('orderCancelled', () => loadDashboard());
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) return;
    loadDashboard();
    loadProfile();
    setupSocket();
  });
})();