// ============================================================
// TTD ORANG TUA WAJIB sebelum tindakan. Proses diblokir bila TTD belum ada; Owner boleh melewati dengan alasan (tercatat).
// Penanda "TTD belum" di daftar; Petugas tetap bisa menambah TTD untuk pasien yang sudah selesai (lewat tombol Dokumen).
// ============================================================
(function () {
  'use strict';
  let wajib = true, docsOk = false; const LEWATI = {};
  const ada = id => !!S.docs[id + '|TTD'];
  const perlu = id => wajib && docsOk && !ada(id);

  // daftar dokumen sudah dimuat? (agar penanda tidak muncul keliru sebelum data tiba)
  const _ok = SRC.docs.ok; SRC.docs.ok = function (l) { _ok(l); docsOk = true; if (typeof renderB === 'function') { renderB(); renderP(); } };
  const _ing = window.ingestMaster; window.ingestMaster = function (m) { wajib = !m || m.wajibTtd !== false; return _ing(m); };
  const _res = window.resetState; if (_res) window.resetState = function () { docsOk = false; for (const k in LEWATI) delete LEWATI[k]; return _res.apply(this, arguments); };

  // ----- hadang tombol Proses -----
  const _mProses = window.mProses;
  window.mProses = function (id) {
    if (!wajib || ada(id) || LEWATI[id]) return _mProses(id);
    const b = S.bk.filter(x => x.ID === id)[0];
    openM('<h3><i class="bi bi-pen"></i> Tanda tangan orang tua belum ada</h3><p style="margin:6px 0">' + esc(b ? b.NamaAnak : id) + ' belum bisa diproses sebelum orang tua menandatangani persetujuan tindakan.</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px"><button onclick="ttdAmbil(\'' + id + '\')"><i class="bi bi-pen"></i> Ambil tanda tangan sekarang</button>' +
      (isOwner() ? '<button class="btn-ghost" style="color:var(--ink)" onclick="ttdLewati(\'' + id + '\')"><i class="bi bi-exclamation-triangle"></i> Lanjutkan tanpa tanda tangan (Owner)</button>' : '') +
      '<button class="btn-ghost" style="color:var(--ink)" onclick="closeM()">Batal</button></div>');
  };
  // setiap TTD baru tersimpan (dari mana pun) -> penanda ikut diperbarui
  const _mTtd = window.mTtd; window.mTtd = function (id, cb, skip) { return _mTtd(id, function () { renderB(); renderP(); cb && cb(); }, skip); };
  window.ttdAmbil = function (id) { mTtd(id, () => _mProses(id)); };
  window.ttdLewati = function (id) {
    openM('<h3>Lanjutkan tanpa tanda tangan</h3><p style="color:var(--mute);margin:4px 0">Hanya Owner. Alasan dan akun Anda dicatat.</p><label>Alasan * <small style="color:var(--mute)">(minimal 5 huruf)</small></label><textarea id="ttdAls" rows="2" maxlength="200" placeholder="Contoh: darurat, orang tua belum tiba"></textarea><div class="msg" id="mm"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()">Batal</button><button onclick="ttdLanjut(\'' + id + '\')">Lanjutkan</button></div>');
  };
  window.ttdLanjut = function (id) {
    const a = $('ttdAls').value.replace(/\s+/g, ' ').trim(); if (a.length < 5) { $('mm').textContent = 'Alasan wajib diisi (minimal 5 huruf).'; return; }
    LEWATI[id] = a; _mProses(id);
  };

  // ----- sisipkan alasan sebagai argumen ke-5 prosesBooking; bila server menolak karena TTD, tampilkan jelas -----
  const _call = window.call;
  window.call = function (action, args, ok, fail) {
    if (action === 'prosesBooking' && args && args.length >= 4) {
      const id = args[0], a = args.slice(0, 4); if (LEWATI[id]) a.push(LEWATI[id]);
      return _call(action, a, function (d, r) { delete LEWATI[id]; ok && ok(d, r); }, function (e, r) { delete LEWATI[id]; if (/Tanda tangan orang tua belum ada/.test(e)) { docsOk = true; delete S.docs[id + '|TTD']; } fail ? fail(e, r) : toast(e); });
    }
    return _call.apply(this, arguments);
  };

  // ----- penanda di tabel -----
  function tandai(tbody, st) {
    [].slice.call($(tbody).querySelectorAll('tr')).forEach(tr => {
      const c = tr.cells[0], nm = tr.cells[1]; if (!c || !nm || tr.querySelector('.ttd-tag')) return; const id = c.textContent.trim(); if (!perlu(id)) return;
      const s = document.createElement('span'); s.className = 'badge b-wait ttd-tag'; s.style.marginLeft = '6px'; s.title = 'Tanda tangan orang tua belum ada'; s.textContent = '⚠ TTD belum'; nm.appendChild(s);
    });
  }
  const _rB = window.renderB; window.renderB = function () { _rB(); tandai('tB'); };
  const _rP = window.renderP; window.renderP = function () { _rP(); tandai('tP'); };
})();
