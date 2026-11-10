// ============================================================
// PENGAJUAN LEMBUR: Petugas mengajukan (tanggal, shift Pagi/Sore/Pagi & Sore, keterangan); Owner menyetujui/menolak + tarif & rekap.
// Semua teks dari server dirender dengan textContent.
// ============================================================
(function () {
  'use strict';
  const L = { d: null, bln: '' };
  const SHIFT = ['Pagi', 'Sore', 'Pagi & Sore'], HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const tg = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return s || '-'; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return HARI[d.getUTCDay()] + ', ' + (+m[3]) + '-' + (+m[2]) + '-' + m[1]; };
  const hariOf = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : -1; };
  const wkt = ms => ms ? new Date(ms).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const gagal = r => { if (r && (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || ''))) authLost(r.message); else toast((r && r.message) || 'Gagal.'); };
  const nShift = s => s === 'Pagi & Sore' ? 2 : 1;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const stBadge = s => { const b = el('span', 'badge ' + (s === 'Disetujui' ? 'b-ok' : s === 'Menunggu' ? 'b-wait' : 'b-no'), s); if (s !== 'Disetujui' && s !== 'Menunggu') { b.style.background = 'var(--redl)'; b.style.color = 'var(--red)'; } return b; };
  const cabNama = id => { const c = ((S.master && S.master.cabang) || []).filter(x => x.CabangID === id)[0]; return c ? c.Nama : id; };
  const pakai = () => !!S.token && (isOwner() || S.role === 'Petugas');

  function terima(d) {
    L.d = d; const b = $('lbrBadge'); if (b) { const n = isOwner() ? d.menunggu : 0; b.textContent = n; b.classList.toggle('hide', !n); }
    if ($('s-lembur').classList.contains('active')) tampil();
  }
  SRC.lbr = { a: 'getLembur', d: () => ({ cab: isOwner() ? S.cab : undefined, bulan: isOwner() ? L.bln || undefined : undefined }), ok: terima };
  const muat = force => { if (pakai()) pull(['lbr'], !!force); };
  async function kirim(a, d, okMsg) { const r = await api(a, d); if (!r.success) { gagal(r); muat(true); return false; } toast(okMsg || r.message); muat(true); return true; }

  function tabel(kepala, baris) {
    const w = el('div', 'tw'), t = el('table'), th = el('thead'), tr = el('tr'); kepala.forEach(k => tr.appendChild(el('th', null, k))); th.appendChild(tr); t.appendChild(th);
    const tb = el('tbody'); baris.forEach(r => tb.appendChild(r)); t.appendChild(tb); w.appendChild(t); return w;
  }
  const td = (c, txt) => { const x = el('td'); if (txt != null) x.textContent = txt; if (c) c.appendChild(x); return x; };
  function kartu(judul) { const c = el('div', 'card'); const h = el('h3'); h.textContent = judul; c.appendChild(h); c.style.marginBottom = '14px'; return c; }

  function formAjukan() {
    const c = kartu('Ajukan lembur'), g = el('div'); g.style.cssText = 'display:grid;gap:8px;max-width:460px';
    c.appendChild(el('p', null, 'Lembur untuk hari Minggu atau tanggal merah. Bisa diajukan sampai 1 bulan ke belakang.')).style.cssText = 'color:var(--mute);margin:0 0 8px;font-size:13px';
    const l1 = el('label', null, 'Tanggal *'), tgl = el('input'); tgl.type = 'date'; tgl.id = 'lbrTgl'; if (L.d.batas) tgl.min = L.d.batas;
    const info = el('div'); info.id = 'lbrInfo'; info.style.cssText = 'font-size:12.5px;color:var(--mute)';
    const l2 = el('label', null, 'Shift *'), sh = el('select'); sh.id = 'lbrShift'; SHIFT.forEach(x => { const o = el('option', null, x); o.value = x; sh.appendChild(o); });
    const l3 = el('label', null, 'Keterangan *'), ket = el('textarea'); ket.id = 'lbrKet'; ket.rows = 2; ket.maxLength = 200; ket.placeholder = 'Contoh: menggantikan teman yang sakit / tanggal merah Natal';
    tgl.oninput = () => { const h = hariOf(tgl.value); info.textContent = h < 0 ? '' : h === 0 ? 'Hari Minggu.' : tg(tgl.value) + ' bukan hari Minggu: sebutkan tanggal merahnya di keterangan.'; };
    const msg = el('div', 'msg'); msg.id = 'lbrMsg';
    const bt = el('button'); bt.id = 'lbrKirim'; const i = el('i', 'bi bi-send'); bt.appendChild(i); bt.appendChild(document.createTextNode(' Kirim pengajuan'));
    bt.onclick = async () => {
      if (!tgl.value) { msg.textContent = 'Pilih tanggal.'; return; } if (ket.value.trim().length < 5) { msg.textContent = 'Keterangan wajib diisi (minimal 5 huruf).'; return; }
      msg.textContent = ''; bt.disabled = true; const ok = await kirim('ajukanLembur', { tanggal: tgl.value, shift: sh.value, ket: ket.value }); bt.disabled = false; if (ok) { tgl.value = ''; ket.value = ''; info.textContent = ''; }
    };
    [l1, tgl, info, l2, sh, l3, ket, msg, bt].forEach(x => g.appendChild(x)); c.appendChild(g); return c;
  }
  function riwayat(judul, own) {
    const c = kartu(judul), d = L.d.daftar;
    if (!d.length) { c.appendChild(el('p', 'kon-empty', 'Belum ada pengajuan.')); return c; }
    const kep = ['Tanggal', 'Shift', 'Keterangan'].concat(own ? ['Petugas', 'Cabang'] : [], ['Status', 'Catatan']).concat(own ? ['Nominal'] : []).concat(['Aksi']);
    const rows = d.map(x => { const tr = el('tr'); const a = td(tr, tg(x.tanggal));
      td(tr, x.shift); td(tr, x.ket); if (own) { td(tr, x.nama); td(tr, cabNama(x.cabang)); } const s = td(tr); s.appendChild(stBadge(x.status)); td(tr, x.catatan || (x.pemutus ? 'oleh ' + x.pemutus : ''));
      if (own) td(tr, x.status === 'Disetujui' ? rp(x.nominal) : '-');
      const ac = td(tr); if (x.status === 'Menunggu') {
        if (own) { const ya = el('button', 'btn-sm', 'Setujui'), no = el('button', 'btn-sm btn-red', 'Tolak'); ya.style.marginRight = '4px';
          ya.onclick = async () => { if (!L.d.tarif) { toast('Isi tarif lembur per shift dulu.'); return; } if (confirm('Setujui lembur ' + x.nama + ' ' + tg(x.tanggal) + ' (' + x.shift + ') sebesar ' + rp(L.d.tarif * nShift(x.shift)) + '?')) await kirim('putusLembur', { id: x.id, setuju: true }); };
          no.onclick = async () => { const a2 = prompt('Alasan menolak lembur ' + x.nama + ' (wajib):'); if (a2 == null) return; if (a2.trim().length < 3) { toast('Alasan wajib diisi.'); return; } await kirim('putusLembur', { id: x.id, setuju: false, catatan: a2 }); };
          ac.appendChild(ya); ac.appendChild(no); }
        else { const b = el('button', 'btn-sm btn-ghost', 'Batalkan'); b.style.color = 'var(--ink)'; b.onclick = async () => { if (confirm('Batalkan pengajuan lembur ini?')) await kirim('batalLembur', { id: x.id }); }; ac.appendChild(b); } }
      return tr; });
    c.appendChild(tabel(kep, rows)); return c;
  }
  function kartuTarif() {
    const c = kartu('Tarif lembur per shift'), r = el('div'); r.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    const i = el('input'); i.id = 'lbrTarif'; i.type = 'number'; i.min = '0'; i.step = '1'; i.inputMode = 'numeric'; i.value = L.d.tarif || ''; i.style.maxWidth = '200px'; i.placeholder = 'Rp per shift';
    const b = el('button', 'btn-sm', 'Simpan tarif'); b.id = 'lbrTarifOk'; b.onclick = async () => { const ok = await kirim('saveTarifLembur', { tarif: i.value }); if (ok) toast('Tarif disimpan'); };
    r.appendChild(i); r.appendChild(b); c.appendChild(r);
    const p = el('p', null, 'Sama untuk semua petugas, hari Minggu dan tanggal merah. "Pagi & Sore" = 2 shift. Nominal terkunci saat disetujui; mengubah tarif tidak mengubah yang sudah disetujui. Nominal hanya terlihat Owner. Pengajuan baru dikabarkan ke Telegram pribadi Anda: tautkan akun di menu Telegram, lalu tekan Start pada bot sekali.'); p.style.cssText = 'color:var(--mute);font-size:12.5px;margin:8px 0 0'; c.appendChild(p); return c;
  }
  function kartuRekap() {
    const c = kartu('Rekap bulanan (disetujui)'), r = el('div'); r.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
    const m = el('input'); m.type = 'month'; m.id = 'lbrBln'; m.value = L.d.bulan; m.onchange = () => { L.bln = m.value; muat(true); }; r.appendChild(m); c.appendChild(r);
    if (!L.d.rekap.length) { c.appendChild(el('p', 'kon-empty', 'Belum ada lembur disetujui pada bulan ini.')); return c; }
    const tot = L.d.rekap.reduce((a, x) => a + x.nominal, 0), ts = L.d.rekap.reduce((a, x) => a + x.shift, 0);
    const rows = L.d.rekap.map(x => { const tr = el('tr'); td(tr, x.nama); td(tr, String(x.shift)); td(tr, rp(x.nominal)); return tr; });
    const f = el('tr'); const a = td(f, 'Total'); a.style.fontWeight = '700'; td(f, String(ts)).style.fontWeight = '700'; td(f, rp(tot)).style.fontWeight = '700'; rows.push(f);
    c.appendChild(tabel(['Petugas', 'Jumlah shift', 'Nominal'], rows)); return c;
  }
  function tampil() {
    const w = $('lbrWrap'); if (!w) return; w.textContent = '';
    if (!pakai()) { w.appendChild(el('p', 'kon-empty', 'Menu ini untuk Petugas dan Owner.')); return; }
    if (!L.d) { w.appendChild(el('p', 'kon-empty', 'Memuat…')); return; }
    if (isOwner()) { w.appendChild(kartuTarif()); w.appendChild(riwayat('Pengajuan lembur', true)); w.appendChild(kartuRekap()); }
    else { w.appendChild(formAjukan()); w.appendChild(riwayat('Pengajuan saya', false)); }
  }
  const _im = window.ingestMaster; window.ingestMaster = function (m) { const r = _im(m); $('navLembur').classList.toggle('hide', !pakai()); return r; };
  const _nav = window.nav; window.nav = function (s) { _nav(s); if (s === 'lembur') { muat(true); tampil(); } };
  const _res = window.resetState; if (_res) window.resetState = function () { L.d = null; L.bln = ''; return _res.apply(this, arguments); };
  const _sc = window.setCabang; if (_sc) window.setCabang = function (v) { L.d = null; return _sc.apply(this, arguments); };
})();
