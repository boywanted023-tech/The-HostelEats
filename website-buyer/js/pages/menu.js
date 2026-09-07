(function () {
  'use strict';

  let currentVendor = null;

  async function loadMenu() {
    const vendorId = window.Helpers.getQueryParam('vendor');
    if (!vendorId) {
      window.Helpers.toast('Missing vendor', 'error');
      return;
    }
    try {
      const res = await window.Api.customer.vendor(vendorId);
      currentVendor = res.vendor;
      renderVendor(res.vendor);
      renderMenu(res.menu);
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  function renderVendor(v) {
    const info = document.getElementById('vendorInfo');
    const name = document.getElementById('vendorName');
    if (name) name.textContent = v.shopName;
    if (info) {
      info.innerHTML = `
        <h2>${window.Helpers.escape(v.shopName)}</h2>
        <p>${window.Helpers.escape(v.description)}</p>
        <div class="vendor-info-meta">
          <span>★ ${(v.rating || 0).toFixed(1)}</span>
          <span>Block ${v.hostelBlock}</span>
          <span>${v.openingTime} - ${v.closingTime}</span>
          <span>${v.isOpen ? '🟢 Open' : '🔴 Closed'}</span>
        </div>
      `;
    }
  }

  function renderMenu(items) {
    const list = document.getElementById('menuList');
    if (!items.length) {
      list.innerHTML = '<p style="text-align:center;color:#999">No items available</p>';
      return;
    }
    const grouped = items.reduce((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {});
    list.innerHTML = Object.entries(grouped).map(([cat, items]) => `
      <div class="menu-category">
        <h3>${cat}</h3>
        ${items.map(item => `
          <div class="menu-item">
            <div class="menu-item-info">
              <div class="menu-item-name">
                <span class="veg-mark ${item.isVeg ? 'veg' : 'nonveg'}">${item.isVeg ? '●' : '●'}</span>
                ${window.Helpers.escape(item.name)}
              </div>
              <div class="menu-item-desc">${window.Helpers.escape(item.description || '')}</div>
              <div class="menu-item-price">${window.Helpers.formatCurrency(item.price)}</div>
            </div>
            <div class="item-action" id="action-${item._id}"></div>
          </div>
        `).join('')}
      </div>
    `).join('');
    items.forEach(item => {
      const wrap = document.getElementById('action-' + item._id);
      wrap.innerHTML = `
        <button class="add-btn" data-id="${item._id}" data-name="${window.Helpers.escape(item.name)}" data-price="${item.price}">
          + Add
        </button>
      `;
      wrap.querySelector('button').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const id = btn.dataset.id;
        window.Cart.add(currentVendor._id, { _id: id, name: btn.dataset.name, price: parseFloat(btn.dataset.price) });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', loadMenu);
})();