// ============================================================
// MENU BERKELOMPOK: grup Pasien / Laporan / Pengaturan bisa dilipat; Koreksi DP menjadi tab di Pasien Booking.
// Grup otomatis tersembunyi bila semua isinya tersembunyi (menurut peran), dan terbuka otomatis bila berisi menu yang aktif.
// ============================================================
(function () {
  'use strict';
  const grup = () => [].slice.call(document.querySelectorAll('.ng'));
  const anak = g => [].slice.call(g.querySelectorAll('.nsub > .nav'));
  const tampil = b => !b.classList.contains('hide');
  const buka = (g, v) => { g.classList.toggle('closed', !v); g.querySelector('.ngh').setAttribute('aria-expanded', v ? 'true' : 'false'); badge(g); };
  const KUNCI = 'kp_menu'; let simpan = {};
  try { simpan = JSON.parse(sessionStorage.getItem(KUNCI) || '{}') || {}; } catch (e) { simpan = {}; }
  const ingat = () => { try { sessionStorage.setItem(KUNCI, JSON.stringify(simpan)); } catch (e) {} };

  // lencana grup (jumlah konsultasi + pengajuan DP) hanya tampil saat grup terlipat
  function badge(g) {
    const b = g.querySelector('.ngh .nbadge'); if (!b) return;
    const n = ['konBadge', 'kdpBadge'].reduce((t, id) => { const e = document.getElementById(id); return t + (e && !e.classList.contains('hide') ? Number(e.textContent) || 0 : 0); }, 0);
    b.textContent = n; b.classList.toggle('hide', !(n > 0 && g.classList.contains('closed')));
  }
  function sinkron() {
    grup().forEach(g => {
      const a = anak(g), v = a.filter(tampil); g.classList.toggle('hide', !v.length);
      const aktif = a.some(x => x.classList.contains('active')); g.classList.toggle('has-act', aktif);
      if (aktif || v.length === 1) buka(g, true); else badge(g);
    });
    const kd = document.querySelector('.tab-kdp'); // tab Pengajuan DP: hanya Owner & Petugas
    const boleh = typeof S !== 'undefined' && (S.role === 'Owner' || S.role === 'Petugas');
    [].slice.call(document.querySelectorAll('.tab-kdp')).forEach(t => t.classList.toggle('hide', !boleh));
  }
  window.menuToggle = function (k) { const g = document.querySelector('.ng[data-g="' + k + '"]'); if (!g) return; const v = g.classList.contains('closed'); buka(g, v); simpan[k] = v ? 1 : 0; ingat(); };

  // Pengajuan DP memakai bagian "kdp" tetapi menunya = Pasien Booking
  const _showSec = window.showSec;
  window.showSec = function (s) {
    _showSec(s);
    if (s === 'kdp') { const b = document.querySelector('.nav[data-s="booking"]'); if (b) b.classList.add('active'); }
    sinkron();
  };
  const _ing = window.ingestMaster;
  window.ingestMaster = function (m) {
    const r = _ing(m);
    grup().forEach(g => { const k = g.dataset.g; if (simpan[k] === 1) buka(g, true); else if (simpan[k] === 0) buka(g, false); else buka(g, k === 'pasien'); });
    sinkron(); return r;
  };
  // lencana berubah (konsultasi / pengajuan DP) -> perbarui lencana grup
  ['konBadge', 'kdpBadge'].forEach(id => { const e = document.getElementById(id); if (e) new MutationObserver(() => grup().forEach(badge)).observe(e, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] }); });
  grup().forEach(g => buka(g, g.dataset.g === 'pasien'));
})();
