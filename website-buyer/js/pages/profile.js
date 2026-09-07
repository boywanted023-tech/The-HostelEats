(function () {
  'use strict';

  function renderProfile() {
    const u = window.Auth.user;
    if (!u) {
      if (window.Helpers.getQueryParam('2fa')) {
        render2FAPrompt();
      } else if (window.Helpers.getQueryParam('register')) {
        renderRegisterForm();
      } else {
        renderLoginForm();
      }
      return;
    }
    document.getElementById('profileCard').innerHTML = `
      <div class="profile-avatar">${(u.name || '?').charAt(0).toUpperCase()}</div>
      <div class="profile-name">${window.Helpers.escape(u.name)}</div>
      <div class="profile-email">${window.Helpers.escape(u.email)}</div>
    `;
    document.getElementById('nameInput').value = u.name || '';
    document.getElementById('phoneInput').value = u.phone || '';
  }

  function renderLoginForm() {
    document.querySelector('main').innerHTML = `
      <section class="card">
        <h3>Login</h3>
        <form id="loginForm">
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" required /></label>
        </form>
        <button class="btn btn-primary btn-block" id="loginBtn">Login</button>
        <p style="text-align:center;margin-top:12px"><a href="#" id="toRegister">Create account</a></p>
      </section>
    `;
    document.getElementById('loginBtn').addEventListener('click', async () => {
      const fd = new FormData(document.getElementById('loginForm'));
      try {
        await window.Auth.login(fd.get('email'), fd.get('password'));
      } catch (err) { window.Helpers.toast(err.message, 'error'); }
    });
    document.getElementById('toRegister').addEventListener('click', (e) => {
      e.preventDefault(); renderRegisterForm();
    });
  }

  function renderRegisterForm() {
    document.querySelector('main').innerHTML = `
      <section class="card">
        <h3>Register</h3>
        <form id="registerForm">
          <label>Name<input name="name" type="text" required minlength="2" /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Phone<input name="phone" type="tel" pattern="[0-9]{10}" required /></label>
          <label>Password<input name="password" type="password" required minlength="6" /></label>
        </form>
        <button class="btn btn-primary btn-block" id="registerBtn">Create Account</button>
        <p style="text-align:center;margin-top:12px"><a href="#" id="toLogin">Have an account?</a></p>
      </section>
    `;
    document.getElementById('registerBtn').addEventListener('click', async () => {
      const fd = new FormData(document.getElementById('registerForm'));
      const data = Object.fromEntries(fd.entries());
      if (data.password.length < 6) { window.Helpers.toast('Password too short', 'error'); return; }
      try {
        await window.Auth.register(data);
      } catch (err) { window.Helpers.toast(err.message, 'error'); }
    });
    document.getElementById('toLogin').addEventListener('click', (e) => {
      e.preventDefault(); renderLoginForm();
    });
  }

  function render2FAPrompt() {
    document.querySelector('main').innerHTML = `
      <section class="card">
        <h3>Two-Factor Authentication</h3>
        <form id="twofaForm">
          <label>6-digit code<input name="token" pattern="[0-9]{6}" required /></label>
        </form>
        <button class="btn btn-primary btn-block" id="verifyBtn">Verify</button>
      </section>
    `;
    document.getElementById('verifyBtn').addEventListener('click', async () => {
      const fd = new FormData(document.getElementById('twofaForm'));
      const userId = sessionStorage.getItem('pending2FA');
      try {
        const res = await window.Api.auth.verify2FA({ userId, token: fd.get('token') });
        window.Auth.user = res.user;
        sessionStorage.removeItem('pending2FA');
        window.location.href = '/';
      } catch (err) { window.Helpers.toast(err.message, 'error'); }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    renderProfile();

    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const fd = new FormData(document.getElementById('profileForm'));
      try {
        await window.Api.auth.updateProfile({ name: fd.get('name'), phone: fd.get('phone') });
        window.Helpers.toast('Profile updated', 'success');
        window.Auth.user = (await window.Api.auth.me()).user;
        renderProfile();
      } catch (err) { window.Helpers.toast(err.message, 'error'); }
    });

    const passBtn = document.getElementById('changePassBtn');
    if (passBtn) passBtn.addEventListener('click', async () => {
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

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      if (!confirm('Logout?')) return;
      await window.Auth.logout();
    });
  });
})();