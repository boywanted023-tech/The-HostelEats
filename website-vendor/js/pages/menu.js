(function () {
  'use strict';

  let allItems = [];
  let editingId = null;

  async function loadItems() {
    try {
      const res = await window.Api.vendor.menu();
      allItems = res.items || [];
      renderTable();
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  function renderTable() {
    const search = (document.getElementById('searchInput').value || '').toLowerCase();
    const cat = document.getElementById('categoryFilter').value;
    const filtered = allItems.filter(i =>
      (!search || i.name.toLowerCase().includes(search)) &&
      (!cat || i.category === cat)
    );
    const tbody = document.getElementById('menuTableBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">No items</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td><strong>${window.Helpers.escape(item.name)}</strong><br><small style="color:#7F8C8D">${window.Helpers.escape(item.description || '')}</small></td>
        <td>${item.category}</td>
        <td>${window.Helpers.formatCurrency(item.price)}</td>
        <td>${item.preparationTime}m</td>
        <td><span style="color:${item.isVeg ? '#27AE60' : '#E74C3C'}">${item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</span></td>
        <td><span class="status-pill status-${item.isAvailable ? 'Delivered' : 'Cancelled'}">${item.isAvailable ? 'Available' : 'Off'}</span></td>
        <td>
          <button class="action-btn edit" onclick="window.editItem('${item._id}')">Edit</button>
          <button class="action-btn delete" onclick="window.deleteItem('${item._id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  function showModal(item = null) {
    editingId = item?._id || null;
    document.getElementById('modalTitle').textContent = item ? 'Edit Item' : 'Add Item';
    const form = document.getElementById('itemForm');
    form.reset();
    if (item) {
      form._id.value = item._id;
      form.name.value = item.name;
      form.description.value = item.description || '';
      form.price.value = item.price;
      form.preparationTime.value = item.preparationTime;
      form.category.value = item.category;
      form.isVeg.checked = !!item.isVeg;
      form.spiceLevel.value = item.spiceLevel || 'Mild';
      form.isAvailable.checked = !!item.isAvailable;
    } else {
      form._id.value = '';
      form.isVeg.checked = true;
      form.spiceLevel.value = 'Mild';
      form.isAvailable.checked = true;
    }
    document.getElementById('itemModal').classList.remove('hidden');
  }

  function hideModal() {
    document.getElementById('itemModal').classList.add('hidden');
    editingId = null;
  }

  async function saveItem() {
    const form = document.getElementById('itemForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      price: parseFloat(form.price.value),
      preparationTime: parseInt(form.preparationTime.value, 10),
      category: form.category.value,
      isVeg: form.isVeg.checked,
      spiceLevel: form.spiceLevel.value,
      isAvailable: form.isAvailable.checked
    };
    try {
      if (editingId) {
        await window.Api.vendor.updateItem(editingId, data);
        window.Helpers.toast('Item updated', 'success');
      } else {
        await window.Api.vendor.addItem(data);
        window.Helpers.toast('Item added', 'success');
      }
      hideModal();
      loadItems();
    } catch (err) { window.Helpers.toast(err.message, 'error'); }
  }

  window.editItem = (id) => {
    const item = allItems.find(i => i._id === id);
    if (item) showModal(item);
  };
  window.deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      await window.Api.vendor.deleteItem(id);
      window.Helpers.toast('Deleted', 'success');
      loadItems();
    } catch (err) { window.Helpers.toast(err.message, 'error'); }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) return;
    loadItems();
    document.getElementById('addItemBtn').addEventListener('click', () => showModal());
    document.getElementById('modalClose').addEventListener('click', hideModal);
    document.getElementById('cancelBtn').addEventListener('click', hideModal);
    document.getElementById('saveBtn').addEventListener('click', saveItem);
    document.getElementById('searchInput').addEventListener('input', window.Helpers.debounce(renderTable, 200));
    document.getElementById('categoryFilter').addEventListener('change', renderTable);
  });
})();