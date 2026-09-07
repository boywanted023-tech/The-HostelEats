(function () {
  'use strict';

  let chart;

  async function loadEarnings() {
    const days = parseInt(document.getElementById('periodSelect').value, 10) || 30;
    try {
      const res = await window.Api.vendor.earnings({ days });
      const s = res.stats;
      document.getElementById('totalRevenue').textContent = window.Helpers.formatCurrency(s.totalRevenue);
      document.getElementById('totalOrders').textContent = s.totalOrders;
      document.getElementById('totalCommission').textContent = window.Helpers.formatCurrency(s.commission);
      document.getElementById('netEarnings').textContent = window.Helpers.formatCurrency(s.netEarnings);
      renderChart(s.totalRevenue, s.totalOrders);
    } catch (err) {
      window.Helpers.toast(err.message, 'error');
    }
  }

  function renderChart(revenue, orders) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (chart) chart.destroy();

    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
      data.push(Math.floor(Math.random() * Math.max(50, revenue / 14)));
    }

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data,
          borderColor: '#3498DB',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await window.Auth.ready();
    if (!window.Auth.user) return;
    loadEarnings();
    document.getElementById('periodSelect').addEventListener('change', loadEarnings);
  });
})();