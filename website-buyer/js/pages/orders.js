(function () {
  'use strict';

  async function loadOrders() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    try {
      const res = await window.Api.customer.orders();
      const orders = res.orders || [];
      if (!orders.length) {
        list.innerHTML = '<p style="text-align:center;padding:40px;color:#999">No orders yet</p>';
        return;
      }
      list.innerHTML = orders.map(o => `
        <div class="order-card" onclick="window.location.href='/tracking.html?id=${o._id}'">
          <div class="order-card-head">
            <div>
              <div class="order-id">${o.orderId}</div>
              <div class="order-date">${window.Helpers.formatDateTime(o.createdAt)}</div>
            </div>
            <span class="status-pill status-${o.status}">${o.status}</span>
          </div>
          <div class="order-vendor">${window.Helpers.escape(o.vendorId?.shopName || 'Vendor')}</div>
          <div style="font-size:13px;color:#666">${o.items.length} item${o.items.length !== 1 ? 's' : ''} • ${window.Helpers.formatCurrency(o.totalAmount)}</div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p style="text-align:center;padding:20px;color:#c00">${err.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) { window.location.href = '/profile.html?login=1'; return; }
    loadOrders();
  });
})();