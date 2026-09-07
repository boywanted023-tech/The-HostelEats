(function () {
  'use strict';

  let currentOrder = null;

  const STATUS_FLOW = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Picked', 'Delivered'];

  async function loadOrder() {
    const id = window.Helpers.getQueryParam('id');
    if (!id) return;
    try {
      const res = await window.Api.customer.order(id);
      currentOrder = res.order;
      renderOrder(res.order);
      setupLiveUpdates(id);
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  function renderOrder(order) {
    document.getElementById('orderIdCard').innerHTML = `
      <h2>${order.orderId}</h2>
      <span class="status-pill status-${order.status}">${order.status}</span>
    `;

    const idx = STATUS_FLOW.indexOf(order.status);
    const pct = idx >= 0 ? ((idx + 1) / STATUS_FLOW.length) * 100 : 0;
    document.getElementById('progressFill').style.width = pct + '%';

    document.getElementById('statusSteps').innerHTML = STATUS_FLOW.map((s, i) => `
      <div class="status-step ${i <= idx ? 'done' : ''}">
        <div class="step-dot">${i <= idx ? '✓' : ''}</div>
        <span>${s}</span>
      </div>
    `).join('');

    document.getElementById('orderItems').innerHTML = order.items.map(i => `
      <div class="cart-item">
        <div class="cart-item-name">${window.Helpers.escape(i.name)} × ${i.quantity}</div>
        <div>${window.Helpers.formatCurrency(i.total)}</div>
      </div>
    `).join('') + `
      <div class="totals">
        <div class="total-row grand"><span>Total</span><span>${window.Helpers.formatCurrency(order.totalAmount)}</span></div>
      </div>
    `;

    const a = order.deliveryAddress;
    document.getElementById('deliveryAddress').innerHTML = `
      <strong>Block ${a.block}, Floor ${a.floor}</strong><br>
      Room ${a.roomNumber}${a.landmark ? ' • ' + window.Helpers.escape(a.landmark) : ''}
    `;

    document.getElementById('liveStatus').textContent = `Order is ${order.status}`;
  }

  function setupLiveUpdates(orderId) {
    window.SocketClient.connect();
    window.SocketClient.joinOrder(orderId);

    ['orderConfirmed', 'orderPreparing', 'orderReady', 'orderPicked', 'orderDelivered', 'orderCancelled'].forEach(evt => {
      window.SocketClient.on(evt, (data) => {
        if (data?.order?._id === orderId) {
          window.Helpers.toast(`Order ${evt.replace('order', '')}`, 'success');
          loadOrder();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    loadOrder();
  });
})();