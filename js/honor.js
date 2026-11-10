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
  const kartu = el('div', 'card hf'); kartu.id = 'hfCard'; sel.appendChild(kartu);

  // sumber data memakai mekanisme pull() (ikut paket login & refresh), jadi pindah menu tidak menambah panggilan server
  SRC.hf = { a: 'getHonorFee', d: () => ({ cab: isOwner() ? S.cab : undefined, bulan: H.bln || undefined }), ok: d => { H.d = d; tampil(); } };
  const _pull = window.pull; window.pull = function (keys, force, done) { if (keys.indexOf('lap') > -1 && keys.indexOf('hf') < 0) keys = keys.concat('hf'); return _pull.call(this, keys, force, done); };
  const ang = n => new Intl.NumberFormat('id-ID').format(n || 0);
  const KOMP = [['lembur', 'Lembur', 'lemburRp', 'o', ' shift'], ['cd', 'Close deal', 'cdRp', '', ''], ['hv', 'Homevisite', 'hvRp', 'p', ''], ['dokterN', 'Dokter', 'dokterRp', 'g', ' tindakan'], ['asistenN', 'Asisten', 'asistenRp', 'g', ' tindakan']];
  const sumOf = list => list.reduce((t, x) => { ['lembur', 'cd', 'hv', 'dokterN', 'asistenN', 'lemburRp', 'cdRp', 'hvRp', 'dokterRp', 'asistenRp', 'total'].forEach(k => { t[k] = (t[k] || 0) + (x[k] || 0); }); return t; }, {});
  H.open = H.open || {};
  function tampil() {
    kartu.textContent = ''; const d = H.d, nom = !!(d && d.nominal), own = isOwner();
    const h = el('div', 'hf-top'); const jd = el('h3'); jd.appendChild(el('i', 'bi bi-cash-stack')); jd.appendChild(document.createTextNode(' Honor & Fee')); h.appendChild(jd);
    const ac = el('div', 'hf-act');
    const m = el('input'); m.type = 'month'; m.id = 'hfBln'; m.value = H.bln || (d && d.bulan) || ym(); m.onchange = () => { H.bln = m.value; pull(['hf'], true); }; ac.appendChild(m);
    if (d && d.daftar.length) { const ex = el('button', 'btn-sm btn-ghost', 'Ekspor Excel'); ex.id = 'hfEks'; ex.onclick = ekspor; ac.appendChild(ex); }
    if (own) { const lm = el('button', 'btn-sm btn-ghost', 'Hitung data lama'); lm.id = 'hfLama'; lm.title = 'Isi fee & honor untuk booking/kunjungan/tindakan bulan ini yang dicatat sebelum tarif diatur'; lm.onclick = hitungLama; ac.appendChild(lm); const tr = el('button', 'btn-sm', 'Atur tarif'); tr.id = 'hfTarif'; tr.onclick = tarif; ac.appendChild(tr); }
    h.appendChild(ac); kartu.appendChild(h);
    kartu.appendChild(el('p', 'hf-mut', own ? 'Lembur disetujui, fee close deal (dari tanggal booking diinput), fee homevisite, dan honor tindakan (saat pasien selesai). Ketuk nama untuk melihat rincian.' : d && d.peran === 'Dokter' ? 'Rekap honor tindakan Anda bulan ini.' : 'Rekap jumlah per orang. Ketuk nama untuk melihat rincian (nominal hanya terlihat Owner).'));
    if (!d) { kartu.appendChild(el('p', 'kon-empty', 'Memuat…')); return; }
    if (!d.daftar.length) { kartu.appendChild(el('p', 'kon-empty', 'Belum ada data pada bulan ini.')); return; }
    const list = d.daftar.slice().sort((a, b) => nom ? (b.total - a.total) || a.nama.localeCompare(b.nama) : a.nama.localeCompare(b.nama)), tot = d.total || sumOf(list);
    // ringkasan
    const kp = el('div', 'hf-kpi'); const tile = (lbl, big, cls) => { const k = el('div', 'hf-k' + (cls ? ' ' + cls : '')); k.appendChild(el('small', null, lbl)); k.appendChild(el('b', null, big)); kp.appendChild(k); };
    if (nom) tile('Total bulan ini', 'Rp ' + ang(tot.total), 'hf-t');
    KOMP.forEach(([k, lbl, kr, , suf]) => { const n = tot[k] || 0; tile(lbl + (k === 'dokterN' ? ' (tindakan)' : k === 'asistenN' ? ' (tindakan)' : k === 'lembur' ? ' (shift)' : ''), n ? (nom ? 'Rp ' + ang(tot[kr]) + ' · ' + n : String(n)) : '–', n ? '' : 'hf-z'); });
    kartu.appendChild(kp);
    // daftar per orang
    const box = el('div', 'hf-list');
    list.forEach(x => {
      const key = x.nama.toLowerCase(), buka = !!H.open[key], row = el('div', 'hf-item' + (buka ? ' on' : ''));
      const hd = el('button', 'hf-row'); hd.type = 'button'; hd.setAttribute('aria-expanded', buka ? 'true' : 'false');
      hd.appendChild(el('b', 'hf-nm', x.nama)); const ch = el('span', 'hf-chips');
      KOMP.forEach(([k, lbl, kr, cls, suf]) => { const n = x[k] || 0; if (!n) return; const belum = nom && !(x[kr] > 0); ch.appendChild(el('span', 'hf-chip ' + (belum ? 'o' : cls), lbl + ' ' + n + (nom ? (belum ? ' · tarif belum diisi' : ' · Rp ' + ang(x[kr])) : ''))); });
      if (!ch.firstChild) ch.appendChild(el('span', 'hf-chip z', 'Belum ada data'));
      hd.appendChild(ch); hd.appendChild(el('span', 'hf-sum' + (nom && !x.total ? ' z' : ''), nom ? 'Rp ' + ang(x.total) : '')); hd.appendChild(el('span', 'hf-chev', buka ? '⌄' : '›'));
      hd.onclick = () => { H.open[key] = !H.open[key]; tampil(); }; row.appendChild(hd);
      if (buka) { const dt = el('div', 'hf-det'); KOMP.forEach(([k, lbl, kr, , suf]) => { const n = x[k] || 0, c = el('div', n ? 'on' : ''); c.appendChild(el('small', null, lbl === 'Dokter' ? 'Tindakan dokter' : lbl === 'Asisten' ? 'Tindakan asisten' : lbl)); c.appendChild(el('b', n ? null : 'z', n ? n + (nom ? ' · Rp ' + ang(x[kr]) : '') : '–')); dt.appendChild(c); }); row.appendChild(dt); }
      box.appendChild(row);
    });
    kartu.appendChild(box);
    const ft = el('div', 'hf-foot'); ft.appendChild(el('span', null, 'Total (' + list.length + ' orang)')); ft.appendChild(el('span', null, nom ? 'Rp ' + ang(tot.total) : '')); kartu.appendChild(ft);
  }
  function ekspor() {
    const d = H.d, nom = d.nominal, q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const kep = ['Nama', 'Lembur (shift)'].concat(nom ? ['Lembur (Rp)'] : [], ['Close deal'], nom ? ['Fee close deal (Rp)'] : [], ['Homevisite'], nom ? ['Fee homevisite (Rp)'] : [], ['Tindakan dokter'], nom ? ['Honor dokter (Rp)'] : [], ['Tindakan asisten'], nom ? ['Honor asisten (Rp)'] : [], nom ? ['Total (Rp)'] : []);
    const baris = d.daftar.map(x => [x.nama, x.lembur].concat(nom ? [x.lemburRp] : [], [x.cd], nom ? [x.cdRp] : [], [x.hv || 0], nom ? [x.hvRp || 0] : [], [x.dokterN], nom ? [x.dokterRp] : [], [x.asistenN], nom ? [x.asistenRp] : [], nom ? [x.total] : []));
    const csv = '﻿' + [kep].concat(baris).map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'honor-fee-' + d.bulan + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function hitungLama() {
    const bln = H.bln || (H.d && H.d.bulan) || ym(), base = { bulan: bln, cab: S.cab }, z = await api('hitungDataLama', Object.assign({ simulasi: true }, base));
    if (!z.success) { gagal(z); return; } const x = z.data;
    if (!x.fee && !x.tindakan && !x.hv) { toast('Tidak ada data lama bulan ' + bln + ' yang perlu dihitung.'); return; }
    if (!confirm('Hitung data lama bulan ' + bln + '?\n\n• ' + x.fee + ' booking: fee close deal ' + rp(x.rpFee) + ' (tarif ' + rp(x.tarifFee) + ' per booking)\n• ' + x.hv + ' homevisite: fee ' + rp(x.rpHv) + '\n• ' + x.tindakan + ' tindakan selesai: honor dokter + asisten ' + rp(x.rpHonor) + '\n\nMemakai tarif saat ini. Setelah dihitung nominalnya terkunci dan tidak berubah bila tarif diganti.')) return;
    const r = await api('hitungDataLama', base); if (!r.success) { gagal(r); return; } toast(r.message); pull(['hf'], true);
  }
  async function tarif() {
    const r = await api('getTarifHonor', {}); if (!r.success) { gagal(r); return; } const t = r.data;
    openM('<div id="hfTf"></div>'); $('modalBody').style.maxWidth = '720px'; const w = $('hfTf');
    const jd = el('h3', null, 'Atur tarif honor & fee'); w.appendChild(jd);
    const info = el('p', null, 'Perubahan tarif berlaku untuk booking / tindakan berikutnya. Data yang sudah tercatat tidak berubah. Tarif lembur diatur di menu Pengajuan Lembur.'); info.style.cssText = 'color:var(--mute);font-size:12.5px;margin:4px 0 10px'; w.appendChild(info);
    const num = (id, v, ph) => { const i = el('input'); i.type = 'number'; i.min = '0'; i.step = '1'; i.inputMode = 'numeric'; i.value = v || ''; i.id = id; i.placeholder = ph || '0'; return i; };
    w.appendChild(el('label', null, 'Fee close deal per booking (Rp) — sama untuk semua petugas')); const fee = num('hfFee', t.feeCD); fee.style.maxWidth = '220px'; w.appendChild(fee);
    const l1b = el('label', null, 'Fee homevisite per kunjungan (Rp) — untuk orang yang tercatat di data homevisite'); l1b.style.cssText = 'margin-top:12px;display:block'; w.appendChild(l1b); const feeHv = num('hfFeeHV', t.feeHV); feeHv.style.maxWidth = '220px'; w.appendChild(feeHv);
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
      const spes = t.dokter.filter((n, i) => $('hfSp' + i).checked); ok.disabled = true; const z = await api('saveTarifHonor', { feeCD: $('hfFee').value, feeHV: $('hfFeeHV').value, paket: paket, spesialis: spes }); ok.disabled = false;
      if (!z.success) { msg.textContent = z.message || 'Gagal.'; return; } toast(z.message); closeM(); pull(['hf'], true);
    };
    bar.appendChild(bt); bar.appendChild(ok); w.appendChild(bar);
  }
  const _res = window.resetState; if (_res) window.resetState = function () { H.d = null; H.bln = ''; return _res.apply(this, arguments); };
})();
