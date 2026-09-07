(function () {
  'use strict';

  function renderCart() {
    const cart = window.Cart.get();
    const wrap = document.getElementById('cartItems');
    const totalsWrap = document.getElementById('cartTotals');
    if (!wrap) return;

    if (!cart.items || !cart.items.length) {
      wrap.innerHTML = '<p style="text-align:center;color:#999">Your cart is empty</p>';
      totalsWrap.innerHTML = '';
      const btn = document.getElementById('placeOrderBtn');
      if (btn) btn.disabled = true;
      return;
    }

    wrap.innerHTML = cart.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-name">${window.Helpers.escape(item.name)}<br><small>${window.Helpers.formatCurrency(item.price)} × ${item.quantity}</small></div>
        <div class="cart-item-controls">
          <button onclick="Cart.update('${item.menuItemId}', ${item.quantity - 1})">−</button>
          <span>${item.quantity}</span>
          <button onclick="Cart.update('${item.menuItemId}', ${item.quantity + 1})">+</button>
        </div>
      </div>
    `).join('');

    const subtotal = window.Cart.total();
    const delivery = subtotal >= 200 ? 0 : 20;
    const surge = (new Date().getHours() >= 19 && new Date().getHours() < 21) ? 10 : 0;
    const total = subtotal + delivery + surge;

    totalsWrap.innerHTML = `
      <div class="total-row"><span>Subtotal</span><span>${window.Helpers.formatCurrency(subtotal)}</span></div>
      <div class="total-row"><span>Delivery</span><span>${delivery === 0 ? 'FREE' : window.Helpers.formatCurrency(delivery)}</span></div>
      ${surge ? `<div class="total-row"><span>Surge</span><span>${window.Helpers.formatCurrency(surge)}</span></div>` : ''}
      <div class="total-row grand"><span>Total</span><span>${window.Helpers.formatCurrency(total)}</span></div>
    `;
  }

  async function placeOrder() {
    const cart = window.Cart.get();
    if (!cart.vendorId || !cart.items?.length) {
      window.Helpers.toast('Cart is empty', 'error');
      return;
    }
    const form = document.getElementById('addressForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const formData = new FormData(form);
    const address = {
      block: formData.get('block'),
      floor: formData.get('floor'),
      roomNumber: formData.get('roomNumber'),
      landmark: formData.get('landmark') || ''
    };
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const specialInstructions = document.getElementById('specialInstructions').value.trim();

    const payload = {
      vendorId: cart.vendorId,
      items: cart.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      deliveryAddress: address,
      paymentMethod,
      specialInstructions
    };

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Placing...';

    try {
      const res = await window.Api.customer.placeOrder(payload);
      window.Cart.clear();
      window.Helpers.toast('Order placed!', 'success');
      setTimeout(() => window.location.href = '/tracking.html?id=' + res.order._id, 500);
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) {
      window.location.href = '/profile.html?login=1';
      return;
    }
    renderCart();
    const btn = document.getElementById('placeOrderBtn');
    if (btn) btn.addEventListener('click', placeOrder);
  });
})();