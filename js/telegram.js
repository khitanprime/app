// ============================================================
// MENU TELEGRAM: Owner mengatur bot + grup per cabang; semua staf menautkan akun Telegram-nya.
// Semua teks dirender dengan textContent. Token bot tidak pernah dikirim balik dari server.
// ============================================================
(function () {
  'use strict';
  const T = { cfg: null, saya: null, kode: {}, busy: false };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const btn = (txt, ic, fn, cls) => { const b = el('button', 'btn-sm ' + (cls || '')); const i = el('i', 'bi ' + ic); b.appendChild(i); b.appendChild(document.createTextNode(' ' + txt)); b.onclick = fn; return b; };
  const card = (judul, ic) => { const c = el('div', 'card'), h = el('h3'); h.appendChild(el('i', 'bi ' + ic)); h.appendChild(document.createTextNode(' ' + judul)); c.appendChild(h); return c; };
  const p = (t, st) => { const e = el('p', null, t); e.style.cssText = 'margin:6px 0;' + (st || ''); return e; };
  const kodeBox = (kode, cmd, menit) => { const d = el('div'); d.style.cssText = 'margin:10px 0;padding:12px;border:1px dashed var(--line);border-radius:12px;background:var(--bg,transparent)'; d.appendChild(p('Kirim pesan ini di Telegram (berlaku ' + menit + ' menit):', 'color:var(--mute);font-size:12px')); const c = el('code', null, cmd + ' ' + kode); c.style.cssText = 'font-size:20px;font-weight:700;letter-spacing:1px'; d.appendChild(c); return d; };
  const gagal = r => { if (r && (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || ''))) authLost(r.message); else toast((r && r.message) || 'Gagal.'); };

  async function muat() {
    const w = $('tgWrap'); if (!w) return;
    const rs = await api('getTgSaya', {}); if (!rs.success) { gagal(rs); return; } T.saya = rs.data;
    if (isOwner()) { const rc = await api('getTgCfg', {}); if (rc.success) T.cfg = rc.data; else { gagal(rc); return; } }
    tampil();
  }
  function tampil() {
    const w = $('tgWrap'); if (!w) return; w.textContent = '';
    if (isOwner()) w.appendChild(bagianBot());
    if (isOwner() && T.cfg && T.cfg.aktif) w.appendChild(bagianGrup());
    w.appendChild(bagianSaya());
  }
  function bagianBot() {
    const c = card('Bot Telegram', 'bi-robot'), cf = T.cfg;
    if (cf.aktif) {
      c.appendChild(p('Tersambung: @' + cf.bot + (cf.webhook ? ' · webhook terpasang' : ' · webhook belum terpasang')));
      const r = el('div'); r.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
      r.appendChild(btn('Pasang ulang webhook', 'bi-arrow-repeat', async () => { const x = await api('tgPasang', {}); if (!x.success) return gagal(x); toast('Webhook dipasang. Antrean: ' + x.data.pending + (x.data.error ? ' · Catatan Telegram: ' + x.data.error : '')); muat(); }, 'btn-ghost'));
      r.appendChild(btn('Ganti token', 'bi-key', () => { cf.aktif = false; cf.ganti = true; tampil(); }, 'btn-ghost'));
      r.appendChild(btn('Lepas bot', 'bi-x-circle', async () => { if (!confirm('Lepas bot Telegram? Notifikasi berhenti sampai bot dipasang lagi.')) return; const x = await api('tgHapusBot', {}); if (!x.success) return gagal(x); toast('Bot dilepas.'); muat(); }, 'btn-red'));
      c.appendChild(r); return c;
    }
    c.appendChild(p('1) Di Telegram buka @BotFather → kirim /newbot → ikuti langkahnya. 2) Salin token yang diberikan lalu tempel di bawah.', 'color:var(--mute);font-size:13px'));
    const i = el('input'); i.type = 'password'; i.placeholder = '123456789:AAE…'; i.autocomplete = 'off'; i.setAttribute('aria-label', 'Token bot'); c.appendChild(i);
    const m = p('', 'color:var(--red,#b91c1c);font-size:12px'); c.appendChild(m);
    c.appendChild(btn('Simpan & hubungkan', 'bi-plug', async () => { m.textContent = ''; const x = await api('saveTgToken', { token: i.value.trim() }); i.value = ''; if (!x.success) { m.textContent = x.message || 'Gagal.'; if (x.code === 'AUTH') gagal(x); return; } toast(x.message); muat(); }));
    return c;
  }
  function bagianGrup() {
    const c = card('Grup Telegram per cabang', 'bi-people');
    c.appendChild(p('Buat satu grup Telegram untuk tiap cabang, isi hanya staf yang terdaftar, tambahkan @' + T.cfg.bot + ' sebagai anggota, lalu tautkan di sini. Foto dan pesan pasien akan masuk ke grup cabangnya.', 'color:var(--mute);font-size:13px'));
    T.cfg.grup.forEach(g => {
      const row = el('div'); row.style.cssText = 'border-top:1px solid var(--line);padding:10px 0'; const b = el('b', null, g.nama); row.appendChild(b);
      row.appendChild(el('span', 'badge ' + (g.terhubung ? 'b-ok' : 'b-wait'), g.terhubung ? 'Terhubung' + (g.judul ? ': ' + g.judul : '') : 'Belum terhubung')); row.lastChild.style.marginLeft = '8px';
      const a = el('div'); a.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
      a.appendChild(btn(g.terhubung ? 'Ganti grup' : 'Buat kode tautan', 'bi-link-45deg', async () => { const x = await api('tgKodeGrup', { cabang: g.id }); if (!x.success) return gagal(x); T.kode[g.id] = x.data; tampil(); }));
      if (g.terhubung) { a.appendChild(btn('Kirim uji', 'bi-send', async () => { const x = await api('tgUji', { cabang: g.id }); x.success ? toast('Pesan uji terkirim ke grup.') : gagal(x); }, 'btn-ghost')); a.appendChild(btn('Lepas', 'bi-x-lg', async () => { if (!confirm('Lepas grup ' + g.nama + '?')) return; const x = await api('tgPutusGrup', { cabang: g.id }); if (!x.success) return gagal(x); delete T.kode[g.id]; muat(); }, 'btn-red')); }
      row.appendChild(a); if (T.kode[g.id]) row.appendChild(kodeBox(T.kode[g.id].kode, '/grup', T.kode[g.id].menit)); c.appendChild(row);
    });
    if (T.cfg.akun.length) { const d = el('div'); d.style.cssText = 'border-top:1px solid var(--line);padding-top:10px;margin-top:6px'; d.appendChild(el('b', null, 'Akun staf yang sudah tertaut')); d.appendChild(p(T.cfg.akun.map(a => (a.nama || a.username) + ' (' + a.role + ')').join(' · '), 'font-size:13px')); c.appendChild(d); }
    return c;
  }
  function bagianSaya() {
    const c = card('Akun Telegram saya', 'bi-person-check'), s = T.saya;
    if (!s.aktif) { c.appendChild(p('Bot Telegram belum diatur oleh Owner.', 'color:var(--mute)')); return c; }
    if (s.grupCabang === false) c.appendChild(p('Catatan: cabang Anda belum memiliki grup Telegram. Minta Owner menautkannya.', 'color:#B45309;font-size:13px'));
    if (s.tertaut) {
      c.appendChild(el('span', 'badge b-ok', 'Tertaut'));
      c.appendChild(p('Balasan (reply) Anda pada notifikasi bot di grup akan tercatat sebagai balasan Anda kepada pasien.', 'font-size:13px'));
      c.appendChild(btn('Lepas tautan', 'bi-x-lg', async () => { const x = await api('tgPutusAkun', {}); if (!x.success) return gagal(x); T.kode.saya = null; muat(); }, 'btn-ghost'));
    } else {
      c.appendChild(p('Tautkan Telegram Anda agar balasan dari Telegram dikenali sebagai balasan akun Anda.', 'font-size:13px'));
      c.appendChild(btn('Buat kode tautan', 'bi-link-45deg', async () => { const x = await api('tgKodeAkun', {}); if (!x.success) return gagal(x); T.kode.saya = x.data; tampil(); }));
      if (T.kode.saya) c.appendChild(kodeBox(T.kode.saya.kode, '/akun', T.kode.saya.menit)), c.appendChild(p('Kirim ke @' + T.kode.saya.bot + ' (chat pribadi) atau di grup cabang. Lalu muat ulang halaman ini.', 'color:var(--mute);font-size:12px'));
    }
    c.appendChild(btn('Muat ulang status', 'bi-arrow-clockwise', muat, 'btn-ghost')); c.lastChild.style.marginLeft = '8px';
    return c;
  }
  const _nav = nav; nav = function (s) { _nav(s); if (s === 'tg') muat(); };
})();
