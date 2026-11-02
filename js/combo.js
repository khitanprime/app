// Kolom ketik-cari (combobox) tanpa pustaka. Dipakai: Proses Pasien (obat/BHP), Homevisite (pasien lama), Resep (obat).
// Semua teks dirender dengan textContent. Papan ketik: panah atas/bawah, Enter, Esc.
(function () {
  'use strict';
  const MAX = 20;
  function combo(input, o) {
    // o.items(): [{id,label,sub,off,value}] ; o.onPick(item) ; o.free = boleh teks bebas ; o.onClear()
    let box = null, idx = -1, cur = [];
    const wrap = document.createElement('div'); wrap.className = 'cb'; input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.autocomplete = 'off';
    const norm = s => String(s == null ? '' : s).toLowerCase();
    function hide() { if (box) { box.remove(); box = null; } idx = -1; input.setAttribute('aria-expanded', 'false'); }
    function paint() { if (!box) return; [...box.children].forEach((li, i) => li.classList.toggle('on', i === idx)); const a = box.children[idx]; if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' }); }
    function pick(it) { if (!it || it.off) return; input.value = it.value != null ? it.value : it.label; hide(); if (o.onPick) o.onPick(it); }
    function show() {
      const q = norm(input.value).trim(), all = o.items() || [];
      cur = all.filter(it => !q || norm(it.hay || (it.label + ' ' + (it.sub || ''))).indexOf(q) > -1).slice(0, MAX);
      if (!box) { box = document.createElement('ul'); box.className = 'cb-list'; box.setAttribute('role', 'listbox'); wrap.appendChild(box); input.setAttribute('aria-expanded', 'true'); box.addEventListener('mousedown', e => e.preventDefault()); }
      box.textContent = '';
      if (!cur.length) { const li = document.createElement('li'); li.className = 'cb-none'; li.textContent = o.free ? 'Tidak ada saran — teks Anda dipakai apa adanya' : 'Tidak ditemukan'; box.appendChild(li); idx = -1; return; }
      cur.forEach((it, i) => { const li = document.createElement('li'); li.setAttribute('role', 'option'); if (it.off) { li.className = 'off'; li.setAttribute('aria-disabled', 'true'); }
        const a = document.createElement('span'); a.className = 'cb-a'; a.textContent = it.label; li.appendChild(a); if (it.sub) { const b = document.createElement('small'); b.textContent = it.sub; li.appendChild(b); }
        li.addEventListener('click', () => pick(it)); li.addEventListener('mousemove', () => { idx = i; paint(); }); box.appendChild(li); });
      idx = cur.findIndex(x => !x.off); paint();
    }
    input.addEventListener('input', () => { if (o.onClear) o.onClear(); show(); });
    input.addEventListener('focus', show); input.addEventListener('click', () => { if (!box) show(); });
    input.addEventListener('blur', () => setTimeout(hide, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!box) show(); const n = cur.length; if (!n) return; let i = idx, t = 0; do { i = (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; t++; } while (cur[i].off && t <= n); idx = i; paint(); }
      else if (e.key === 'Enter') { if (box && idx > -1 && cur[idx]) { e.preventDefault(); pick(cur[idx]); } }
      else if (e.key === 'Escape') { if (box) { e.stopPropagation(); hide(); } }
    });
    return { hide, show };
  }
  window.combo = combo;

  const $ = id => document.getElementById(id), esc_ = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stokItems = tp => () => ((S.stok && S.stok[tp]) || []).map(i => { const n = Number(i.stok) || 0; return { id: String(i.id), label: i.nama, sub: n > 0 ? 'stok ' + n : 'HABIS', off: n <= 0, value: i.nama, hay: i.nama }; });
  window.comboStok = stokItems; // dipakai konsul.js (resep) — bila perlu

  // ---- Proses Pasien: obat & BHP bisa diketik
  window.mProses = function mProses(id) {
    PI = { obat: [], bhp: [] };
    openM('<h3>Proses Pasien ' + esc_(id) + '</h3><label>Dokter</label><select id="mD">' + opts(S.master.dokter, 'Pilih dokter') + '</select><label>Asisten</label><select id="mA">' + opts(S.master.asisten, 'Pilih asisten') + '</select>' +
      ['obat', 'bhp'].map(tp => '<label>' + tp.toUpperCase() + ' digunakan</label><div style="display:flex;gap:6px;align-items:flex-start"><div style="flex:1;min-width:0"><input id="ms_' + tp + '" placeholder="Ketik untuk mencari ' + tp.toUpperCase() + '…" data-id=""></div><input id="mq_' + tp + '" type="number" min="1" value="1" style="width:80px" aria-label="Jumlah"><button class="btn-sm" type="button" onclick="addPI(\'' + tp + '\')" aria-label="Tambah"><i class="bi bi-plus-lg"></i></button></div><div id="ml_' + tp + '" style="font-size:12px;color:var(--mute)"></div>').join('') +
      '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button><button onclick="doProses(\'' + esc_(id) + '\')"><i class="bi bi-check2-circle"></i> Tandai Selesai</button></div>');
    ['obat', 'bhp'].forEach(tp => { const inp = $('ms_' + tp); combo(inp, { items: stokItems(tp), onPick: it => { inp.dataset.id = it.id; $('mq_' + tp).focus(); $('mq_' + tp).select(); }, onClear: () => { inp.dataset.id = ''; } });
      $('mq_' + tp).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPI(tp); inp.focus(); } }); });
  };
  window.addPI = function addPI(tp) {
    const inp = $('ms_' + tp), id = inp.dataset.id, q = Number($('mq_' + tp).value) || 0, it = S.stok[tp].filter(x => String(x.id) === String(id))[0];
    if (!it) { $('mm').textContent = 'Pilih ' + tp.toUpperCase() + ' dari daftar saran.'; return; } if (q <= 0) return; $('mm').textContent = '';
    const ex = PI[tp].filter(x => String(x.id) === String(id))[0]; if (ex) ex.jumlah += q; else PI[tp].push({ id: id, nama: it.nama, jumlah: q });
    $('ml_' + tp).innerHTML = PI[tp].map(x => esc_(x.nama) + ' x' + x.jumlah).join(' · '); inp.value = ''; inp.dataset.id = ''; $('mq_' + tp).value = 1;
  };

  // ---- Homevisite: cari pasien terdaftar (nama anak / ID / nama ortu / HP)
  window.mHv = function mHv() {
    const staff = {}; ['dokter', 'asisten', 'petugas'].forEach(r => S.master[r].forEach(x => staff[x.Nama] = 1));
    openM('<h3>Tambah Homevisite</h3><label>Pasien terdaftar (opsional)</label><input type="hidden" id="hP" value=""><input id="hPq" placeholder="Cari nama anak, ID booking, nama ortu, atau HP…"><div id="hPi" style="font-size:12px;color:var(--mute);margin-top:2px">Kosongkan bila pasien baru / manual.</div><label>Nama pasien</label><input id="hN"><label>Alamat</label><textarea id="hA" rows="2"></textarea><label>No HP</label><input id="hW" inputmode="tel">' +
      '<label>Tanggal</label><input type="date" id="hT" value="' + today_() + '"><label>Petugas homevisite</label><select id="hS"><option value="">Pilih</option>' + Object.keys(staff).map(n => '<option>' + esc_(n) + '</option>').join('') + '</select><label>Catatan</label><input id="hC">' + btnRow('doHv()'));
    combo($('hPq'), {
      items: () => (S.bk || []).map(b => ({ id: b.ID, label: b.NamaAnak + ' — ' + b.Tanggal, sub: [b.ID, b.NamaOrtu, b.NoHP].filter(Boolean).join(' · '), hay: [b.NamaAnak, b.ID, b.NamaOrtu, b.NoHP].join(' ') })),
      onPick: it => { $('hP').value = it.id; $('hPi').textContent = 'Terhubung ke booking ' + it.id; pickHv(); }, onClear: () => { $('hP').value = ''; $('hPi').textContent = 'Kosongkan bila pasien baru / manual.'; }
    });
  };
})();
