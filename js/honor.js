// ============================================================
// HONOR & FEE di menu Laporan: rekap bulanan lembur + fee close deal + honor tindakan dokter/asisten.
// Owner: semua + nominal + atur tarif; Petugas: semua orang, jumlah saja; Dokter: hanya baris sendiri (dengan nominal).
// ============================================================
(function () {
  'use strict';
  const H = { d: null, bln: '', t: null };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const gagal = r => { if (r && (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || ''))) authLost(r.message); else toast((r && r.message) || 'Gagal.'); };
  const ym = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const sel = $('s-lap'); if (!sel) return;
  const kartu = el('div', 'card'); kartu.id = 'hfCard'; sel.appendChild(kartu);

  // sumber data memakai mekanisme pull() (ikut paket login & refresh), jadi pindah menu tidak menambah panggilan server
  SRC.hf = { a: 'getHonorFee', d: () => ({ cab: isOwner() ? S.cab : undefined, bulan: H.bln || undefined }), ok: d => { H.d = d; tampil(); } };
  const _pull = window.pull; window.pull = function (keys, force, done) { if (keys.indexOf('lap') > -1 && keys.indexOf('hf') < 0) keys = keys.concat('hf'); return _pull.call(this, keys, force, done); };
  function tampil() {
    kartu.textContent = ''; const d = H.d, nom = !!(d && d.nominal), own = isOwner();
    const h = el('div'); h.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap';
    const jd = el('h3'); const ic = el('i', 'bi bi-cash-stack'); jd.appendChild(ic); jd.appendChild(document.createTextNode(' Honor & Fee')); h.appendChild(jd);
    const ac = el('div'); ac.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
    const m = el('input'); m.type = 'month'; m.id = 'hfBln'; m.value = H.bln || (d && d.bulan) || ym(); m.style.maxWidth = '170px'; m.onchange = () => { H.bln = m.value; pull(['hf'], true); }; ac.appendChild(m);
    if (d && d.daftar.length) { const ex = el('button', 'btn-sm btn-ghost', 'Ekspor Excel'); ex.id = 'hfEks'; ex.style.color = 'var(--ink)'; ex.onclick = ekspor; ac.appendChild(ex); }
    if (own) { const tr = el('button', 'btn-sm', 'Atur tarif'); tr.id = 'hfTarif'; tr.onclick = tarif; ac.appendChild(tr); }
    h.appendChild(ac); kartu.appendChild(h);
    const p = el('p', null, own ? 'Lembur disetujui, fee close deal (dari tanggal booking diinput), dan honor tindakan (saat pasien selesai).' : d && d.peran === 'Dokter' ? 'Rekap honor tindakan Anda bulan ini.' : 'Rekap jumlah per orang (nominal hanya terlihat Owner).'); p.style.cssText = 'color:var(--mute);font-size:12.5px;margin:4px 0 8px'; kartu.appendChild(p);
    if (!d) { kartu.appendChild(el('p', 'kon-empty', 'Memuat…')); return; }
    if (!d.daftar.length) { kartu.appendChild(el('p', 'kon-empty', 'Belum ada data pada bulan ini.')); return; }
    const kep = ['Nama', 'Lembur (shift)', 'Close deal', 'Tindakan dokter', 'Tindakan asisten'].concat(nom ? ['Total'] : []);
    const wrap = el('div', 'tw'), tb = el('table'), th = el('thead'), tr0 = el('tr'); kep.forEach(k => tr0.appendChild(el('th', null, k))); th.appendChild(tr0); tb.appendChild(th);
    const body = el('tbody'); const baris = (x, tebal) => { const tr = el('tr');
      const fmt = (n, v) => nom ? n + ' · ' + rp(v) : String(n);
      const cells = [x.nama, fmt(x.lembur, x.lemburRp), fmt(x.cd, x.cdRp), fmt(x.dokterN, x.dokterRp), fmt(x.asistenN, x.asistenRp)].concat(nom ? [rp(x.total)] : []);
      cells.forEach(c => { const t = el('td', null, c); if (tebal) t.style.fontWeight = '700'; tr.appendChild(t); }); return tr; };
    d.daftar.forEach(x => body.appendChild(baris(x)));
    if (d.total) body.appendChild(baris(Object.assign({ nama: 'Total' }, d.total), true));
    tb.appendChild(body); wrap.appendChild(tb); kartu.appendChild(wrap);
  }
  function ekspor() {
    const d = H.d, nom = d.nominal, q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const kep = ['Nama', 'Lembur (shift)'].concat(nom ? ['Lembur (Rp)'] : [], ['Close deal'], nom ? ['Fee close deal (Rp)'] : [], ['Tindakan dokter'], nom ? ['Honor dokter (Rp)'] : [], ['Tindakan asisten'], nom ? ['Honor asisten (Rp)'] : [], nom ? ['Total (Rp)'] : []);
    const baris = d.daftar.map(x => [x.nama, x.lembur].concat(nom ? [x.lemburRp] : [], [x.cd], nom ? [x.cdRp] : [], [x.dokterN], nom ? [x.dokterRp] : [], [x.asistenN], nom ? [x.asistenRp] : [], nom ? [x.total] : []));
    const csv = '﻿' + [kep].concat(baris).map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'honor-fee-' + d.bulan + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function tarif() {
    const r = await api('getTarifHonor', {}); if (!r.success) { gagal(r); return; } const t = r.data;
    openM('<div id="hfTf"></div>'); $('modalBody').style.maxWidth = '720px'; const w = $('hfTf');
    const jd = el('h3', null, 'Atur tarif honor & fee'); w.appendChild(jd);
    const info = el('p', null, 'Perubahan tarif berlaku untuk booking / tindakan berikutnya. Data yang sudah tercatat tidak berubah. Tarif lembur diatur di menu Pengajuan Lembur.'); info.style.cssText = 'color:var(--mute);font-size:12.5px;margin:4px 0 10px'; w.appendChild(info);
    const num = (id, v, ph) => { const i = el('input'); i.type = 'number'; i.min = '0'; i.step = '1'; i.inputMode = 'numeric'; i.value = v || ''; i.id = id; i.placeholder = ph || '0'; return i; };
    w.appendChild(el('label', null, 'Fee close deal per booking (Rp) — sama untuk semua petugas')); const fee = num('hfFee', t.feeCD); fee.style.maxWidth = '220px'; w.appendChild(fee);
    const l2 = el('label', null, 'Honor tindakan per paket (Rp)'); l2.style.marginTop = '12px'; l2.style.display = 'block'; w.appendChild(l2);
    const tw = el('div', 'tw'), tb = el('table'), th = el('thead'), tr0 = el('tr'); ['Paket', 'Dokter', 'Dokter spesialis', 'Asisten'].forEach(k => tr0.appendChild(el('th', null, k))); th.appendChild(tr0); tb.appendChild(th);
    const body = el('tbody'); t.paket.forEach((p, i) => { const tr = el('tr'); tr.appendChild(el('td', null, p.nama)); [['d', p.dokter], ['s', p.spesialis], ['a', p.asisten]].forEach(([k, v]) => { const td = el('td'); const n = num('hfP' + k + i, v); n.style.minWidth = '110px'; td.appendChild(n); tr.appendChild(td); }); body.appendChild(tr); });
    tb.appendChild(body); tw.appendChild(tb); w.appendChild(tw);
    const l3 = el('label', null, 'Dokter spesialis (memakai tarif "Dokter spesialis")'); l3.style.cssText = 'margin-top:12px;display:block'; w.appendChild(l3);
    const cb = el('div'); cb.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px'; const set = {}; t.spesialis.forEach(n => { set[n.toLowerCase()] = 1; });
    t.dokter.forEach((n, i) => { const lb = el('label'); lb.style.cssText = 'display:flex;gap:6px;align-items:center;font-weight:500'; const c = el('input'); c.type = 'checkbox'; c.id = 'hfSp' + i; c.checked = !!set[n.toLowerCase()]; c.style.width = 'auto'; lb.appendChild(c); lb.appendChild(document.createTextNode(n)); cb.appendChild(lb); });
    if (!t.dokter.length) cb.appendChild(el('span', null, 'Belum ada dokter di daftar staf.')); w.appendChild(cb);
    const msg = el('div', 'msg'); msg.id = 'hfMsg'; w.appendChild(msg);
    const bar = el('div'); bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px';
    const bt = el('button', 'btn-ghost', 'Batal'); bt.style.color = 'var(--ink)'; bt.onclick = closeM; const ok = el('button', null, 'Simpan'); ok.id = 'hfSimpan';
    ok.onclick = async () => {
      const paket = t.paket.map((p, i) => ({ id: p.id, dokter: $('hfPd' + i).value, spesialis: $('hfPs' + i).value, asisten: $('hfPa' + i).value }));
      const spes = t.dokter.filter((n, i) => $('hfSp' + i).checked); ok.disabled = true; const z = await api('saveTarifHonor', { feeCD: $('hfFee').value, paket: paket, spesialis: spes }); ok.disabled = false;
      if (!z.success) { msg.textContent = z.message || 'Gagal.'; return; } toast(z.message); closeM(); pull(['hf'], true);
    };
    bar.appendChild(bt); bar.appendChild(ok); w.appendChild(bar);
  }
  const _res = window.resetState; if (_res) window.resetState = function () { H.d = null; H.bln = ''; return _res.apply(this, arguments); };
})();
