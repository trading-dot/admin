/* Jembatan antara shell admin (index.html di root) dan tiap panel yang dibuka di dalam iframe.
   - Halaman panel yang dibuka langsung (tanpa shell) dialihkan ke shell.
   - Menandai <html class="embedded app-..."> supaya CSS tema embed bisa menyembunyikan navigasi bawaan.
   - Mengganti sub tab saat shell mengirim pesan, atau dari hash saat pertama kali dimuat. */
(function () {
  var s = document.currentScript;
  var app = s && s.getAttribute('data-app');
  if (!app) return;

  if (window.top === window) {               // dibuka langsung, bukan lewat shell
    location.replace('index.html#' + app);
    return;
  }
  document.documentElement.classList.add('embedded', 'app-' + app);

  var A = {
    web: {
      go: function (t) { window.switchTab(t); },
      ok: function (t) { var e = document.getElementById('tab-' + t); return !!e && e.classList.contains('active'); }
    },
    jurnal: {
      go: function (t) { var b = document.querySelector('[data-tab="' + t + '"]'); if (b) b.click(); },
      ok: function (t) { var b = document.querySelector('[data-tab="' + t + '"]'); return !!b && b.getAttribute('aria-selected') === 'true'; }
    },
    kota: {
      go: function (t) { if (window.kotaTab) window.kotaTab(t); },
      ok: function (t) { return window.__kotaTab === t; }
    },
    keuangan: {
      go: function (t) { if (location.hash.slice(1) !== t) location.hash = '#' + t; else { var b = document.querySelector('#side [data-nav="' + t + '"]'); if (b) b.click(); } },
      ok: function (t) { var v = document.getElementById('v-' + t); return !!v && !v.classList.contains('hide'); }
    }
  }[app];
  if (!A) return;

  var want = null, timer = null;
  function apply(t) {
    want = t;
    clearInterval(timer);
    var n = 0;
    timer = setInterval(function () {
      n++;
      try { if (A.ok(want)) { clearInterval(timer); return; } A.go(want); } catch (e) { /* belum siap, coba lagi */ }
      if (n > 100) clearInterval(timer);     // menyerah setelah ± 15 detik
    }, 150);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    var d = e.data;
    if (d && d.fvck === 'tab' && typeof d.tab === 'string') apply(d.tab);
  });

  var h = location.hash.replace(/^#/, '');
  if (h) document.addEventListener('DOMContentLoaded', function () { apply(h); });
})();
