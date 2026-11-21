// js/admin.js - Logika halaman admin Layanan BK SMP
(function () {
  'use strict';

  // ===== State =====
  let token = sessionStorage.getItem('bk_token') || '';
  let dataPengaturan = null;
  let daftarKirimanSaatIni = [];
  let kirimanDetailSaatIni = null;
  let modePDFSaatIni = null; // 'kasus' | 'rekap'
  let idKirimanPDF = null;

  // ===== API =====

  async function panggilAPI(aksi, payload) {
    const body = JSON.stringify(Object.assign({ a: aksi, token: token }, payload || {}));
    console.log('[BK-Admin] Kirim:', aksi);
    let res;
    try {
      res = await fetch(CONFIG.WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body
      });
    } catch (e) {
      console.error('[BK-Admin] Fetch gagal:', e);
      throw new Error('Tidak dapat terhubung ke server.');
    }
    const teks = await res.text();
    try {
      return JSON.parse(teks);
    } catch (e) {
      console.error('[BK-Admin] Respons non-JSON:', teks.slice(0, 300));
      throw new Error('Server mengembalikan respons non-JSON.');
    }
  }

  // ===== Inisialisasi =====

  document.addEventListener('DOMContentLoaded', function () {
    pasangEventListener();
    if (token) {
      // Token ada: tampilkan app langsung, lalu muat data
      // Jika token tidak valid, muatDasbor akan memanggil logout()
      tampilkanApp();
    } else {
      tampilkanLogin();
    }
  });

  // ===== Login / Logout =====

  function tampilkanLogin() {
    document.getElementById('layar-login').hidden = false;
    document.getElementById('app-admin').hidden = true;
  }

  function tampilkanApp() {
    document.getElementById('layar-login').hidden = true;
    document.getElementById('app-admin').hidden = false;
    muatDasbor();
  }

  async function login(kataSandi) {
    tampilkanMemuat(true, 'Masuk...');
    try {
      const resp = await panggilAPI('loginAdmin', { kataSandi: kataSandi, token: '' });
      if (resp.ok && resp.data && resp.data.token) {
        token = resp.data.token;
        sessionStorage.setItem('bk_token', token);
        tampilkanApp();
      } else {
        tampilkanInfoLogin(resp.error || 'Kata sandi salah.', 'galat');
      }
    } catch (e) {
      tampilkanInfoLogin('Tidak bisa terhubung ke server. ' + String(e.message || e), 'galat');
    }
    tampilkanMemuat(false);
  }

  async function logout() {
    try {
      await panggilAPI('logoutAdmin', {});
    } catch (e) { /* abaikan */ }
    token = '';
    sessionStorage.removeItem('bk_token');
    tampilkanLogin();
    document.getElementById('input-kata-sandi').value = '';
  }

  // ===== Dasbor =====

  async function muatDasbor() {
    tampilkanMemuat(true, 'Memuat dasbor...');
    try {
      const resp = await panggilAPI('ambilDasbor', {});
      if (resp.ok && resp.data) {
        const d = resp.data;
        setText('stat-baru', String(d.baru));
        setText('stat-belum', String(d.belumDibalas));
        setText('stat-urgensi', String(d.urgensiTinggi));
        setText('stat-eskalasi', String(d.perluEskalasi));
        setText('stat-total', String(d.total));
        setText('dasbor-periode-info', 'Tahun Ajaran ' + d.tahunAjaran + ' - Semester ' + d.semester);
        // Muat pengaturan untuk info header
        if (!dataPengaturan) {
          muatPengaturan(true);
        }
      } else {
        if (resp.error && resp.error.indexOf('Sesi') !== -1) {
          logout();
        }
      }
    } catch (e) {
      tampilkanToast('Gagal memuat dasbor.', 'error');
    }
    tampilkanMemuat(false);
  }

  // ===== Kotak Masuk =====

  async function muatKiriman() {
    tampilkanMemuat(true, 'Memuat kiriman...');
    const filters = kumpulFilter();
    try {
      const resp = await panggilAPI('ambilKiriman', filters);
      if (resp.ok && resp.data) {
        daftarKirimanSaatIni = resp.data;
        renderTabelKiriman(resp.data);
      } else {
        if (resp.error && resp.error.indexOf('Sesi') !== -1) {
          logout();
        } else {
          tampilkanToast(resp.error || 'Gagal memuat kiriman.', 'error');
        }
      }
    } catch (e) {
      tampilkanToast('Tidak bisa terhubung ke server.', 'error');
    }
    tampilkanMemuat(false);
  }

  function kumpulFilter() {
    return {
      cari: val('filter-cari'),
      jenjang: val('filter-jenjang'),
      status: val('filter-status'),
      urgensi: val('filter-urgensi'),
      kategori: val('filter-kategori'),
      guruTujuan: val('filter-guru'),
      tahunAjaran: val('filter-ta'),
      semester: val('filter-semester'),
      hanyaEskalasi: document.getElementById('filter-eskalasi').checked
    };
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function renderTabelKiriman(daftar) {
    const wadah = document.getElementById('tabel-kiriman');
    const infoJumlah = document.getElementById('info-jumlah-kiriman');
    infoJumlah.textContent = daftar.length + ' kiriman';

    if (daftar.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Tidak ada kiriman yang cocok dengan filter.</p>';
      return;
    }

    // Render sebagai kartu (mobile-first, juga dipakai di desktop)
    wadah.innerHTML = daftar.map(function (k) {
      const eskalasi = isAktif(k.LabelEskalasi);
      const anonim = isAktif(k.Anonim);
      const namaTampil = anonim ? 'Anonim' : (k.Nama || '(tanpa nama)');
      const kelasTampil = anonim ? '-' : (k.Kelas || '-');
      const urgensiClass = k.Urgensi === 'tinggi' ? 'badge-urgensi-tinggi' : (k.Urgensi === 'sedang' ? 'badge-urgensi-sedang' : 'badge-urgensi-rendah');
      const statusClass = (k.Status || 'Baru').toLowerCase();

      return '<div class="kartu-kiriman' + (eskalasi ? ' kartu-eskalasi' : '') + '" data-id="' + escapeAttr(k.IDKiriman) + '" tabindex="0" role="button">' +
        '<div class="baris-utama-kiriman">' +
          '<div class="info-utama-kiriman">' +
            '<span class="id-kiriman">' + escapeHtml(k.IDKiriman) + '</span>' +
            (eskalasi ? '<span class="badge-eskalasi">TPPK</span>' : '') +
            '<span class="badge-urgensi ' + urgensiClass + '">' + escapeHtml(k.Urgensi || '-') + '</span>' +
            '<span class="badge-status badge-status-' + statusClass + '">' + escapeHtml(k.Status || 'Baru') + '</span>' +
          '</div>' +
          '<div class="waktu-kiriman">' + formatTanggalPendek(k.Waktu) + '</div>' +
        '</div>' +
        '<div class="info-tambahan-kiriman">' +
          '<span>K' + escapeHtml(String(k.Jenjang || '-')) + ' / ' + escapeHtml(kelasTampil) + '</span>' +
          '<span>' + escapeHtml(namaTampil) + '</span>' +
          '<span>Kategori: ' + escapeHtml(k.KategoriID || '-') + '</span>' +
          '<span>Guru: ' + escapeHtml(k.GuruTujuanID === 'Siapa saja' || !k.GuruTujuanID ? 'Siapa Saja' : k.GuruTujuanID) + '</span>' +
        '</div>' +
        '<div class="cuplikan-pesan">' + escapeHtml(String(k.Pesan || '').slice(0, 100)) + (k.Pesan && k.Pesan.length > 100 ? '...' : '') + '</div>' +
      '</div>';
    }).join('');

    // Pasang event klik
    wadah.querySelectorAll('.kartu-kiriman').forEach(function (el) {
      el.addEventListener('click', function () {
        bukaDetail(el.dataset.id);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          bukaDetail(el.dataset.id);
        }
      });
    });
  }

  // ===== Detail Kiriman =====

  async function bukaDetail(id) {
    navigasiView('detail');
    tampilkanMemuat(true, 'Memuat detail...');
    try {
      const resp = await panggilAPI('ambilDetailKiriman', { idKiriman: id });
      if (resp.ok && resp.data) {
        kirimanDetailSaatIni = resp.data;
        renderDetail(resp.data);
      } else {
        document.getElementById('konten-detail').innerHTML = '<p class="keadaan-kosong">' + escapeHtml(resp.error || 'Tidak ditemukan.') + '</p>';
      }
    } catch (e) {
      document.getElementById('konten-detail').innerHTML = '<p class="keadaan-kosong">Gagal memuat detail.</p>';
    }
    tampilkanMemuat(false);
  }

  function renderDetail(data) {
    const k = data.kiriman;
    const balasan = data.balasan || [];
    const wadah = document.getElementById('konten-detail');
    const anonim = isAktif(k.Anonim);
    const eskalasi = isAktif(k.LabelEskalasi);

    // Parse lampiran
    let lampiran = [];
    try { lampiran = k.Lampiran ? JSON.parse(k.Lampiran) : []; } catch (e) {}

    let html = '<div class="kartu-detail">';
    html += '<div class="header-detail">';
    html += '<div><h3>' + escapeHtml(k.IDKiriman) + '</h3>';
    html += '<p class="waktu-detail">' + formatTanggalLengkap(k.Waktu) + '</p></div>';
    html += '<div class="aksi-detail-atas">';
    html += '<button class="btn-sekunder btn-kecil" id="btn-pdf-kasus" type="button">Lembar Kasus PDF</button>';
    html += '</div></div>';

    // Badge
    html += '<div class="baris-badge-detail">';
    if (eskalasi) html += '<span class="badge-eskalasi">ESKALASI TPPK</span>';
    html += '<span class="badge-urgensi badge-urgensi-' + (k.Urgensi || 'rendah') + '">Urgensi: ' + escapeHtml(k.Urgensi || '-') + '</span>';
    html += '<span class="badge-status badge-status-' + (k.Status || 'Baru').toLowerCase() + '">' + escapeHtml(k.Status || 'Baru') + '</span>';
    html += '</div>';

    // Info grid
    html += '<div class="grid-info-detail">';
    html += detailBaris('Tahun Ajaran', (k.TahunAjaran || '-') + ' / ' + (k.Semester || '-'));
    html += detailBaris('Jenjang', 'Kelas ' + String(k.Jenjang || '-'));
    html += detailBaris('Nama', anonim ? '(Anonim)' : escapeHtml(k.Nama || '-'));
    html += detailBaris('Kelas', anonim ? '-' : escapeHtml(String(k.Kelas || '-')));
    html += detailBaris('Kategori', escapeHtml(data.kategoriNama || k.KategoriID || '-'));
    html += detailBaris('Guru Tujuan', k.GuruTujuanID === 'Siapa saja' || !k.GuruTujuanID ? 'Siapa Saja' : escapeHtml(k.GuruTujuanID));
    html += detailBaris('Preferensi Balasan', k.PreferensiBalasan === 'website' ? 'Lewat Website' : 'Bertemu Langsung');
    html += '</div>';

    // Pesan
    html += '<div class="blok-pesan-detail">';
    html += '<h4>Isi Pesan</h4>';
    html += '<div class="isi-pesan-detail">' + escapeHtml(k.Pesan || '-') + '</div>';
    html += '</div>';

    // Lampiran
    if (lampiran.length > 0) {
      html += '<div class="blok-lampiran-detail">';
      html += '<h4>Lampiran (' + lampiran.length + ')</h4>';
      html += '<div class="daftar-lampiran-detail">';
      lampiran.forEach(function (f) {
        const isGambar = f.tipe && f.tipe.indexOf('image/') !== -1;
        html += '<a href="' + escapeAttr(f.url) + '" target="_blank" rel="noopener" class="item-lampiran-detail">';
        html += '<span class="ikon-lampiran" aria-hidden="true">' + (isGambar ? '&#128247;' : '&#128196;') + '</span>';
        html += '<span>' + escapeHtml(f.nama || 'File') + '</span>';
        html += '</a>';
      });
      html += '</div></div>';
    }

    // Form pengelolaan
    html += '<div class="blok-kelola-detail">';
    html += '<h4>Kelola Kiriman</h4>';

    // Status
    html += '<div class="grup-input"><label for="detail-status">Status</label>';
    html += '<select id="detail-status">';
    ['Baru', 'Dibaca', 'Ditangani', 'Selesai', 'Dirujuk'].forEach(function (s) {
      html += '<option value="' + s + '"' + (k.Status === s ? ' selected' : '') + '>' + s + '</option>';
    });
    html += '</select></div>';

    // Rujukan
    html += '<div class="grup-input"><label for="detail-rujukan">Dirujuk Ke</label>';
    html += '<input type="text" id="detail-rujukan" value="' + escapeAttr(k.RujukanKe || '') + '" maxlength="200" placeholder="Mis. Psikolog, dokter, orang tua..."></div>';

    // Diteruskan
    html += '<div class="grup-input"><label for="detail-diteruskan">Diteruskan Ke</label>';
    html += '<input type="text" id="detail-diteruskan" value="' + escapeAttr(k.DiteruskanKe || '') + '" maxlength="200" placeholder="Mis. Wali kelas, guru BK lain..."></div>';

    // Catatan internal
    html += '<div class="grup-input"><label for="detail-catatan">Catatan Internal (tidak terlihat siswa)</label>';
    html += '<textarea id="detail-catatan" rows="4" maxlength="1000" placeholder="Catatan untuk diri sendiri...">' + escapeHtml(k.CatatanInternal || '') + '</textarea></div>';

    html += '<button class="btn-primer btn-kecil" id="btn-simpan-kelola" type="button">Simpan Perubahan</button>';
    html += '</div>';

    // Balasan
    html += '<div class="blok-balasan-detail">';
    html += '<h4>Balasan untuk Siswa</h4>';
    if (balasan.length > 0) {
      html += '<div class="daftar-balasan-detail">';
      balasan.forEach(function (b) {
        html += '<div class="item-balasan-detail">';
        html += '<div class="waktu-balasan-detail">' + formatTanggalLengkap(b.Waktu) + '</div>';
        html += '<div class="isi-balasan-detail">' + escapeHtml(b.Pesan) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<p class="keadaan-kosong">Belum ada balasan.</p>';
    }
    html += '<div class="grup-input"><label for="detail-balasan-baru">Tulis Balasan Baru</label>';
    html += '<textarea id="detail-balasan-baru" rows="4" maxlength="2000" placeholder="Tulis balasan untuk siswa..."></textarea></div>';
    html += '<button class="btn-primer btn-kecil" id="btn-kirim-balasan" type="button">Kirim Balasan</button>';
    html += '</div>';

    html += '</div>'; // kartu-detail

    wadah.innerHTML = html;

    // Pasang event
    document.getElementById('btn-simpan-kelola').addEventListener('click', function () {
      simpanKelolaKiriman(k.IDKiriman);
    });
    document.getElementById('btn-kirim-balasan').addEventListener('click', function () {
      kirimBalasanForm(k.IDKiriman);
    });
    document.getElementById('btn-pdf-kasus').addEventListener('click', function () {
      bukaDialogPDFKasus(k.IDKiriman);
    });
  }

  function detailBaris(label, nilai) {
    return '<div class="baris-info-detail"><span class="label-info-detail">' + escapeHtml(label) + '</span><span class="nilai-info-detail">' + nilai + '</span></div>';
  }

  async function simpanKelolaKiriman(id) {
    tampilkanMemuat(true, 'Menyimpan...');
    try {
      const resp = await panggilAPI('ubahKiriman', {
        idKiriman: id,
        status: val('detail-status'),
        rujukanKe: val('detail-rujukan'),
        diteruskanKe: val('detail-diteruskan'),
        catatanInternal: val('detail-catatan')
      });
      if (resp.ok) {
        tampilkanToast('Perubahan tersimpan.', 'sukses');
      } else {
        tampilkanToast(resp.error || 'Gagal menyimpan.', 'error');
      }
    } catch (e) {
      tampilkanToast('Tidak bisa terhubung ke server.', 'error');
    }
    tampilkanMemuat(false);
  }

  async function kirimBalasanForm(id) {
    const pesan = val('detail-balasan-baru');
    if (!pesan) {
      tampilkanToast('Tulis balasan dulu.', 'peringatan');
      return;
    }
    tampilkanMemuat(true, 'Mengirim balasan...');
    try {
      const resp = await panggilAPI('kirimBalasan', { idKiriman: id, pesan: pesan });
      if (resp.ok) {
        tampilkanToast('Balasan terkirim.', 'sukses');
        // Muat ulang detail
        bukaDetail(id);
      } else {
        tampilkanToast(resp.error || 'Gagal mengirim.', 'error');
      }
    } catch (e) {
      tampilkanToast('Tidak bisa terhubung ke server.', 'error');
    }
    tampilkanMemuat(false);
  }

  // ===== Pengaturan =====

  async function muatPengaturan(saatLogin) {
    try {
      const resp = await panggilAPI('ambilPengaturan', {});
      if (resp.ok && resp.data) {
        dataPengaturan = resp.data;
        terapPengaturanKeForm();
        if (saatLogin) {
          terapPengaturanKeHeader();
        }
        // Isul filter dropdown
        isiFilterDropdown();
      } else {
        if (resp.error && resp.error.indexOf('Sesi') !== -1 && !saatLogin) {
          logout();
        }
      }
    } catch (e) {
      if (!saatLogin) tampilkanToast('Gagal memuat pengaturan.', 'error');
    }
  }

  function terapPengaturanKeHeader() {
    const p = dataPengaturan.pengaturan;
    if (p.temaWarna) document.body.setAttribute('data-tema', p.temaWarna);
    setText('admin-nama-sekolah', p.namaSekolah || 'Admin BK');
    setText('admin-periode', 'TA ' + (p.tahunAjaranAktif || '-') + ' - ' + (p.semesterAktif || '-'));
    const logo = document.getElementById('admin-logo');
    if (p.logo) {
      logo.src = p.logo;
      logo.hidden = false;
    } else {
      logo.hidden = true;
    }
  }

  function terapPengaturanKeForm() {
    const p = dataPengaturan.pengaturan;
    // Isi semua input dengan data-pengaturan
    document.querySelectorAll('[data-pengaturan]').forEach(function (el) {
      const kunci = el.dataset.pengaturan;
      if (p[kunci] !== undefined) el.value = p[kunci];
    });
    // Pratinjau logo & banner
    if (p.logo) {
      const img = document.getElementById('pratinjau-logo');
      img.src = p.logo; img.hidden = false;
    }
    if (p.banner) {
      const img = document.getElementById('pratinjau-banner');
      img.src = p.banner; img.hidden = false;
    }
    // Tema aktif
    document.querySelectorAll('.kartu-tema').forEach(function (b) {
      b.classList.toggle('aktif', b.dataset.tema === p.temaWarna);
    });
    // Render editor daftar
    renderEditorGuru(dataPengaturan.guru || []);
    renderEditorKelas(dataPengaturan.kelas || []);
    renderEditorKategori(dataPengaturan.kategori || []);
    renderEditorLayanan(dataPengaturan.layanan || []);
    renderEditorFAQ(dataPengaturan.faq || []);
  }

  function isiFilterDropdown() {
    // Kategori
    const selKat = document.getElementById('filter-kategori');
    const kat = (dataPengaturan.kategori || []);
    selKat.innerHTML = '<option value="">Semua</option>' + kat.map(function (k) {
      return '<option value="' + escapeAttr(k.ID) + '">' + escapeHtml(k.Nama) + '</option>';
    }).join('');
    // Guru
    const selGuru = document.getElementById('filter-guru');
    const guru = (dataPengaturan.guru || []);
    selGuru.innerHTML = '<option value="">Semua</option><option value="Siapa saja">Siapa Saja</option>' + guru.map(function (g) {
      return '<option value="' + escapeAttr(g.ID) + '">' + escapeHtml(g.Nama) + '</option>';
    }).join('');
  }

  // ===== Simpan Pengaturan (per bagian) =====

  async function simpanBagianPengaturan(bagian, payload) {
    tampilkanMemuat(true, 'Menyimpan pengaturan...');
    try {
      const resp = await panggilAPI('simpanPengaturan', payload);
      if (resp.ok) {
        tampilkanToast('Pengaturan tersimpan.', 'sukses');
        // Muat ulang data pengaturan
        await muatPengaturan(false);
        terapPengaturanKeHeader();
      } else {
        tampilkanToast(resp.error || 'Gagal menyimpan.', 'error');
      }
    } catch (e) {
      tampilkanToast('Tidak bisa terhubung ke server.', 'error');
    }
    tampilkanMemuat(false);
  }

  function simpanIdentitas() {
    const p = {};
    document.querySelectorAll('[data-pengaturan]').forEach(function (el) {
      p[el.dataset.pengaturan] = el.value;
    });
    simpanBagianPengaturan('identitas', { pengaturan: p });
  }

  function simpanPeriode() {
    const p = {};
    document.querySelectorAll('[data-pengaturan]').forEach(function (el) {
      p[el.dataset.pengaturan] = el.value;
    });
    // Tambah temaWarna dari kartu yang aktif
    const temaAktif = document.querySelector('.kartu-tema.aktif');
    if (temaAktif) p.temaWarna = temaAktif.dataset.tema;
    simpanBagianPengaturan('periode', { pengaturan: p });
  }

  function simpanPrivasi() {
    const p = {
      kebijakanPrivasi: val('set-kebijakan'),
      kontakDarurat: val('set-darurat')
    };
    // Gabung dengan pengaturan lain yang sudah ada agar tidak hilang
    document.querySelectorAll('[data-pengaturan]').forEach(function (el) {
      if (!p[el.dataset.pengaturan]) p[el.dataset.pengaturan] = el.value;
    });
    simpanBagianPengaturan('privasi', { pengaturan: p });
  }

  function simpanGuru() {
    const daftar = kumpulDataEditorGuru();
    simpanBagianPengaturan('guru', { guru: daftar });
  }

  function simpanKelas() {
    const daftar = kumpulDataEditorKelas();
    simpanBagianPengaturan('kelas', { kelas: daftar });
  }

  function simpanKategori() {
    const daftar = kumpulDataEditorKategori();
    simpanBagianPengaturan('kategori', { kategori: daftar });
  }

  function simpanLayanan() {
    const daftar = kumpulDataEditorLayanan();
    simpanBagianPengaturan('layanan', { layanan: daftar });
  }

  function simpanFAQ() {
    const daftar = kumpulDataEditorFAQ();
    simpanBagianPengaturan('faq', { faq: daftar });
  }

  // ===== Editor Daftar Guru =====

  function renderEditorGuru(daftar) {
    const wadah = document.getElementById('daftar-editor-guru');
    if (daftar.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada guru. Klik "Tambah Guru".</p>';
      return;
    }
    wadah.innerHTML = '';
    daftar.forEach(function (g, idx) {
      wadah.appendChild(buatKartuEditorGuru(g, idx));
    });
  }

  function buatKartuEditorGuru(g, idx) {
    const el = document.createElement('div');
    el.className = 'kartu-editor';
    el.dataset.idx = idx;
    el.innerHTML =
      '<div class="grid-form-2kol">' +
        '<div class="grup-input"><label>Nama</label><input type="text" class="ed-guru-nama" value="' + escapeAttr(g.Nama || '') + '" maxlength="100"></div>' +
        '<div class="grup-input"><label>Jabatan</label><input type="text" class="ed-guru-jabatan" value="' + escapeAttr(g.Jabatan || '') + '" maxlength="100"></div>' +
        '<div class="grup-input"><label>Jenjang (pisah koma, mis. 7,8,9)</label><input type="text" class="ed-guru-jenjang" value="' + escapeAttr(String(g.Jenjang || '')) + '" maxlength="20"></div>' +
        '<div class="grup-input"><label>Kontak</label><input type="text" class="ed-guru-kontak" value="' + escapeAttr(g.Kontak || '') + '" maxlength="100"></div>' +
        '<div class="grup-input"><label>Urutan</label><input type="number" class="ed-guru-urutan" value="' + escapeAttr(String(g.Urutan || 1)) + '" min="1"></div>' +
        '<div class="grup-input"><label>Aktif</label><label class="cek-box"><input type="checkbox" class="ed-guru-aktif"' + (isAktif(g.Aktif) ? ' checked' : '') + '> Tampilkan di halaman siswa</label></div>' +
      '</div>' +
      '<div class="grup-input"><label>Bio</label><textarea class="ed-guru-bio" rows="2" maxlength="300">' + escapeHtml(g.Bio || '') + '</textarea></div>' +
      '<div class="grup-input"><label>Foto</label>' +
        '<div class="zona-upload-mini">' +
          (g.Foto ? '<img class="pratinjau-gambar-kecil" src="' + escapeAttr(g.Foto) + '" alt="">' : '') +
          '<label class="zona-upload zona-upload-padat"><span aria-hidden="true">&#128247;</span> Pilih Foto</label>' +
          '<input type="file" class="ed-guru-foto" accept="image/*" hidden>' +
          '<input type="hidden" class="ed-guru-foto-data" value="' + escapeAttr(g.Foto || '') + '">' +
          '<small class="catatan-gambar">Maks 250x250 piksel.</small>' +
        '</div>' +
      '</div>' +
      '<div class="aksi-kartu-editor">' +
        '<span class="ed-guru-id" hidden>' + escapeHtml(g.ID || '') + '</span>' +
        '<button type="button" class="btn-hapus-editor" title="Hapus">&times; Hapus</button>' +
      '</div>';
    // Event hapus
    el.querySelector('.btn-hapus-editor').addEventListener('click', function () {
      el.remove();
      if (document.getElementById('daftar-editor-guru').children.length === 0) {
        renderEditorGuru([]);
      }
    });
    // Event foto
    const inputFoto = el.querySelector('.ed-guru-foto');
    inputFoto.addEventListener('change', function () {
      prosesFotoGuru(inputFoto.files[0], el);
    });
    return el;
  }

  async function prosesFotoGuru(file, elKartu) {
    if (!file) return;
    try {
      const dataUri = await resizeGambar(file, 250, 250, 0.8);
      elKartu.querySelector('.ed-guru-foto-data').value = dataUri;
      let img = elKartu.querySelector('.pratinjau-gambar-kecil');
      if (!img) {
        img = document.createElement('img');
        img.className = 'pratinjau-gambar-kecil';
        elKartu.querySelector('.zona-upload-mini').prepend(img);
      }
      img.src = dataUri;
      img.hidden = false;
    } catch (e) {
      tampilkanToast('Gagal memproses foto.', 'error');
    }
  }

  function tambahGuru() {
    const wadah = document.getElementById('daftar-editor-guru');
    if (wadah.querySelector('.keadaan-kosong')) wadah.innerHTML = '';
    const idx = wadah.children.length;
    const guruBaru = { ID: 'GURU-' + String(idx + 1).padStart(2, '0'), Nama: '', Jabatan: 'Guru BK', Jenjang: '7,8,9', Kontak: '', Bio: '', Foto: '', Aktif: true, Urutan: idx + 1 };
    wadah.appendChild(buatKartuEditorGuru(guruBaru, idx));
  }

  function kumpulDataEditorGuru() {
    const daftar = [];
    document.querySelectorAll('#daftar-editor-guru .kartu-editor').forEach(function (el, idx) {
      daftar.push({
        ID: el.querySelector('.ed-guru-id').textContent || ('GURU-' + String(idx + 1).padStart(2, '0')),
        Nama: el.querySelector('.ed-guru-nama').value,
        Jabatan: el.querySelector('.ed-guru-jabatan').value,
        Jenjang: el.querySelector('.ed-guru-jenjang').value,
        Kontak: el.querySelector('.ed-guru-kontak').value,
        Bio: el.querySelector('.ed-guru-bio').value,
        Foto: el.querySelector('.ed-guru-foto-data').value,
        Aktif: el.querySelector('.ed-guru-aktif').checked,
        Urutan: Number(el.querySelector('.ed-guru-urutan').value) || (idx + 1)
      });
    });
    return daftar;
  }

  // ===== Editor Daftar Kelas =====

  function renderEditorKelas(daftar) {
    const wadah = document.getElementById('daftar-editor-kelas');
    if (daftar.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada kelas.</p>';
      return;
    }
    wadah.innerHTML = '';
    daftar.forEach(function (k, idx) {
      const el = document.createElement('div');
      el.className = 'kartu-editor-padat';
      el.innerHTML =
        '<input type="text" class="ed-kelas-nama" value="' + escapeAttr(k.Kelas || '') + '" maxlength="10" placeholder="Mis. 7A">' +
        '<select class="ed-kelas-jenjang">' +
          ['7', '8', '9'].map(function (j) { return '<option value="' + j + '"' + (String(k.Jenjang) === j ? ' selected' : '') + '>Kelas ' + j + '</option>'; }).join('') +
        '</select>' +
        '<label class="cek-box"><input type="checkbox" class="ed-kelas-aktif"' + (isAktif(k.Aktif) ? ' checked' : '') + '> Aktif</label>' +
        '<button type="button" class="btn-hapus-editor">&times;</button>';
      el.querySelector('.btn-hapus-editor').addEventListener('click', function () { el.remove(); });
      wadah.appendChild(el);
    });
  }

  function tambahKelas() {
    const wadah = document.getElementById('daftar-editor-kelas');
    if (wadah.querySelector('.keadaan-kosong')) wadah.innerHTML = '';
    renderEditorKelas(dataPengaturan.kelas.concat([{ Kelas: '', Jenjang: '7', Aktif: true }]));
  }

  function kumpulDataEditorKelas() {
    const daftar = [];
    document.querySelectorAll('#daftar-editor-kelas .kartu-editor-padat').forEach(function (el) {
      const nama = el.querySelector('.ed-kelas-nama').value.trim();
      if (nama) {
        daftar.push({ Kelas: nama, Jenjang: el.querySelector('.ed-kelas-jenjang').value, Aktif: el.querySelector('.ed-kelas-aktif').checked });
      }
    });
    return daftar;
  }

  // ===== Editor Kategori =====

  function renderEditorKategori(daftar) {
    const wadah = document.getElementById('daftar-editor-kategori');
    if (daftar.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada kategori.</p>';
      return;
    }
    wadah.innerHTML = '';
    daftar.forEach(function (k, idx) {
      const el = document.createElement('div');
      el.className = 'kartu-editor';
      el.innerHTML =
        '<div class="grid-form-2kol">' +
          '<div class="grup-input"><label>Nama Kategori</label><input type="text" class="ed-kat-nama" value="' + escapeAttr(k.Nama || '') + '" maxlength="50"></div>' +
          '<div class="grup-input"><label>Bidang</label><select class="ed-kat-bidang">' +
            ['pribadi', 'belajar', 'sosial', 'karier', 'perundungan-kekerasan'].map(function (b) {
              return '<option value="' + b + '"' + (k.Bidang === b ? ' selected' : '') + '>' + b + '</option>';
            }).join('') +
          '</select></div>' +
        '</div>' +
        '<div class="grup-input"><label>Deskripsi</label><input type="text" class="ed-kat-deskripsi" value="' + escapeAttr(k.Deskripsi || '') + '" maxlength="200"></div>' +
        '<div class="baris-cek-editor">' +
          '<label class="cek-box"><input type="checkbox" class="ed-kat-eskalasi"' + (isAktif(k.Eskalasi) ? ' checked' : '') + '> Eskalasi TPPK</label>' +
          '<label class="cek-box"><input type="checkbox" class="ed-kat-aktif"' + (isAktif(k.Aktif) ? ' checked' : '') + '> Aktif</label>' +
        '</div>' +
        '<span class="ed-kat-id" hidden>' + escapeHtml(k.ID || '') + '</span>' +
        '<button type="button" class="btn-hapus-editor">&times; Hapus</button>';
      el.querySelector('.btn-hapus-editor').addEventListener('click', function () { el.remove(); });
      wadah.appendChild(el);
    });
  }

  function tambahKategori() {
    const daftar = kumpulDataEditorKategori();
    daftar.push({ ID: 'KAT-' + String(daftar.length + 1).padStart(2, '0'), Nama: '', Bidang: 'pribadi', Deskripsi: '', Eskalasi: false, Aktif: true });
    renderEditorKategori(daftar);
  }

  function kumpulDataEditorKategori() {
    const daftar = [];
    document.querySelectorAll('#daftar-editor-kategori .kartu-editor').forEach(function (el, idx) {
      const nama = el.querySelector('.ed-kat-nama').value.trim();
      if (nama) {
        daftar.push({
          ID: el.querySelector('.ed-kat-id').textContent || ('KAT-' + String(idx + 1).padStart(2, '0')),
          Nama: nama,
          Bidang: el.querySelector('.ed-kat-bidang').value,
          Deskripsi: el.querySelector('.ed-kat-deskripsi').value,
          Eskalasi: el.querySelector('.ed-kat-eskalasi').checked,
          Aktif: el.querySelector('.ed-kat-aktif').checked
        });
      }
    });
    return daftar;
  }

  // ===== Editor Layanan =====

  function renderEditorLayanan(daftar) {
    const wadah = document.getElementById('daftar-editor-layanan');
    if (daftar.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada layanan.</p>';
      return;
    }
    wadah.innerHTML = '';
    daftar.forEach(function (l, idx) {
      const el = document.createElement('div');
      el.className = 'kartu-editor';
      el.innerHTML =
        '<div class="grid-form-2kol">' +
          '<div class="grup-input"><label>Judul</label><input type="text" class="ed-lay-judul" value="' + escapeAttr(l.Judul || '') + '" maxlength="100"></div>' +
          '<div class="grup-input"><label>Urutan</label><input type="number" class="ed-lay-urutan" value="' + escapeAttr(String(l.Urutan || idx + 1)) + '" min="1"></div>' +
        '</div>' +
        '<div class="grup-input"><label>Deskripsi</label><textarea class="ed-lay-deskripsi" rows="2" maxlength="300">' + escapeHtml(l.Deskripsi || '') + '</textarea></div>' +
        '<label class="cek-box"><input type="checkbox" class="ed-lay-aktif"' + (isAktif(l.Aktif) ? ' checked' : '') + '> Aktif</label>' +
        '<span class="ed-lay-id" hidden>' + escapeHtml(l.ID || '') + '</span>' +
        '<button type="button" class="btn-hapus-editor">&times; Hapus</button>';
      el.querySelector('.btn-hapus-editor').addEventListener('click', function () { el.remove(); });
      wadah.appendChild(el);
    });
  }

  function tambahLayanan() {
    const daftar = kumpulDataEditorLayanan();
    daftar.push({ ID: 'LAY-' + String(daftar.length + 1).padStart(2, '0'), Judul: '', Deskripsi: '', Urutan: daftar.length + 1, Aktif: true });
    renderEditorLayanan(daftar);
  }

  function kumpulDataEditorLayanan() {
    const daftar = [];
    document.querySelectorAll('#daftar-editor-layanan .kartu-editor').forEach(function (el, idx) {
      const judul = el.querySelector('.ed-lay-judul').value.trim();
      if (judul) {
        daftar.push({
          ID: el.querySelector('.ed-lay-id').textContent || ('LAY-' + String(idx + 1).padStart(2, '0')),
          Judul: judul,
          Deskripsi: el.querySelector('.ed-lay-deskripsi').value,
          Urutan: Number(el.querySelector('.ed-lay-urutan').value) || (idx + 1),
          Aktif: el.querySelector('.ed-lay-aktif').checked
        });
      }
    });
    return daftar;
  }

  // ===== Editor FAQ =====

  function renderEditorFAQ(daftar) {
    const wadah = document.getElementById('daftar-editor-faq');
    if (daftar.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada FAQ.</p>';
      return;
    }
    wadah.innerHTML = '';
    daftar.forEach(function (f, idx) {
      const el = document.createElement('div');
      el.className = 'kartu-editor';
      el.innerHTML =
        '<div class="grup-input"><label>Pertanyaan</label><input type="text" class="ed-faq-tanya" value="' + escapeAttr(f.Pertanyaan || '') + '" maxlength="200"></div>' +
        '<div class="grup-input"><label>Jawaban</label><textarea class="ed-faq-jawab" rows="3" maxlength="500">' + escapeHtml(f.Jawaban || '') + '</textarea></div>' +
        '<div class="baris-cek-editor">' +
          '<div class="grup-input" style="margin:0"><label>Urutan</label><input type="number" class="ed-faq-urutan" value="' + escapeAttr(String(f.Urutan || idx + 1)) + '" min="1" style="width:70px"></div>' +
          '<label class="cek-box"><input type="checkbox" class="ed-faq-aktif"' + (isAktif(f.Aktif) ? ' checked' : '') + '> Aktif</label>' +
        '</div>' +
        '<span class="ed-faq-id" hidden>' + escapeHtml(f.ID || '') + '</span>' +
        '<button type="button" class="btn-hapus-editor">&times; Hapus</button>';
      el.querySelector('.btn-hapus-editor').addEventListener('click', function () { el.remove(); });
      wadah.appendChild(el);
    });
  }

  function tambahFAQ() {
    const daftar = kumpulDataEditorFAQ();
    daftar.push({ ID: 'FAQ-' + String(daftar.length + 1).padStart(2, '0'), Pertanyaan: '', Jawaban: '', Urutan: daftar.length + 1, Aktif: true });
    renderEditorFAQ(daftar);
  }

  function kumpulDataEditorFAQ() {
    const daftar = [];
    document.querySelectorAll('#daftar-editor-faq .kartu-editor').forEach(function (el, idx) {
      const tanya = el.querySelector('.ed-faq-tanya').value.trim();
      if (tanya) {
        daftar.push({
          ID: el.querySelector('.ed-faq-id').textContent || ('FAQ-' + String(idx + 1).padStart(2, '0')),
          Pertanyaan: tanya,
          Jawaban: el.querySelector('.ed-faq-jawab').value,
          Urutan: Number(el.querySelector('.ed-faq-urutan').value) || (idx + 1),
          Aktif: el.querySelector('.ed-faq-aktif').checked
        });
      }
    });
    return daftar;
  }

  // ===== Upload Gambar (Logo & Banner) =====

  function resizeGambar(file, maksLebar, maksTinggi, kualitas) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          let w = img.width, h = img.height;
          const rasio = Math.min(maksLebar / w, maksTinggi / h, 1);
          w = Math.round(w * rasio);
          h = Math.round(h * rasio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', kualitas));
        };
        img.onerror = function () { reject(new Error('Gagal memuat gambar')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Gagal membaca file')); };
      reader.readAsDataURL(file);
    });
  }

  async function prosesLogo(file) {
    if (!file) return;
    try {
      const dataUri = await resizeGambar(file, 300, 300, 0.8);
      const img = document.getElementById('pratinjau-logo');
      img.src = dataUri; img.hidden = false;
      const hidden = document.getElementById('hidden-logo');
      if (hidden) hidden.value = dataUri;
    } catch (e) {
      tampilkanToast('Gagal memproses logo.', 'error');
    }
  }

  async function prosesBanner(file) {
    if (!file) return;
    try {
      const dataUri = await resizeGambar(file, 1000, 250, 0.8);
      const img = document.getElementById('pratinjau-banner');
      img.src = dataUri; img.hidden = false;
      const hidden = document.getElementById('hidden-banner');
      if (hidden) hidden.value = dataUri;
    } catch (e) {
      tampilkanToast('Gagal memproses banner.', 'error');
    }
  }

  // ===== PDF Dialog =====

  function bukaDialogPDFKasus(idKiriman) {
    modePDFSaatIni = 'kasus';
    idKirimanPDF = idKiriman;
    const isi = document.getElementById('isi-dialog-pdf');
    isi.innerHTML =
      '<div class="grup-input"><label class="cek-box"><input type="checkbox" id="pdf-identitas"> Sertakan identitas siswa di laporan</label></div>' +
      '<p class="catatan-pdf">Identitas disembunyikan secara default untuk melindungi siswa. Centang hanya jika perlu untuk guru BK tujuan.</p>';
    document.getElementById('judul-dialog-pdf').textContent = 'Lembar Kasus PDF';
    document.getElementById('dialog-pdf').hidden = false;
  }

  function bukaDialogPDFRekap() {
    modePDFSaatIni = 'rekap';
    idKirimanPDF = null;
    const p = dataPengaturan ? dataPengaturan.pengaturan : {};
    const isi = document.getElementById('isi-dialog-pdf');
    isi.innerHTML =
      '<div class="grup-input"><label for="pdf-rekap-jenis">Jenis Rekap</label>' +
        '<select id="pdf-rekap-jenis">' +
          '<option value="semester">Per Semester</option>' +
          '<option value="bulanan">Bulanan</option>' +
          '<option value="tahunan">Tahunan</option>' +
        '</select></div>' +
      '<div class="grid-form-2kol">' +
        '<div class="grup-input"><label for="pdf-rekap-ta">Tahun Ajaran</label><input type="text" id="pdf-rekap-ta" value="' + escapeAttr(p.tahunAjaranAktif || '') + '"></div>' +
        '<div class="grup-input"><label for="pdf-rekap-sem">Semester</label><select id="pdf-rekap-sem"><option value="">Semua</option><option value="Ganjil" selected>Ganjil</option><option value="Genap">Genap</option></select></div>' +
        '<div class="grup-input"><label for="pdf-rekap-jenjang">Jenjang</label><select id="pdf-rekap-jenjang"><option value="">Semua</option><option value="7">Kelas 7</option><option value="8">Kelas 8</option><option value="9">Kelas 9</option></select></div>' +
        '<div class="grup-input"><label for="pdf-rekap-bulan">Bulan (untuk rekap bulanan)</label><input type="month" id="pdf-rekap-bulan"></div>' +
      '</div>' +
      '<div class="grup-input"><label class="cek-box"><input type="checkbox" id="pdf-identitas"> Sertakan identitas siswa</label></div>';
    document.getElementById('judul-dialog-pdf').textContent = 'Laporan Rekap PDF';
    document.getElementById('dialog-pdf').hidden = false;
  }

  async function generatePDF() {
    const sertakanIdentitas = document.getElementById('pdf-identitas').checked;
    tutupDialogPDF();
    tampilkanMemuat(true, 'Membuat PDF...');

    const p = dataPengaturan ? dataPengaturan.pengaturan : {};

    if (modePDFSaatIni === 'kasus' && idKirimanPDF) {
      // Lembar kasus
      try {
        const resp = await panggilAPI('ambilDetailKiriman', { idKiriman: idKirimanPDF });
        if (resp.ok && resp.data) {
          const doc = BKPDF.buatLembarKasus(resp.data.kiriman, resp.data.balasan, p, resp.data.kategoriNama, sertakanIdentitas);
          const namaFile = 'LembarKasus_' + idKirimanPDF;
          await tawarkanPDF(doc, namaFile);
        } else {
          tampilkanToast('Gagal memuat data kasus.', 'error');
        }
      } catch (e) {
        tampilkanToast('Gagal membuat PDF.', 'error');
      }
    } else if (modePDFSaatIni === 'rekap') {
      // Rekap
      try {
        const jenis = val('pdf-rekap-jenis');
        const ta = val('pdf-rekap-ta');
        const sem = val('pdf-rekap-sem');
        const jenjang = val('pdf-rekap-jenjang');
        const bulan = val('pdf-rekap-bulan');
        const filters = { tahunAjaran: ta, semester: sem, jenjang: jenjang };
        if (bulan) filters.cari = bulan; // simplisitas: cari sebagai teks
        const resp = await panggilAPI('ambilKiriman', filters);
        if (resp.ok && resp.data) {
          const daftar = resp.data;
          let judul = '';
          let filterInfo = '';
          if (jenis === 'semester') {
            judul = 'Rekap Semester ' + (sem || '') + ' TA ' + (ta || '');
            filterInfo = 'Jenjang: ' + (jenjang ? 'Kelas ' + jenjang : 'Semua');
          } else if (jenis === 'bulanan') {
            judul = 'Rekap Bulanan ' + (bulan || '');
            filterInfo = 'Tahun Ajaran: ' + (ta || '') + ' | Jenjang: ' + (jenjang ? 'Kelas ' + jenjang : 'Semua');
          } else {
            judul = 'Rekap Tahunan TA ' + (ta || '');
            filterInfo = 'Semester: ' + (sem || 'Semua') + ' | Jenjang: ' + (jenjang ? 'Kelas ' + jenjang : 'Semua');
          }
          const doc = BKPDF.buatRekap(daftar, p, judul, filterInfo, sertakanIdentitas);
          const namaFile = 'Rekap_' + judul.replace(/[^a-zA-Z0-9]/g, '_');
          await tawarkanPDF(doc, namaFile);
        } else {
          tampilkanToast('Gagal memuat data rekap.', 'error');
        }
      } catch (e) {
        tampilkanToast('Gagal membuat PDF rekap.', 'error');
      }
    }
    tampilkanMemuat(false);
  }

  async function tawarkanPDF(doc, namaFile) {
    const berhasilShare = await BKPDF.bagikanPDF(doc, namaFile);
    if (!berhasilShare) {
      // Jika share tidak didukung atau gagal, unduh
      BKPDF.unduhPDF(doc, namaFile);
      tampilkanToast('PDF diunduh. Gunakan tombol Bagikan di perangkat Anda jika perlu.', 'sukses');
    } else {
      tampilkanToast('PDF dibuat.', 'sukses');
    }
  }

  function tutupDialogPDF() {
    document.getElementById('dialog-pdf').hidden = true;
  }

  // ===== Cadangan Excel =====

  async function unduhCadangan() {
    tampilkanMemuat(true, 'Mengunduh cadangan...');
    try {
      const resp = await panggilAPI('unduhCadangan', {});
      if (resp.ok && resp.data) {
        const wb = XLSX.utils.book_new();
        const daftarSheet = ['Pengaturan', 'Guru', 'Kelas', 'Kategori', 'Layanan', 'FAQ', 'Kiriman', 'Balasan', 'Log'];
        daftarSheet.forEach(function (nama) {
          const data = resp.data[nama] || [];
          if (data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, nama);
          } else {
            // Sheet kosong dengan header placeholder
            const ws = XLSX.utils.aoa_to_sheet([['(kosong)']]);
            XLSX.utils.book_append_sheet(wb, ws, nama);
          }
        });
        const tanggal = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, 'Cadangan_BK_' + tanggal + '.xlsx');
        tampilkanToast('Cadangan berhasil diunduh.', 'sukses');
      } else {
        tampilkanToast(resp.error || 'Gagal mengunduh cadangan.', 'error');
      }
    } catch (e) {
      tampilkanToast('Tidak bisa terhubung ke server.', 'error');
    }
    tampilkanMemuat(false);
  }

  // ===== Navigasi View =====

  function navigasiView(nama) {
    document.querySelectorAll('.view-admin').forEach(function (s) {
      s.classList.remove('aktif');
    });
    const target = document.getElementById('view-' + nama);
    if (target) target.classList.add('aktif');
    document.querySelectorAll('.taut-admin').forEach(function (b) {
      b.classList.toggle('aktif', b.dataset.view === nama);
    });
    window.scrollTo(0, 0);
    if (nama === 'dasbor') muatDasbor();
    if (nama === 'kotak-masuk') {
      if (!dataPengaturan) muatPengaturan(false);
      muatKiriman();
    }
  }

  // ===== Event Listener =====

  function pasangEventListener() {
    // Login
    document.getElementById('form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      login(document.getElementById('input-kata-sandi').value);
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', logout);

    // Navigasi admin
    document.querySelectorAll('.taut-admin').forEach(function (b) {
      b.addEventListener('click', function () { navigasiView(b.dataset.view); });
    });
    // Tombol dengan data-view-tujuan
    document.addEventListener('click', function (e) {
      const t = e.target.closest('[data-view-tujuan]');
      if (t) { e.preventDefault(); navigasiView(t.dataset.viewTujuan); }
    });

    // Kembali ke inbox dari detail
    document.getElementById('btn-kembali-inbox').addEventListener('click', function () {
      navigasiView('kotak-masuk');
    });

    // Filter
    document.getElementById('btn-terap-filter').addEventListener('click', muatKiriman);
    document.getElementById('btn-reset-filter').addEventListener('click', function () {
      document.querySelectorAll('.panel-filter select, .panel-filter input').forEach(function (el) {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
      muatKiriman();
    });
    // Enter di search
    document.getElementById('filter-cari').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') muatKiriman();
    });

    // Tab pengaturan
    document.querySelectorAll('.nav-tab [role="tab"]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.nav-tab [role="tab"]').forEach(function (x) { x.classList.remove('tab-aktif'); });
        b.classList.add('tab-aktif');
        document.querySelectorAll('.panel-tab').forEach(function (p) { p.classList.remove('aktif'); });
        const target = document.querySelector('.panel-tab[data-panel="' + b.dataset.tab + '"]');
        if (target) target.classList.add('aktif');
      });
    });

    // Tema warna
    document.querySelectorAll('.kartu-tema').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.kartu-tema').forEach(function (x) { x.classList.remove('aktif'); });
        b.classList.add('aktif');
        document.body.setAttribute('data-tema', b.dataset.tema);
      });
    });

    // Simpan pengaturan
    document.getElementById('btn-simpan-identitas').addEventListener('click', simpanIdentitas);
    document.getElementById('btn-simpan-periode').addEventListener('click', simpanPeriode);
    document.getElementById('btn-simpan-guru').addEventListener('click', simpanGuru);
    document.getElementById('btn-simpan-kelas').addEventListener('click', simpanKelas);
    document.getElementById('btn-simpan-kategori').addEventListener('click', simpanKategori);
    document.getElementById('btn-simpan-layanan').addEventListener('click', simpanLayanan);
    document.getElementById('btn-simpan-faq').addEventListener('click', simpanFAQ);
    document.getElementById('btn-simpan-privasi').addEventListener('click', simpanPrivasi);

    // Tambah item
    document.getElementById('btn-tambah-guru').addEventListener('click', tambahGuru);
    document.getElementById('btn-tambah-kelas').addEventListener('click', tambahKelas);
    document.getElementById('btn-tambah-kategori').addEventListener('click', tambahKategori);
    document.getElementById('btn-tambah-layanan').addEventListener('click', tambahLayanan);
    document.getElementById('btn-tambah-faq').addEventListener('click', tambahFAQ);

    // Upload gambar
    document.getElementById('input-logo-admin').addEventListener('change', function () {
      prosesLogo(this.files[0]); this.value = '';
    });
    document.getElementById('input-banner-admin').addEventListener('change', function () {
      prosesBanner(this.files[0]); this.value = '';
    });

    // Dasbor aksi
    document.getElementById('btn-rekap-pdf').addEventListener('click', bukaDialogPDFRekap);
    document.getElementById('btn-cadangan').addEventListener('click', unduhCadangan);

    // PDF dialog
    document.getElementById('btn-batal-pdf').addEventListener('click', tutupDialogPDF);
    document.getElementById('btn-buat-pdf').addEventListener('click', generatePDF);
  }

  // ===== Utility =====

  function tampilkanMemuat(tampilkan, teks) {
    const el = document.getElementById('overlay-memuat');
    el.hidden = !tampilkan;
    if (teks) setText('teks-memuat', teks);
  }

  function tampilkanToast(pesan, tipe) {
    const toast = document.getElementById('toast');
    toast.textContent = pesan;
    toast.className = 'toast' + (tipe ? ' ' + tipe : '');
    toast.hidden = false;
    const durasi = (tipe === 'error' || tipe === 'peringatan') ? 6000 : 3500;
    setTimeout(function () { toast.hidden = true; }, durasi);
  }

  function tampilkanInfoLogin(pesan, tipe) {
    const el = document.getElementById('info-login');
    el.textContent = pesan;
    el.className = 'info-login' + (tipe === 'galat' ? ' info-login-galat' : '');
    el.hidden = false;
  }

  function setText(id, teks) {
    const el = document.getElementById(id);
    if (el) el.textContent = teks;
  }

  function isAktif(v) {
    return v === true || v === 'TRUE' || v === 'True' || v === 'true' || v === 1 || v === '1';
  }

  function formatTanggalLengkap(iso) {
    try {
      const d = new Date(iso);
      const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return hari[d.getDay()] + ', ' + d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear() + ' pukul ' + ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) { return String(iso); }
  }

  function formatTanggalPendek(iso) {
    try {
      const d = new Date(iso);
      return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    } catch (e) { return String(iso); }
  }

  function escapeHtml(teks) {
    if (teks === null || teks === undefined) return '';
    return String(teks).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(teks) { return escapeHtml(teks); }

})();
