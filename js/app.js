// ===== State (token HANYA di memori, tidak pernah di URL) =====
const S = { token: null, role: '', nama: '', cab: '', master: null, bk: [], stok: { obat: [], bhp: [] }, docs: {}, epoch: 0, t: {}, sig: {} };
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const rp = n => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
const isOwner = () => S.role === 'Owner';
function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; }

// Format nomor ke internasional: 0812.. -> 62812.. ; tanpa teks otomatis (chat kosong)
function waLink(no) {
  let d = String(no || '').replace(/\D/g, '');
  if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d;
  return d.length >= 10 ? 'https://wa.me/' + d : '';
}
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.remove('hide'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hide'), 2600); }
function show(v) { ['login', 'app'].forEach(x => $(x).classList.toggle('hide', x !== v)); }

// (call() sekarang ada di js/api.js — memakai fetch ke Google Apps Script)

// ===== Layar loading: video tampil selama login + data semua menu disiapkan di latar belakang =====
function showLoad(txt) {
  TOT = 0; DONE = 0; barUpdate(0); barRamp(true);
  const s = $('loadScr'), v = $('loadVid'); loadText(txt);
  if (!v.src) {
    v.poster = 'assets/loading-poster.jpg'; v.src = 'assets/loading.mp4';
    v.onerror = () => { v.classList.add('hide'); $('loadSpin').classList.remove('hide'); }; // video gagal diputar: pakai spinner
  }
  s.classList.remove('hide', 'out');
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
}
function hideLoad() {
  const s = $('loadScr'); if (!s || s.classList.contains('hide')) return;
  barRamp(false);
  s.classList.add('out'); setTimeout(() => { s.classList.add('hide'); try { $('loadVid').pause(); } catch (e) {} }, 380);
}
function loadText(t) { const e = $('loadTxt'); if (e && t) e.textContent = t; }
let RAMP = 0, RAMP_T = null;
function barRamp(on) { clearInterval(RAMP_T); RAMP = 0; if (on) RAMP_T = setInterval(() => { RAMP += (90 - RAMP) * 0.07; barUpdate(); }, 250); } // bar bergerak pelan selagi menunggu 1 panggilan besar
function barUpdate(force) { const b = $('loadBar'); if (!b) return; b.style.width = (force !== undefined ? force : Math.min(95, Math.max(Math.round(RAMP), Math.round(DONE / Math.max(TOT, 1) * 100)))) + '%'; }
// Muat semua data menu di muka (dashboard, booking, stok, dokumen, homevisite, keuangan, laporan, + master untuk Owner)
function prefetchAll() { refreshAll(true); }
function enterApp(minMs) { // tunggu semua panggilan selesai (min. supaya tidak berkedip, maks. 25 dtk), lalu buka aplikasi
  const t0 = Date.now(); let fin = false;
  const go = () => { if (fin) return; fin = true; IDLE_CB = null; if (!S.token) { hideLoad(); return; } barUpdate(100); loadText('Siap!'); setTimeout(() => { show('app'); showSec('dash'); hideLoad(); }, 250); };
  const check = () => { const w = minMs - (Date.now() - t0); if (w > 0) setTimeout(go, w); else go(); };
  setTimeout(() => { if (PEND > 0) go(); }, 25000);
  if (PEND <= 0) check(); else IDLE_CB = check;
}

// ===== Login / logout =====
function authLost(msg) { const r0 = S.restoring || !S.token; resetState(); hideLoad(); show('login'); if (!r0) toast(msg || 'Sesi berakhir, silakan login lagi.'); warmUpServer(); }
function doLogin() {
  const u = $('lu').value.trim(), p = $('lp').value; $('lmsg').textContent = '';
  if (!u || !p) { $('lmsg').textContent = 'Username dan password wajib diisi.'; return; }
  if ($('lbtn').disabled) return;
  $('lbtn').disabled = true; $('lbtn').textContent = 'Memproses...'; showLoad('Memeriksa akun...');
  const reset = () => { $('lbtn').disabled = false; $('lbtn').textContent = 'Masuk'; };
  call('login', [u, p, rangeNow()], d => {
    reset();
    Object.assign(S, { token: d.token, role: d.role, nama: d.nama, cab: d.role === 'Owner' ? 'ALL' : d.cabang, bk: [], hv: [], stok: { obat: [], bhp: [] }, docs: {}, epoch: S.epoch + 1, t: {}, sig: {} });
    $('lp').value = ''; $('who').textContent = d.nama + ' · ' + d.role; setWelcome(d.nama, d.role);
    ls('kp_sess', { token: d.token, role: d.role, nama: d.nama, cab: S.cab, exp: Date.now() + 5.9 * 3600000 }); // tetap login ±6 jam (sama dengan masa sesi server)
    loadText('Menyiapkan data untuk ' + d.nama + '...'); if (d.boot) ingest(d.boot); else prefetchAll(); enterApp(1500);
  }, m => { reset(); hideLoad(); $('lmsg').textContent = m; });
}
function resetState() { Object.assign(S, { token: null, role: '', nama: '', cab: '', master: null, bk: [], hv: [], stok: { obat: [], bhp: [] }, docs: {}, adm: null, stf: null, restoring: false, epoch: S.epoch + 1, t: {}, sig: {} });
  ['tB', 'tP', 'tH', 'kPen', 'kOut'].forEach(i => { const e = $(i); if (e) e.innerHTML = ''; }); // data pasien tidak tertinggal di layar setelah keluar
  const nb = $('netBar'); if (nb) nb.classList.add('hide'); try { localStorage.removeItem('kp_sess'); } catch (e) {} }
function doLogout() { if (S.token) api('logout', {}); resetState(); show('login'); }

// ===== Bootstrap & prefetch di latar belakang =====
function ingestMaster(m) {
  S.restoring = false; S.master = m; const sel = $('cabSel');
  $('cabWrap').classList.toggle('hide', !isOwner()); $('navMaster').classList.toggle('hide', !isOwner()); $('navStaff').classList.toggle('hide', !isOwner());
  sel.innerHTML = (isOwner() ? '<option value="ALL">Semua Cabang (Gabungan)</option>' : '') +
    m.cabang.map(c => '<option value="' + esc(c.CabangID) + '">' + esc(c.Nama) + '</option>').join('');
  sel.value = S.cab; fillForm();
}
function setCabang(v) { S.cab = v; S.epoch++; S.t = {}; S.bk = []; S.hv = []; S.stok = { obat: [], bhp: [] }; S.docs = {}; renderB(); renderP(); refreshAll(true); }
function loadAll() { pull(['dash', 'bk', 'stokO', 'stokB', 'docs'], true); } // dipanggil setelah menulis data: 1 panggilan, bukan 5

// ===== Lapisan data: banyak menu diambil dalam 1 panggilan (batch) =====
// Setiap sumber: aksi server, parameter, dan cara menampilkannya. Urutan kunci = urutan penerapan (master dulu).
const SRC = {
  boot:  { a: 'getBootstrap', d: () => ({ cab: S.cab }), ok: d => ingestMaster(d) },
  dash:  { a: 'getDashboard', d: () => ({ cab: S.cab }), ok: d => renderDash(d) },
  bk:    { a: 'getBookings', d: () => ({ cab: S.cab, status: '' }), ok: d => { S.bk = d; renderB(); renderP(); } },
  stokO: { a: 'getStok', d: () => ({ cab: S.cab, tipe: 'obat' }), ok: d => { S.stok.obat = d; renderStok('obat'); } },
  stokB: { a: 'getStok', d: () => ({ cab: S.cab, tipe: 'bhp' }), ok: d => { S.stok.bhp = d; renderStok('bhp'); } },
  docs:  { a: 'getDokumen', d: () => ({ cab: S.cab }), ok: l => { S.docs = {}; l.forEach(r => S.docs[r.Kunci] = r.Url); } },
  hv:    { a: 'getHomevisit', d: () => ({ cab: S.cab }), ok: l => { S.hv = l; renderHv(); } },
  keu:   { a: 'getKeuangan', d: () => ({ cab: S.cab, dari: $('kD').value, sampai: $('kS').value }), ok: d => renderKeu(d) },
  lap:   { a: 'getLaporan', d: () => ({ cab: S.cab, dari: $('lD').value, sampai: $('lS').value }), ok: d => renderLap(d) },
  adm:   { a: 'getMaster', d: () => ({}), ok: d => { S.adm = d; renderMaster(); } },
  stf:   { a: 'getAdminStaff', d: () => ({}), ok: d => { S.stf = d; renderStaff(); } }
};
const FRESH_MS = 20000; // data yang baru diambil < 20 dtk tidak diminta lagi saat pindah menu
function ensureDates() { const t = today_(), m = t.slice(0, 8) + '01'; if (!$('kS').value) { $('kS').value = t; $('kD').value = m; } if (!$('lS').value) { $('lS').value = t; $('lD').value = m; } }
function rangeNow() { ensureDates(); return { kD: $('kD').value, kS: $('kS').value, lD: $('lD').value, lS: $('lS').value }; }
function showNet(m) { $('netMsg').textContent = m || 'Gagal memuat data.'; $('netBar').classList.remove('hide'); }
function netOk() { $('netBar').classList.add('hide'); }
// Terapkan hasil batch ke layar. Mengembalikan pesan galat pertama (jika ada).
function ingest(res) {
  let bad = '';
  Object.keys(SRC).forEach(k => {
    const r = res && res[k]; if (!r) return;
    if (r.success) { S.t[k] = Date.now(); if (S.sig[k] === undefined) S.sig[k] = JSON.stringify(SRC[k].d()); try { SRC[k].ok(r.data); } catch (e) { console.error(k, e); } }
    else if (r.code === 'AUTH') authLost(r.message);
    else if (!bad) bad = r.message || 'Gagal memuat data.';
  });
  return bad;
}
function pull(keys, force, done) {
  keys = keys.filter(k => (k !== 'adm' && k !== 'stf') || isOwner());
  ensureDates();
  const calls = [];
  keys.forEach(k => {
    const data = SRC[k].d(), sg = JSON.stringify(data);
    if (!force && S.t[k] && Date.now() - S.t[k] < FRESH_MS && S.sig[k] === sg) return; // masih segar & parameter sama
    S.sig[k] = sg; calls.push({ k: k, action: SRC[k].a, data: data });
  });
  if (!calls.length) { done && done(); return; }
  const ep = S.epoch;
  call('batch', { calls: calls }, res => {
    if (ep !== S.epoch) return; // jawaban dari cabang/sesi lama diabaikan
    netOk(); const bad = ingest(res); if (bad) toast(bad); done && done();
  }, m => { if (ep === S.epoch) showNet(m); });
}
function refreshAll(force) { ensureDates(); pull(['boot', 'dash', 'bk', 'stokO', 'stokB', 'docs', 'hv', 'keu', 'lap', 'adm', 'stf'], force !== false); }

// ===== Navigasi SPA (0 ms, tanpa google.script.run) =====
function setWelcome(nama, role) { $('wName').textContent = nama; $('wRole').textContent = role; }
function showSec(s) {
  document.querySelectorAll('.sec-app').forEach(x => x.classList.toggle('active', x.id === 's-' + s));
  document.querySelectorAll('.nav[data-s]').forEach(b => b.classList.toggle('active', b.dataset.s === s));
}
function nav(s) {
  showSec(s);
  if (s === 'dash') loadDash(); if (s === 'booking' || s === 'proses') loadBk(); if (s === 'stok') loadStok(); if (s === 'keu') initKeu(); if (s === 'master') loadMaster(); if (s === 'hv') loadHv(); if (s === 'lap') initLap(); if (s === 'staff') loadStaff();
}
function toggleTheme() { const h = document.documentElement; h.dataset.theme = h.dataset.theme === 'dark' ? 'light' : 'dark'; ls('kp_theme', h.dataset.theme); }
(function () { const t = ls('kp_theme'); if (t) document.documentElement.dataset.theme = t; })();

// ===== Dashboard =====
function loadDash(force) { pull(['dash'], force); }
function renderDash(d) {
  $('k1').textContent = d.bulanIni; $('k2').textContent = d.booking; $('k3').textContent = d.selesaiBulanIni;
  const nm = S.master ? (S.master.cabang.filter(c => c.CabangID === S.cab)[0] || {}).Nama : '';
  $('dCab').textContent = S.cab === 'ALL' ? 'Semua cabang (gabungan)' : (nm || '');
  const mx = Math.max.apply(null, d.trend.map(t => t.jumlah).concat([1]));
  $('trend').innerHTML = d.trend.map(t => '<div><b style="color:var(--ink)">' + (t.jumlah || '') + '</b><i style="height:' + Math.round(t.jumlah / mx * 110) + 'px"></i>' + t.bulan + '</div>').join('');
  $('dist').innerHTML = donut(d.distribusi);
  $('low').innerHTML = (d.stokMenipis || []).map(x => '<tr><td>' + esc(x.nama) + '</td><td><span class="badge b-wait">' + x.tipe + '</span></td><td style="color:var(--red)"><b>' + x.stok + '</b></td><td>' + (x.stok <= 0 ? 'Habis' : x.stok <= 3 ? 'Kritis' : 'Menipis') + '</td></tr>').join('') || '<tr><td style="color:var(--mute)">Semua stok aman.</td></tr>';
  $('cmpCard').classList.toggle('hide', !d.perCabang);
  if (d.perCabang) $('cmp').innerHTML = d.perCabang.map(c => '<tr><td><b>' + esc(c.nama) + '</b></td><td>' + c.pasien + '</td><td>' + c.selesai + '</td><td>' + c.booking + '</td><td>' + rp(c.pendapatan) + '</td></tr>').join('');
}

// ===== Dashboard: daftar pasien bulan ini (klik kartu "Pasien bulan ini") =====
let PB = { list: [], f: 'all', label: '' };
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function openPasienBulan() {
  const n = new Date(), ym = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  PB.f = 'all'; PB.label = BLN[n.getMonth()] + ' ' + n.getFullYear();
  openM('<h3><i class="bi bi-people"></i> Pasien bulan ini</h3><div style="color:var(--mute);margin-top:8px">Memuat data...</div>'); $('modalBody').style.maxWidth = '560px';
  call('getBookings', [S.cab, ''], list => { PB.list = list.filter(b => String(b.Tanggal).indexOf(ym) === 0); renderPB(); }, m => { closeM(); toast(m); });
}
const pbVis = () => PB.list.filter(b => PB.f === 'all' || (PB.f === 'done' ? b.Status === 'Selesai' : b.Status !== 'Selesai'));
function renderPB() {
  const done = PB.list.filter(b => b.Status === 'Selesai').length, wait = PB.list.length - done, v = pbVis();
  const chip = (k, t) => '<button class="btn-sm ' + (PB.f === k ? 'btn-navy' : 'btn-ghost') + '" style="' + (PB.f === k ? '' : 'color:var(--ink)') + '" onclick="PB.f=\'' + k + '\';renderPB()">' + t + '</button>';
  $('modalBody').innerHTML = '<h3><i class="bi bi-people"></i> Pasien bulan ini — ' + PB.label + '</h3>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' + chip('all', 'Semua (' + PB.list.length + ')') + chip('done', '<i class="bi bi-check-circle-fill"></i> Selesai (' + done + ')') + chip('wait', '<i class="bi bi-hourglass-split"></i> Menunggu (' + wait + ')') + '</div>' +
    '<div style="max-height:52vh;overflow:auto">' + (v.map(b => { const ok = b.Status === 'Selesai', w = waLink(b.NoHP);
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)">' +
        '<span style="font-size:20px;line-height:1.2;color:' + (ok ? '#15803D' : '#B45309') + '"><i class="bi ' + (ok ? 'bi-check-circle-fill' : 'bi-hourglass-split') + '"></i></span>' +
        '<div style="flex:1;min-width:0"><b>' + esc(b.NamaAnak) + '</b> <span class="badge ' + (ok ? 'b-ok' : 'b-wait') + '">' + (ok ? 'Selesai' : 'Booking menunggu') + '</span>' +
        '<div style="font-size:12px;color:var(--mute)">' + esc(b.NamaOrtu || '-') + ' · ' + tgl_(b.Tanggal) + ' ' + esc(b.Jam || '') + ' · ' + esc(b.NamaPaket) + '</div></div>' +
        (w ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + w + '" title="Chat orang tua"><i class="bi bi-whatsapp"></i></a>' : '') + '</div>'; }).join('') || '<div style="color:var(--mute);padding:12px 0">Tidak ada data.</div>') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px"><button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Tutup</button>' +
    '<button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="salinPB()"><i class="bi bi-clipboard"></i> Salin teks</button>' +
    '<button class="btn-sm btn-wa" onclick="kirimWaPB()"><i class="bi bi-whatsapp"></i> Kirim daftar via WhatsApp</button></div>';
}
function teksPB() { // teks daftar sesuai filter aktif; emoji ditulis sebagai kode unicode agar tidak rusak saat file ditempel
  const v = pbVis(); if (!v.length) return '';
  const judul = { all: 'Semua', done: 'Selesai', wait: 'Booking Menunggu' }[PB.f];
  return ['*Data Pasien ' + PB.label + ' \u2014 ' + judul + ' (' + v.length + ')*', ''].concat(v.map((b, i) =>
    (i + 1) + '. ' + (b.Status === 'Selesai' ? '\u2705' : '\u23F3') + ' ' + b.NamaAnak + ' - ' + tgl_(b.Tanggal) + ' ' + (b.Jam || '') + ' - ' + b.NamaPaket)).join('\n');
}
function kirimWaPB() { // buka WhatsApp tanpa nomor tujuan: pilih sendiri kontaknya
  const t = teksPB(); if (!t) { toast('Tidak ada data'); return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}
function salinPB() { // cadangan: salin teks lalu tempel manual di WhatsApp (emoji pasti ikut)
  const t = teksPB(); if (!t) { toast('Tidak ada data'); return; }
  const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
  try { navigator.clipboard.writeText(t); } catch (x) { document.execCommand('copy'); }
  document.body.removeChild(ta); toast('Teks disalin');
}

const DPAL = ['#00C2CB', '#1E40AF', '#F59E0B', '#EF4444', '#10B981', '#7C3AED', '#0891B2', '#DB2777'];
function donut(list) {
  if (!list.length) return '<p style="color:var(--mute)">Belum ada data.</p>';
  const total = list.reduce((a, x) => a + x.jumlah, 0) || 1, C = 2 * Math.PI * 54; let off = 0;
  const seg = list.map((x, i) => { const len = x.jumlah / total * C, c = '<circle cx="70" cy="70" r="54" fill="none" stroke="' + DPAL[i % 8] + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"><title>' + esc(x.nama) + ': ' + x.jumlah + '</title></circle>'; off += len; return c; }).join('');
  const leg = list.map((x, i) => '<div style="display:flex;align-items:center;gap:8px;margin:6px 0"><span style="width:10px;height:10px;border-radius:3px;background:' + DPAL[i % 8] + ';flex:0 0 auto"></span><span style="flex:1">' + esc(x.nama) + '</span><b>' + x.jumlah + '</b><span style="color:var(--mute);min-width:42px;text-align:right">' + Math.round(x.jumlah / total * 100) + '%</span></div>').join('');
  return '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 140 140" style="width:170px;height:170px;flex:0 0 auto" role="img" aria-label="Diagram donat distribusi paket"><circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" stroke-width="22"/>' + seg +
    '<text x="70" y="68" text-anchor="middle" font-size="24" font-weight="800" style="fill:var(--ink)">' + total + '</text><text x="70" y="86" text-anchor="middle" font-size="10" style="fill:var(--mute)">booking</text></svg><div style="flex:1;min-width:200px">' + leg + '</div></div>';
}

// ===== Pendaftaran =====
function fillForm() {
  $('fPaket').innerHTML = '<option value="">Pilih</option>' + S.master.paket.map(p => '<option value="' + esc(p.id) + '" data-h="' + p.harga + '">' + esc(p.nama) + ' — ' + rp(p.harga) + '</option>').join('');
  if (!$('fTgl').value) $('fTgl').value = today_();
  hit();
}
function hit() { // hitung total/sisa instan di browser (server tetap menghitung ulang)
  const o = $('fPaket').selectedOptions[0], h = Number(o && o.dataset.h) || 0, dk = Math.min(Number($('fDisk').value) || 0, h), tot = h - dk;
  const lunas = $('fSt').value === 'lunas'; $('dpBox').classList.toggle('hide', lunas);
  const dp = lunas ? tot : Math.min(Number($('fDp').value) || 0, tot);
  $('fTot').value = 'Total ' + rp(tot) + ' · Sisa ' + rp(tot - dp);
}
function simpanBooking() {
  const d = { cabang: S.cab, tanggal: $('fTgl').value, jam: $('fJam').value, namaAnak: $('fAnak').value, usia: $('fUsia').value, namaOrtu: $('fOrtu').value,
    noHp: $('fHp').value, alamat: $('fAlm').value, beratBadan: $('fBerat').value, riwayat: $('fRiw').value, paketId: $('fPaket').value, diskon: $('fDisk').value, status: $('fSt').value, dp: $('fDp').value, metode: $('fMet').value };
  const m = $('fmsg'); m.textContent = '';
  if (isOwner() && S.cab === 'ALL') { m.textContent = 'Pilih satu cabang di sidebar terlebih dahulu.'; return; }
  if (!d.tanggal || !d.jam || !d.namaAnak.trim() || !d.paketId || !d.metode) { m.textContent = 'Tanggal, jam, nama anak, paket, dan metode wajib diisi.'; return; }
  $('fbtn').disabled = true; $('fbtn').textContent = 'Menyimpan...';
  call('createBooking', [d], (r, resp) => {
    $('fbtn').disabled = false; $('fbtn').textContent = 'Simpan Booking'; toast(resp.message); const txt = bookingText(d);
    ['fAnak', 'fUsia', 'fBerat', 'fOrtu', 'fHp', 'fAlm', 'fRiw'].forEach(i => $(i).value = ''); $('fDp').value = 0; $('fDisk').value = 0; hit(); loadBk(true); mWaBooking(txt, d.noHp);
  }, e => { $('fbtn').disabled = false; $('fbtn').textContent = 'Simpan Booking'; m.textContent = e; });
}

// ===== Formulir booking siap kirim ke WhatsApp =====
function bookingText(d) {
  const tg = t => { const p = String(t || '').split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : (t || '-'); };
  return ['🧾 FORMULIR BOOKING KHITAN PRIME', 'Khitan Premium – Nyaman, Aman, Profesional, Sunat Ceria, Anak Bahagia', '📅 Tanggal Booking: ' + tg(d.tanggal), '⏰ Jam yang Diinginkan: ' + d.jam, '',
    '👦 DATA ANAK', '• Nama Lengkap Anak: ' + d.namaAnak, '• Usia: ' + (d.usia || '-'), '• Berat Badan (kg): ' + (d.beratBadan || '-'), '• Riwayat Penyakit / Alergi:',
    d.riwayat ? '☐ Tidak ada\n☑ Ada, sebutkan: ' + d.riwayat : '☑ Tidak ada\n☐ Ada, sebutkan: ..........................', '',
    '👪 DATA ORANG TUA / WALI', '• Nama Orang Tua/Wali: ' + (d.namaOrtu || '-'), '• Nomor HP (WhatsApp): ' + (d.noHp || '-'), '• Alamat Lengkap: ' + (d.alamat || '-'), '', '📦 PAKET YANG DIPILIH']
    .concat(S.master.paket.map(p => (String(p.id) === String(d.paketId) ? '☑ ' : '☐ ') + p.nama)).concat(['', 'Catatan Tambahan:', '..........................................']).join('\n');
}
function mWaBooking(txt, hp) {
  const l = waLink(hp);
  openM('<h3>Siap dikirim ke WhatsApp</h3><p style="color:var(--mute);margin:4px 0">Booking tersimpan. Periksa formulir, lalu pilih kontak tujuan di WhatsApp.</p><textarea id="waTxt" rows="13" readonly style="font-size:12px">' + esc(txt) + '</textarea>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px"><button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Tutup</button><button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="salinWa()"><i class="bi bi-clipboard"></i> Salin</button>' +
    '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '"><i class="bi bi-whatsapp"></i> Kirim via WhatsApp</a></div>');
}
function salinWa() { const t = $('waTxt'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand('copy'); } toast('Teks disalin'); }

// ===== Daftar pasien =====
function loadBk(force) {
  if (S.bk.length || S.t.bk) { renderB(); renderP(); }
  else { $('tB').innerHTML = $('tP').innerHTML = '<tr><td colspan="6"><div class="skel"></div></td></tr>'; }
  pull(['bk'], force);
}
const waBtn = b => { const l = waLink(b.NoHP);
  return l ? '<a class="btn btn-wa ic" target="_blank" rel="noopener" href="' + l + '" aria-label="WhatsApp ' + esc(b.NamaAnak) + '" title="Chat WhatsApp"><i class="bi bi-whatsapp"></i></a>' : '<button class="ic off" disabled aria-label="Nomor kosong" title="Nomor HP kosong/tidak valid"><i class="bi bi-whatsapp"></i></button>'; };
const moreBtn = id => '<button class="ic btn-ghost" style="color:var(--ink)" onclick="mAksi(\'' + id + '\')" aria-label="Aksi lainnya" title="Aksi lainnya"><i class="bi bi-three-dots-vertical"></i></button>';
const aksiBtn = (ic, label, fn, cls) => '<button class="' + (cls || 'btn-ghost') + '" style="width:100%;justify-content:flex-start;margin-top:8px;' + (cls ? '' : 'color:var(--ink)') + '" onclick="' + fn + '"><i class="bi ' + ic + '"></i> ' + label + '</button>';
function mAksi(id) {
  const b = S.bk.filter(x => x.ID === id)[0]; if (!b) return; const wait = b.Status === 'Belum Diproses';
  openM('<h3>' + esc(b.NamaAnak) + ' <small style="color:var(--mute);font-weight:500">' + esc(b.ID) + '</small></h3>' + aksiBtn('bi-file-earmark-pdf', 'Dokumen (PDF &amp; tanda tangan)', "mDok('" + id + "')") +
    aksiBtn('bi-pencil-square', 'Ubah data', "mUbah('" + id + "')") + (Number(b.Sisa) > 0 ? aksiBtn('bi-cash-coin', 'Pelunasan (bayar sisa)', "mLunas('" + id + "')") : '') + (wait ? aksiBtn('bi-calendar2-week', 'Ubah jadwal (reschedule)', "mResched('" + id + "')") : '') + (isOwner() ? aksiBtn('bi-trash3', 'Hapus data', "closeM();hapus('" + id + "')", 'btn-red') : '') +
    '<div style="text-align:right;margin-top:12px"><button class="btn-sm btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Tutup</button></div>');
}
const hit_ = (b, q) => !q || (b.NamaAnak + ' ' + b.ID).toLowerCase().indexOf(q.toLowerCase()) > -1;
function renderB() {
  const rows = S.bk.filter(b => b.Status === 'Belum Diproses' && hit_(b, $('qB').value) && inRange(b.Tanggal, 'fb'));
  $('tB').innerHTML = rows.map(b => '<tr><td style="color:var(--navy);font-weight:700">' + esc(b.ID) + '</td><td><b>' + esc(b.NamaAnak) + '</b></td><td>' + esc(b.NamaOrtu) + '</td><td>' + esc(b.NoHP || '-') + '</td><td>' + esc(b.Tanggal) + '</td><td>' + esc(b.Jam) + '</td><td>' + esc(b.NamaPaket) +
    '</td><td>' + rp(b.DP) + '</td><td>' + rp(b.Sisa) + '</td><td><span class="badge b-wait">Belum Diproses</span></td><td><div class="act">' + waBtn(b) + '<button class="btn-sm btn-navy" onclick="mProses(\'' + b.ID + '\')"><i class="bi bi-check2-square"></i> Proses</button>' + moreBtn(b.ID) + '</div></td></tr>').join('') || '<tr><td colspan="11" style="color:var(--mute)">Tidak ada data.</td></tr>';
}
function renderP() {
  const rows = S.bk.filter(b => b.Status === 'Selesai' && hit_(b, $('qP').value) && inRange(b.TanggalProses, 'fp'));
  $('tP').innerHTML = rows.map(b => '<tr><td style="color:var(--navy);font-weight:700">' + esc(b.ID) + '</td><td><b>' + esc(b.NamaAnak) + '</b></td><td>' + esc(b.NamaOrtu) + '</td><td>' + esc(b.Dokter) + '</td><td>' + esc(b.Asisten) + '</td><td>' + esc(b.TanggalProses) + '</td><td>' + esc(b.NamaPaket) +
    '</td><td>' + rp((Number(b.Harga) || 0) - (Number(b.Diskon) || 0)) + '</td><td><span class="badge b-ok">Selesai</span></td><td><div class="act">' + waBtn(b) + '<button class="btn-sm btn-navy" onclick="mDok(\'' + b.ID + '\')"><i class="bi bi-file-earmark-pdf"></i> Dokumen</button>' + (isOwner() ? moreBtn(b.ID) : '') + '</div></td></tr>').join('') || '<tr><td colspan="10" style="color:var(--mute)">Tidak ada data.</td></tr>';
}

// ===== Modal proses / reschedule =====
function openM(html) { $('modalBody').style.maxWidth = ''; $('modalBody').innerHTML = html; $('modal').classList.remove('hide'); }
function closeM() { $('modal').classList.add('hide'); }
const opts = (a, ph) => '<option value="">' + ph + '</option>' + a.map(x => '<option>' + esc(x.Nama) + '</option>').join('');
let PI = { obat: [], bhp: [] };
function mProses(id) {
  PI = { obat: [], bhp: [] };
  openM('<h3>Proses Pasien ' + id + '</h3><label>Dokter</label><select id="mD">' + opts(S.master.dokter, 'Pilih dokter') + '</select><label>Asisten</label><select id="mA">' + opts(S.master.asisten, 'Pilih asisten') + '</select>' +
    ['obat', 'bhp'].map(tp => '<label>' + tp.toUpperCase() + ' digunakan</label><div style="display:flex;gap:6px"><select id="ms_' + tp + '"><option value="">Pilih</option>' +
      S.stok[tp].map(i => '<option value="' + esc(i.id) + '">' + esc(i.nama) + ' (' + i.stok + ')</option>').join('') + '</select><input id="mq_' + tp + '" type="number" min="1" value="1" style="width:80px"><button class="btn-sm" onclick="addPI(\'' + tp + '\')"><i class="bi bi-plus-lg"></i></button></div><div id="ml_' + tp + '" style="font-size:12px;color:var(--mute)"></div>').join('') +
    '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button><button onclick="doProses(\'' + id + '\')"><i class="bi bi-check2-circle"></i> Tandai Selesai</button></div>');
}
function addPI(tp) {
  const id = $('ms_' + tp).value, q = Number($('mq_' + tp).value) || 0, it = S.stok[tp].filter(x => String(x.id) === String(id))[0]; if (!it || q <= 0) return;
  const ex = PI[tp].filter(x => String(x.id) === String(id))[0]; if (ex) ex.jumlah += q; else PI[tp].push({ id: id, nama: it.nama, jumlah: q });
  $('ml_' + tp).innerHTML = PI[tp].map(x => esc(x.nama) + ' x' + x.jumlah).join(' · ');
}
function doProses(id) {
  const d = $('mD').value, a = $('mA').value; if (!d || !a) { $('mm').textContent = 'Dokter dan asisten wajib dipilih.'; return; }
  const items = PI.obat.map(x => ({ tipe: 'obat', id: x.id, jumlah: x.jumlah })).concat(PI.bhp.map(x => ({ tipe: 'bhp', id: x.id, jumlah: x.jumlah })));
  const b = S.bk.filter(x => x.ID === id)[0]; if (b) { b.Status = 'Selesai'; b.Dokter = d; b.Asisten = a; b.TanggalProses = today_(); }
  items.forEach(it => { const s0 = S.stok[it.tipe].filter(x => String(x.id) === String(it.id))[0]; if (s0) s0.stok = Math.max(0, s0.stok - it.jumlah); });
  closeM(); renderB(); renderP(); toast('Pasien diproses');
  call('prosesBooking', [id, d, a, items], () => { loadAll(); preCetakSelesai(id); }, e => { toast(e); loadAll(); });
}
// Setelah pasien diproses: Invoice, Bukti Bayar (dan Laporan Tindakan bila tanda tangan sudah ada) dibuat diam-diam di latar belakang agar saat dicetak langsung terbuka.
function preCetakSelesai(id) {
  ['invoice', 'payment'].concat(S.docs[id + '|TTD'] ? ['tindakan'] : []).forEach(j => {
    delete S.docs[id + '|' + j]; // PDF lama sudah dihapus server saat diproses
    call('cetak', [id, j], d => { if (d && d.url) S.docs[id + '|' + j] = d.url; }, () => {});
  });
}
// ===== Ubah data booking: koreksi nama, HP, alamat, paket, diskon =====
const opsSel = (a, cur, ph) => { const n = a.map(x => x.Nama); if (cur && n.indexOf(cur) < 0) n.unshift(cur); return '<option value="">' + ph + '</option>' + n.map(x => '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>').join(''); };
function mUbah(id) {
  const b = S.bk.filter(x => x.ID === id)[0]; if (!b) return; const lock = b.Status === 'Selesai';
  const pk = S.master.paket.map(p => ({ id: p.id, nama: p.nama, h: Number(p.harga) || 0 })).filter(p => String(p.id) !== String(b.PaketID));
  pk.unshift({ id: b.PaketID, nama: b.NamaPaket, h: Number(b.Harga) || 0 }); // paket saat ini memakai harga saat booking dibuat
  const f = (lb, el) => '<label>' + lb + '</label>' + el, inp = (i, v, ty) => '<input id="' + i + '"' + (ty ? ' type="' + ty + '"' : '') + ' value="' + esc(v == null ? '' : v) + '">';
  openM('<h3><i class="bi bi-pencil-square"></i> Ubah data ' + esc(id) + '</h3>' +
    f('Nama anak *', inp('ubNama', b.NamaAnak)) + f('Usia', inp('ubUsia', b.Usia)) + f('Berat badan', inp('ubBerat', b.BeratBadan)) + f('Nama orang tua', inp('ubOrtu', b.NamaOrtu)) +
    f('Nomor HP', inp('ubHp', b.NoHP, 'tel')) + f('Alamat', '<textarea id="ubAlm" rows="2">' + esc(b.Alamat) + '</textarea>') + f('Riwayat penyakit / alergi', '<textarea id="ubRiw" rows="2">' + esc(b.Riwayat) + '</textarea>') +
    f('Paket', '<select id="ubPak" onchange="hitU(\'' + id + '\')"' + (lock ? ' disabled' : '') + '>' + pk.map(p => '<option value="' + esc(p.id) + '" data-h="' + p.h + '"' + (String(p.id) === String(b.PaketID) ? ' selected' : '') + '>' + esc(p.nama) + ' — ' + rp(p.h) + '</option>').join('') + '</select>') +
    (lock ? f('Dokter', '<select id="ubDok">' + opsSel(S.master.dokter, b.Dokter, 'Pilih dokter') + '</select>') + f('Asisten', '<select id="ubAsi">' + opsSel(S.master.asisten, b.Asisten, 'Pilih asisten') + '</select>') : '') +
    f('Diskon (Rp)', '<input id="ubDisk" type="number" min="0" value="' + (Number(b.Diskon) || 0) + '" oninput="hitU(\'' + id + '\')"' + (lock ? ' disabled' : '') + '>') +
    '<div id="ubTot" style="margin-top:10px;background:var(--cyl);border-radius:10px;padding:10px 12px;font-size:13px"></div>' +
    '<p style="font-size:12px;color:var(--mute);margin:8px 0 0">' + (lock ? 'Paket dan diskon terkunci karena pasien sudah selesai. ' : '') + 'DP dan pelunasan tidak bisa diubah dari sini.</p>' +
    '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button><button onclick="doUbah(\'' + id + '\')"><i class="bi bi-save"></i> Simpan perubahan</button></div>');
  hitU(id);
}
function hitU(id) {
  const b = S.bk.filter(x => x.ID === id)[0], o = $('ubPak').selectedOptions[0], h = Number(o && o.dataset.h) || 0, dk = Math.min(Math.max(Number($('ubDisk').value) || 0, 0), h), tot = h - dk, paid = (Number(b.DP) || 0) + (Number(b.Pelunasan) || 0);
  $('ubTot').innerHTML = 'Total ' + rp(tot) + ' · Sudah dibayar ' + rp(paid) + ' · Sisa ' + (tot < paid ? '<b style="color:var(--red)">tidak valid (total di bawah pembayaran)</b>' : '<b>' + rp(tot - paid) + '</b>');
}
function doUbah(id) {
  const nm = $('ubNama').value.trim(); if (!nm) { $('mm').textContent = 'Nama anak wajib diisi.'; return; }
  const d = { namaAnak: nm, usia: $('ubUsia').value, beratBadan: $('ubBerat').value, namaOrtu: $('ubOrtu').value, noHp: $('ubHp').value, alamat: $('ubAlm').value, riwayat: $('ubRiw').value, paketId: $('ubPak').value, diskon: $('ubDisk').value };
  if ($('ubDok')) { if (!$('ubDok').value || !$('ubAsi').value) { $('mm').textContent = 'Dokter dan asisten wajib dipilih.'; return; } d.dokter = $('ubDok').value; d.asisten = $('ubAsi').value; }
  call('ubahBooking', [id, d], () => { closeM(); toast('Data diperbarui'); ['booking', 'invoice', 'payment', 'consent', 'tindakan'].forEach(x => delete S.docs[id + '|' + x]); loadAll(); }, e => { $('mm').textContent = e; });
}
// ===== Pelunasan: pasien yang awalnya DP lalu melunasi sisanya =====
function mLunas(id) {
  const b = S.bk.filter(x => x.ID === id)[0]; if (!b) return;
  const total = (Number(b.Harga) || 0) - (Number(b.Diskon) || 0);
  openM('<h3><i class="bi bi-cash-coin"></i> Pelunasan ' + esc(id) + '</h3><p style="color:var(--mute);margin:4px 0">' + esc(b.NamaAnak) + '</p>' +
    '<div style="background:var(--cyl);border-radius:10px;padding:12px;margin:8px 0;line-height:1.7"><div>Total biaya: <b>' + rp(total) + '</b></div><div>DP sudah dibayar: <b>' + rp(b.DP) + '</b></div><div>Sisa yang dilunasi: <b style="color:#B45309">' + rp(b.Sisa) + '</b></div></div>' +
    '<label>Metode pembayaran *</label><select id="lM"><option value="">Pilih</option><option>Cash</option><option>Transfer</option></select>' +
    '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button><button onclick="doLunas(\'' + id + '\')"><i class="bi bi-check2-circle"></i> Simpan pelunasan</button></div>');
}
function doLunas(id) {
  const m = $('lM').value; if (!m) { $('mm').textContent = 'Pilih metode pembayaran.'; return; }
  call('pelunasan', [id, m], () => {
    closeM(); toast('Pelunasan tercatat'); const b = S.bk.filter(x => x.ID === id)[0]; if (b) b.Sisa = 0;
    delete S.docs[id + '|invoice']; delete S.docs[id + '|payment']; loadAll();
    call('cetak', [id, 'payment'], d => { if (d && d.url) S.docs[id + '|payment'] = d.url; }, () => {}); // bukti bayar disiapkan di latar belakang
  }, e => { $('mm').textContent = e; });
}
function mResched(id) {
  const b = S.bk.filter(x => x.ID === id)[0];
  openM('<h3>Reschedule ' + id + '</h3><label>Tanggal</label><input type="date" id="rT" value="' + esc(b.Tanggal) + '"><label>Jam</label><input type="time" id="rJ" value="' + esc(b.Jam) +
    '"><div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button><button onclick="doResched(\'' + id + '\')"><i class="bi bi-save"></i> Simpan</button></div>');
}
function doResched(id) {
  const t = $('rT').value, j = $('rJ').value; if (!t || !j) { $('mm').textContent = 'Tanggal dan jam wajib diisi.'; return; }
  const b = S.bk.filter(x => x.ID === id)[0]; if (b) { b.Tanggal = t; b.Jam = j; } closeM(); renderB(); toast('Jadwal diperbarui');
  call('rescheduleBooking', [id, t, j], null, e => { toast(e); loadBk(); });
}
function hapus(id) {
  if (!confirm('Hapus data ' + id + '? Tidak bisa dibatalkan.')) return;
  S.bk = S.bk.filter(x => x.ID !== id); renderB(); renderP();
  call('deleteBooking', [id], () => loadAll(), e => { toast(e); loadBk(); });
}

// ===== Stok Obat & BHP =====
function loadStok(force) { ['obat', 'bhp'].forEach(tp => { if (S.stok[tp].length) renderStok(tp); }); pull(['stokO', 'stokB'], force); }
function renderStok(tp) {
  $('st_' + tp).innerHTML = S.stok[tp].map(i => '<tr><td>' + esc(i.nama) + '</td><td style="color:' + (i.stok <= 20 ? 'var(--red)' : 'inherit') + '"><b>' + i.stok + '</b></td><td style="white-space:nowrap"><button class="btn-sm btn-navy" onclick="mStok(\'' + tp + '\',\'' + i.id + '\')"><i class="bi bi-pencil-square"></i> Ubah</button>' +
    (isOwner() ? ' <button class="btn-sm btn-red" onclick="delStok(\'' + tp + '\',\'' + i.id + '\')"><i class="bi bi-trash"></i> Hapus</button>' : '') + '</td></tr>').join('') || '<tr><td colspan="3" style="color:var(--mute)">Belum ada data.</td></tr>';
}
const btnRow = fn => '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button><button onclick="' + fn + '"><i class="bi bi-save"></i> Simpan</button></div>';
function mStokBaru(tp) { openM('<h3>Tambah ' + tp.toUpperCase() + '</h3><label>Nama</label><input id="nN"><label>Stok awal</label><input type="number" id="nS" value="0">' + btnRow("doStokBaru('" + tp + "')")); }
function doStokBaru(tp) {
  const n = $('nN').value.trim(); if (!n) { $('mm').textContent = 'Nama wajib diisi.'; return; }
  if (isOwner() && S.cab === 'ALL') { $('mm').textContent = 'Pilih satu cabang di sidebar dulu.'; return; }
  call('addStok', [S.cab, tp, n, $('nS').value], () => { closeM(); toast('Item ditambahkan'); loadStok(); }, e => $('mm').textContent = e);
}
function mStok(tp, id) { openM('<h3>Ubah Stok</h3><label>Aksi</label><select id="sA"><option value="tambah">Tambah (+)</option><option value="kurangi">Kurangi (-)</option><option value="opname">Opname (atur ulang)</option></select><label>Jumlah</label><input type="number" id="sJ" value="0" min="0">' + btnRow("doStok('" + tp + "','" + id + "')")); }
function doStok(tp, id) { call('ubahStok', [tp, id, $('sA').value, $('sJ').value], () => { closeM(); toast('Stok diperbarui'); loadAll(); }, e => $('mm').textContent = e); }
function delStok(tp, id) { if (!confirm('Hapus item ini?')) return; S.stok[tp] = S.stok[tp].filter(x => x.id !== id); renderStok(tp); call('hapusStok', [tp, id], () => loadDash(), e => { toast(e); loadStok(); }); }

// ===== Keuangan =====
function initKeu() { ensureDates(); pull(['keu']); }
function loadKeu() { pull(['keu'], true); }
function renderKeu(d) {
  {
    $('kp1').textContent = rp(d.pendapatan); $('kp2').textContent = rp(d.pengeluaran); $('kp3').textContent = rp(d.saldo);
    $('kPen').innerHTML = d.pen.map(x => '<tr><td>' + esc(x.tanggal) + '</td><td>' + esc(x.nama) + '<br><small>' + esc(x.paket) + '</small></td><td>' + rp(x.jumlah) + '</td></tr>').join('') || '<tr><td colspan="3" style="color:var(--mute)">Tidak ada data.</td></tr>';
    $('kOut').innerHTML = d.out.map(x => '<tr><td>' + esc(x.tanggal) + '</td><td>' + esc(x.ket) + '</td><td>' + rp(x.jumlah) + '</td><td><button class="btn-sm btn-red" onclick="delPeng(\'' + x.id + '\')"><i class="bi bi-trash"></i> Hapus</button></td></tr>').join('') || '<tr><td colspan="4" style="color:var(--mute)">Tidak ada data.</td></tr>';
  }
}
function mPeng() { openM('<h3>Tambah Pengeluaran</h3><label>Tanggal</label><input type="date" id="pT" value="' + today_() + '"><label>Keterangan</label><input id="pK" placeholder="Beli obat, listrik, gaji..."><label>Jumlah (Rp)</label><input type="number" id="pJ" value="0">' + btnRow('doPeng()')); }
function doPeng() {
  if (isOwner() && S.cab === 'ALL') { $('mm').textContent = 'Pilih satu cabang di sidebar dulu.'; return; }
  call('addPengeluaran', [S.cab, $('pT').value, $('pK').value, $('pJ').value], () => { closeM(); toast('Pengeluaran tersimpan'); loadKeu(); }, e => $('mm').textContent = e);
}
function delPeng(id) { if (!confirm('Hapus pengeluaran ini?')) return; call('hapusPengeluaran', [id], () => loadKeu()); }

// ===== Master Cabang & Paket (Owner) =====
function loadMaster(force) { pull(['adm'], force); }
function renderMaster() {
  $('wCab').innerHTML = S.adm.cabang.map(c => '<tr><td><b>' + esc(c.Nama) + '</b><br><small>' + esc(c.Alamat) + '</small></td><td>' + esc(c.NoWA) + '</td><td><span class="badge ' + (c.Aktif !== false ? 'b-ok' : 'b-wait') + '">' + (c.Aktif !== false ? 'Aktif' : 'Nonaktif') +
    '</span></td><td><button class="btn-sm btn-navy" onclick="mCabang(\'' + c.CabangID + '\')"><i class="bi bi-pencil-square"></i> Edit</button></td></tr>').join('') || '<tr><td colspan="4" style="color:var(--mute)">Belum ada cabang.</td></tr>';
  $('wPak').innerHTML = S.adm.paket.map(p => '<tr><td><b>' + esc(p.NamaPaket) + '</b><br><small>' + esc(p.Deskripsi) + '</small></td><td>' + rp(p.Harga) + '</td><td><span class="badge ' + (p.Aktif !== false ? 'b-ok' : 'b-wait') + '">' + (p.Aktif !== false ? 'Aktif' : 'Nonaktif') +
    '</span></td><td><button class="btn-sm btn-navy" onclick="mPaket(\'' + p.ID + '\')"><i class="bi bi-pencil-square"></i> Edit</button></td></tr>').join('') || '<tr><td colspan="4" style="color:var(--mute)">Belum ada paket.</td></tr>';
}
const yn = (id, v, l) => '<label>' + l + '</label><select id="' + id + '"><option value="1"' + (v ? ' selected' : '') + '>Ya</option><option value="0"' + (v ? '' : ' selected') + '>Tidak</option></select>';
function mCabang(id) {
  const c = S.adm.cabang.filter(x => x.CabangID === id)[0] || { Aktif: true };
  openM('<h3>' + (id ? 'Edit' : 'Tambah') + ' Cabang</h3><label>Nama</label><input id="cN" value="' + esc(c.Nama || '') + '"><label>Alamat</label><textarea id="cA" rows="2">' + esc(c.Alamat || '') + '</textarea><label>No WhatsApp</label><input id="cW" inputmode="tel" value="' + esc(c.NoWA || '') +
    '">' + yn('cX', c.Aktif !== false, 'Aktif') + btnRow("doCabang('" + id + "')"));
}
function doCabang(id) {
  const o = { CabangID: id, Nama: $('cN').value, Alamat: $('cA').value, NoWA: $('cW').value, Aktif: $('cX').value === '1' };
  call('saveCabang', [o], () => { closeM(); toast('Cabang disimpan'); pull(['adm', 'boot'], true); }, e => $('mm').textContent = e);
}
function mPaket(id) {
  const p = S.adm.paket.filter(x => String(x.ID) === String(id))[0] || { Aktif: true };
  openM('<h3>' + (id ? 'Edit' : 'Tambah') + ' Paket</h3><label>Nama paket</label><input id="pN" value="' + esc(p.NamaPaket || '') + '"><label>Harga (Rp)</label><input type="number" id="pH" value="' + (Number(p.Harga) || 0) +
    '"><label>Deskripsi</label><textarea id="pD" rows="2">' + esc(p.Deskripsi || '') + '</textarea>' + yn('pX', p.Aktif !== false, 'Aktif (muncul di Pendaftaran)') + btnRow("doPaket('" + id + "')"));
}
function doPaket(id) {
  const o = { ID: id, NamaPaket: $('pN').value, Harga: $('pH').value, Deskripsi: $('pD').value, Aktif: $('pX').value === '1' };
  call('savePaket', [o], () => { closeM(); toast('Paket disimpan'); pull(['adm', 'boot'], true); }, e => $('mm').textContent = e);
}

// ===== Master Staff & Akun login (Owner) =====
function loadStaff(force) { pull(['stf'], force); }
const cabNm = id => { const c = S.stf.cabang.filter(x => x.CabangID === id)[0]; return c ? c.Nama : '(Semua)'; };
const selOpt = (id, arr, v, lbl) => '<select id="' + id + '">' + arr.map(x => '<option value="' + esc(x) + '"' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>';
const cabSel = (id, v) => '<label>Cabang</label><select id="' + id + '">' + S.stf.cabang.map(c => '<option value="' + esc(c.CabangID) + '"' + (c.CabangID === v ? ' selected' : '') + '>' + esc(c.Nama) + '</option>').join('') + '</select>';
function renderStaff() {
  const pr = {}; S.stf.staff.forEach(x => { const key = x.Nama.toLowerCase() + '|' + x.Role; (pr[key] = pr[key] || { Nama: x.Nama, Role: x.Role, cab: [] }).cab.push(x.CabangID); });
  const g = {}, ord = ['Dokter', 'Asisten', 'Petugas']; // satu baris per orang; peran dengan daftar cabang yang sama digabung
  Object.keys(pr).forEach(key => { const p = pr[key], gk = p.Nama.toLowerCase() + '|' + p.cab.slice().sort().join(','); (g[gk] = g[gk] || { Nama: p.Nama, roles: [], cab: p.cab }).roles.push(p.Role); });
  S.stfG = Object.keys(g).map(key => { g[key].roles.sort((a, b) => ord.indexOf(a) - ord.indexOf(b)); return g[key]; });
  $('sfT').innerHTML = S.stfG.map((x, i) => '<tr><td><b>' + esc(x.Nama) + '</b></td><td>' + x.roles.map(r => '<span class="badge b-ok">' + esc(r) + '</span>').join(' ') + '</td><td>' + esc(x.cab.length === S.stf.cabang.length ? 'Semua cabang' : x.cab.map(cabNm).join(', ')) +
    '</td><td style="white-space:nowrap"><button class="btn-sm btn-navy" onclick="mStaff(' + i + ')"><i class="bi bi-pencil-square"></i> Edit</button> <button class="btn-sm btn-red" onclick="delStaff(' + i + ')"><i class="bi bi-trash"></i> Hapus</button></td></tr>').join('') || '<tr><td colspan="4" style="color:var(--mute)">Belum ada staf.</td></tr>';
  $('usT').innerHTML = S.stf.users.map(u => '<tr><td>' + esc(u.Username) + '</td><td>' + esc(u.Nama) + '</td><td><span class="badge ' + (u.Role === 'Owner' ? 'b-wait' : 'b-ok') + '">' + esc(u.Role) + '</span></td><td>' + (u.Role === 'Owner' ? '(Semua)' : esc(cabNm(u.CabangID))) +
    '</td><td style="white-space:nowrap"><button class="btn-sm btn-navy" onclick="mUser(\'' + esc(u.Username) + '\')"><i class="bi bi-pencil-square"></i> Edit</button> <button class="btn-sm btn-red" onclick="delUser(\'' + esc(u.Username) + '\')"><i class="bi bi-trash"></i> Hapus</button></td></tr>').join('');
}
function mStaff(i) {
  const x = i === '' || i === undefined ? { Nama: '', roles: ['Dokter'], cab: [] } : S.stfG[i];
  openM('<h3>' + (x.Nama ? 'Edit' : 'Tambah') + ' Staf</h3><label>Nama</label><input id="sN" value="' + esc(x.Nama) + '"><label>Peran (boleh lebih dari satu)</label><div style="display:flex;gap:16px;flex-wrap:wrap">' + ['Dokter', 'Asisten', 'Petugas'].map(r => '<label style="display:flex;gap:6px;align-items:center;font-weight:500;color:var(--ink);margin:4px 0"><input type="checkbox" class="srl" value="' + r + '"' + (x.roles.indexOf(r) > -1 ? ' checked' : '') + ' style="width:auto;min-height:0"> ' + r + '</label>').join('') + '</div>' +
    '<label>Tampil di cabang (boleh lebih dari satu)</label><label style="display:flex;gap:8px;align-items:center;font-weight:700;color:var(--ink)"><input type="checkbox" id="sAll" style="width:auto;min-height:0" onchange="document.querySelectorAll(\'.sfc\').forEach(c=>c.checked=this.checked)"> Semua cabang</label>' +
    S.stf.cabang.map(c => '<label style="display:flex;gap:8px;align-items:center;font-weight:500;color:var(--ink);margin:4px 0"><input type="checkbox" class="sfc" value="' + esc(c.CabangID) + '"' + (x.cab.indexOf(c.CabangID) > -1 ? ' checked' : '') + ' style="width:auto;min-height:0"> ' + esc(c.Nama) + '</label>').join('') + btnRow('doStaff(' + (x.Nama ? i : "''") + ')'));
}
function doStaff(i) {
  const old = i === '' ? null : S.stfG[i], ids = Array.prototype.map.call(document.querySelectorAll('.sfc:checked'), c => c.value);
  call('saveStaff', [{ Nama: $('sN').value, Roles: Array.prototype.map.call(document.querySelectorAll('.srl:checked'), c => c.value), CabangIDs: ids, OldNama: old ? old.Nama : '', OldRoles: old ? old.roles : [] }], () => { closeM(); toast('Staf disimpan'); pull(['stf', 'boot'], true); }, e => $('mm').textContent = e);
}
function delStaff(i) { const x = S.stfG[i]; if (!confirm('Hapus ' + x.Nama + ' (' + x.roles.join(', ') + ') dari semua cabang?')) return; call('hapusStaff', [x.Nama, x.roles], () => { toast('Staf dihapus'); pull(['stf', 'boot'], true); }); }
function mUser(un) {
  const u = S.stf.users.filter(y => y.Username === un)[0] || {};
  openM('<h3>' + (un ? 'Edit' : 'Tambah') + ' Akun</h3><label>Username</label><input id="uU" value="' + esc(u.Username || '') + '"><label>Nama</label><input id="uN" value="' + esc(u.Nama || '') + '"><label>Role</label>' + selOpt('uR', ['Petugas', 'Owner'], u.Role) +
    cabSel('uC', u.CabangID) + '<small style="color:var(--mute)">Cabang diabaikan untuk Owner.</small><label>' + (un ? 'Password baru (kosongkan jika tidak diganti; WAJIB diisi jika username diubah)' : 'Password (min. 6 karakter)') + '</label><input type="password" id="uP" autocomplete="new-password">' + btnRow("doUser('" + un + "')"));
}
function doUser(un) {
  call('saveUser', [{ Username: $('uU').value, OldUsername: un, Nama: $('uN').value, Role: $('uR').value, CabangID: $('uC').value, Password: $('uP').value }, !un], () => { closeM(); toast('Akun disimpan'); loadStaff(); }, e => $('mm').textContent = e);
}
function delUser(un) { if (!confirm('Hapus akun ' + un + '?')) return; call('hapusUser', [un], () => { toast('Akun dihapus'); loadStaff(); }); }

// ===== Homevisite =====
function loadHv(force) { if ((S.hv || []).length) renderHv(); pull(['hv'], force); }
function renderHv() {
  const q = ($('qH').value || '').toLowerCase();
  $('tH').innerHTML = (S.hv || []).filter(h => (!q || (h.NamaPasien + ' ' + h.Petugas).toLowerCase().indexOf(q) > -1) && inRange(h.Tanggal, 'fh')).map(h => '<tr><td>' + esc(h.Tanggal) + '</td><td><b>' + esc(h.NamaPasien) + '</b></td><td>' + esc(h.Alamat) + '</td><td>' + esc(h.Petugas) +
    '</td><td style="white-space:nowrap">' + (waLink(h.NoHP) ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + waLink(h.NoHP) + '">WA</a> ' : '') + '<button class="btn-sm btn-red" onclick="delHv(\'' + h.ID + '\')"><i class="bi bi-trash"></i> Hapus</button></td></tr>').join('') || '<tr><td colspan="5" style="color:var(--mute)">Tidak ada data.</td></tr>';
}
function mHv() {
  const staff = {}; ['dokter', 'asisten', 'petugas'].forEach(r => S.master[r].forEach(x => staff[x.Nama] = 1));
  openM('<h3>Tambah Homevisite</h3><label>Pasien terdaftar (opsional)</label><select id="hP" onchange="pickHv()"><option value="">Pasien baru / manual</option>' +
    S.bk.map(b => '<option value="' + b.ID + '">' + esc(b.NamaAnak) + ' — ' + esc(b.Tanggal) + '</option>').join('') + '</select><label>Nama pasien</label><input id="hN"><label>Alamat</label><textarea id="hA" rows="2"></textarea><label>No HP</label><input id="hW" inputmode="tel">' +
    '<label>Tanggal</label><input type="date" id="hT" value="' + today_() + '"><label>Petugas homevisite</label><select id="hS"><option value="">Pilih</option>' + Object.keys(staff).map(n => '<option>' + esc(n) + '</option>').join('') + '</select><label>Catatan</label><input id="hC">' + btnRow('doHv()'));
}
function pickHv() { const b = S.bk.filter(x => x.ID === $('hP').value)[0]; if (b) { $('hN').value = b.NamaAnak; $('hA').value = b.Alamat || ''; $('hW').value = b.NoHP || ''; } }
function doHv() {
  if (isOwner() && S.cab === 'ALL') { $('mm').textContent = 'Pilih satu cabang di sidebar dulu.'; return; }
  call('addHomevisit', [S.cab, { tanggal: $('hT').value, nama: $('hN').value, alamat: $('hA').value, noHp: $('hW').value, petugas: $('hS').value, catatan: $('hC').value, bookingId: $('hP').value }],
    () => { closeM(); toast('Homevisite tersimpan'); loadHv(); }, e => $('mm').textContent = e);
}
function delHv(id) { if (!confirm('Hapus data homevisite ini?')) return; S.hv = S.hv.filter(x => x.ID !== id); renderHv(); call('hapusHomevisit', [id], null, e => { toast(e); loadHv(); }); }

// ===== Laporan =====
function initLap() { ensureDates(); pull(['lap']); }
const lst = a => a.length ? '<ul style="margin:8px 0;padding-left:18px">' + a.map(x => '<li>' + esc(x.nama) + ': <b>' + x.jumlah + '</b></li>').join('') + '</ul>' : '<p style="color:var(--mute)">Tidak ada data.</p>';
function loadLap() { pull(['lap'], true); }
function renderLap(d) {
  {
    $('l1').textContent = d.total; $('l2').textContent = d.selesai; $('l3').textContent = d.booking; $('l4').textContent = rp(d.pendapatan);
    $('lP').innerHTML = lst(d.petugas); $('lDk').innerHTML = lst(d.dokter); $('lHv').textContent = d.totalHv;
    $('lAH').innerHTML = d.asistenHv.map(x => '<tr><td>' + esc(x.nama) + '</td><td>' + x.asisten + '</td><td>' + x.homevisite + '</td><td><b>' + x.total + '</b></td></tr>').join('') || '<tr><td colspan="4" style="color:var(--mute)">Tidak ada data.</td></tr>';
    $('lCmp').classList.toggle('hide', !d.perCabang);
    if (d.perCabang) $('lcT').innerHTML = d.perCabang.map(c => '<tr><td><b>' + esc(c.nama) + '</b></td><td>' + c.pasien + '</td><td>' + c.selesai + '</td><td>' + c.homevisit + '</td><td>' + rp(c.pendapatan) + '</td></tr>').join('');
  }
}

// ===== Dokumen PDF & tanda tangan =====
function loadDocs(force) { pull(['docs'], force); }
const DOKS = [['booking', 'Booking Confirmation'], ['invoice', 'Invoice'], ['consent', 'Informed Consent (tanda tangan)'], ['payment', 'Payment / Pelunasan'], ['tindakan', 'Laporan Tindakan (tanda tangan)']];
function mDok(id) {
  const b = S.bk.filter(x => x.ID === id)[0]; if (!b) return; const selesai = b.Status === 'Selesai';
  openM('<h3>Dokumen ' + id + '</h3><p style="color:var(--mute);margin:4px 0">Tanda tangan orang tua: <b>' + (S.docs[id + '|TTD'] ? 'sudah ada' : 'belum ada') + '</b></p>' +
    DOKS.filter(d => d[0] !== 'tindakan' || selesai).filter(d => d[0] !== 'payment' || selesai || Number(b.Sisa) <= 0).map(d => '<button class="btn-sm" style="width:100%;margin-top:8px;justify-content:space-between" onclick="doCetak(\'' + id + '\',\'' + d[0] + '\')"><span>' + d[1] + '</span><span>' + (S.docs[id + '|' + d[0]] ? 'Buka ✓' : 'Buat') + '</span></button>').join('') +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn-ghost btn-sm" style="color:var(--ink)" onclick="mTtd(\'' + id + '\')"><i class="bi bi-pen"></i> Ulangi tanda tangan</button><button class="btn-ghost btn-sm" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Tutup</button></div>');
}
// Unduh PDF lewat tab sementara, lalu tab itu ditutup otomatis setelah unduhan dimulai (tab kosong tidak menumpuk).
function bukaPdf(url, tab) {
  const w = (tab && !tab.closed) ? tab : window.open('about:blank', '_blank');
  if (!w) { window.open(url, '_blank'); return; }
  w.location.href = url;
  setTimeout(() => { try { if (!w.closed) w.close(); } catch (e) {} }, 1500);
}
function doCetak(id, j) {
  const key = id + '|' + j;
  if ((j === 'consent' || j === 'tindakan') && !S.docs[id + '|TTD']) { mTtd(id, () => doCetak(id, j), j); return; }
  if (S.docs[key]) { bukaPdf(S.docs[key]); return; }
  const tab = window.open('about:blank', '_blank'); if (tab) tab.document.write('<p style="font-family:sans-serif;padding:20px">Sedang membuat PDF, mohon tunggu...</p>');
  toast('Membuat PDF...');
  call('cetak', [id, j], d => { S.docs[key] = d.url; bukaPdf(d.url, tab); toast('PDF siap'); },
    e => { if (tab && !tab.closed) tab.close(); toast(e); });
}
let TTD = null, TTD_CB = null, TTD_SKIP = '';
function mTtd(id, cb, skip) {
  TTD_CB = cb || null; TTD_SKIP = skip || '';
  openM('<h3>Tanda Tangan Orang Tua</h3><p style="color:var(--mute);margin:4px 0">Cukup sekali; dipakai untuk Informed Consent &amp; Laporan Tindakan.</p><div style="border:1.5px solid var(--line);border-radius:8px;background:#fff"><canvas id="ttdC" style="width:100%;height:160px;display:block;touch-action:none"></canvas></div>' +
    '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:space-between;margin-top:10px"><button class="btn-ghost btn-sm" style="color:var(--ink)" onclick="TTD.clear()"><i class="bi bi-eraser"></i> Hapus</button><span><button class="btn-ghost btn-sm" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Batal</button> <button class="btn-sm" onclick="doTtd(\'' + id + '\')"><i class="bi bi-save"></i> Simpan</button></span></div>');
  setTimeout(() => { const c = $('ttdC'), r = Math.max(window.devicePixelRatio || 1, 1); c.width = c.offsetWidth * r; c.height = c.offsetHeight * r; c.getContext('2d').scale(r, r); TTD = new SignaturePad(c, { backgroundColor: 'rgb(255,255,255)' }); }, 60);
}
function doTtd(id) {
  if (!TTD || TTD.isEmpty()) { $('mm').textContent = 'Mohon bubuhkan tanda tangan.'; return; }
  call('saveTtd', [id, TTD.toDataURL('image/png')], () => { S.docs[id + '|TTD'] = '1'; ['consent', 'tindakan'].forEach(j => delete S.docs[id + '|' + j]); closeM(); toast('Tanda tangan tersimpan'); if (TTD_CB) TTD_CB(); preCetak(id, TTD_SKIP); }, e => $('mm').textContent = e);
}
// Setelah tanda tangan tersimpan: PDF Informed Consent & Laporan Tindakan dibuat diam-diam di latar belakang (tanpa tab/notifikasi), agar saat dicetak langsung terbuka.
// Dokumen yang sedang dicetak oleh pengguna (skip) dilewati agar tidak dibuat dobel; Laporan Tindakan hanya dibuat jika pasien sudah berstatus Selesai.
function preCetak(id, skip) {
  const b = (S.bk || []).filter(x => x.ID === id)[0];
  ['consent', 'tindakan'].forEach(j => {
    if (j === skip || S.docs[id + '|' + j]) return;
    if (j === 'tindakan' && !(b && b.Status === 'Selesai')) return;
    call('cetak', [id, j], d => { if (d && d.url) S.docs[id + '|' + j] = d.url; }, () => {});
  });
}

// ===== Export Excel (CSV) & kirim daftar via WhatsApp =====
const csvEsc = v => { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function dlCsv(head, rows, name) {
  const blob = new Blob(['\uFEFF' + [head].concat(rows).map(r => r.map(csvEsc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name + '-' + today_() + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const visB = () => S.bk.filter(b => b.Status === 'Belum Diproses' && hit_(b, $('qB').value) && inRange(b.Tanggal, 'fb')), visP = () => S.bk.filter(b => b.Status === 'Selesai' && hit_(b, $('qP').value) && inRange(b.TanggalProses, 'fp'));
function exportB() { const r = visB(); if (!r.length) { toast('Tidak ada data'); return; }
  dlCsv(['ID', 'Cabang', 'Nama Anak', 'Orang Tua', 'No HP', 'Tanggal', 'Jam', 'Paket', 'Harga', 'Diskon', 'DP', 'Sisa', 'Metode'], r.map(b => [b.ID, b.CabangID, b.NamaAnak, b.NamaOrtu, b.NoHP, b.Tanggal, b.Jam, b.NamaPaket, b.Harga, b.Diskon, b.DP, b.Sisa, b.Metode]), 'Pasien-Booking'); }
function exportP() { const r = visP(); if (!r.length) { toast('Tidak ada data'); return; }
  dlCsv(['ID', 'Cabang', 'Nama Anak', 'Orang Tua', 'Dokter', 'Asisten', 'Tanggal Proses', 'Paket', 'Total'], r.map(b => [b.ID, b.CabangID, b.NamaAnak, b.NamaOrtu, b.Dokter, b.Asisten, b.TanggalProses, b.NamaPaket, (Number(b.Harga) || 0) - (Number(b.Diskon) || 0)]), 'Pasien-Selesai'); }
function kirimWA() { // buka WhatsApp tanpa nomor tujuan: pilih sendiri kontaknya (mis. dokter)
  const r = visB(); if (!r.length) { toast('Tidak ada data'); return; }
  const tg = t => { const p = String(t).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : t; };
  window.open('https://wa.me/?text=' + encodeURIComponent(['*Data Pasien Booking — ' + tg(today_()) + '*', ''].concat(r.map((b, i) => (i + 1) + '. ' + tg(b.Tanggal) + ' - ' + b.NamaAnak + ' - ' + b.Jam + ' - ' + b.NamaPaket)).join('\n')), '_blank');
}

// ===== Rentang tanggal (Pasien Booking: fb, Pasien Diproses: fp, Homevisite: fh) =====
const pad2 = x => String(x).padStart(2, '0'), today_ = () => { const n = new Date(); return n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate()); };
const tgl_ = t => { const p = String(t || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (t || '-'); };
const inRange = (t, p) => { const d = $(p + 'D').value, s = $(p + 'S').value; return (!d || String(t) >= d) && (!s || String(t) <= s); };
const reRender = p => { if (p === 'fb') renderB(); else if (p === 'fp') renderP(); else renderHv(); };
function setMonth(p) { const n = new Date(); $(p + 'D').value = n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-01'; $(p + 'S').value = today_(); reRender(p); }
function clearRange(p) { $(p + 'D').value = ''; $(p + 'S').value = ''; reRender(p); }
(function () { const n = new Date(); $('fpD').value = n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-01'; $('fpS').value = today_(); })(); // Pasien Diproses: default bulan ini
function kirimWAP() { // daftar pasien selesai sesuai filter yang tampil
  const r = visP(); if (!r.length) { toast('Tidak ada data'); return; }
  const d = $('fpD').value, s = $('fpS').value, per = d || s ? tgl_(d) + ' s/d ' + tgl_(s) : 'Semua';
  window.open('https://wa.me/?text=' + encodeURIComponent(['*Data Pasien Selesai — ' + per + '*', ''].concat(r.map((b, i) => (i + 1) + '. ' + tgl_(b.TanggalProses) + ' - ' + b.NamaAnak + ' - ' + b.NamaPaket + ' - ' + (b.Dokter || '-'))).join('\n')), '_blank');
}

// ===== Pulihkan sesi login (±6 jam): layar loading dulu, lalu langsung masuk aplikasi; jika tidak ada sesi, tampil halaman login =====
(function () {
  const x = ls('kp_sess');
  if (!x || !x.token || x.exp < Date.now()) { try { localStorage.removeItem('kp_sess'); } catch (e) {} return; }
  Object.assign(S, { token: x.token, role: x.role, nama: x.nama, cab: x.cab, restoring: true });
  $('who').textContent = x.nama + ' · ' + x.role; setWelcome(x.nama, x.role); showLoad('Memulihkan sesi ' + x.nama + '...'); prefetchAll(); enterApp(1200);
})();

// ===== Pemanasan server: saat halaman login tampil & saat tab kembali aktif setelah lama di latar belakang =====
(function () {
  let hiddenAt = 0;
  if (!S.token) warmUpServer();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 120000) { warmUpServer(); hiddenAt = 0; }
  });
})();
