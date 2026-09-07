(function () {
  'use strict';

  let currentFilter = {};

  async function loadOrders() {
    try {
      const res = await window.Api.vendor.orders(currentFilter);
      const orders = res.orders || [];
      const wrap = document.getElementById('ordersContainer');
      if (!orders.length) {
        wrap.innerHTML = '<p style="text-align:center;padding:40px;color:#999">No orders</p>';
        return;
      }
      wrap.innerHTML = orders.map(o => `
        <div class="order-card">
          <div class="order-card-head">
            <div>
              <div class="order-id">${o.orderId}</div>
              <div style="font-size:12px;color:#7F8C8D">${window.Helpers.formatDateTime(o.createdAt)}</div>
            </div>
            <span class="status-pill status-${o.status}">${o.status}</span>
          </div>
          <div style="font-size:13px;margin-top:6px">
            ${o.items.length} items • ${window.Helpers.formatCurrency(o.totalAmount)}
          </div>
          <div style="font-size:12px;color:#7F8C8D;margin-top:4px">
            Block ${o.deliveryAddress.block}, Floor ${o.deliveryAddress.floor}, Room ${o.deliveryAddress.roomNumber}
          </div>
          <div class="order-actions">${getActionButtons(o)}</div>
        </div>
      `).join('');
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  function getActionButtons(order) {
    const transitions = {
      Pending:   [{ status: 'Confirmed', label: 'Confirm', cls: 'edit' }, { status: 'Cancelled', label: 'Cancel', cls: 'delete' }],
      Confirmed: [{ status: 'Preparing', label: 'Start Preparing', cls: 'edit' }, { status: 'Cancelled', label: 'Cancel', cls: 'delete' }],
      Preparing: [{ status: 'Ready', label: 'Mark Ready', cls: 'edit' }],
      Ready:     [{ status: 'Picked', label: 'Picked Up', cls: 'edit' }],
      Picked:    [{ status: 'Delivered', label: 'Delivered', cls: 'edit' }],
      Delivered: [],
      Cancelled: []
    };
    const btns = transitions[order.status] || [];
    return btns.map(b => `<button class="action-btn ${b.cls}" onclick="window.changeStatus('${order._id}','${b.status}')">${b.label}</button>`).join('');
  }

  window.changeStatus = async (id, status) => {
    if (status === 'Cancelled' && !confirm('Cancel this order?')) return;
    try {
      await window.Api.vendor.updateOrderStatus(id, { status });
      window.Helpers.toast('Status updated', 'success');
      loadOrders();
    } catch (err) { window.Helpers.toast(err.message, 'error'); }
  };

  function setupSocket() {
    if (!window.Auth?.user) return;
    window.SocketClient.connect();
    window.SocketClient.on('newOrder', () => {
      window.Helpers.playAlert();
      window.Helpers.toast('🔔 New order!', 'success');
      loadOrders();
    });
    ['orderCancelled', 'orderConfirmed'].forEach(evt => {
      window.SocketClient.on(evt, () => loadOrders());
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) return;
    loadOrders();
    setupSocket();
    document.getElementById('statusFilter').addEventListener('change', (e) => {
      currentFilter.status = e.target.value || undefined;
      loadOrders();
    });
    document.getElementById('dateFilter').addEventListener('change', (e) => {
      const d = e.target.value;
      currentFilter.from = d || undefined;
      loadOrders();
    });
  });
})();