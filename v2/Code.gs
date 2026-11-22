/**
 * Code.gs - Backend Layanan Bimbingan Konseling (BK) SMP
 * Google Apps Script Web App
 *
 * Pemilik script: akun Google sekolah.
 * Deploy: Execute as: Me, Who has access: Anyone.
 * Panggilan dari frontend memakai fetch POST dengan Content-Type text/plain
 * agar lolos tanpa preflight CORS. Semua respons berupa JSON {ok, data, error}.
 */

// ===== Konstanta =====

// Alfabet kode tiket tanpa karakter yang mudah tertukar (tanpa O, 0, I, 1)
const ALFABET_KODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Kata kunci bahaya untuk deteksi otomatis (huruf kecil)
const KATA_BAHAYA = [
  'akhiri hidup', 'mengakhiri hidup', 'bunuh diri', 'ingin mati', 'tidak ingin hidup',
  'menyakiti diri', 'melukai diri', 'memotong tangan', 'memotong pergelangan', 'memotong diri',
  'putus asa', 'tak tahan lagi', 'tidak tahan lagi',
  'dipukul', 'dipukuli', 'dibenturkan', 'ditendang', 'dianiaya', 'penganiayaan',
  'digigit', 'dicekik', 'ditusuk', 'ditelan',
  'dilecehkan', 'diperkosa', 'disentuh paksa', 'pelcehan', 'pelecehan', 'kekerasan seksual'
];

// Batas panjang pesan (karakter)
const MAKS_PESAN = 2000;

// Batas anti-spam global (jumlah per 10 menit)
const BATAS_KIRIM_GLOBAL = 20;
const BATAS_CEK_KODE = 40;

// Header tiap tab Sheet
const HEADER_PENGATURAN = ['Kunci', 'Nilai'];
const HEADER_GURU = ['ID', 'Nama', 'Jabatan', 'Jenjang', 'Kontak', 'Foto', 'Bio', 'Aktif', 'Urutan'];
const HEADER_KELAS = ['Kelas', 'Jenjang', 'Aktif'];
const HEADER_KATEGORI = ['ID', 'Nama', 'Bidang', 'Deskripsi', 'Eskalasi', 'Aktif'];
const HEADER_LAYANAN = ['ID', 'Judul', 'Deskripsi', 'Urutan', 'Aktif'];
const HEADER_FAQ = ['ID', 'Pertanyaan', 'Jawaban', 'Urutan', 'Aktif'];
const HEADER_KIRIMAN = ['IDKiriman', 'Waktu', 'TahunAjaran', 'Semester', 'Jenjang', 'Kelas', 'Nama', 'Anonim', 'KategoriID', 'Urgensi', 'GuruTujuanID', 'Pesan', 'PreferensiBalasan', 'KodeHash', 'Status', 'LabelEskalasi', 'RujukanKe', 'CatatanInternal', 'DiteruskanKe', 'WaktuUbah'];
const HEADER_BALASAN = ['IDBalasan', 'IDKiriman', 'Waktu', 'Pesan'];
const HEADER_LOG = ['Waktu', 'Aksi', 'Detail'];

// ===== Titik Masuk Web App =====

