// Dokumen PDF: pratinjau di dalam aplikasi (tanpa tab baru) + Unduh + Kirim tautan lewat WhatsApp.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KURL = (typeof KONSUL_URL !== 'undefined' && KONSUL_URL) || 'https://khitanprime.github.io/pasien/';
  const dokLinkUrl = kode => String(KURL).replace(/\/?$/, '/') + '#/d/' + encodeURIComponent(kode);
  const KIRIM = { booking: 1, invoice: 1, payment: 1 };
  const esc_ = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const waNo = hp => { let d = String(hp || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d.length >= 9 ? d : ''; };
  const DV = { n: 0, pdf: null, link: null };
  const salin = (t, ok) => { const f = () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); toast(ok); };
    (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(t).then(() => toast(ok), f) : f(); };

  window.doCetak = function doCetak(id, j) {
    if ((j === 'consent' || j === 'tindakan') && !S.docs[id + '|TTD']) { mTtd(id, () => doCetak(id, j), j); return; }
    const label = (DOKS.filter(d => d[0] === j)[0] || [j, j])[1], my = ++DV.n; DV.pdf = null; DV.link = null;
    openM('<h3>' + esc_(label) + ' — ' + esc_(id) + '</h3><div id="dvBox" class="dv-box"><p class="dv-load">Menyiapkan dokumen… (pertama kali bisa beberapa detik)</p></div><div class="msg" id="mm"></div>' +
      '<div class="dv-act"><button id="dvDl" disabled><i class="bi bi-download"></i> Unduh</button>' + (KIRIM[j] ? '<button id="dvWa" class="btn-wa" disabled><i class="bi bi-whatsapp"></i> Kirim WhatsApp</button><button id="dvCp" class="btn-ghost" style="color:var(--ink)" disabled><i class="bi bi-link-45deg"></i> Salin tautan</button>' : '') +
      '<button class="btn-ghost" style="color:var(--ink)" onclick="closeM()"><i class="bi bi-x-lg"></i> Tutup</button></div>');
    $('modalBody').style.maxWidth = '780px';
    api('getDokPdf', { id: id, jenis: j }).then(async r => {
      if (my !== DV.n || !$('dvBox')) return;
      if (!r.success) { if (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || '')) { authLost(r.message); return; } $('dvBox').textContent = ''; $('mm').textContent = r.message || 'Gagal membuat dokumen.'; return; }
      DV.pdf = r.data; if (!S.docs[id + '|' + j]) S.docs[id + '|' + j] = '1';
      try { await PDFV.show($('dvBox'), r.data.pdf); } catch (e) { if ($('dvBox')) { $('dvBox').textContent = ''; $('mm').textContent = 'Pratinjau tidak dapat ditampilkan di perangkat ini. Gunakan tombol Unduh.'; } }
      if (my !== DV.n || !$('dvDl')) return;
      $('dvDl').disabled = false; $('dvDl').onclick = () => PDFV.save(DV.pdf.pdf, DV.pdf.nama);
      if ($('dvWa')) { $('dvWa').disabled = false; $('dvWa').onclick = () => kirimWa(id, j); $('dvCp').disabled = false; $('dvCp').onclick = () => buatTautan(id, j).then(l => l && salin(l.url, 'Tautan disalin.')); }
    });
  };
  async function buatTautan(id, j) { // kode pendek per dokumen; idempoten, berlaku 90 hari sejak terakhir dibuat/dikirim
    if (DV.link && DV.link.key === id + '|' + j) return DV.link;
    const r = await api('dokLink', { id: id, jenis: j }); if (!r.success) { if (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || '')) authLost(r.message); else toast(r.message || 'Gagal membuat tautan.'); return null; }
    DV.link = Object.assign({ key: id + '|' + j, url: dokLinkUrl(r.data.kode) }, r.data); return DV.link;
  }
  async function kirimWa(id, j) {
    const w = window.open('about:blank', '_blank'); if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:20px">Membuka WhatsApp…</p>'); } catch (e) {} }
    const b = $('dvWa'); if (b) b.disabled = true; const l = await buatTautan(id, j); if (b) b.disabled = false;
    if (!l) { if (w) w.close(); return; }
    const isi = { ortu: l.ortu || '', nama_anak: l.nama || '', klinik: l.klinik || '', dokumen: l.judul || '', tautan: l.url, hari: String(l.hari || '') };
    const teks = String(l.tpl || '{tautan}').replace(/\{(\w+)\}/g, (m, k) => isi[k] !== undefined ? isi[k] : m); // template dari Owner (Ubah template pesan)
    const no = waNo(l.hp), url = 'https://wa.me/' + no + '?text=' + encodeURIComponent(teks);
    if (!no) toast('Nomor HP belum diisi/valid; pilih kontak di WhatsApp.');
    if (w) w.location.href = url; else { salin(l.url, 'Pop-up diblokir. Tautan disalin — tempel di WhatsApp.'); }
  }

  // ---- Owner: ubah template pesan WhatsApp per dokumen
  window.dokTpl = function dokTpl() {
    api('getDokTpl', {}).then(r => {
      if (!r.success) { if (r.code === 'AUTH' || /Sesi berakhir/.test(r.message || '')) authLost(r.message); else toast(r.message); return; } const d = r.data, J = ['booking', 'invoice', 'payment'];
      openM('<h3><i class="bi bi-chat-square-text"></i> Template Pesan WhatsApp Dokumen</h3><p style="font-size:12px;color:var(--mute)">Isian otomatis: <b>{ortu}</b> <b>{nama_anak}</b> <b>{klinik}</b> <b>{dokumen}</b> <b>{tautan}</b> <b>{hari}</b>. Wajib memuat <b>{tautan}</b>. Kosongkan lalu simpan untuk memakai teks bawaan (terlihat abu-abu di kolom).</p>' +
        J.map(j => '<label>' + esc_(d.nama[j]) + '</label><textarea id="dt_' + j + '" rows="5" maxlength="1000" placeholder="' + esc_(d.def[j]) + '">' + esc_(d.tpl[j]) + '</textarea>').join('') +
        '<div class="msg" id="mm"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-ghost" style="color:var(--ink)" onclick="closeM()">Batal</button><button id="dtS">Simpan</button></div>');
      $('modalBody').style.maxWidth = '560px';
      $('dtS').onclick = () => { const tpl = {}; J.forEach(j => { tpl[j] = $('dt_' + j).value; }); $('dtS').disabled = true;
        api('saveDokTpl', { tpl: tpl }).then(x => { if (x.success) { closeM(); toast('Template pesan tersimpan'); } else { $('dtS').disabled = false; if ($('mm')) $('mm').textContent = x.message || 'Gagal menyimpan.'; } }); };
    });
  };
  const _mDok = window.mDok; // tombol "Ubah template" hanya untuk Owner, di bagian bawah menu Dokumen
  window.mDok = function mDok(id) { _mDok(id); if (typeof isOwner === 'function' && isOwner() && $('modalBody')) $('modalBody').insertAdjacentHTML('beforeend', '<div style="margin-top:8px;text-align:right"><button class="btn-ghost btn-sm" style="color:var(--ink)" onclick="dokTpl()"><i class="bi bi-chat-square-text"></i> Ubah template pesan WhatsApp</button></div>'); };
})();
