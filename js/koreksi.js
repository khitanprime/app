// ============================================================
// KOREKSI DP: Owner koreksi langsung; Petugas mengajukan, Owner menyetujui/menolak. Tidak bisa bila pasien sudah Selesai.
// Semua teks dari server dirender dengan esc()/textContent.
// ============================================================
(function () {
  'use strict';
  const K = { map: {}, list: [], menunggu: 0 };
  const canKoreksi = () => isOwner() || S.role === 'Petugas';
  const tgl = ms => ms ? new Date(ms).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const gagal = r => { if (r && (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || ''))) authLost(r.message); else toast((r && r.message) || 'Gagal.'); };
  const totalOf = b => (Number(b.Harga) || 0) - (Number(b.Diskon) || 0);

  function terima(d) {
    K.list = d.daftar; K.menunggu = d.menunggu; K.map = {}; K.list.forEach(x => { if (x.status === 'Menunggu') K.map[x.booking] = x; });
    const b = $('kdpBadge'); if (b) { b.textContent = K.menunggu; b.classList.toggle('hide', !K.menunggu); } if (typeof renderB === 'function') renderB();
    if ($('s-kdp').classList.contains('active')) tampil();
  }
  SRC.kdp = { a: 'getKoreksiDP', d: () => ({ cab: isOwner() ? S.cab : undefined }), ok: terima };
    function muat(force) { if (!S.token || !canKoreksi()) return; pull(['kdp'], !!force); }
  // ----- menu aksi booking: tambah tombol -----
  const _mAksi = window.mAksi;
  window.mAksi = function (id) {
    _mAksi(id); const b = S.bk.filter(x => x.ID === id)[0]; if (!b || b.Status !== 'Belum Diproses' || !canKoreksi()) return;
    const ubah = [].slice.call($('modalBody').querySelectorAll('button')).filter(x => /Ubah data/.test(x.textContent))[0]; if (!ubah) return;
    const n = ubah.cloneNode(true); n.setAttribute('onclick', "mKoreksi('" + id + "')"); n.textContent = ''; const i = document.createElement('i'); i.className = 'bi bi-cash-stack'; n.appendChild(i);
    n.appendChild(document.createTextNode(' ' + (isOwner() ? 'Koreksi DP' : 'Ajukan koreksi DP') + (K.map[id] ? ' (ada pengajuan menunggu)' : ''))); ubah.parentNode.insertBefore(n, ubah.nextSibling);
  };
  // ----- penanda di tabel booking -----
  const _renderB = window.renderB;
  window.renderB = function () { _renderB(); [].slice.call($('tB').querySelectorAll('tr')).forEach(tr => { const c = tr.cells[0]; if (c && K.map[c.textContent.trim()] && !tr.querySelector('.kdp-tag')) { const s = document.createElement('span'); s.className = 'badge b-wait kdp-tag'; s.textContent = 'Pengajuan DP'; s.style.marginLeft = '6px'; const nm = tr.cells[1]; if (nm) nm.appendChild(s); } }); };
  // ----- modal koreksi / ajuan -----
  window.mKoreksi = function (id) {
    const b = S.bk.filter(x => x.ID === id)[0]; if (!b) return; const own = isOwner(), tot = totalOf(b), pel = Number(b.Pelunasan) || 0, pend = K.map[id];
    openM('<h3><i class="bi bi-cash-stack"></i> ' + (own ? 'Koreksi DP' : 'Ajukan koreksi DP') + ' <small style="color:var(--mute);font-weight:500">' + esc(id) + '</small></h3><p style="color:var(--mute);margin:4px 0">' + esc(b.NamaAnak) + '</p>' +
      '<div style="background:var(--cyl);border-radius:10px;padding:12px;margin:8px 0;line-height:1.7"><div>Total biaya: <b>' + rp(tot) + '</b></div><div>DP tercatat: <b>' + rp(b.DP) + '</b> (' + esc(b.Metode) + ')</div>' + (pel ? '<div>Pelunasan: <b>' + rp(pel) + '</b></div>' : '') + '<div>Sisa sekarang: <b>' + rp(b.Sisa) + '</b></div></div>' +
      (pend ? '<div style="background:#FEF3C7;color:#92400E;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:8px">Sudah ada pengajuan menunggu: ' + rp(pend.lama) + ' → <b>' + rp(pend.baru) + '</b> oleh ' + esc(pend.pengaju) + '. ' + (own ? 'Putuskan di menu Koreksi DP, atau koreksi langsung di bawah.' : 'Tunggu keputusan Owner.') + '</div>' : '') +
      (pend && !own ? '' : '<label>DP yang benar (Rp) *</label><input id="kNom" type="number" min="0" step="1" inputmode="numeric" value="' + (Number(b.DP) || 0) + '" oninput="kHit(\'' + id + '\')"><div id="kPrev" style="margin:6px 0;font-size:13px"></div>' +
        '<label>Alasan * <small style="color:var(--mute)">(wajib, tercatat di riwayat)</small></label><textarea id="kAls" rows="2" maxlength="200" placeholder="Contoh: kasir lupa mengisi DP, uang sudah diterima"></textarea>' +
        '<p style="font-size:12px;color:var(--mute);margin:6px 0 0">Invoice, bukti bayar, dan booking confirmation lama dibuat ulang otomatis. Dokumen yang sudah terkirim ke orang tua perlu dikirim ulang. Koreksi tidak bisa dilakukan bila pasien sudah selesai.</p>') +
      '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Tutup</button>' + (pend && !own ? '' : '<button onclick="kKirim(\'' + id + '\')"><i class="bi bi-send"></i> ' + (own ? 'Simpan koreksi' : 'Kirim pengajuan') + '</button>') + '</div>');
    if ($('kNom')) kHit(id);
  };
  window.kHit = function (id) { const b = S.bk.filter(x => x.ID === id)[0], v = $('kNom').value, n = Number(v), tot = totalOf(b), pel = Number(b.Pelunasan) || 0, p = $('kPrev');
    if (v === '' || !isFinite(n) || n < 0 || Math.round(n) !== n) { p.innerHTML = '<span style="color:var(--red)">Isi bilangan bulat, 0 atau lebih.</span>'; return; }
    if (n + pel > tot) { p.innerHTML = '<span style="color:var(--red)">Melebihi total biaya ' + rp(tot) + '.</span>'; return; }
    p.innerHTML = 'Sisa menjadi <b>' + rp(tot - n - pel) + '</b>' + (n === (Number(b.DP) || 0) ? ' (sama dengan sekarang)' : ''); };
  window.kKirim = function (id) {
    const b = S.bk.filter(x => x.ID === id)[0], n = $('kNom').value, a = $('kAls').value.trim(), own = isOwner(), m = $('mm'); m.textContent = '';
    if (a.length < 5) { m.textContent = 'Alasan wajib diisi (minimal 5 huruf).'; return; }
    if (Number(n) === (Number(b.DP) || 0)) { m.textContent = 'Nominal sama dengan DP sekarang.'; return; }
    if (own && !confirm('Ubah DP ' + b.NamaAnak + ' dari ' + rp(b.DP) + ' menjadi ' + rp(n) + '?')) return;
    call(own ? 'koreksiDP' : 'ajukanKoreksiDP', [{ id: id, dp: n, alasan: a }], (r, resp) => { closeM(); toast(resp.message || 'Tersimpan'); ['booking', 'invoice', 'payment'].forEach(x => delete S.docs[id + '|' + x]); if (own) loadAll(); muat(true); }, e => { m.textContent = e; });
  };
  // ----- halaman Koreksi DP -----
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  function tampil() {
    const w = $('kdpWrap'); if (!w) return; w.textContent = '';
    const c = el('div', 'card'), tunggu = K.list.filter(x => x.status === 'Menunggu'), riw = K.list.filter(x => x.status !== 'Menunggu');
    const h = el('h3', null, 'Menunggu keputusan' + (tunggu.length ? ' (' + tunggu.length + ')' : '')); c.appendChild(h);
    if (!tunggu.length) { const p = el('p', null, isOwner() ? 'Tidak ada pengajuan.' : 'Tidak ada pengajuan yang menunggu.'); p.style.color = 'var(--mute)'; c.appendChild(p); }
    tunggu.forEach(x => { const r = el('div'); r.style.cssText = 'border-top:1px solid var(--line);padding:10px 0';
      const t = el('div'); t.appendChild(el('b', null, x.nama)); t.appendChild(document.createTextNode(' · ' + x.booking + ' · ' + x.pengaju + ' · ' + tgl(x.waktu))); r.appendChild(t);
      r.appendChild(el('div', null, 'DP ' + rp(x.lama) + '  →  ' + rp(x.baru))); r.lastChild.style.cssText = 'margin:4px 0;font-size:15px;font-weight:700';
      const al = el('div', null, 'Alasan: ' + x.alasan); al.style.cssText = 'font-size:13px;color:var(--mute)'; r.appendChild(al);
      const a = el('div'); a.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
      if (isOwner()) { const ok = el('button', 'btn-sm'); ok.textContent = 'Setujui'; ok.onclick = () => putus(x, true); const no = el('button', 'btn-sm btn-red'); no.textContent = 'Tolak'; no.onclick = () => putus(x, false); a.appendChild(ok); a.appendChild(no); }
      { const bt = el('button', 'btn-sm btn-ghost'); bt.textContent = 'Batalkan pengajuan'; bt.onclick = async () => { const z = await api('batalKoreksiDP', { kid: x.id }); z.success ? (toast(z.message), muat(true)) : gagal(z); }; a.appendChild(bt); }
      r.appendChild(a); c.appendChild(r); });
    w.appendChild(c);
    const c2 = el('div', 'card'); c2.appendChild(el('h3', null, 'Riwayat koreksi'));
    if (!riw.length) { const p = el('p', null, 'Belum ada riwayat.'); p.style.color = 'var(--mute)'; c2.appendChild(p); }
    else { const tb = el('table'); const th = el('tr'); ['Waktu', 'Pasien', 'DP lama', 'DP baru', 'Status', 'Alasan / catatan'].forEach(x => th.appendChild(el('th', null, x))); const hd = el('thead'); hd.appendChild(th); tb.appendChild(hd); const bd = el('tbody');
      riw.forEach(x => { const tr = el('tr'); [tgl(x.waktu), x.nama + ' (' + x.booking + ')', rp(x.lama), rp(x.baru), x.status + (x.pemutus && x.status !== 'Langsung' ? ' oleh ' + x.pemutus : x.status === 'Langsung' ? ' oleh ' + x.pengaju : ''), x.alasan + (x.catatan ? ' — ' + x.catatan : '')].forEach(v => tr.appendChild(el('td', null, v))); bd.appendChild(tr); });
      tb.appendChild(bd); const wrap = el('div', 'tw'); wrap.appendChild(tb); c2.appendChild(wrap); }
    w.appendChild(c2);
  }
  async function putus(x, setuju) {
    let cat = ''; if (!setuju) { cat = prompt('Catatan penolakan (opsional):', '') || ''; } else if (!confirm('Setujui koreksi DP ' + x.nama + ': ' + rp(x.lama) + ' → ' + rp(x.baru) + '?')) return;
    const r = await api('putusKoreksiDP', { kid: x.id, setuju: setuju, catatan: cat }); if (!r.success) { gagal(r); muat(true); return; } toast(r.message); ['booking', 'invoice', 'payment'].forEach(j => delete S.docs[x.booking + '|' + j]); muat(true); if (setuju && typeof loadAll === 'function') loadAll();
  }
  const _nav = nav; nav = function (s) { _nav(s); if (s === 'kdp') { muat(true); tampil(); } else if (s === 'booking') muat(false); };
  // ----- peringatan DP kosong saat simpan pendaftaran -----
  const _sb = window.simpanBooking;
  window.simpanBooking = function () {
    if ($('fSt').value !== 'lunas' && $('fMet').value === 'Cash' && !(Number($('fDp').value) > 0) && !confirm('DP masih Rp 0 untuk pembayaran Cash. Pastikan memang belum ada uang muka yang diterima.\n\nLanjut simpan?')) return;
    _sb();
  };
})();
