# Layanan BK SMP — Website Bimbingan Konseling

Website curhat dan konseling untuk siswa SMP (kelas 7, 8, 9). Siswa dapat mengirim pesan anonim atau beridentitas, menyertakan lampiran file, dan mengecek balasan via kode tiket. Admin (guru BK) mengelola kiriman, membalas, membuat laporan PDF, dan mengunduh cadangan Excel.

## Struktur Berkas

```
bk-website/
├── index.html          # Halaman siswa (curhat, cek balasan, info)
├── admin.html          # Halaman admin (login, dasbor, kotak masuk, pengaturan)
├── css/
│   └── style.css       # Gaya untuk kedua halaman
├── js/
│   ├── config.js       # URL Web App (SATU-SATUNYA yang perlu diubah)
│   ├── app.js          # Logika halaman siswa
│   ├── admin.js        # Logika halaman admin
│   └── pdf.js          # Generator laporan PDF
├── Code.gs             # Backend Google Apps Script
└── README.md           # Panduan ini
```

## Teknologi

- **Frontend:** HTML/CSS/JS murni (tanpa framework), untuk GitHub Pages
- **Backend:** Google Apps Script Web App + Google Sheet
- **PDF:** jsPDF 2.5.1 + jspdf-autotable 3.8.2 (cdnjs)
- **Excel:** SheetJS xlsx 0.18.5 (cdnjs)
- **Font:** Nunito (Google Fonts)

## Penerapan

Lihat panduan lengkap di bawah (Tahap D). Singkatnya:

1. Salin Code.gs ke editor Apps Script di akun Google sekolah
2. Jalankan `setup()` → jalankan `aturKataSandiAdmin()`
3. Deploy sebagai Web App (Execute as: Me, akses: Anyone)
4. Salin URL deployment ke `js/config.js`
5. Unggah semua berkas ke GitHub Pages
6. Buka website dan uji

## Privasi dan Keamanan

- Kode tiket disimpan sebagai hash SHA-256 bergaram (tidak bisa ditebak)
- Kata sandi admin di-hash bergaram di Script Properties
- Sesi admin 6 jam, kunci login 15 menit setelah 5 gagal
- Anti-spam: honeypot, batas waktu isi, batas global per 10 menit
- Tidak menyimpan email, IP, atau perangkat siswa
- Hanya data publik yang dikirim ke halaman siswa
- Deteksi kata kunci bahaya dengan kontak darurat otomatis
