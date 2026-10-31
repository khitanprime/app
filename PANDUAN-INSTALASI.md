# Panduan Instalasi — Khitan Prime v4 (Frontend GitHub Pages + Backend Google Apps Script)

Aplikasi Anda sekarang terbagi dua:

| Bagian | Tempat | Berkas |
|---|---|---|
| **Backend** (data, login, PDF) | Google Apps Script, spreadsheet **yang sama** dengan sekarang | `Kode.gs` |
| **Frontend** (tampilan) | GitHub Pages (`https://USERNAME.github.io/khitan-prime/`) | isi `khitan-prime-frontend.zip` |

Data Anda **tidak berubah**: nama sheet, kolom, password staf, nomor booking (KP-00500, ...), template PDF, dan Script Properties yang sudah ada tetap dipakai.

> **Aman untuk dicoba:** langkah backend di bawah membuat **deployment baru** dengan alamat baru. Aplikasi lama Anda (alamat lama) **tetap jalan** sampai Anda sendiri mematikannya. Keduanya memakai spreadsheet yang sama.

---

## BAGIAN 1 — Backend (Google Apps Script)

1. Buka proyek Apps Script Khitan Prime Anda yang sekarang.
2. **Cadangkan dulu:** klik berkas `Kode` → salin semua isinya ke Notepad, simpan sebagai `Kode-lama.txt`.
3. Hapus seluruh isi `Kode.gs`, lalu **tempel seluruh isi `Kode.gs` yang baru**. Klik **Simpan** (ikon disket).
   - **Jangan hapus** berkas `Index`, `JavaScript`, `Stylesheet`, `Loading`. Aplikasi lama (alamat lama) masih memakainya. Boleh dihapus nanti, setelah aplikasi lama dimatikan.
4. Pastikan zona waktu benar: ⚙️ **Project Settings** → *Time zone* = **(GMT+07:00) Asia/Jakarta**.
5. Pilih fungsi **`setupAppEnvironment`** di menu dropdown atas → klik **▶ Run**.
   - Aman dijalankan ulang: **tidak** membuat spreadsheet baru dan **tidak** menimpa data. Fungsinya hanya menyiapkan kunci pengaman token (`TOKEN_SECRET`).
   - Di *Execution log* harus muncul baris `Spreadsheet: https://docs.google.com/...`. Jika Google meminta izin, pilih **Review permissions → Allow**.
6. **Deploy → New deployment** → ikon ⚙️ pilih **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** ← wajib, kalau tidak frontend tidak bisa memanggil
   - Klik **Deploy**, lalu **salin URL yang berakhiran `/exec`**.
7. **Tes backend:** tempel URL itu di browser lalu tambahkan `?ping=1` di belakangnya. Harus tampil teks JSON seperti:
   `{"success":true,"data":{"app":"Khitan Prime","v":"4.0.0-api","api":true},...}`
   Jika yang tampil halaman login Google atau error, cek lagi langkah 6 (*Who has access* harus **Anyone**).

> **Update backend di kemudian hari:** tempel kode baru → Simpan → **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. Pilih *New version* (bukan *New deployment*) supaya URL tidak berubah.

---

## BAGIAN 2 — Frontend (GitHub Pages)

### 2.1 Isi alamat backend
1. Ekstrak `khitan-prime-frontend.zip` ke folder, misalnya `C:\Users\NAMA\Documents\khitan-prime-frontend`.
2. Buka `js\config.js` dengan Notepad. Ganti tulisan `PASTE_URL_EXEC_DI_SINI` dengan URL `/exec` dari langkah 1.6 (tetap di dalam tanda kutip `'...'`). Simpan.

### 2.2 Siapkan Git & GitHub (sekali saja)
- Pasang Git: https://git-scm.com/download/win (pengaturan default). Buka **PowerShell**, cek: `git --version`
- Punya akun di https://github.com. Lalu atur identitas:
  ```
  git config --global user.name "Nama Anda"
  git config --global user.email "email-akun-github@contoh.com"
  ```
- Di GitHub: **+ → New repository** → nama `khitan-prime` → **Public** → **jangan centang** README/.gitignore/license → **Create repository**.

### 2.3 Push dari folder yang BENAR
> ⚠️ **Folder kerja = `khitan-prime-frontend`** (folder hasil ekstrak yang langsung berisi `index.html`). Bukan folder di atasnya, bukan folder di dalamnya.

Buka folder itu di File Explorer → klik address bar → ketik `powershell` → Enter. Lalu **cek dulu isinya**:
```
dir
```
Harus terlihat `index.html`, `css`, `js`, `assets`. Kalau tidak terlihat `index.html`, **berhenti** — Anda di folder yang salah.