function doGet() {
  return json({ ok: true, data: { layanan: 'BK SMP Web App', status: 'aktif' } });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'Format permintaan tidak valid.' });
  }
  const aksi = body.a || '';
  try {
    if (AKSI_PUBLIK[aksi]) {
      return json(AKSI_PUBLIK[aksi](body));
    }
    if (AKSI_ADMIN[aksi]) {
      const token = body.token || '';
      if (!cekSesi(token)) {
        return json({ ok: false, error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
      }
      return json(AKSI_ADMIN[aksi](body));
    }
    return json({ ok: false, error: 'Aksi tidak dikenal.' });
  } catch (err) {
    catatLog('Galat Server', aksi + ': ' + String(err).slice(0, 200));
    return json({ ok: false, error: 'Terjadi kesalahan di server. Silakan coba beberapa saat lagi.' });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Peta Aksi =====

const AKSI_PUBLIK = {
  ambilDataPublik: ambilDataPublik,
  kirimKiriman: kirimKiriman,
  cekBalasan: cekBalasan,
  loginAdmin: loginAdmin
};

const AKSI_ADMIN = {
  logoutAdmin: logoutAdmin,
  ambilDasbor: ambilDasbor,
  ambilKiriman: ambilKiriman,
  ambilDetailKiriman: ambilDetailKiriman,
  ubahKiriman: ubahKiriman,
  kirimBalasan: kirimBalasan,
  ambilPengaturan: ambilPengaturan,
  simpanPengaturan: simpanPengaturan,
  unduhCadangan: unduhCadangan
};

// ===== Setup & Inisialisasi =====

/**
 * Mengembalikan spreadsheet database. Membuat baru jika belum ada.
 * ID spreadsheet disimpan di Script Properties.
 */
function dapatkanSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('BK_SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  const ss = SpreadsheetApp.create('Database Layanan BK SMP');
  props.setProperty('BK_SPREADSHEET_ID', ss.getId());
  return ss;
}

/**
 * Membuat semua tab Sheet beserta data awal contoh.
 * Jalankan sekali di editor Apps Script (Run > setup).
 * Aman dijalankan ulang: tidak menimpa data yang sudah ada.
 */
function setup() {
  const ss = dapatkanSpreadsheet();

  // Tab Pengaturan
  buatSheetJikaBelumAda(ss, 'Pengaturan', HEADER_PENGATURAN, [
    ['namaSekolah', 'SMP Negeri 1 Contoh'],
    ['namaSingkat', 'SMPN 1 Contoh'],
    ['logo', ''],
    ['alamat', 'Jl. Pendidikan No. 1, Kota Contoh, Provinsi Contoh'],
    ['kontakSekolah', '(021) 12345678'],
    ['kepalaSekolah', 'Drs. Budi Santoso, M.Pd.'],
    ['penandaTangan', ''],
    ['jabatanPenandaTangan', 'Guru Bimbingan Konseling'],
    ['tahunAjaranAktif', '2025/2026'],
    ['semesterAktif', 'Ganjil'],
    ['temaWarna', 'teal'],
    ['teksSambutan', 'Halo! Selamat datang di layanan curhat BK sekolah kita. Di sini kamu boleh menceritakan apa pun yang sedang mengganggu pikiranmu, secara anonim atau dengan menyebut identitas. Guru BK siap mendengarkan dan membantu kamu. Kamu tidak sendirian.'],
    ['banner', ''],
    ['jamLayanan', 'Senin - Jumat, pukul 07.00 - 15.00 WIB'],
    ['kebijakanPrivasi', 'KERAHASIAAN ANDA KAMI JAGA\n\nSetiap kiriman yang kamu kirim melalui layanan ini hanya dapat dilihat oleh guru Bimbingan Konseling (BK) sekolah. Kami tidak menyimpan alamat email, alamat IP, atau jenis perangkat yang kamu gunakan. Kode tiketmu disimpan dalam bentuk terenkripsi (hash) sehingga tidak ada pihak, termasuk pengelola sistem, yang dapat membaca kodenya.\n\nBATAS KERAHASIAAN\n\nAda situasi di mana guru BK harus mengungkapkan informasi untuk melindungi keselamatanmu atau orang lain, yaitu:\n1. Jika ada ancaman bahaya bagi dirimu sendiri.\n2. Jika ada ancaman bahaya bagi orang lain.\n3. Jika terjadi kekerasan atau pelecehan terhadap anak.\nDalam situasi tersebut, guru BK akan mengambil tindakan yang diperlukan, termasuk kemungkinan melaporkan kepada pihak yang berwenang, dengan tetap mendahulukan keselamatanmu.\n\nCatatan: Mohon tinjau dan sesuaikan draf ini dengan kebijakan privasi sekolah Anda.'],
    ['kontakDarurat', 'Jika kamu dalam keadaan darurat atau butuh bantuan segera:\n- Telepon Darurat Nasional: 112\n- Hotline KPAI (Komisi Perlindungan Anak Indonesia): 129\n- Yayasan Pulih (konseling trauma): 021-78842580\n- Into the Light Indonesia (pencegahan bunuh diri): 0800-1234-123\n\nMohon verifikasi nomor-nomor ini sebelum dipakai.']
  ]);

  // Tab Guru
  buatSheetJikaBelumAda(ss, 'Guru', HEADER_GURU, [
    ['GURU-01', 'Ibu Sari Wijaya, S.Psi.', 'Guru BK', '7,8,9', '081234567890', '', 'Guru BK yang melayani kelas 7, 8, dan 9. Siap mendengarkan tanpa menghakimi.', true, 1],
    ['GURU-02', 'Bapak Hendra Saputra, M.Pd.', 'Guru BK', '7,8,9', '081234567891', '', 'Guru BK untuk semua jenjang. Berpengalaman menangani masalah belajar dan sosial.', true, 2],
    ['GURU-03', 'Ibu Dewi Anggraini, S.Pd.', 'Guru BK', '7,8', '081234567892', '', 'Guru BK kelas 7 dan 8. Fokus pada adaptasi sekolah dan pertemanan.', true, 3]
  ]);

  // Tab Kelas
  buatSheetJikaBelumAda(ss, 'Kelas', HEADER_KELAS, [
    ['7A', '7', true],
    ['7B', '7', true],
    ['7C', '7', true],
    ['8A', '8', true],
    ['8B', '8', true],
    ['8C', '8', true],
    ['9A', '9', true],
    ['9B', '9', true],
    ['9C', '9', true]
  ]);

  // Tab Kategori
  buatSheetJikaBelumAda(ss, 'Kategori', HEADER_KATEGORI, [
    ['KAT-01', 'Pribadi', 'pribadi', 'Masalah pribadi, perasaan, atau kesehatan mental', false, true],
    ['KAT-02', 'Belajar', 'belajar', 'Kesulitan belajar, nilai, motivasi belajar', false, true],
    ['KAT-03', 'Sosial/pertemanan', 'sosial', 'Pertemanan, konflik dengan teman, isolasi sosial', false, true],
    ['KAT-04', 'Karier dan minat', 'karier', 'Pilihan jurusan, minat bakat, cita-cita', false, true],
    ['KAT-05', 'Perundungan', 'perundungan-kekerasan', 'Penggencetan, perundungan, intimidasi oleh teman atau pihak lain', true, true],
    ['KAT-06', 'Kekerasan atau pelecehan', 'perundungan-kekerasan', 'Kekerasan fisik, verbal, atau pelecehan seksual', true, true],
    ['KAT-07', 'Lainnya', 'pribadi', 'Topik lain yang belum tercantum di atas', false, true]
  ]);

  // Tab Layanan
  buatSheetJikaBelumAda(ss, 'Layanan', HEADER_LAYANAN, [
    ['LAY-01', 'Konseling Individu', 'Pertemuan tatap muka dengan guru BK untuk membahas masalah pribadi.', 1, true],
    ['LAY-02', 'Konseling Kelompok', 'Pertemuan kelompok kecil untuk berbagi dan saling mendukung.', 2, true],
    ['LAY-03', 'Curhat Online', 'Kirim pesan melalui website ini secara anonim atau beridentitas.', 3, true],
    ['LAY-04', 'Bimbingan Karier', 'Bantuan memilih jurusan dan merencanakan masa depan.', 4, true]
  ]);

  // Tab FAQ
  buatSheetJikaBelumAda(ss, 'FAQ', HEADER_FAQ, [
    ['FAQ-01', 'Apakah curhat saya benar-benar rahasia?', 'Ya. Hanya guru BK sekolah yang dapat melihat kirimanmu. Kode tiketmu disimpan dalam bentuk terenkripsi. Namun ada batas kerahasiaan: jika ada bahaya bagi dirimu atau orang lain, guru BK wajib mengambil tindakan untuk melindungimu.', 1, true],
    ['FAQ-02', 'Apa itu kode tiket?', 'Kode tiket adalah 10 huruf/angka yang kamu dapat setelah mengirim pesan. Simpan baik-baik! Kode ini adalah satu-satunya cara untuk melihat balasan dari guru BK.', 2, true],
    ['FAQ-03', 'Berapa lama balasan diberikan?', 'Guru BK berusaha membalas secepatnya, biasanya dalam 1-3 hari kerja. Untuk hal mendesak, mohon hubungi langsung ruang BK atau kontak darurat.', 3, true],
    ['FAQ-04', 'Bisakah saya curhat tanpa nama?', 'Bisa! Pilih opsi "Anonim" saat mengirim. Kamu tetap mendapat kode tiket untuk mengecek balasan.', 4, true]
  ]);

  // Tab Kiriman, Balasan, Log (hanya header, tanpa data)
  buatSheetJikaBelumAda(ss, 'Kiriman', HEADER_KIRIMAN, null);
  buatSheetJikaBelumAda(ss, 'Balasan', HEADER_BALASAN, null);
  buatSheetJikaBelumAda(ss, 'Log', HEADER_LOG, null);

  // Hapus sheet default kosong jika ada
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Pastikan garam kode tiket sudah ada
  dapatGaramKode();

  catatLog('Setup Selesai', 'Semua tab Sheet dibuat dengan data awal');
  return 'Setup selesai. Semua tab Sheet siap. Jangan lupa jalankan aturKataSandiAdmin() untuk mengatur kata sandi admin.';
}

/**
 * Membuat sheet jika belum ada, menulis header, dan data awal jika masih kosong.
 */
function buatSheetJikaBelumAda(ss, nama, header, dataAwal) {
  let sheet = ss.getSheetByName(nama);
  if (!sheet) {
    sheet = ss.insertSheet(nama);
  }
  // Tulis header
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  // Tulis data awal hanya jika sheet masih kosong (belum ada baris data)
  if (dataAwal && dataAwal.length > 0 && sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, dataAwal.length, header.length).setValues(dataAwal);
  }
  return sheet;
}

/**
 * Mengatur kata sandi admin.
 * Cara pakai:
 * 1. Buka Project Settings > Script properties di editor Apps Script.
 * 2. Tambah properti "BK_TEMP_PASSWORD" dengan kata sandi baru yang diinginkan.
 * 3. Jalankan fungsi ini (Run > aturKataSandiAdmin).
 * 4. Kata sandi akan di-hash dan disimpan; properti sementara dihapus.
 */
function aturKataSandiAdmin() {
  const props = PropertiesService.getScriptProperties();
  const kataSandiBaru = props.getProperty('BK_TEMP_PASSWORD');
  if (!kataSandiBaru) {
    return 'Properti BK_TEMP_PASSWORD belum diisi. Buka Project Settings > Script properties, tambah properti BK_TEMP_PASSWORD dengan kata sandi baru, lalu jalankan fungsi ini lagi.';
  }
  if (kataSandiBaru.length < 8) {
    props.deleteProperty('BK_TEMP_PASSWORD');
    return 'Kata sandi minimal 8 karakter. Ulangi lagi dengan kata sandi yang lebih panjang.';
  }
  // Buat garam admin jika belum ada
  let garam = props.getProperty('BK_SALT_ADMIN');
  if (!garam) {
    garam = Utilities.getUuid();
    props.setProperty('BK_SALT_ADMIN', garam);
  }
  const hash = hashSHA256(kataSandiBaru, garam);
  props.setProperty('BK_ADMIN_HASH', hash);
  props.deleteProperty('BK_TEMP_PASSWORD');
  catatLog('Kata Sandi Diatur', 'Kata sandi admin diperbarui');
  return 'Kata sandi admin berhasil disimpan. Properti BK_TEMP_PASSWORD telah dihapus. Sekarang kamu bisa login di admin.html.';
}

// ===== Autentikasi Admin =====

function loginAdmin(body) {
  if (cekKunciLogin()) {
    return { ok: false, error: 'Login dikunci karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.' };
  }
  const kataSandi = body.kataSandi || '';
  if (!kataSandi) {
    catatKegagalanLogin();
    return { ok: false, error: 'Kata sandi salah.' };
  }
  const props = PropertiesService.getScriptProperties();
  const hashTersimpan = props.getProperty('BK_ADMIN_HASH');
  const garam = props.getProperty('BK_SALT_ADMIN');
  if (!hashTersimpan || !garam) {
    return { ok: false, error: 'Kata sandi admin belum diatur. Jalankan fungsi aturKataSandiAdmin() di editor Apps Script.' };
  }
  const hashInput = hashSHA256(kataSandi, garam);
  if (hashInput !== hashTersimpan) {
    catatKegagalanLogin();
    return { ok: false, error: 'Kata sandi salah.' };
  }
  // Login berhasil
  const token = buatToken();
  simpanSesi(token);
  CacheService.getScriptCache().remove('LOGIN_GAGAL');
  catatLog('Login Berhasil', 'Admin masuk');
  return { ok: true, data: { token: token } };
}

function logoutAdmin(body) {
  hapusSesi(body.token || '');
  catatLog('Logout', 'Admin keluar');
  return { ok: true, data: { keluar: true } };
}

function cekSesi(token) {
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  return cache.get('SESI_' + token) === '1';
}

function simpanSesi(token) {
  // Kedaluwarsa 6 jam (dalam detik)
  CacheService.getScriptCache().put('SESI_' + token, '1', 6 * 60 * 60);
}

function hapusSesi(token) {
  if (token) CacheService.getScriptCache().remove('SESI_' + token);
}

function catatKegagalanLogin() {
  const cache = CacheService.getScriptCache();
  const kunci = 'LOGIN_GAGAL';
  let nilai = parseInt(cache.get(kunci) || '0', 10) + 1;
  if (nilai >= 5) {
    cache.put('LOGIN_KUNCI', '1', 15 * 60); // kunci 15 menit
    cache.remove(kunci);
  } else {
    cache.put(kunci, String(nilai), 15 * 60);
  }
}

function cekKunciLogin() {
  return CacheService.getScriptCache().get('LOGIN_KUNCI') === '1';
}

function buatToken() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

// ===== Helper Keamanan (Hash & Garam) =====

function hashSHA256(teks, garam) {
  const input = garam + teks;
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    const v = (b < 0) ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function dapatGaramKode() {
  const props = PropertiesService.getScriptProperties();
  let garam = props.getProperty('BK_SALT_KODE');
  if (!garam) {
    garam = Utilities.getUuid();
    props.setProperty('BK_SALT_KODE', garam);
  }
  return garam;
}

// ===== Aksi Publik (Siswa, tanpa login) =====

/**
 * Mengembalikan data publik untuk halaman siswa: pengaturan tampilan,
 * guru aktif, kelas, kategori, layanan, dan FAQ. Di-cache 5 menit.
 */
function ambilDataPublik() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('DATA_PUBLIK');
  if (cached) {
    try { return { ok: true, data: JSON.parse(cached) }; } catch (e) { /* lanjut baca ulang */ }
  }
  const pengaturan = bacaPengaturan();
  const data = {
    pengaturan: {
      namaSekolah: pengaturan.namaSekolah || '',
      namaSingkat: pengaturan.namaSingkat || '',
      logo: pengaturan.logo || '',
      alamat: pengaturan.alamat || '',
      kontakSekolah: pengaturan.kontakSekolah || '',
      tahunAjaranAktif: pengaturan.tahunAjaranAktif || '',
      semesterAktif: pengaturan.semesterAktif || '',
      temaWarna: pengaturan.temaWarna || 'teal',
      teksSambutan: pengaturan.teksSambutan || '',
      banner: pengaturan.banner || '',
      jamLayanan: pengaturan.jamLayanan || '',
      kebijakanPrivasi: pengaturan.kebijakanPrivasi || '',
      kontakDarurat: pengaturan.kontakDarurat || ''
    },
    guru: bacaSheet('Guru').filter(function (g) { return isAktif(g.Aktif); })
      .sort(function (a, b) { return (a.Urutan || 0) - (b.Urutan || 0); })
      .map(function (g) {
        return { ID: g.ID, Nama: g.Nama, Jabatan: g.Jabatan, Jenjang: g.Jenjang, Kontak: g.Kontak, Foto: g.Foto, Bio: g.Bio };
      }),
    kelas: bacaSheet('Kelas').filter(function (k) { return isAktif(k.Aktif); }),
    kategori: bacaSheet('Kategori').filter(function (k) { return isAktif(k.Aktif); }),
    layanan: bacaSheet('Layanan').filter(function (l) { return isAktif(l.Aktif); })
      .sort(function (a, b) { return (a.Urutan || 0) - (b.Urutan || 0); }),
    faq: bacaSheet('FAQ').filter(function (f) { return isAktif(f.Aktif); })
      .sort(function (a, b) { return (a.Urutan || 0) - (b.Urutan || 0); })
  };
  try {
    cache.put('DATA_PUBLIK', JSON.stringify(data), 5 * 60);
  } catch (e) {
    // Lewati caching jika data terlalu besar (melebihi batas CacheService)
  }
  return { ok: true, data: data };
}

/**
 * Menerima kiriman baru dari siswa.
 */
function kirimKiriman(body) {
  // Anti-spam: kolom jebakan (honeypot) harus kosong
  if (body.website && String(body.website).length > 0) {
    return { ok: false, error: 'Terjadi galat. Silakan muat ulang halaman dan coba lagi.' };
  }
  // Anti-spam: waktu isi minimum (mencegah kiriman otomatis terlalu cepat)
  if (!cekWaktuIsi(body.mulai)) {
    return { ok: false, error: 'Formulir terkirim terlalu cepat. Silakan isi dengan tenang dan kirim ulang.' };
  }
  // Anti-spam: batas global per 10 menit
  const hitungKirim = catatPengirimanGlobal();
  if (hitungKirim > BATAS_KIRIM_GLOBAL) {
    return { ok: false, error: 'Terlalu banyak kiriman dalam waktu singkat. Mohon coba lagi nanti.' };
  }
  // Validasi input
  const error = validasiKiriman(body);
  if (error) return { ok: false, error: error };

  const pengaturan = bacaPengaturan();
  const ta = pengaturan.tahunAjaranAktif || '';
  const sem = pengaturan.semesterAktif || '';

  const anonim = isAktif(body.anonim);
  const jenjang = sanitasiTeks(body.jenjang, 2);
  const kelas = anonim ? '' : sanitasiTeks(body.kelas, 20);
  const nama = anonim ? '' : sanitasiTeks(body.nama, 100);
  const kategoriID = sanitasiTeks(body.kategoriID, 20);
  const guruTujuanID = sanitasiTeks(body.guruTujuanID, 30);
  const pesan = sanitasiTeks(body.pesan, MAKS_PESAN);
  const preferensi = sanitasiTeks(body.preferensiBalasan, 20);

  // Deteksi kata kunci bahaya -> naikkan urgensi ke tinggi
  const bahaya = deteksiBahaya(pesan);
  let urgensi = sanitasiTeks(body.urgensi, 10);
  if (bahaya) urgensi = 'tinggi';

  // Cek label eskalasi berdasarkan kategori
  const kategori = bacaSheet('Kategori').find(function (k) { return k.ID === kategoriID; });
  const labelEskalasi = kategori ? isAktif(kategori.Eskalasi) : false;

  // Buat kode tiket dan ID kiriman
  const kode = buatKodeTiket();
  const idKiriman = buatIDKiriman();
  const garam = dapatGaramKode();
  const kodeHash = hashSHA256(kode, garam);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    tambahBaris('Kiriman', {
      IDKiriman: idKiriman,
      Waktu: new Date(),
      TahunAjaran: ta,
      Semester: sem,
      Jenjang: jenjang,
      Kelas: kelas,
      Nama: nama,
      Anonim: anonim,
      KategoriID: kategoriID,
      Urgensi: urgensi,
      GuruTujuanID: guruTujuanID,
      Pesan: pesan,
      PreferensiBalasan: preferensi,
      KodeHash: kodeHash,
      Status: 'Baru',
      LabelEskalasi: labelEskalasi,
      RujukanKe: '',
      CatatanInternal: '',
      DiteruskanKe: '',
      WaktuUbah: new Date()
    });
    catatLog('Kiriman Baru', 'ID: ' + idKiriman + ' | Kategori: ' + kategoriID + (bahaya ? ' | Terdeteksi kata bahaya' : ''));
    return { ok: true, data: { kode: kode, bahaya: bahaya } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengecek status dan balasan kiriman berdasarkan kode tiket.
 */
function cekBalasan(body) {
  const kode = sanitasiTeks(body.kode, 20).toUpperCase();
  if (!kode || kode.length !== 10) {
    return { ok: false, error: 'Kode tiket tidak valid. Pastikan 10 karakter.' };
  }
  // Anti-spam: batas percobaan cek
  const hitungCek = catatCekKode();
  if (hitungCek > BATAS_CEK_KODE) {
    return { ok: false, error: 'Terlalu banyak percobaan. Mohon coba lagi nanti.' };
  }
  const garam = dapatGaramKode();
  const hash = hashSHA256(kode, garam);
  const kiriman = bacaSheet('Kiriman').find(function (k) { return k.KodeHash === hash; });
  if (!kiriman) {
    return { ok: false, error: 'Kode tiket tidak ditemukan. Periksa kembali kode Anda.' };
  }
  const balasan = bacaSheet('Balasan').filter(function (b) { return b.IDKiriman === kiriman.IDKiriman; })
    .sort(function (a, b) { return new Date(a.Waktu) - new Date(b.Waktu); });
  return {
    ok: true,
    data: {
      status: kiriman.Status,
      urgensi: kiriman.Urgensi,
      waktu: kiriman.Waktu,
      balasan: balasan.map(function (b) { return { waktu: b.Waktu, pesan: b.Pesan }; })
    }
  };
}

// ===== Aksi Admin (butuh token) =====

function ambilDasbor(body) {
  const pengaturan = bacaPengaturan();
  const ta = pengaturan.tahunAjaranAktif || '';
  const sem = pengaturan.semesterAktif || '';
  const semuaKiriman = bacaSheet('Kiriman');
  const periodeAktif = semuaKiriman.filter(function (k) {
    return k.TahunAjaran === ta && k.Semester === sem;
  });
  const semuaBalasan = bacaSheet('Balasan');
  const idDibales = semuaBalasan.map(function (b) { return b.IDKiriman; });

  const baru = periodeAktif.filter(function (k) { return k.Status === 'Baru'; }).length;
  const belumDibalas = periodeAktif.filter(function (k) {
    return idDibales.indexOf(k.IDKiriman) === -1 && k.Status !== 'Selesai';
  }).length;
  const urgensiTinggi = periodeAktif.filter(function (k) { return k.Urgensi === 'tinggi'; }).length;
  const perluEskalasi = periodeAktif.filter(function (k) { return isAktif(k.LabelEskalasi); }).length;
  const total = periodeAktif.length;

  return {
    ok: true,
    data: {
      baru: baru,
      belumDibalas: belumDibalas,
      urgensiTinggi: urgensiTinggi,
      perluEskalasi: perluEskalasi,
      total: total,
      tahunAjaran: ta,
      semester: sem
    }
  };
}

function ambilKiriman(body) {
  let semua = bacaSheet('Kiriman');
  if (body.jenjang) semua = semua.filter(function (k) { return k.Jenjang === body.jenjang; });
  if (body.guruTujuan) {
    semua = semua.filter(function (k) {
      if (body.guruTujuan === 'Siapa saja') {
        return !k.GuruTujuanID || k.GuruTujuanID === 'Siapa saja';
      }
      return k.GuruTujuanID === body.guruTujuan;
    });
  }
  if (body.kategori) semua = semua.filter(function (k) { return k.KategoriID === body.kategori; });
  if (body.status) semua = semua.filter(function (k) { return k.Status === body.status; });
  if (body.urgensi) semua = semua.filter(function (k) { return k.Urgensi === body.urgensi; });
  if (body.tahunAjaran) semua = semua.filter(function (k) { return k.TahunAjaran === body.tahunAjaran; });
  if (body.semester) semua = semua.filter(function (k) { return k.Semester === body.semester; });
  if (body.hanyaEskalasi) semua = semua.filter(function (k) { return isAktif(k.LabelEskalasi); });
  if (body.cari) {
    const q = String(body.cari).toLowerCase();
    semua = semua.filter(function (k) {
      return String(k.IDKiriman).toLowerCase().indexOf(q) !== -1 ||
        String(k.Pesan).toLowerCase().indexOf(q) !== -1 ||
        String(k.Nama).toLowerCase().indexOf(q) !== -1;
    });
  }
  // Urutkan terbaru di atas
  semua.sort(function (a, b) {
    return new Date(b.Waktu) - new Date(a.Waktu);
  });
  return { ok: true, data: semua };
}

function ambilDetailKiriman(body) {
  const id = body.idKiriman;
  if (!id) return { ok: false, error: 'ID kiriman tidak diberikan.' };
  const semua = bacaSheet('Kiriman');
  const kiriman = semua.find(function (k) { return k.IDKiriman === id; });
  if (!kiriman) return { ok: false, error: 'Kiriman tidak ditemukan.' };
  const balasan = bacaSheet('Balasan').filter(function (b) { return b.IDKiriman === id; })
    .sort(function (a, b) { return new Date(a.Waktu) - new Date(b.Waktu); });
  // Tandai sudah dibaca jika masih Baru
  if (kiriman.Status === 'Baru') {
    perbaruiBarisKiriman(id, { Status: 'Dibaca', WaktuUbah: new Date() });
    kiriman.Status = 'Dibaca';
  }
  // Sertakan info kategori untuk label
  const kategori = bacaSheet('Kategori');
  return {
    ok: true,
    data: {
      kiriman: kiriman,
      balasan: balasan,
      kategoriNama: (kategori.find(function (k) { return k.ID === kiriman.KategoriID; }) || {}).Nama || ''
    }
  };
}

function ubahKiriman(body) {
  const id = body.idKiriman;
  if (!id) return { ok: false, error: 'ID kiriman tidak diberikan.' };
  const perubahan = {};
  const statusValid = ['Baru', 'Dibaca', 'Ditangani', 'Selesai', 'Dirujuk'];
  if (body.status && statusValid.indexOf(body.status) !== -1) {
    perubahan.Status = body.status;
  }
  if (body.rujukanKe !== undefined) perubahan.RujukanKe = sanitasiTeks(body.rujukanKe, 200);
  if (body.diteruskanKe !== undefined) perubahan.DiteruskanKe = sanitasiTeks(body.diteruskanKe, 200);
  if (body.catatanInternal !== undefined) perubahan.CatatanInternal = sanitasiTeks(body.catatanInternal, 1000);
  perubahan.WaktuUbah = new Date();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sukses = perbaruiBarisKiriman(id, perubahan);
    if (!sukses) return { ok: false, error: 'Kiriman tidak ditemukan.' };
    catatLog('Kiriman Diperbarui', 'ID: ' + id);
    return { ok: true, data: { tersimpan: true } };
  } finally {
    lock.releaseLock();
  }
}

function kirimBalasan(body) {
  const id = body.idKiriman;
  const pesan = sanitasiTeks(body.pesan, 2000);
  if (!id) return { ok: false, error: 'ID kiriman tidak diberikan.' };
  if (!pesan) return { ok: false, error: 'Isi balasan tidak boleh kosong.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const idBalasan = 'B' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    tambahBaris('Balasan', {
      IDBalasan: idBalasan,
      IDKiriman: id,
      Waktu: new Date(),
      Pesan: pesan
    });
    // Update status dan waktu ubah
    const kiriman = bacaSheet('Kiriman').find(function (k) { return k.IDKiriman === id; });
    const perubahan = { WaktuUbah: new Date() };
    if (kiriman && kiriman.Status === 'Baru') {
      perubahan.Status = 'Dibaca';
    }
    perbaruiBarisKiriman(id, perubahan);
    catatLog('Balasan Dikirim', 'ID: ' + id);
    return { ok: true, data: { idBalasan: idBalasan } };
  } finally {
    lock.releaseLock();
  }
}

function ambilPengaturan(body) {
  return {
    ok: true,
    data: {
      pengaturan: bacaPengaturan(),
      guru: bacaSheet('Guru'),
      kelas: bacaSheet('Kelas'),
      kategori: bacaSheet('Kategori'),
      layanan: bacaSheet('Layanan'),
      faq: bacaSheet('FAQ')
    }
  };
}

function simpanPengaturan(body) {
  // Validasi periode aktif
  if (body.pengaturan) {
    if (!body.pengaturan.tahunAjaranAktif || !body.pengaturan.semesterAktif) {
      return { ok: false, error: 'Tahun ajaran dan semester aktif harus diisi.' };
    }
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (body.pengaturan) {
      const pasangan = [];
      for (const kunci in body.pengaturan) {
        pasangan.push({ Kunci: kunci, Nilai: body.pengaturan[kunci] });
      }
      gantiIsiSheet('Pengaturan', HEADER_PENGATURAN, pasangan);
    }
    if (body.guru) gantiIsiSheet('Guru', HEADER_GURU, body.guru);
    if (body.kelas) gantiIsiSheet('Kelas', HEADER_KELAS, body.kelas);
    if (body.kategori) gantiIsiSheet('Kategori', HEADER_KATEGORI, body.kategori);
    if (body.layanan) gantiIsiSheet('Layanan', HEADER_LAYANAN, body.layanan);
    if (body.faq) gantiIsiSheet('FAQ', HEADER_FAQ, body.faq);
    // Bersihkan cache data publik agar siswa melihat perubahan
    CacheService.getScriptCache().remove('DATA_PUBLIK');
    catatLog('Pengaturan Disimpan', 'Konfigurasi diperbarui oleh admin');
    return { ok: true, data: { tersimpan: true } };
  } finally {
    lock.releaseLock();
  }
}

function unduhCadangan(body) {
  const daftar = ['Pengaturan', 'Guru', 'Kelas', 'Kategori', 'Layanan', 'FAQ', 'Kiriman', 'Balasan', 'Log'];
  const hasil = {};
  daftar.forEach(function (nama) {
    hasil[nama] = bacaSheet(nama);
  });
  return { ok: true, data: hasil };
}

// ===== Helper Sheet =====

function bacaSheet(nama) {
  const ss = dapatkanSpreadsheet();
  const sheet = ss.getSheetByName(nama);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const header = data[0];
  const hasil = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].join('') === '') continue; // lewati baris kosong
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = data[i][j];
    }
    hasil.push(obj);
  }
  return hasil;
}

