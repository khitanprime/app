// ============================================================
// MENU KONSULTASI (sisi klinik). Semua teks dari pasien dirender dengan textContent — tidak pernah innerHTML.
// ============================================================
(function () {
  'use strict';
  const KON = { id: null, seq: 0, meta: null, timer: 0, busy: false, foto: '', shown: {}, urls: {}, gen: 0, idle: 0, pend: [], poll: 0 };
  S.kon = { list: [], unread: 0 };
  SRC.kon = { a: 'getKonsulList', d: () => ({ cab: S.cab }), ok: d => { S.kon = d; konRender(); konBadge(); } };

  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const linkOf = kode => String(KONSUL_URL).replace(/\/?$/, '/') + '?k=' + encodeURIComponent(kode);
  const jam = ms => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const tgl = ms => { const d = new Date(ms), n = new Date(); return d.toDateString() === n.toDateString() ? jam(ms) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); };
  const hari = ms => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const salin = (t, ok) => { const f = () => { const a = el('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); toast(ok); };
    (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(t).then(() => toast(ok), f) : f(); };
  const waTeks = m => 'Halo Bapak/Ibu ' + (m.ortu || '') + ', berikut tautan konsultasi pasca khitan untuk ' + m.nama + ' di ' + KLINIK_NAMA_ + ':\n' + linkOf(m.kode) + '\n\nPIN: 4 digit terakhir nomor HP yang didaftarkan. Silakan kirim foto luka atau keluhan di sana.';
  const KLINIK_NAMA_ = 'Khitan Prime';
  const isDokter = () => S.role === 'Owner' || S.role === 'Dokter'; // pembuat resep & penutup konsultasi

  // ---------- lencana & daftar ----------
  function konBadge() { const n = (S.kon && S.kon.unread) || 0, b = $('konBadge'); if (!b) return; b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hide', !n); }
  function konRender() {
    const box = $('konList'); if (!box) return; const q = ($('qKon').value || '').toLowerCase(); box.textContent = '';
    const rows = (S.kon.list || []).filter(x => !q || (x.nama + ' ' + x.ortu).toLowerCase().indexOf(q) > -1);
    if (!rows.length) { box.appendChild(el('p', 'kon-empty', S.kon.list.length ? 'Tidak ada yang cocok.' : 'Belum ada percakapan. Buka menu "Pasien Diproses", lalu klik ikon percakapan pada pasien untuk membuat tautan.')); return; }
    rows.forEach(x => {
      const b = el('button', 'kon-it' + (x.id === KON.id ? ' on' : '') + (x.belum ? ' unread' : '')); b.type = 'button'; b.addEventListener('click', () => konBuka(x.id));
      const t = el('div', 'kon-top'); t.appendChild(el('b', null, x.nama)); t.appendChild(el('span', 'kon-t', x.waktu ? tgl(x.waktu) : '')); b.appendChild(t);
      const s = el('div', 'kon-sub'); s.appendChild(el('span', 'kon-pv', (x.teks ? (x.dari ? x.dari + ': ' : '') + x.teks : (x.aktif ? 'Belum ada pesan' : 'Ditutup')))); if (x.belum) s.appendChild(el('span', 'kon-n', x.belum)); b.appendChild(s);
      if (!x.aktif) b.appendChild(el('small', 'kon-off', 'Ditutup'));
      box.appendChild(b);
    });
  }
  window.konRender = konRender;

  // ---------- percakapan ----------
  function konBuka(id) {
    konStopThread(); KON.id = id; KON.seq = 0; KON.shown = {}; KON.pend = []; KON.idle = 0; KON.meta = null; KON.gen++;
    $('konWrap').classList.add('open'); konRender(); const th = $('konThread'); th.textContent = ''; th.appendChild(el('p', 'kon-empty', 'Memuat…'));
    fetchThread(true);
  }
  function konStopThread() { clearTimeout(KON.timer); KON.gen++; Object.values(KON.urls).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} }); KON.urls = {}; KON.busy = false; }
  function konStop() { konStopThread(); KON.id = null; KON.foto = ''; const w = $('konWrap'); if (w) w.classList.remove('open'); }
  async function fetchThread(first) {
    if (!KON.id || KON.busy) return; KON.busy = true; const gen = KON.gen, id = KON.id;
    try {
      const r = await api('getKonsulPesan', { id: id, after: KON.seq }); if (gen !== KON.gen) return;
      if (!r.success) { if (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || '')) return authLost(r.message); if (first) { $('konThread').textContent = ''; $('konThread').appendChild(el('p', 'kon-empty', r.message || 'Gagal memuat.')); } return; }
      const d = r.data; if (d.aktif === false) { toast('Konsultasi ini sudah diselesaikan.'); konStop(); $('konThread').textContent = ''; $('konThread').appendChild(el('p', 'kon-empty', 'Pilih percakapan di sebelah kiri.')); pull(['kon'], true); return; }
      if (first || !KON.meta) { KON.meta = { id: id, kode: d.kode, aktif: d.aktif, nama: d.nama, ortu: d.ortu, hp: d.hp }; buildThread(); }
      const n = addMsgs(d.pesan); KON.seq = Math.max(KON.seq, d.seq || 0); KON.idle = n ? 0 : KON.idle + 1;
      if (d.belum) { api('konsulBaca', { id: id }).then(() => { const it = S.kon.list.filter(x => x.id === id)[0]; if (it) { S.kon.unread = Math.max(0, S.kon.unread - it.belum); it.belum = 0; konRender(); konBadge(); } }); }
    } finally { KON.busy = false; if (gen === KON.gen && KON.id) { clearTimeout(KON.timer); KON.timer = setTimeout(() => fetchThread(false), document.hidden ? 60000 : KON.idle < 6 ? 5000 : KON.idle < 24 ? 12000 : 25000); } }
  }
  function buildThread() {
    const th = $('konThread'); th.textContent = ''; const head = el('div', 'kon-head'); head.id = 'konHead'; th.appendChild(head);
    const list = el('div', 'kon-msgs'); list.id = 'konMsgs'; th.appendChild(list);
    const f = el('form', 'kon-bar'); f.id = 'konBar'; const file = el('input'); file.type = 'file'; file.id = 'konFile'; file.accept = 'image/jpeg,image/png,image/webp'; file.hidden = true;
    const bf = el('button', 'btn-ghost ic', ''); bf.type = 'button'; bf.setAttribute('aria-label', 'Lampirkan foto'); bf.innerHTML = '<i class="bi bi-camera"></i>'; bf.addEventListener('click', () => file.click());
    const ta = el('textarea'); ta.id = 'konTeks'; ta.rows = 1; ta.maxLength = 2000; ta.placeholder = 'Tulis balasan…'; ta.setAttribute('aria-label', 'Balasan');
    const bs = el('button', 'ic', ''); bs.type = 'submit'; bs.setAttribute('aria-label', 'Kirim'); bs.innerHTML = '<i class="bi bi-send-fill"></i>';
    const pv = el('div', 'kon-prev hide'); pv.id = 'konPrev'; const pi = el('img'); pi.alt = 'Pratinjau'; const px = el('button', null, '✕'); px.type = 'button'; px.setAttribute('aria-label', 'Batal foto'); pv.append(pi, px);
    px.addEventListener('click', () => { KON.foto = ''; pv.classList.add('hide'); file.value = ''; });
    file.addEventListener('change', async () => { const x = file.files[0]; if (!x) return; if (!/^image\/(jpeg|png|webp)$/.test(x.type)) { toast('Gunakan foto JPG, PNG, atau WebP.'); file.value = ''; return; } try { KON.foto = await shrink(x); pi.src = KON.foto; pv.classList.remove('hide'); } catch (e) { toast('Foto tidak dapat diproses.'); file.value = ''; } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
    ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); f.requestSubmit(); } });
    f.addEventListener('submit', ev => { ev.preventDefault(); kirim(ta, pv, file); });
    f.append(file, bf, ta, bs); th.append(pv, f); buildHead();
  }
  function buildHead() {
    const m = KON.meta, h = $('konHead'); if (!h || !m) return; h.textContent = '';
    const back = el('button', 'btn-ghost kon-back', ''); back.type = 'button'; back.innerHTML = '<i class="bi bi-arrow-left"></i>'; back.setAttribute('aria-label', 'Kembali'); back.addEventListener('click', () => { konStop(); $('konThread').textContent = ''; $('konThread').appendChild(el('p', 'kon-empty', 'Pilih percakapan di sebelah kiri.')); konRender(); });
    const who = el('div', 'kon-who'); who.appendChild(el('b', null, m.nama)); who.appendChild(el('small', null, m.ortu ? 'Orang tua: ' + m.ortu : ''));
    const acts = el('div', 'kon-acts');
    const mk = (ic, label, fn, cls) => { const b = el('button', 'btn-sm ' + (cls || 'btn-ghost')); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label); b.innerHTML = '<i class="bi ' + ic + '"></i><span class="kon-lbl"> ' + label.split(' ')[0] + '</span>'; b.addEventListener('click', fn); return b; };
    acts.append(mk('bi-link-45deg', 'Salin tautan', () => salin(linkOf(m.kode), 'Tautan disalin.')),
      mk('bi-whatsapp', 'WhatsApp tautan', () => { const l = waLink(m.hp); if (!l) return toast('Nomor HP tidak valid.'); window.open(l + '?text=' + encodeURIComponent(waTeks(m)), '_blank', 'noopener'); }, 'btn-wa'),
      mk('bi-arrow-repeat', 'Ganti kode (tautan lama mati)', () => { if (confirm('Ganti kode? Tautan lama langsung tidak berlaku dan pasien harus memakai tautan baru.')) call('konsulReset', { id: m.id }, d => { m.kode = d.kode; toast('Kode diganti.'); buildHead(); }); }));
    if (isDokter()) acts.append(mk('bi-prescription2', 'Resep', () => konResepForm()), mk('bi-check2-circle', 'Selesai konsultasi', () => konSelesai(), 'btn-red'));
    h.append(back, who, acts);
  }
  function addMsgs(msgs) {
    const box = $('konMsgs'); if (!box) return 0; const near = box.scrollHeight - box.scrollTop - box.clientHeight < 140; let n = 0;
    msgs.forEach(m => {
      if (KON.shown['s' + m.seq]) return; KON.shown['s' + m.seq] = 1; n++;
      if (m.dari === 'staf') { const i = KON.pend.findIndex(p => !p.err && p.teks === m.teks && !!p.foto === !!m.foto && p.nama === m.nama); if (i > -1) { KON.pend[i].el.remove(); KON.pend.splice(i, 1); } }
      if (!box.dataset.t || new Date(+box.dataset.t).toDateString() !== new Date(m.waktu).toDateString()) box.appendChild(el('div', 'kon-day', hari(m.waktu))); box.dataset.t = m.waktu;
      box.appendChild(bubble(m, false));
    });
    if (n && (near || KON.seq === 0)) box.scrollTop = box.scrollHeight; return n;
  }
  function bubble(m, pend) {
    if (m.resep) return resepBubble(m);
    const me = m.dari === 'staf', b = el('div', 'kon-m ' + (me ? 'me' : 'them') + (pend ? ' pending' : ''));
    b.appendChild(el('span', 'kon-who2', me ? (m.nama || 'Klinik') : 'Orang tua'));
    if (m.foto) { const ph = el('span', 'kon-ph', 'Memuat foto…'); b.appendChild(ph); loadFoto(m.foto, ph, pend); }
    if (m.teks) b.appendChild(el('span', null, m.teks)); b.appendChild(el('time', null, pend ? 'Mengirim…' : jam(m.waktu))); return b;
  }
  // ---------- Resep ----------
  function resepBubble(m) {
    if (m.teks === '[Resep dibatalkan]') { const n = el('div', 'kon-day', 'Resep ' + m.resep + ' dibatalkan oleh ' + m.nama); setTimeout(() => refreshResep(m.resep), 0); return n; }
    const b = el('div', 'kon-m me kon-rx'); b.dataset.rid = m.resep; b.appendChild(el('span', 'kon-ph', 'Memuat resep…')); loadResep(m.resep, b); return b;
  }
  function loadResep(rid, box) {
    const id = KON.id; api('getKonsulResep', { id: id, rid: rid }).then(r => { if (id !== KON.id) return; box.textContent = ''; if (!r.success) { box.appendChild(el('span', 'kon-ph', 'Resep tidak dapat dimuat.')); return; } box.appendChild(resepCard(r.data)); });
  }
  function refreshResep(rid) { document.querySelectorAll('.kon-rx[data-rid="' + rid + '"]').forEach(b => loadResep(rid, b)); }
  function resepCard(d) {
    const c = el('div', 'rx' + (d.status !== 'Aktif' ? ' off' : '')); c.appendChild(el('b', 'rx-k', d.klinik || KLINIK_NAMA_)); if (d.alamat) c.appendChild(el('small', null, d.alamat));
    c.appendChild(el('div', 'rx-t', 'RESEP ' + d.id + (d.status !== 'Aktif' ? ' — ' + d.status.toUpperCase() : ''))); c.appendChild(el('small', null, 'Tanggal: ' + d.tanggal + ' · Pasien: ' + d.nama));
    const ul = el('ol', 'rx-l'); d.items.forEach(i => { const li = el('li'); li.appendChild(el('b', null, i.obat + '  —  ' + i.jumlah)); li.appendChild(el('div', null, i.aturan)); ul.appendChild(li); }); c.appendChild(ul);
    if (d.catatan) c.appendChild(el('p', 'rx-n', 'Catatan: ' + d.catatan));
    const sg = el('div', 'rx-s'); if (d.ttd) { const im = el('img'); im.src = d.ttd; im.alt = 'Tanda tangan'; sg.appendChild(im); } sg.appendChild(el('b', null, d.dokter)); sg.appendChild(el('small', null, 'SIP: ' + d.sip)); c.appendChild(sg);
    c.appendChild(el('small', 'rx-v', 'Kode verifikasi: ' + d.kode));
    if (d.status === 'Aktif' && isDokter()) { const x = el('button', 'btn-sm btn-red', 'Batalkan resep'); x.type = 'button'; x.addEventListener('click', () => { if (confirm('Batalkan resep ' + d.id + '? Pasien akan melihat resep ini dibatalkan.')) call('konsulResepBatal', { id: KON.id, rid: d.id }, () => { toast('Resep dibatalkan'); KON.idle = 0; clearTimeout(KON.timer); KON.busy = false; fetchThread(false); }); }); c.appendChild(x); }
    return c;
  }
  function konResepForm() {
    const m = KON.meta; if (!m) return;
    api('getProfil', {}).then(r => {
      if (!r.success) return toast(r.message);
      if (!r.data.sip || !r.data.ttd) { toast('Lengkapi nomor SIP dan tanda tangan dulu.'); return konProfil(); }
      const names = ((S.stok && S.stok.obat) || []).map(x => x.nama || x.Nama).filter(Boolean);
      const row = () => '<div class="rx-row"><input class="rxO" list="rxList" placeholder="Nama obat & kekuatan" maxlength="100"><input class="rxA" placeholder="Aturan pakai (mis. 3 x 1 sesudah makan)" maxlength="200"><input class="rxJ" placeholder="Jumlah (mis. 10 tablet)" maxlength="40"></div>';
      openM('<h3><i class="bi bi-prescription2"></i> Resep untuk ' + esc(m.nama) + '</h3><p style="font-size:12px;color:var(--mute)">Ditandatangani: <b>' + esc(r.data.nama) + '</b> · SIP ' + esc(r.data.sip) + '. Resep yang terkirim tidak dapat diubah, hanya dibatalkan.</p>' +
        '<datalist id="rxList">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist><div id="rxRows">' + row() + '</div>' +
        '<button type="button" class="btn-sm btn-ghost" style="color:var(--ink);margin-top:8px" id="rxAdd"><i class="bi bi-plus-lg"></i> Tambah obat</button><label>Catatan (opsional)</label><textarea id="rxC" rows="2" maxlength="500"></textarea>' +
        '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()">Batal</button><button id="rxSend"><i class="bi bi-send"></i> Kirim ke pasien</button></div>');
      $('modalBody').style.maxWidth = '560px'; $('rxAdd').onclick = () => { if (document.querySelectorAll('.rx-row').length < 15) $('rxRows').insertAdjacentHTML('beforeend', row()); };
      $('rxSend').onclick = () => {
        const items = [...document.querySelectorAll('.rx-row')].map(r => ({ obat: r.querySelector('.rxO').value.trim(), aturan: r.querySelector('.rxA').value.trim(), jumlah: r.querySelector('.rxJ').value.trim() })).filter(i => i.obat || i.aturan || i.jumlah);
        if (!items.length) { $('mm').textContent = 'Isi minimal satu obat.'; return; } if (items.some(i => !i.obat || !i.aturan || !i.jumlah)) { $('mm').textContent = 'Nama obat, aturan pakai, dan jumlah wajib diisi pada setiap baris.'; return; }
        $('rxSend').disabled = true; call('konsulResepBuat', { id: m.id, items: items, catatan: $('rxC').value }, () => { closeM(); toast('Resep terkirim ke pasien'); KON.idle = 0; clearTimeout(KON.timer); KON.busy = false; fetchThread(false); }, e => { $('rxSend').disabled = false; $('mm').textContent = e; });
      };
    });
  }
  function konSelesai() {
    const m = KON.meta; if (!m) return;
    if (!confirm('Selesaikan konsultasi ' + m.nama + '?\n\n• Tautan pasien berakhir; pasien hanya melihat pesan penutup.\n• Foto dihapus, kecuali foto pasien yang terakhir.\n• Percakapan hilang dari menu ini.\n• Resep yang sudah dibuat tetap tersimpan.')) return;
    call('konsulSelesai', { id: m.id }, () => { toast('Konsultasi diselesaikan'); konStop(); const th = $('konThread'); th.textContent = ''; th.appendChild(el('p', 'kon-empty', 'Konsultasi diselesaikan. Pilih percakapan lain.')); pull(['kon'], true); });
  }
  window.konProfil = function konProfil() {
    api('getProfil', {}).then(r => {
      if (!r.success) return toast(r.message); const d = r.data;
      openM('<h3><i class="bi bi-pen"></i> Profil & Tanda Tangan</h3><p style="font-size:12px;color:var(--mute)">Dipakai pada resep pasien: nama <b>' + esc(d.nama) + '</b>, tanda tangan, dan nomor SIP di bawah nama.</p><label>Nomor SIP</label><input id="pfS" maxlength="40" value="' + esc(d.sip) + '" placeholder="mis. 503/123/SIP-DOK/2025">' +
        '<label>Tanda tangan ' + (d.ttd ? '(tersimpan; gambar ulang hanya bila ingin mengganti)' : '(wajib)') + '</label>' + (d.ttd ? '<img id="pfOld" alt="Tanda tangan" style="max-height:60px;background:#fff;border:1px solid var(--line);border-radius:6px;display:block;margin-bottom:6px" src="' + d.ttd + '">' : '') +
        '<div style="border:1.5px solid var(--line);border-radius:8px;background:#fff"><canvas id="pfC" style="width:100%;height:150px;touch-action:none"></canvas></div><div class="msg" id="mm"></div>' +
        '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:10px"><button class="btn-ghost btn-sm" style="color:var(--ink)" id="pfX"><i class="bi bi-eraser"></i> Hapus</button><span><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()">Batal</button> <button id="pfOk">Simpan</button></span></div>');
      let pad = null; setTimeout(() => { const c = $('pfC'), k = Math.max(window.devicePixelRatio || 1, 1); c.width = c.offsetWidth * k; c.height = c.offsetHeight * k; c.getContext('2d').scale(k, k); pad = new SignaturePad(c, { penColor: 'rgb(15,23,42)' }); }, 60);
      $('pfX').onclick = () => pad && pad.clear();
      $('pfOk').onclick = () => { const draw = pad && !pad.isEmpty(); if (!d.ttd && !draw) { $('mm').textContent = 'Mohon bubuhkan tanda tangan.'; return; } call('saveProfil', { sip: $('pfS').value, ttd: draw ? pad.toDataURL('image/png') : undefined }, () => { closeM(); toast('Profil tersimpan'); }, e => $('mm').textContent = e); };
    });
  };
  window.konTpl = function () {
    api('getKonsulTpl', {}).then(r => {
      if (!r.success) return toast(r.message);
      openM('<h3><i class="bi bi-chat-square-text"></i> Pesan Penutup Konsultasi</h3><p style="font-size:12px;color:var(--mute)">Dibaca pasien saat membuka tautan setelah dokter menekan "Selesai konsultasi". Gunakan <b>{nama_anak}</b> dan <b>{klinik}</b>. Kosongkan lalu simpan untuk memakai pesan bawaan.</p><textarea id="tplT" rows="6" maxlength="1000">' + esc(r.data.tpl) + '</textarea><div class="msg" id="mm"></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()">Batal</button><button id="tplS">Simpan</button></div>');
      $('tplS').onclick = () => call('saveKonsulTpl', { tpl: $('tplT').value }, () => { closeM(); toast('Pesan penutup disimpan'); }, e => $('mm').textContent = e);
    });
  };

  async function loadFoto(fid, ph, local) {
    const gen = KON.gen, id = KON.id;
    try {
      let url = local ? fid : KON.urls[fid];
      if (!url) { const r = await api('getKonsulFoto', { id: id, fid: fid }); if (gen !== KON.gen) return; if (!r.success) throw 0; url = URL.createObjectURL(await (await fetch(r.data.foto)).blob()); KON.urls[fid] = url; }
      const im = el('img'); im.alt = 'Foto'; im.src = url; im.addEventListener('click', () => { const z = el('div', 'kon-zoom'); const zi = el('img'); zi.src = url; z.appendChild(zi); z.addEventListener('click', () => z.remove()); document.body.appendChild(z); }); ph.replaceWith(im);
    } catch (e) { ph.textContent = 'Foto tidak dapat dimuat.'; }
  }
  function shrink(file) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, 1280 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        let q = .82, out = c.toDataURL('image/jpeg', q); while (out.length > 850000 && q > .35) { q -= .1; out = c.toDataURL('image/jpeg', q); } out.length > 850000 ? rej(0) : res(out); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(0); }; im.src = u; });
  }
  function kirim(ta, pv, file) {
    const teks = ta.value.trim(), foto = KON.foto, m = KON.meta; if ((!teks && !foto) || !m) return; if (!m.aktif) return toast('Percakapan ditutup. Buka dulu untuk membalas.');
    const p = { rid: newReqId(), teks: teks, foto: foto, nama: S.nama, err: false, id: m.id }; ta.value = ''; ta.style.height = 'auto'; KON.foto = ''; pv.classList.add('hide'); file.value = '';
    p.el = bubble({ dari: 'staf', nama: S.nama, teks: teks, foto: foto }, true); KON.pend.push(p); const box = $('konMsgs'); box.appendChild(p.el); box.scrollTop = box.scrollHeight; enviar(p);
  }
  async function enviar(p) {
    const gen = KON.gen; p.err = false; p.el.classList.remove('gagal'); p.el.classList.add('pending'); p.el.querySelector('time').textContent = 'Mengirim…';
    const r = await api('konsulBalas', { id: p.id, teks: p.teks, foto: p.foto }, { reqId: p.rid }); if (gen !== KON.gen) return;
    if (r.success) { KON.idle = 0; clearTimeout(KON.timer); KON.busy = false; fetchThread(false); return; }
    if (r.code === 'AUTH') return authLost(r.message);
    p.err = true; p.el.classList.remove('pending'); p.el.classList.add('gagal'); const t = p.el.querySelector('time'); t.textContent = (r.message || 'Gagal') + ' '; const b = el('button', 'kon-retry', 'Kirim ulang'); b.type = 'button'; b.addEventListener('click', () => { b.remove(); enviar(p); }); t.appendChild(b);
  }

  // ---------- Buat tautan dari booking ----------
  window.konOpen = function (bookingId) {
    const b = S.bk.filter(x => x.ID === bookingId)[0]; if (!b) return;
    if (b.Status !== 'Selesai') return toast('Konsultasi pasca khitan hanya untuk pasien yang sudah diproses.');
    call('konsulLink', { id: bookingId }, d => {
      if (d.selesai) {
        openM('<h3><i class="bi bi-chat-dots"></i> Konsultasi Pasca Khitan — ' + esc(d.nama) + '</h3><p style="margin:8px 0">Konsultasi pasien ini sudah <b>diselesaikan</b>; tautan lamanya tidak aktif.</p>' +
          (isOwner() ? '<p style="font-size:12px;color:var(--mute)">Owner dapat membuka kembali bila diperlukan (foto yang sudah dihapus tidak kembali).</p><button class="btn-sm btn-navy" id="konRe"><i class="bi bi-unlock"></i> Buka kembali</button> ' : '') +
          '<div style="text-align:right;margin-top:12px"><button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="closeM()">Tutup</button></div>');
        if (isOwner()) $('konRe').onclick = () => call('konsulBuka', { id: bookingId }, () => { closeM(); toast('Konsultasi dibuka kembali'); pull(['kon'], true); });
        return;
      }
      const m = { id: bookingId, kode: d.kode, nama: d.nama, ortu: d.ortu, hp: d.hp }, l = linkOf(d.kode), wl = waLink(d.hp);
      openM('<h3><i class="bi bi-chat-dots"></i> Konsultasi Pasca Khitan — ' + esc(d.nama) + '</h3>' +
        '<label>Tautan untuk pasien</label><input id="konLink" readonly value="' + esc(l) + '" onfocus="this.select()">' +
        '<p style="font-size:12px;color:var(--mute);margin:8px 0">PIN pasien = <b>4 digit terakhir nomor HP</b> yang terdaftar di booking (<b>' + esc(d.pin) + '</b>). Jangan kirim PIN bersama tautan; cukup beri tahu "4 digit terakhir nomor HP Anda".</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm btn-ghost" style="color:var(--ink)" id="konCp"><i class="bi bi-clipboard"></i> Salin tautan</button>' +
        (wl ? '<button class="btn-sm btn-wa" id="konWa"><i class="bi bi-whatsapp"></i> Kirim via WhatsApp</button>' : '') + '<button class="btn-sm btn-navy" id="konGo"><i class="bi bi-chat-text"></i> Buka percakapan</button></div>' +
        '<div style="text-align:right;margin-top:12px"><button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="closeM()">Tutup</button></div>');
      $('konCp').onclick = () => salin(l, 'Tautan disalin.'); if (wl) $('konWa').onclick = () => window.open(wl + '?text=' + encodeURIComponent(waTeks(m)), '_blank', 'noopener');
      $('konGo').onclick = () => { closeM(); nav('kon'); konBuka(bookingId); };
      pull(['kon'], true);
    });
  };
  // tombol percakapan di daftar Pasien Diproses (hanya pasien berstatus Selesai)
  const _wa = waBtn; waBtn = function (b) { return _wa(b) + (b.Status === 'Selesai' ? '<button class="ic btn-ghost" style="color:var(--ink)" onclick="konOpen(\'' + esc(b.ID) + '\')" aria-label="Konsultasi pasca khitan" title="Konsultasi pasca khitan"><i class="bi bi-chat-dots"></i></button>' : ''); };

  // ---------- Navigasi & siklus ----------
  const konPull = () => pull(['kon'], true);
  const _nav = nav; nav = function (s) { _nav(s); if (s === 'kon') { pull(['kon'], false); if (KON.id) fetchThread(false); } };
  const _reset = resetState; resetState = function () { konStop(); S.kon = { list: [], unread: 0 }; ['konList', 'konThread'].forEach(i => { const e = $(i); if (e) e.textContent = ''; }); konBadge(); clearInterval(KON.poll); _reset(); };
  const _im = ingestMaster; ingestMaster = function (m) { _im(m); $('navProfil').classList.toggle('hide', !isDokter()); $('konTplBtn').classList.toggle('hide', !isOwner()); };
  const _ra = refreshAll; refreshAll = function (f) { _ra(f); konPull(); };
  window.konStop = konStop;
  // Lencana "belum dibaca": cek ringan tiap 45 dtk saat tab terlihat (hanya bila login)
  KON.poll = setInterval(async () => {
    if (!S.token || document.hidden || !SRC.kon) return; const ep = S.epoch;
    const r = await api('getKonsulList', { cab: S.cab }); if (ep !== S.epoch || !r.success) return; S.t.kon = Date.now(); S.kon = r.data; konRender(); konBadge();
  }, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && KON.id) { KON.idle = 0; clearTimeout(KON.timer); KON.busy = false; fetchThread(false); } });
  document.addEventListener('DOMContentLoaded', () => { const q = $('qKon'); if (q) q.addEventListener('input', konRender); });
})();
