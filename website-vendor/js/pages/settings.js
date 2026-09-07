(function () {
  'use strict';

  async function loadProfile() {
    try {
      const res = await window.Api.vendor.profile();
      const v = res.vendor;
      const form = document.getElementById('shopForm');
      form.shopName.value = v.shopName;
      form.description.value = v.description;
      form.hostelBlock.value = v.hostelBlock;
      form.openingTime.value = v.openingTime;
      form.closingTime.value = v.closingTime;

      document.getElementById('accountInfo').innerHTML = `
        <div class="account-info">
          <p><span class="label">Email:</span> ${window.Helpers.escape(window.Auth.user.email)}</p>
          <p><span class="label">Phone:</span> ${window.Helpers.escape(window.Auth.user.phone || '-')}</p>
          <p><span class="label">Approved:</span> ${v.isApproved ? 'Yes' : 'Pending'}</p>
        </div>
      `;
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) return;
    loadProfile();

    document.getElementById('saveShopBtn').addEventListener('click', async () => {
      const form = document.getElementById('shopForm');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      try {
        await window.Api.vendor.updateProfile(data);
        window.Helpers.toast('Saved', 'success');
      } catch (err) { window.Helpers.toast(err.message, 'error'); }
    });

    document.getElementById('changePassBtn').addEventListener('click', async () => {
      const fd = new FormData(document.getElementById('passwordForm'));
      try {
        await window.Api.put('/auth/change-password', {
          currentPassword: fd.get('currentPassword'),
          newPassword: fd.get('newPassword')
        });
        window.Helpers.toast('Password changed. Please login again.', 'success');
        document.getElementById('passwordForm').reset();
        setTimeout(() => window.Auth.logout(), 1000);
      } catch (err) { window.Helpers.toast(err.message, 'error'); }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Logout?')) window.Auth.logout();
    });
  });
})();