function bacaPengaturan() {
  const baris = bacaSheet('Pengaturan');
  const obj = {};
  baris.forEach(function (b) { obj[b.Kunci] = b.Nilai; });
  return obj;
}

function tambahBaris(nama, objek) {
  const ss = dapatkanSpreadsheet();
  const sheet = ss.getSheetByName(nama);
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + nama);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const baris = header.map(function (k) { return objek[k] !== undefined ? objek[k] : ''; });
  sheet.appendRow(baris);
}

function gantiIsiSheet(nama, header, barisData) {
  const ss = dapatkanSpreadsheet();
  const sheet = ss.getSheetByName(nama);
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + nama);
  const barisTerakhir = sheet.getLastRow();
  const kolomTerakhir = Math.max(sheet.getLastColumn(), header.length);
  // Bersihkan data lama (baris 2 ke bawah)
  if (barisTerakhir > 1) {
    sheet.getRange(2, 1, barisTerakhir - 1, kolomTerakhir).clearContent();
  }
  // Pastikan header
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  // Tulis data baru
  if (barisData && barisData.length > 0) {
    const matriks = barisData.map(function (obj) {
      return header.map(function (k) { return obj[k] !== undefined ? obj[k] : ''; });
    });
    sheet.getRange(2, 1, matriks.length, header.length).setValues(matriks);
  }
}

