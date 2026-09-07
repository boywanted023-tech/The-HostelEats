(function () {
  'use strict';

  const state = { vendors: [], category: null, search: '' };

  const CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Dinner', 'Beverages'];

  async function loadCategories() {
    const wrap = document.getElementById('categoryPills');
    if (!wrap) return;
    wrap.innerHTML = '<div class="pill active" data-cat="">All</div>' +
      CATEGORIES.map(c => `<div class="pill" data-cat="${c}">${c}</div>`).join('');
    wrap.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      wrap.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.category = pill.dataset.cat || null;
      loadVendors();
    });
  }

  async function loadVendors() {
    const list = document.getElementById('vendorsList');
    if (!list) return;
    list.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    try {
      const params = {};
      if (state.search) params.search = state.search;
      if (state.category) params.category = state.category;
      const res = await window.Api.customer.vendors(params);
      state.vendors = res.vendors || [];
      renderVendors();
    } catch (err) {
      list.innerHTML = `<p style="text-align:center;padding:20px;color:#999">${err.message}</p>`;
    }
  }

  function renderVendors() {
    const list = document.getElementById('vendorsList');
    if (!state.vendors.length) {
      list.innerHTML = '<p style="text-align:center;padding:20px;color:#999">No vendors found.</p>';
      return;
    }
    list.innerHTML = state.vendors.map(v => `
      <div class="vendor-card" onclick="window.location.href='/menu.html?vendor=${v._id}'">
        <div class="vendor-img">${v.shopImage ? `<img src="${v.shopImage}" alt="${window.Helpers.escape(v.shopName)}" style="width:100%;height:100%;object-fit:cover">` : '🍽️'}</div>
        <div class="vendor-info-pad">
          <div class="vendor-name">${window.Helpers.escape(v.shopName)}</div>
          <div class="vendor-desc">${window.Helpers.escape(v.description)}</div>
          <div class="vendor-meta">
            <span class="vendor-rating">★ ${(v.rating || 0).toFixed(1)}</span>
            <span class="vendor-status">Block ${v.hostelBlock} • ${v.openingTime}-${v.closingTime}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadVendors();
    const search = document.getElementById('searchInput');
    if (search) {
      search.addEventListener('input', window.Helpers.debounce((e) => {
        state.search = e.target.value.trim();
        loadVendors();
      }, 400));
    }
  });
})();