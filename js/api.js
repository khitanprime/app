// ============================================================
// LAPISAN API — pengganti google.script.run.
// fetch() ke Google Apps Script (JSON), dengan timeout, retry, idempotensi, dan pengukur waktu.
// ============================================================

// Pengukur: ketik Perf.table() di Console browser (F12) untuk melihat total / server / jaringan per aksi.
const Perf = {
  rows: [],
  add(action, total, server) {
    this.rows.push({ action: action, total_ms: total, server_ms: server == null ? null : server, jaringan_ms: server == null ? null : total - server });
    if (this.rows.length > 200) this.rows.shift();
  },
  table() { console.table(this.rows.slice(-30)); },
  summary() {
    const m = {};
    this.rows.forEach(r => { const x = (m[r.action] = m[r.action] || { n: 0, total: 0, server: 0 }); x.n++; x.total += r.total_ms; x.server += r.server_ms || 0; });
    console.table(Object.keys(m).map(k => ({ action: k, n: m[k].n, rata_total_ms: Math.round(m[k].total / m[k].n), rata_server_ms: Math.round(m[k].server / m[k].n) })));
  }
};

// Aksi BACA aman di-retry bebas; aksi TULIS membawa reqId (server mengabaikan permintaan ulang yang sama).
const READ_ACTIONS = /^(ping|login|boot|batch|get[A-Z]\w*)$/;

// Urutan argumen pada call('aksi', [a, b, ...]) -> nama field JSON yang dikirim ke server.
const ARGS = {
  login: ['u', 'p', 'range'], getBootstrap: ['cab'], getDashboard: ['cab'], getBookings: ['cab', 'status'], getStok: ['cab', 'tipe'],
  getDokumen: ['cab'], getHomevisit: ['cab'], getKeuangan: ['cab', 'dari', 'sampai'], getLaporan: ['cab', 'dari', 'sampai'], getMaster: [], getAdminStaff: [],
  createBooking: '*', prosesBooking: ['id', 'dokter', 'asisten', 'items'], rescheduleBooking: ['id', 'tgl', 'jam'], ubahBooking: ['id', 'd'],
  pelunasan: ['id', 'metode'], deleteBooking: ['id'], addStok: ['cab', 'tipe', 'nama', 'awal'], ubahStok: ['tipe', 'id', 'aksi', 'jml'], hapusStok: ['tipe', 'id'],
  addPengeluaran: ['cab', 'tgl', 'ket', 'jml'], hapusPengeluaran: ['id'], addHomevisit: ['cab', 'o'], hapusHomevisit: ['id'],
  saveTtd: ['id', 'dataUrl'], cetak: ['id', 'jenis'], saveCabang: ['o'], savePaket: ['o'], saveStaff: ['o'], hapusStaff: ['nama', 'role'],
  saveUser: ['o', 'baru'], hapusUser: ['username']
};
function toData(action, args) {
  if (!Array.isArray(args)) return args || {};
  const n = ARGS[action];
  if (n === '*') return args[0] || {};
  const d = {}; (n || []).forEach((k, i) => { if (args[i] !== undefined) d[k] = args[i]; });
  return d;
}

const gasOk = () => /^https:\/\/script\.google\.com\/.+\/exec$/.test(String(GAS_URL || ''));
function newReqId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2); }
function waitOnline(ms) {
  return new Promise(res => {
    if (navigator.onLine !== false) return res();
    const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); res(); } addEventListener('online', done);
  });
}

async function apiOnce(action, data, token, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // WAJIB text/plain: menghindari preflight CORS yang ditolak GAS
      body: JSON.stringify({ action: action, token: token || '', reqId: reqId || '', data: data || {} })
    });
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      Perf.add(action, Math.round(performance.now() - t0), j.ms);
      return j;
    } catch (e) {
      return { success: false, network: true, retryable: true, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Pastikan Web App di-deploy: Execute as "Me", akses "Anyone".' };
    }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Koneksi terputus. Periksa internet Anda.' };
  } finally { clearTimeout(timer); }
}

// Selalu mengembalikan objek { success, data, message, code? } — tidak pernah melempar error.
async function api(action, data, opt) {
  opt = opt || {};
  if (!gasOk()) return { success: false, message: 'Alamat backend belum diisi. Buka js/config.js lalu tempel URL Web App (berakhiran /exec) ke GAS_URL.' };
  const token = (typeof S !== 'undefined' && S.token) || ''; // diambil SEKARANG (sebelum await) agar logout tetap membawa token
  const isRead = READ_ACTIONS.test(action), reqId = isRead ? '' : (opt.reqId || newReqId()), tries = isRead ? 3 : 2;
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, token, isRead ? (i ? 40000 : 25000) : 90000, reqId);
    if (res.success || !res.retryable) break;
  }
  return res;
}

// ===== Pemanggil gaya lama: call('aksi', [argumen...], onSukses, onGagal) =====
// PEND/TOT/DONE dipakai layar loading untuk tahu kapan semua data siap.
let PEND = 0, TOT = 0, DONE = 0, IDLE_CB = null;
function pendDone() { PEND--; DONE++; barUpdate(); if (PEND <= 0 && IDLE_CB) { const f = IDLE_CB; IDLE_CB = null; f(); } }
function call(action, args, ok, fail) {
  PEND++; TOT++;
  api(action, toData(action, args)).then(r => {
    try {
      if (!r.success) {
        if (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || '')) { authLost(r.message); return; }
        if (fail) fail(r.message || 'Gagal.', r); else toast(r.message || 'Gagal.');
        return;
      }
      if (!READ_ACTIONS.test(action)) S.t = {}; // setelah menulis, data lama dianggap basi -> menu berikutnya ambil yang baru
      ok && ok(r.data, r);
    } catch (e) { console.error(e); }
    finally { pendDone(); }
  });
}

// Pemanasan server (GET ringan, tanpa data) — mengurangi lambat saat "masuk pertama".
let _warmAt = 0;
function warmUpServer() {
  if (!gasOk() || Date.now() - _warmAt < 240000) return;
  _warmAt = Date.now();
  fetch(GAS_URL + '?w=1&_=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}