function perbaruiBarisKiriman(idKiriman, perubahan) {
  const ss = dapatkanSpreadsheet();
  const sheet = ss.getSheetByName('Kiriman');
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const idxId = header.indexOf('IDKiriman');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxId] === idKiriman) {
      for (const kunci in perubahan) {
        const kol = header.indexOf(kunci);
        if (kol !== -1) {
          sheet.getRange(i + 1, kol + 1).setValue(perubahan[kunci]);
        }
      }
      return true;
    }
  }
  return false;
}

// ===== Helper Validasi & Sanitasi =====

function validasiKiriman(body) {
  const anonim = isAktif(body.anonim);
  if (!body.jenjang || ['7', '8', '9'].indexOf(String(body.jenjang)) === -1) {
    return 'Jenjang harus dipilih.';
  }
  if (!anonim) {
    if (!body.nama || sanitasiTeks(body.nama, 100).length < 1) {
      return 'Nama harus diisi jika kamu memilih menyertakan identitas.';
    }
    if (!body.kelas || sanitasiTeks(body.kelas, 20).length < 1) {
      return 'Kelas harus dipilih jika kamu memilih menyertakan identitas.';
    }
  }
  if (!body.kategoriID) return 'Kategori harus dipilih.';
  if (!body.urgensi || ['rendah', 'sedang', 'tinggi'].indexOf(String(body.urgensi)) === -1) {
    return 'Tingkat urgensi harus dipilih.';
  }
  if (!body.pesan || sanitasiTeks(body.pesan, MAKS_PESAN).length < 1) {
    return 'Isi pesan tidak boleh kosong.';
  }
  if (!body.preferensiBalasan || ['website', 'langsung'].indexOf(String(body.preferensiBalasan)) === -1) {
    return 'Preferensi balasan harus dipilih.';
  }
  // Validasi guru tujuan jika diisi
  if (body.guruTujuanID && body.guruTujuanID !== 'Siapa saja') {
    const guru = bacaSheet('Guru').find(function (g) { return g.ID === body.guruTujuanID && isAktif(g.Aktif); });
    if (!guru) return 'Guru tujuan tidak valid.';
  }
  // Validasi kategori aktif
  const kat = bacaSheet('Kategori').find(function (k) { return k.ID === body.kategoriID && isAktif(k.Aktif); });
  if (!kat) return 'Kategori tidak valid.';
  return null;
}