Jika benar, jalankan satu per satu:
```
git init
git add .
git commit -m "Khitan Prime v4"
git branch -M main
git remote add origin https://github.com/USERNAME/khitan-prime.git
git push -u origin main
```
(Ganti `USERNAME` dengan username GitHub Anda.)

Saat diminta **Password**, tempel **Personal Access Token** (bukan password akun). Layar tampak kosong saat Anda paste — itu normal, tekan Enter.
Membuat token: https://github.com/settings/tokens → *Generate new token (classic)* → centang **repo** → Generate → salin `ghp_...` (hanya tampil sekali).

### 2.4 Aktifkan GitHub Pages
Repo di GitHub → **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main** · **/ (root)** → **Save**. Tunggu 1–2 menit. Alamat aplikasi: `https://USERNAME.github.io/khitan-prime/`

### 2.5 Update frontend di kemudian hari
Dari folder yang sama:
```
git add .
git commit -m "Update"
git push
```
Lalu di browser tekan **Ctrl+Shift+R**.

---

## BAGIAN 3 — Uji setelah terpasang

1. Buka alamat GitHub Pages → login `owner` (atau akun Anda yang sudah ada).
2. Dashboard tampil → buat 1 booking uji → cek muncul di sheet **Booking**.
3. Proses pasien → buka **Dokumen** → PDF terbentuk.
4. Tekan **F12 → Console**, ketik `Perf.table()` → terlihat waktu tiap panggilan (`server_ms` = kerja Google, `jaringan_ms` = sisanya).
5. **Segera ganti password default** `owner` / `owner123` di menu *Staff & Akun* jika belum.

## Yang berubah bagi pengguna
- Login kini **1 panggilan** yang langsung membawa data semua menu. Pindah menu tidak memanggil server selama data < 20 detik; booking baru dari petugas lain muncul paling lambat 20 detik setelah pindah menu.
- Sesi login tetap 6 jam. Jika Owner mengubah peran/cabang/password sebuah akun atau menghapusnya, sesi akun itu **langsung berakhir**.
- Login dibatasi: 8x salah password → terkunci 15 menit untuk username itu.
- Jika sinyal putus: muncul pita merah **"Coba lagi"**. Aksi simpan aman diulang — booking tidak ganda.
- Data pasien **tidak disimpan di browser** (hanya token sesi dan tema).
- Perbaikan: tanggal default memakai tanggal **lokal**. Di versi lama, antara jam 00.00–07.00 WIB tanggal default mundur ke kemarin.

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Login: "Alamat backend belum diisi" | `js/config.js` masih `PASTE_URL_EXEC_DI_SINI` | Isi URL `/exec`, push ulang |
| Login: "bukan JSON" / "Koneksi terputus" | Web App belum *Anyone*, atau URL salah | Ulangi Bagian 1 langkah 6–7 |
| Setelah update backend, perilaku masih lama | Lupa *New version* | *Manage deployments → ✏️ → New version* |
| Halaman GitHub Pages 404 | `index.html` tidak di root repo | Cek halaman repo: `index.html` harus terlihat di daftar teratas. Jika tampil folder `khitan-prime-frontend/`, push ulang dari folder yang benar (`git push -u origin main --force`) |
| Tampil tanpa gaya / CSS 404 | Folder `css/` `js/` tidak ikut | Push lewat terminal (jangan "Upload files" di web GitHub) |
| Tampil versi lama setelah push | Cache browser | Ctrl+Shift+R |
| "Fungsi/aksi tidak dikenal" | Frontend baru + backend lama | Update backend (Bagian 1) |
| Semua orang tiba-tiba harus login ulang | `TOKEN_SECRET` terhapus dari Script Properties | Tidak ada data hilang; login ulang sekali. Jangan hapus properti itu |
| PDF gagal "Script Property TPL_... belum diisi" | Sama seperti versi lama | Isi ID template Slides di Script Properties |

## Catatan keamanan
- Alamat `/exec` bersifat publik (siapa pun yang tahu alamatnya bisa mencoba login). Perlindungannya: password ber-hash, batas percobaan, token bertanda tangan HMAC, dan semua hak akses dicek di server.
- Repo GitHub Pages bersifat publik, tetapi hanya berisi tampilan; tidak ada password, data pasien, atau kunci di dalamnya.
- Berkas PDF yang dihasilkan memakai tautan "siapa pun yang punya tautan" (sama seperti versi lama). Jangan sebarkan tautan PDF pasien sembarangan.
- Jika kelak jumlah booking mencapai ribuan baris, pemuatan awal akan memuat seluruh riwayat booking (seperti versi lama). Saat itu perlu pemuatan per rentang tanggal — kabari saya.

## Rollback
Aplikasi lama masih berjalan di alamat lama. Untuk kembali, cukup pakai alamat lama; data tetap sama. Tempel `Kode-lama.txt` hanya bila Anda ingin membatalkan perubahan kode di proyek.