function sanitasiTeks(teks, maks) {
  if (teks === null || teks === undefined) return '';
  let s = String(teks).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (maks && s.length > maks) s = s.slice(0, maks);
  return s;
}

function isAktif(v) {
  return v === true || v === 'TRUE' || v === 'True' || v === 'true' || v === 1 || v === '1';
}

// ===== Helper Anti-Spam =====

function catatPengirimanGlobal() {
  const cache = CacheService.getScriptCache();
  const kunci = 'KIRIM_GLOBAL';
  let nilai = parseInt(cache.get(kunci) || '0', 10) + 1;
  cache.put(kunci, String(nilai), 10 * 60);
  return nilai;
}

function catatCekKode() {
  const cache = CacheService.getScriptCache();
  const kunci = 'CEK_KODE';
  let nilai = parseInt(cache.get(kunci) || '0', 10) + 1;
  cache.put(kunci, String(nilai), 10 * 60);
  return nilai;
}

function cekWaktuIsi(mulai) {
  if (!mulai) return false;
  const ms = Number(mulai);
  if (isNaN(ms)) return false;
  return (Date.now() - ms) >= 3000;
}

// ===== Helper Umum =====

function deteksiBahaya(pesan) {
  const teks = String(pesan).toLowerCase();
  for (let i = 0; i < KATA_BAHAYA.length; i++) {
    if (teks.indexOf(KATA_BAHAYA[i]) !== -1) return true;
  }
  return false;
}

function buatKodeTiket() {
  let kode = '';
  for (let i = 0; i < 10; i++) {
    kode += ALFABET_KODE[Math.floor(Math.random() * ALFABET_KODE.length)];
  }
  return kode;
}

function buatIDKiriman() {
  const acak = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'K' + Date.now().toString(36).toUpperCase() + acak;
}

function catatLog(aksi, detail) {
  try {
    tambahBaris('Log', {
      Waktu: new Date(),
      Aksi: aksi,
      Detail: String(detail || '').slice(0, 500)
    });
  } catch (e) {
    // Abaikan galat logging agar tidak mengganggu operasi utama
  }
}