/**
 * Logika Panel Admin BK SMP
 * Autentikasi server-side, pengelolaan kotak masuk, balasan, pengaturan lengkap,
 * kompresi gambar di browser, dan ekspor cadangan Excel (.xlsx).
 */
(function () {
  'use strict';

  var STORAGE_TOKEN_KEY = 'bk_admin_session_token';

  var state = {
    token: '',
    data: null, // { pengaturan, guru, kelas, kategori, layanan, faq, kiriman, statistik }
    activeMainTab: 'dasbor',
    activeSettingsSub: 'identitas',
    selectedCaseId: '',
    draft: {
      logo: '',
      banner: '',
      guru: [],
      kelas: [],
      kategori: [],
      layanan: [],
      faq: []
    }
  };

  // ==========================================================================
  // INISIALISASI & AUTENTIKASI
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', function () {
    ikatSemuaEvent();

    // Set bulan default pada filter laporan bulanan
    var now = new Date();
    var bulanIni = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    var inpBulan = document.getElementById('rep-bulan');
    if (inpBulan) inpBulan.value = bulanIni;

    var savedToken = '';
    try {
      savedToken = window.sessionStorage.getItem(STORAGE_TOKEN_KEY) || '';
    } catch (e) {
      savedToken = '';
    }

    if (savedToken) {
      state.token = savedToken;
      masukKeShellAdmin();
    }
  });

  function ikatSemuaEvent() {
    // Login & Logout
    document.getElementById('form-admin-login').addEventListener('submit', tanganiLogin);
    document.getElementById('btn-admin-logout').addEventListener('click', tanganiLogout);
    document.getElementById('btn-refresh-admin').addEventListener('click', muatDataAdmin);

    // Navigasi Tab Utama Admin
    document.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('[data-admin-tab]');
      if (tabBtn) {
        gantiTabUtama(tabBtn.getAttribute('data-admin-tab'));
        return;
      }

      var subBtn = e.target.closest('[data-set-sub]');
      if (subBtn) {
        gantiSubPengaturan(subBtn.getAttribute('data-set-sub'));
        return;
      }
    });

    // Penyaringan Kotak Masuk
    var filterIds = [
      'filter-search', 'filter-periode', 'filter-jenjang', 'filter-guru',
      'filter-kategori', 'filter-status', 'filter-urgensi', 'filter-eskalasi'
    ];
    for (var i = 0; i < filterIds.length; i++) {
      var el = document.getElementById(filterIds[i]);
      if (el) {
        el.addEventListener(filterIds[i] === 'filter-search' ? 'input' : 'change', renderTabelKotakMasuk);
      }
    }

    document.getElementById('btn-reset-filter').addEventListener('click', function () {
      document.getElementById('filter-search').value = '';
      document.getElementById('filter-periode').value = '';
      document.getElementById('filter-jenjang').value = '';
      document.getElementById('filter-guru').value = '';
      document.getElementById('filter-kategori').value = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-urgensi').value = '';
      document.getElementById('filter-eskalasi').value = '';
      renderTabelKotakMasuk();
    });

    // Modal Detail Kasus
    document.getElementById('btn-close-case-modal').addEventListener('click', tutupModalKasus);
    document.getElementById('case-detail-modal').addEventListener('click', function (e) {
      if (e.target.id === 'case-detail-modal') {
        tutupModalKasus();
      }
    });
    document.getElementById('form-modal-reply').addEventListener('submit', tanganiKirimBalasan);
    document.getElementById('form-modal-update').addEventListener('submit', tanganiUpdateKasus);

    // PDF Lembar Kasus dari Modal
    document.getElementById('btn-modal-pdf-download').addEventListener('click', function () {
      eksekusiPdfLembarKasus(false);
    });
    document.getElementById('btn-modal-pdf-share').addEventListener('click', function () {
      eksekusiPdfLembarKasus(true);
    });

    // Tab Laporan PDF & Cadangan Excel
    document.getElementById('rep-jenis').addEventListener('change', perbaruiTampilanFilterRekap);
    document.getElementById('btn-pdf-rekap-download').addEventListener('click', function () {
      eksekusiPdfRekapPeriodik(false);
    });
    document.getElementById('btn-pdf-rekap-share').addEventListener('click', function () {
      eksekusiPdfRekapPeriodik(true);
    });
    document.getElementById('btn-export-xlsx').addEventListener('click', unduhCadanganExcel);

    // Upload & Hapus Gambar (Logo & Banner)
    document.getElementById('set-logo-file').addEventListener('change', function (e) {
      prosesUnggahGambar(e.target, 180, 180, true, function (dataUri) {
        state.draft.logo = dataUri;
        renderPratinjauGambar('preview-logo', dataUri, 'Tanpa Logo');
      });
    });
    document.getElementById('btn-hapus-logo').addEventListener('click', function () {
      state.draft.logo = '';
      document.getElementById('set-logo-file').value = '';
      renderPratinjauGambar('preview-logo', '', 'Tanpa Logo');
    });

    document.getElementById('set-banner-file').addEventListener('change', function (e) {
      prosesUnggahGambar(e.target, 800, 260, false, function (dataUri) {
        state.draft.banner = dataUri;
        renderPratinjauGambar('preview-banner', dataUri, 'Tanpa Banner');
      });
    });
    document.getElementById('btn-hapus-banner').addEventListener('click', function () {
      state.draft.banner = '';
      document.getElementById('set-banner-file').value = '';
      renderPratinjauGambar('preview-banner', '', 'Tanpa Banner');
    });

    // Pratinjau langsung tema warna saat diganti di dropdown
    document.getElementById('set-temaWarna').addEventListener('change', function (e) {
      document.documentElement.setAttribute('data-theme', e.target.value);
    });

    // Tombol Simpan Pengaturan Umum
    document.getElementById('btn-save-identitas').addEventListener('click', simpanPengaturanUmum);
    document.getElementById('btn-save-periode').addEventListener('click', simpanPengaturanUmum);
    document.getElementById('btn-save-privasi').addEventListener('click', simpanPengaturanUmum);

    // Tombol Tambah & Simpan Daftar Guru, Kelas, Kategori, Layanan, FAQ
    document.getElementById('btn-add-guru').addEventListener('click', tambahItemGuru);
    document.getElementById('btn-save-guru').addEventListener('click', simpanDaftarGuru);

    document.getElementById('btn-add-kelas').addEventListener('click', tambahItemKelas);
    document.getElementById('btn-save-kelas').addEventListener('click', simpanDaftarKelas);

    document.getElementById('btn-add-kategori').addEventListener('click', tambahItemKategori);
    document.getElementById('btn-save-kategori').addEventListener('click', simpanDaftarKategori);

    document.getElementById('btn-add-layanan').addEventListener('click', tambahItemLayanan);
    document.getElementById('btn-save-layanan').addEventListener('click', simpanDaftarLayanan);

    document.getElementById('btn-add-faq').addEventListener('click', tambahItemFaq);
    document.getElementById('btn-save-faq').addEventListener('click', simpanDaftarFaq);
  }

  async function panggilApiAdmin(action, payload) {
    var url = (window.BK_CONFIG && window.BK_CONFIG.WEB_APP_URL) ? window.BK_CONFIG.WEB_APP_URL.trim() : '';
    if (!url || url.indexOf('GANTI_DENGAN_ID_DEPLOYMENT_ANDA') !== -1) {
      throw new Error('URL Web App belum dikonfigurasi pada berkas js/config.js.');
    }

    var respons = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: action,
        token: state.token || '',
        payload: payload || {}
      })
    });

    if (!respons.ok) {
      throw new Error('Server merespons dengan status ' + respons.status + '.');
    }

    var json = await respons.json();
    if (!json || json.ok !== true) {
      var msg = (json && json.error) ? json.error : 'Permintaan gagal diproses.';
      // Jika sesi kedaluwarsa di server, kembalikan ke layar login
      if (msg.indexOf('Sesi Anda telah berakhir') !== -1 || msg.indexOf('Akses ditolak') !== -1) {
        bersihkanSesiLokal();
        tampilkanLayarLogin(msg);
      }
      throw new Error(msg);
    }

    return json.data;
  }

  async function tanganiLogin(e) {
    e.preventDefault();
    var inpPass = document.getElementById('input-admin-password');
    var errBox = document.getElementById('login-error-box');
    var btn = document.getElementById('btn-admin-login');

    errBox.classList.add('hidden');
    var password = inpPass.value;
    if (!password) {
      errBox.textContent = 'Masukkan kata sandi admin.';
      errBox.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memeriksa Sandi...';

    try {
      var res = await panggilApiAdmin('adminLogin', { password: password });
      state.token = res.token;
      try {
        window.sessionStorage.setItem(STORAGE_TOKEN_KEY, res.token);
      } catch (errStore) {
        // Abaikan jika sessionStorage dibatasi
      }
      inpPass.value = '';
      masukKeShellAdmin();
    } catch (err) {
      errBox.textContent = err.message || 'Gagal masuk ke panel admin.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk ke Panel BK';
    }
  }

  async function tanganiLogout() {
    try {
      if (state.token) {
        await panggilApiAdmin('adminLogout', {});
      }
    } catch (e) {
      // Tetap lanjut keluar di klien
    }
    bersihkanSesiLokal();
    tampilkanLayarLogin('');
  }

  function bersihkanSesiLokal() {
    state.token = '';
    state.data = null;
    try {
      window.sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    } catch (e) {
      // Abaikan
    }
  }

  function tampilkanLayarLogin(pesanGalat) {
    document.getElementById('admin-app-shell').classList.add('hidden');
    document.getElementById('admin-login-screen').classList.remove('hidden');
    var errBox = document.getElementById('login-error-box');
    if (pesanGalat) {
      errBox.textContent = pesanGalat;
      errBox.classList.remove('hidden');
    } else {
      errBox.classList.add('hidden');
    }
  }

  function masukKeShellAdmin() {
    document.getElementById('admin-login-screen').classList.add('hidden');
    document.getElementById('admin-app-shell').classList.remove('hidden');
    muatDataAdmin();
  }

  async function muatDataAdmin() {
    document.getElementById('admin-loading').classList.remove('hidden');
    sembunyikanSemuaTabUtama();

    try {
      var data = await panggilApiAdmin('adminGetInitData', {});
      state.data = data;

      terapkanHeaderDanTemaAdmin();
      isiOpsiFilterDanLaporan();
      renderStatistikDasbor();
      renderTabelKotakMasuk();
      muatFormPengaturanDariState();

      document.getElementById('admin-loading').classList.add('hidden');
      gantiTabUtama(state.activeMainTab);
    } catch (err) {
      document.getElementById('admin-loading').classList.add('hidden');
      tampilkanToast(err.message || 'Gagal memuat data admin.');
    }
  }

  // ==========================================================================
  // NAVIGASI TAB & HEADER ADMIN
  // ==========================================================================

  function sembunyikanSemuaTabUtama() {
    var tabs = ['dasbor', 'laporan', 'pengaturan'];
    for (var i = 0; i < tabs.length; i++) {
      document.getElementById('admin-tab-' + tabs[i]).classList.add('hidden');
    }
  }

  function gantiTabUtama(namaTab) {
    if (!state.data) return;
    var valid = ['dasbor', 'laporan', 'pengaturan'];
    if (valid.indexOf(namaTab) === -1) namaTab = 'dasbor';
    state.activeMainTab = namaTab;

    sembunyikanSemuaTabUtama();
    document.getElementById('admin-tab-' + namaTab).classList.remove('hidden');

    var btns = document.querySelectorAll('.admin-nav-btn');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-admin-tab') === namaTab) {
        btns[i].setAttribute('aria-current', 'page');
      } else {
        btns[i].removeAttribute('aria-current');
      }
    }
  }

  function gantiSubPengaturan(namaSub) {
    state.activeSettingsSub = namaSub;
    var panels = document.querySelectorAll('.set-sub-panel');
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.add('hidden');
    }
    var target = document.getElementById('set-sub-' + namaSub);
    if (target) target.classList.remove('hidden');

    var btns = document.querySelectorAll('.settings-tab-btn');
    for (var j = 0; j < btns.length; j++) {
      if (btns[j].getAttribute('data-set-sub') === namaSub) {
        btns[j].classList.add('active');
      } else {
        btns[j].classList.remove('active');
      }
    }
  }

  function terapkanHeaderDanTemaAdmin() {
    var peng = state.data.pengaturan || {};
    document.documentElement.setAttribute('data-theme', peng.temaWarna || 'teal-hangat');
    document.getElementById('admin-header-title').textContent = 'Panel Admin • ' + (peng.namaSingkat || peng.namaSekolah || 'BK SMP');
    document.getElementById('admin-header-period').textContent =
      'Periode Aktif: TA ' + (peng.tahunAjaranAktif || '-') + ' (' + (peng.semesterAktif || '-') + ')';

    if (peng.logo && peng.logo.indexOf('data:image/') === 0) {
      var logoBox = document.getElementById('admin-brand-logo');
      logoBox.innerHTML = '';
      var img = document.createElement('img');
      img.src = peng.logo;
      img.alt = 'Logo Sekolah';
      logoBox.appendChild(img);
    }
  }

  // ==========================================================================
  // DASBOR & KOTAK MASUK
  // ==========================================================================

  function renderStatistikDasbor() {
    var stat = state.data.statistik || {};
    document.getElementById('kpi-baru').textContent = String(stat.kirimanBaru || 0);
    document.getElementById('kpi-belum-dibalas').textContent = String(stat.belumDibalas || 0);
    document.getElementById('kpi-urgensi-tinggi').textContent = String(stat.urgensiTinggi || 0);
    document.getElementById('kpi-eskalasi').textContent = String(stat.perluEskalasi || 0);
    document.getElementById('kpi-periode-aktif').textContent = String(stat.totalPeriodeAktif || 0);
  }

  function isiOpsiFilterDanLaporan() {
    var peng = state.data.pengaturan || {};
    var guru = state.data.guru || [];
    var kategori = state.data.kategori || [];
    var kiriman = state.data.kiriman || [];

    // Kumpulkan semua kombinasi Tahun Ajaran + Semester
    var setPeriode = {};
    var setTahunAjaran = {};
    if (peng.tahunAjaranAktif) {
      setTahunAjaran[peng.tahunAjaranAktif] = true;
      if (peng.semesterAktif) {
        setPeriode[peng.tahunAjaranAktif + '|' + peng.semesterAktif] = true;
      }
    }
    for (var i = 0; i < kiriman.length; i++) {
      if (kiriman[i].TahunAjaran) {
        setTahunAjaran[kiriman[i].TahunAjaran] = true;
        if (kiriman[i].Semester) {
          setPeriode[kiriman[i].TahunAjaran + '|' + kiriman[i].Semester] = true;
        }
      }
    }

    var selPeriode = document.getElementById('filter-periode');
    selPeriode.innerHTML = '<option value="">Semua Periode</option>';
    Object.keys(setPeriode).sort().reverse().forEach(function (key) {
      var bagian = key.split('|');
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = 'TA ' + bagian[0] + ' - ' + bagian[1];
      selPeriode.appendChild(opt);
    });

    // Dropdown Tahun Ajaran pada tab Laporan
    var selRepTa = document.getElementById('rep-ta');
    selRepTa.innerHTML = '';
    Object.keys(setTahunAjaran).sort().reverse().forEach(function (ta) {
      var opt = document.createElement('option');
      opt.value = ta;
      opt.textContent = 'TA ' + ta;
      if (ta === peng.tahunAjaranAktif) opt.selected = true;
      selRepTa.appendChild(opt);
    });
    if (peng.semesterAktif) {
      document.getElementById('rep-semester').value = peng.semesterAktif;
    }

    // Dropdown Guru Tujuan (Kotak Masuk & Laporan)
    var selGuru = document.getElementById('filter-guru');
    var selRepGuru = document.getElementById('rep-guru');
    selGuru.innerHTML = '<option value="">Semua Guru Tujuan</option><option value="SEMUA">Siapa saja (Belum ditentukan)</option>';
    selRepGuru.innerHTML = '<option value="">Semua Guru BK</option><option value="SEMUA">Siapa saja (Belum ditentukan)</option>';

    for (var g = 0; g < guru.length; g++) {
      var opt1 = document.createElement('option');
      opt1.value = guru[g].ID;
      opt1.textContent = guru[g].Nama;
      selGuru.appendChild(opt1);

      var opt2 = document.createElement('option');
      opt2.value = guru[g].ID;
      opt2.textContent = guru[g].Nama;
      selRepGuru.appendChild(opt2);
    }

    // Dropdown Kategori
    var selKat = document.getElementById('filter-kategori');
    selKat.innerHTML = '<option value="">Semua Kategori</option>';
    for (var k = 0; k < kategori.length; k++) {
      var optKat = document.createElement('option');
      optKat.value = kategori[k].ID;
      optKat.textContent = kategori[k].Nama;
      selKat.appendChild(optKat);
    }
  }

  function dapatkanPetaNamaKategori() {
    var map = {};
    var list = (state.data && state.data.kategori) || [];
    for (var i = 0; i < list.length; i++) {
      map[list[i].ID] = list[i].Nama;
    }
    return map;
  }

  function dapatkanPetaNamaGuru() {
    var map = {};
    var list = (state.data && state.data.guru) || [];
    for (var i = 0; i < list.length; i++) {
      map[list[i].ID] = list[i].Nama;
    }
    return map;
  }

  function renderTabelKotakMasuk() {
    var semua = (state.data && state.data.kiriman) || [];
    var q = document.getElementById('filter-search').value.trim().toLowerCase();
    var fPeriode = document.getElementById('filter-periode').value;
    var fJenjang = document.getElementById('filter-jenjang').value;
    var fGuru = document.getElementById('filter-guru').value;
    var fKategori = document.getElementById('filter-kategori').value;
    var fStatus = document.getElementById('filter-status').value;
    var fUrgensi = document.getElementById('filter-urgensi').value;
    var fEskalasi = document.getElementById('filter-eskalasi').value;

    var petaKategori = dapatkanPetaNamaKategori();
    var petaGuru = dapatkanPetaNamaGuru();

    var tersaring = semua.filter(function (item) {
      if (fPeriode) {
        var bagian = fPeriode.split('|');
        if (item.TahunAjaran !== bagian[0] || item.Semester !== bagian[1]) return false;
      }
      if (fJenjang && String(item.Jenjang) !== fJenjang) return false;
      if (fGuru) {
        if (fGuru === 'SEMUA' && item.GuruTujuanID !== '') return false;
        if (fGuru !== 'SEMUA' && item.GuruTujuanID !== fGuru) return false;
      }
      if (fKategori && item.KategoriID !== fKategori) return false;
      if (fStatus && item.Status !== fStatus) return false;
      if (fUrgensi && item.Urgensi !== fUrgensi) return false;
      if (fEskalasi === 'YA' && !item.LabelEskalasi) return false;

      if (q) {
        var gabungan = [
          item.IDKiriman, item.Nama, item.Kelas, item.Pesan,
          item.DiteruskanKe, item.RujukanKe, item.CatatanInternal
        ].join(' ').toLowerCase();
        if (gabungan.indexOf(q) === -1) return false;
      }
      return true;
    });

    // Urutkan terbaru di atas
    tersaring.sort(function (a, b) {
      return new Date(b.Waktu).getTime() - new Date(a.Waktu).getTime();
    });

    document.getElementById('inbox-count-label').textContent = String(tersaring.length);

    var tbody = document.getElementById('inbox-table-body');
    tbody.innerHTML = '';

    if (tersaring.length === 0) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 7;
      tdEmpty.className = 'empty-state';
      tdEmpty.textContent = 'Tidak ada kiriman yang cocok dengan penyaringan saat ini.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      return;
    }

    for (var i = 0; i < tersaring.length; i++) {
      (function (item) {
        var tr = document.createElement('tr');
        if (item.LabelEskalasi) {
          tr.className = 'row-eskalasi';
        }

        // Kolom 1: ID & Waktu
        var tdId = document.createElement('td');
        var strongId = document.createElement('strong');
        strongId.textContent = item.IDKiriman;
        var divWaktu = document.createElement('div');
        divWaktu.style.fontSize = '0.78rem';
        divWaktu.style.color = 'var(--text-muted)';
        divWaktu.textContent = formatWaktuSingkat(item.Waktu) + ' • TA ' + item.TahunAjaran;
        tdId.appendChild(strongId);
        tdId.appendChild(divWaktu);

        // Kolom 2: Pengirim
        var tdPengirim = document.createElement('td');
        var namaPengirim = document.createElement('div');
        namaPengirim.style.fontWeight = '700';
        namaPengirim.textContent = item.Anonim ? 'Anonim' : item.Nama;
        var kelasPengirim = document.createElement('div');
        kelasPengirim.style.fontSize = '0.8rem';
        kelasPengirim.style.color = 'var(--text-muted)';
        kelasPengirim.textContent = item.Anonim ? ('Jenjang Kelas ' + item.Jenjang) : ('Kelas ' + item.Kelas);
        tdPengirim.appendChild(namaPengirim);
        tdPengirim.appendChild(kelasPengirim);

        // Kolom 3: Kategori & Cuplikan Pesan
        var tdKat = document.createElement('td');
        var katJudul = document.createElement('div');
        katJudul.style.fontWeight = '700';
        katJudul.textContent = petaKategori[item.KategoriID] || '-';
        tdKat.appendChild(katJudul);

        if (item.LabelEskalasi) {
          var badgeEsk = document.createElement('span');
          badgeEsk.className = 'badge badge-eskalasi';
          badgeEsk.style.marginTop = '0.2rem';
          badgeEsk.textContent = item.LabelEskalasi;
          tdKat.appendChild(badgeEsk);
        }

        var cuplikan = document.createElement('div');
        cuplikan.style.fontSize = '0.82rem';
        cuplikan.style.color = 'var(--text-muted)';
        cuplikan.style.marginTop = '0.25rem';
        cuplikan.style.maxWidth = '280px';
        cuplikan.textContent = item.Pesan.length > 85 ? (item.Pesan.slice(0, 85) + '...') : item.Pesan;
        tdKat.appendChild(cuplikan);

        // Kolom 4: Urgensi
        var tdUrg = document.createElement('td');
        var badgeUrg = document.createElement('span');
        var clsUrg = item.Urgensi === 'Tinggi' ? 'badge-tinggi' : (item.Urgensi === 'Sedang' ? 'badge-sedang' : 'badge-rendah');
        badgeUrg.className = 'badge ' + clsUrg;
        badgeUrg.textContent = item.Urgensi;
        tdUrg.appendChild(badgeUrg);

        // Kolom 5: Guru Tujuan
        var tdGuru = document.createElement('td');
        tdGuru.textContent = item.GuruTujuanID ? (petaGuru[item.GuruTujuanID] || '-') : 'Siapa saja';
        if (item.DiteruskanKe) {
          var divTerus = document.createElement('div');
          divTerus.style.fontSize = '0.78rem';
          divTerus.style.color = 'var(--primary)';
          divTerus.textContent = 'Diteruskan: ' + item.DiteruskanKe;
          tdGuru.appendChild(divTerus);
        }

        // Kolom 6: Status & Jumlah Balasan
        var tdStatus = document.createElement('td');
        var badgeSt = document.createElement('span');
        var clsSt = 'badge-' + String(item.Status || 'baru').toLowerCase();
        badgeSt.className = 'badge ' + clsSt;
        badgeSt.textContent = item.Status;
        tdStatus.appendChild(badgeSt);

        var infoBalas = document.createElement('div');
        infoBalas.style.fontSize = '0.78rem';
        infoBalas.style.color = 'var(--text-muted)';
        infoBalas.style.marginTop = '0.2rem';
        infoBalas.textContent = (item.balasan && item.balasan.length > 0)
          ? (item.balasan.length + ' balasan terkirim')
          : 'Belum dibalas';
        tdStatus.appendChild(infoBalas);

        // Kolom 7: Tombol Detail
        var tdAksi = document.createElement('td');
        var btnDetail = document.createElement('button');
        btnDetail.type = 'button';
        btnDetail.className = 'btn btn-primary btn-sm';
        btnDetail.textContent = 'Buka Detail';
        btnDetail.addEventListener('click', function () {
          bukaModalKasus(item.IDKiriman);
        });
        tdAksi.appendChild(btnDetail);

        tr.appendChild(tdId);
        tr.appendChild(tdPengirim);
        tr.appendChild(tdKat);
        tr.appendChild(tdUrg);
        tr.appendChild(tdGuru);
        tr.appendChild(tdStatus);
        tr.appendChild(tdAksi);

        tbody.appendChild(tr);
      })(tersaring[i]);
    }
  }

  // ==========================================================================
  // MODAL DETAIL KASUS, BALASAN, & UPDATE STATUS
  // ==========================================================================

  function cariKasusById(idKiriman) {
    var list = (state.data && state.data.kiriman) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].IDKiriman === idKiriman) return list[i];
    }
    return null;
  }

  function bukaModalKasus(idKiriman) {
    var kasus = cariKasusById(idKiriman);
    if (!kasus) return;

    state.selectedCaseId = idKiriman;
    var petaKategori = dapatkanPetaNamaKategori();
    var petaGuru = dapatkanPetaNamaGuru();

    document.getElementById('modal-case-title').textContent = 'Detail Kiriman: ' + kasus.IDKiriman;
    document.getElementById('modal-case-subtitle').textContent =
      'Masuk pada ' + formatWaktuSingkat(kasus.Waktu) + ' • TA ' + kasus.TahunAjaran + ' (' + kasus.Semester + ')';

    var eskAlert = document.getElementById('modal-eskalasi-alert');
    if (kasus.LabelEskalasi) {
      eskAlert.textContent = 'PERHATIAN ESKALASI (' + kasus.LabelEskalasi + '): Kasus ini termasuk kategori perlindungan siswa / TPPK dan memerlukan penanganan prioritas.';
      eskAlert.classList.remove('hidden');
    } else {
      eskAlert.classList.add('hidden');
    }

    var metaBox = document.getElementById('modal-case-meta');
    metaBox.innerHTML = '';
    var barisMeta = [
      ['Identitas Siswa', kasus.Anonim ? ('Anonim (Jenjang Kelas ' + kasus.Jenjang + ')') : (kasus.Nama + ' (Kelas ' + kasus.Kelas + ')')],
      ['Kategori & Urgensi', (petaKategori[kasus.KategoriID] || '-') + ' • Urgensi: ' + kasus.Urgensi],
      ['Guru Tujuan & Preferensi', (kasus.GuruTujuanID ? (petaGuru[kasus.GuruTujuanID] || '-') : 'Siapa saja') + ' • ' + kasus.PreferensiBalasan]
    ];
    for (var i = 0; i < barisMeta.length; i++) {
      var row = document.createElement('div');
      row.className = 'summary-row';
      var kEl = document.createElement('span');
      kEl.className = 'summary-key';
      kEl.textContent = barisMeta[i][0];
      var vEl = document.createElement('span');
      vEl.className = 'summary-val';
      vEl.textContent = barisMeta[i][1];
      row.appendChild(kEl);
      row.appendChild(vEl);
      metaBox.appendChild(row);
    }

    document.getElementById('modal-case-pesan').textContent = kasus.Pesan;
    document.getElementById('modal-pdf-include-id').checked = false;

    // Render daftar balasan
    renderDaftarBalasanModal(kasus.balasan || []);
    document.getElementById('modal-reply-text').value = '';

    // Isi form metadata tindak lanjut
    document.getElementById('modal-status').value = kasus.Status || 'Baru';
    document.getElementById('modal-diteruskan').value = kasus.DiteruskanKe || '';
    document.getElementById('modal-rujukan').value = kasus.RujukanKe || '';
    document.getElementById('modal-catatan').value = kasus.CatatanInternal || '';

    document.getElementById('case-detail-modal').classList.remove('hidden');
  }

  function renderDaftarBalasanModal(balasanList) {
    var wadah = document.getElementById('modal-reply-list');
    wadah.innerHTML = '';

    if (balasanList.length === 0) {
      var p = document.createElement('div');
      p.style.fontSize = '0.88rem';
      p.style.color = 'var(--text-muted)';
      p.textContent = 'Belum ada balasan yang dikirimkan untuk tiket ini.';
      wadah.appendChild(p);
      return;
    }

    for (var i = 0; i < balasanList.length; i++) {
      var b = balasanList[i];
      var bubble = document.createElement('div');
      bubble.className = 'bubble-teacher';
      var meta = document.createElement('div');
      meta.className = 'bubble-meta';
      meta.textContent = 'Balasan Guru BK • ' + formatWaktuSingkat(b.Waktu);
      var body = document.createElement('p');
      body.className = 'bubble-body';
      body.textContent = b.Pesan;
      bubble.appendChild(meta);
      bubble.appendChild(body);
      wadah.appendChild(bubble);
    }
  }

  function tutupModalKasus() {
    state.selectedCaseId = '';
    document.getElementById('case-detail-modal').classList.add('hidden');
  }

  async function tanganiKirimBalasan(e) {
    e.preventDefault();
    if (!state.selectedCaseId) return;

    var teks = document.getElementById('modal-reply-text').value.trim();
    if (!teks) {
      tampilkanToast('Tuliskan isi balasan terlebih dahulu.');
      return;
    }

    var btn = document.getElementById('btn-send-reply');
    btn.disabled = true;
    btn.textContent = 'Mengirim Balasan...';

    try {
      var hasil = await panggilApiAdmin('adminKirimBalasan', {
        idKiriman: state.selectedCaseId,
        pesan: teks
      });

      var kasus = cariKasusById(state.selectedCaseId);
      if (kasus) {
        kasus.balasan = kasus.balasan || [];
        kasus.balasan.push(hasil.balasan);
        kasus.Status = hasil.status;
        kasus.WaktuUbah = hasil.waktuUbah;
        document.getElementById('modal-status').value = hasil.status;
        renderDaftarBalasanModal(kasus.balasan);
      }

      document.getElementById('modal-reply-text').value = '';
      hitungUlangStatistikLokal();
      renderTabelKotakMasuk();
      tampilkanToast('Balasan berhasil dikirim dan dapat dibaca siswa lewat kode tiket.');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal mengirim balasan.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Balasan ke Siswa';
    }
  }

  async function tanganiUpdateKasus(e) {
    e.preventDefault();
    if (!state.selectedCaseId) return;

    var btn = document.getElementById('btn-save-case-meta');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
      var payload = {
        idKiriman: state.selectedCaseId,
        status: document.getElementById('modal-status').value,
        diteruskanKe: document.getElementById('modal-diteruskan').value.trim(),
        rujukanKe: document.getElementById('modal-rujukan').value.trim(),
        catatanInternal: document.getElementById('modal-catatan').value.trim()
      };

      var hasil = await panggilApiAdmin('adminUpdateKiriman', payload);
      var kasus = cariKasusById(state.selectedCaseId);
      if (kasus) {
        kasus.Status = hasil.status;
        kasus.DiteruskanKe = hasil.diteruskanKe;
        kasus.RujukanKe = hasil.rujukanKe;
        kasus.CatatanInternal = hasil.catatanInternal;
        kasus.WaktuUbah = hasil.waktuUbah;
      }

      hitungUlangStatistikLokal();
      renderTabelKotakMasuk();
      tampilkanToast('Perubahan status dan catatan kasus berhasil disimpan.');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan perubahan kasus.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan Perubahan Status & Catatan';
    }
  }

  function hitungUlangStatistikLokal() {
    if (!state.data) return;
    var peng = state.data.pengaturan || {};
    var list = state.data.kiriman || [];
    var stat = {
      kirimanBaru: 0,
      belumDibalas: 0,
      urgensiTinggi: 0,
      perluEskalasi: 0,
      totalPeriodeAktif: 0
    };

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.TahunAjaran === peng.tahunAjaranAktif && item.Semester === peng.semesterAktif) {
        stat.totalPeriodeAktif++;
      }
      if (item.Status === 'Baru') stat.kirimanBaru++;
      if ((!item.balasan || item.balasan.length === 0) && item.Status !== 'Selesai') stat.belumDibalas++;
      if (item.Urgensi === 'Tinggi' && item.Status !== 'Selesai') stat.urgensiTinggi++;
      if (item.LabelEskalasi && item.Status !== 'Selesai') stat.perluEskalasi++;
    }

    state.data.statistik = stat;
    renderStatistikDasbor();
  }

  // ==========================================================================
  // LAPORAN PDF & CADANGAN EXCEL (.XLSX)
  // ==========================================================================

  async function eksekusiPdfLembarKasus(modeShare) {
    var kasus = cariKasusById(state.selectedCaseId);
    if (!kasus) return;

    try {
      var petaKategori = dapatkanPetaNamaKategori();
      var petaGuru = dapatkanPetaNamaGuru();
      var sertakanIdentitas = document.getElementById('modal-pdf-include-id').checked;

      var hasilPdf = window.BK_PDF.buatPdfLembarKasus({
        kasus: kasus,
        pengaturan: state.data.pengaturan || {},
        namaKategori: petaKategori[kasus.KategoriID] || '-',
        namaGuruTujuan: kasus.GuruTujuanID ? (petaGuru[kasus.GuruTujuanID] || '-') : 'Siapa saja',
        sertakanIdentitas: sertakanIdentitas
      });

      var pesan = await window.BK_PDF.keluarkanPdf(hasilPdf, modeShare);
      tampilkanToast(pesan);
    } catch (err) {
      tampilkanToast(err.message || 'Gagal membuat PDF Lembar Kasus.');
    }
  }

  function perbaruiTampilanFilterRekap() {
    var jenis = document.getElementById('rep-jenis').value;
    document.getElementById('rep-filter-bulanan').classList.toggle('hidden', jenis !== 'bulanan');
    document.getElementById('rep-filter-ta').classList.toggle('hidden', jenis === 'bulanan');
    document.getElementById('rep-filter-semester').classList.toggle('hidden', jenis !== 'semester');
  }

  async function eksekusiPdfRekapPeriodik(modeShare) {
    if (!state.data) return;

    try {
      var jenis = document.getElementById('rep-jenis').value;
      var fJenjang = document.getElementById('rep-jenjang').value;
      var fGuru = document.getElementById('rep-guru').value;
      var sertakanIdentitas = document.getElementById('rep-sertakan-identitas').checked;

      var bulanVal = document.getElementById('rep-bulan').value;
      var taVal = document.getElementById('rep-ta').value;
      var semVal = document.getElementById('rep-semester').value;

      var subJudul = '';
      var slug = '';

      var tersaring = (state.data.kiriman || []).filter(function (item) {
        if (jenis === 'bulanan') {
          if (!bulanVal) return true;
          var d = new Date(item.Waktu);
          if (isNaN(d.getTime())) return false;
          var ym = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
          if (ym !== bulanVal) return false;
        } else if (jenis === 'semester') {
          if (taVal && item.TahunAjaran !== taVal) return false;
          if (semVal && item.Semester !== semVal) return false;
        } else if (jenis === 'tahunan') {
          if (taVal && item.TahunAjaran !== taVal) return false;
        }

        if (fJenjang && String(item.Jenjang) !== fJenjang) return false;
        if (fGuru) {
          if (fGuru === 'SEMUA' && item.GuruTujuanID !== '') return false;
          if (fGuru !== 'SEMUA' && item.GuruTujuanID !== fGuru) return false;
        }
        return true;
      });

      if (jenis === 'bulanan') {
        subJudul = 'Periode Bulanan: ' + (bulanVal || 'Semua Bulan');
        slug = 'Bulanan_' + (bulanVal || 'Semua');
      } else if (jenis === 'semester') {
        subJudul = 'Periode Tahun Ajaran ' + (taVal || '-') + ' Semester ' + (semVal || '-');
        slug = 'Semester_' + (taVal || '').replace('/', '-') + '_' + (semVal || '');
      } else {
        subJudul = 'Periode Tahunan: Tahun Ajaran ' + (taVal || '-');
        slug = 'Tahunan_' + (taVal || '').replace('/', '-');
      }

      if (fJenjang) subJudul += ' | Jenjang Kelas ' + fJenjang;

      var hasilPdf = window.BK_PDF.buatPdfRekapPeriodik({
        pengaturan: state.data.pengaturan || {},
        daftarKasus: tersaring,
        petaKategori: dapatkanPetaNamaKategori(),
        petaGuru: dapatkanPetaNamaGuru(),
        subJudulPeriode: subJudul,
        slugPeriode: slug,
        sertakanIdentitas: sertakanIdentitas
      });

      var pesan = await window.BK_PDF.keluarkanPdf(hasilPdf, modeShare);
      tampilkanToast(pesan);
    } catch (err) {
      tampilkanToast(err.message || 'Gagal membuat PDF Rekap Periodik.');
    }
  }

  async function unduhCadanganExcel() {
    if (!window.XLSX) {
      tampilkanToast('Pustaka Excel (SheetJS) belum termuat.');
      return;
    }

    var btn = document.getElementById('btn-export-xlsx');
    btn.disabled = true;
    btn.textContent = 'Menyiapkan Berkas Excel...';

    try {
      var backup = await panggilApiAdmin('adminExportBackup', {});
      var wb = window.XLSX.utils.book_new();

      var namaSheets = Object.keys(backup);
      for (var i = 0; i < namaSheets.length; i++) {
        var nama = namaSheets[i];
        var rows = backup[nama] || [];
        var ws = rows.length > 0
          ? window.XLSX.utils.json_to_sheet(rows)
          : window.XLSX.utils.aoa_to_sheet([['Tidak ada data']]);
        window.XLSX.utils.book_append_sheet(wb, ws, nama.slice(0, 31));
      }

      var tgl = new Date().toISOString().slice(0, 10);
      window.XLSX.writeFile(wb, 'Cadangan_Database_BK_' + tgl + '.xlsx');
      tampilkanToast('Cadangan database Excel (.xlsx) berhasil diunduh.');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal mengunduh cadangan Excel.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Unduh Cadangan Excel (.xlsx)';
    }
  }

  // ==========================================================================
  // PENGATURAN SEKOLAH (UMUM, GURU, KELAS, KATEGORI, LAYANAN, FAQ)
  // ==========================================================================

  function muatFormPengaturanDariState() {
    var peng = state.data.pengaturan || {};

    document.getElementById('set-namaSekolah').value = peng.namaSekolah || '';
    document.getElementById('set-namaSingkat').value = peng.namaSingkat || '';
    document.getElementById('set-alamat').value = peng.alamat || '';
    document.getElementById('set-kontakSekolah').value = peng.kontakSekolah || '';
    document.getElementById('set-kepalaSekolah').value = peng.kepalaSekolah || '';
    document.getElementById('set-penandaTangan').value = peng.penandaTangan || '';
    document.getElementById('set-jabatanPenandaTangan').value = peng.jabatanPenandaTangan || '';

    document.getElementById('set-tahunAjaranAktif').value = peng.tahunAjaranAktif || '';
    document.getElementById('set-semesterAktif').value = peng.semesterAktif || 'Ganjil';
    document.getElementById('set-temaWarna').value = peng.temaWarna || 'teal-hangat';
    document.getElementById('set-jamLayanan').value = peng.jamLayanan || '';
    document.getElementById('set-teksSambutan').value = peng.teksSambutan || '';

    document.getElementById('set-kebijakanPrivasi').value = peng.kebijakanPrivasi || '';
    document.getElementById('set-kontakDarurat').value = peng.kontakDarurat || '';

    state.draft.logo = peng.logo || '';
    state.draft.banner = peng.banner || '';
    renderPratinjauGambar('preview-logo', state.draft.logo, 'Tanpa Logo');
    renderPratinjauGambar('preview-banner', state.draft.banner, 'Tanpa Banner');

    // Salin array master untuk diedit di form
    state.draft.guru = JSON.parse(JSON.stringify(state.data.guru || []));
    state.draft.kelas = JSON.parse(JSON.stringify(state.data.kelas || []));
    state.draft.kategori = JSON.parse(JSON.stringify(state.data.kategori || []));
    state.draft.layanan = JSON.parse(JSON.stringify(state.data.layanan || []));
    state.draft.faq = JSON.parse(JSON.stringify(state.data.faq || []));

    renderEditorGuru();
    renderEditorKelas();
    renderEditorKategori();
    renderEditorLayanan();
    renderEditorFaq();
  }

  function renderPratinjauGambar(boxId, dataUri, teksKosong) {
    var box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = '';
    if (dataUri && dataUri.indexOf('data:image/') === 0) {
      var img = document.createElement('img');
      img.src = dataUri;
      img.alt = 'Pratinjau gambar';
      box.appendChild(img);
    } else {
      box.textContent = teksKosong;
    }
  }

  /**
   * Mengubah ukuran gambar di browser agar selalu muat dalam batas sel Google Sheets (< 45KB).
   */
  function prosesUnggahGambar(inputEl, maxW, maxH, pertahankanTransparansi, callback) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    if (file.type.indexOf('image/') !== 0) {
      tampilkanToast('Berkas harus berupa gambar (PNG, JPG, atau WEBP).');
      inputEl.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var rasio = Math.min(maxW / img.width, maxH / img.height, 1);
        var w = Math.max(1, Math.round(img.width * rasio));
        var h = Math.max(1, Math.round(img.height * rasio));

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        var dataUri = pertahankanTransparansi && file.type === 'image/png'
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.78);

        // Jika masih melebihi 45.000 karakter, turunkan ke JPEG terkompresi
        if (dataUri.length > 45000) {
          dataUri = canvas.toDataURL('image/jpeg', 0.58);
        }
        if (dataUri.length > 45000) {
          tampilkanToast('Ukuran gambar masih terlalu besar setelah dikompresi. Gunakan gambar dengan resolusi lebih kecil.');
          inputEl.value = '';
          return;
        }

        callback(dataUri);
        tampilkanToast('Gambar berhasil dimuat dan disesuaikan ukurannya.');
      };
      img.onerror = function () {
        tampilkanToast('Berkas gambar tidak dapat dibaca.');
        inputEl.value = '';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function simpanPengaturanUmum() {
    var payloadData = {
      namaSekolah: document.getElementById('set-namaSekolah').value.trim(),
      namaSingkat: document.getElementById('set-namaSingkat').value.trim(),
      logo: state.draft.logo,
      alamat: document.getElementById('set-alamat').value.trim(),
      kontakSekolah: document.getElementById('set-kontakSekolah').value.trim(),
      kepalaSekolah: document.getElementById('set-kepalaSekolah').value.trim(),
      penandaTangan: document.getElementById('set-penandaTangan').value.trim(),
      jabatanPenandaTangan: document.getElementById('set-jabatanPenandaTangan').value.trim(),
      tahunAjaranAktif: document.getElementById('set-tahunAjaranAktif').value.trim(),
      semesterAktif: document.getElementById('set-semesterAktif').value,
      temaWarna: document.getElementById('set-temaWarna').value,
      jamLayanan: document.getElementById('set-jamLayanan').value.trim(),
      teksSambutan: document.getElementById('set-teksSambutan').value.trim(),
      banner: state.draft.banner,
      kebijakanPrivasi: document.getElementById('set-kebijakanPrivasi').value.trim(),
      kontakDarurat: document.getElementById('set-kontakDarurat').value.trim()
    };

    try {
      await panggilApiAdmin('adminSimpanPengaturan', {
        bagian: 'umum',
        data: payloadData
      });
      state.data.pengaturan = payloadData;
      terapkanHeaderDanTemaAdmin();
      isiOpsiFilterDanLaporan();
      hitungUlangStatistikLokal();
      tampilkanToast('Pengaturan sekolah berhasil disimpan!');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan pengaturan.');
    }
  }

  // --- Editor Daftar Guru BK ---
  function renderEditorGuru() {
    var wadah = document.getElementById('editor-guru-list');
    wadah.innerHTML = '';

    state.draft.guru.forEach(function (g, idx) {
      var card = document.createElement('div');
      card.className = 'item-editor-card';

      var head = document.createElement('div');
      head.className = 'item-editor-head';
      var title = document.createElement('strong');
      title.textContent = 'Guru BK #' + (idx + 1) + ' (' + g.ID + ')';
      head.appendChild(title);
      head.appendChild(buatTombolHapusDuaKlik(function () {
        state.draft.guru.splice(idx, 1);
        renderEditorGuru();
      }));
      card.appendChild(head);

      var grid1 = document.createElement('div');
      grid1.className = 'form-grid-2';
      grid1.appendChild(buatFieldInput('Nama Lengkap & Gelar', g.Nama, function (v) { g.Nama = v; }));
      grid1.appendChild(buatFieldInput('Jabatan', g.Jabatan, function (v) { g.Jabatan = v; }));
      card.appendChild(grid1);

      var grid2 = document.createElement('div');
      grid2.className = 'form-grid-2';
      grid2.appendChild(buatFieldInput('Jenjang Kelas yang Diampu (misal: 7 atau 7, 8)', g.Jenjang, function (v) { g.Jenjang = v; }));
      grid2.appendChild(buatFieldInput('Lokasi Ruangan / Kontak', g.Kontak, function (v) { g.Kontak = v; }));
      card.appendChild(grid2);

      card.appendChild(buatFieldTextarea('Profil Singkat / Bio', g.Bio, function (v) { g.Bio = v; }));

      // Foto Guru + Urutan + Aktif
      var fotoRow = document.createElement('div');
      fotoRow.style.display = 'flex';
      fotoRow.style.flexWrap = 'wrap';
      fotoRow.style.alignItems = 'center';
      fotoRow.style.gap = '0.85rem';

      var prev = document.createElement('div');
      prev.className = 'img-preview-box';
      if (g.Foto && g.Foto.indexOf('data:image/') === 0) {
        var img = document.createElement('img');
        img.src = g.Foto;
        prev.appendChild(img);
      } else {
        prev.textContent = 'Tanpa Foto';
      }

      var fileInp = document.createElement('input');
      fileInp.type = 'file';
      fileInp.accept = 'image/png,image/jpeg,image/webp';
      fileInp.className = 'form-control';
      fileInp.style.maxWidth = '250px';
      fileInp.addEventListener('change', function () {
        prosesUnggahGambar(fileInp, 160, 160, false, function (dataUri) {
          g.Foto = dataUri;
          renderEditorGuru();
        });
      });

      var urutanInp = document.createElement('input');
      urutanInp.type = 'number';
      urutanInp.className = 'form-control';
      urutanInp.style.width = '90px';
      urutanInp.value = g.Urutan || (idx + 1);
      urutanInp.title = 'Urutan Tampil';
      urutanInp.addEventListener('input', function () { g.Urutan = Number(urutanInp.value) || (idx + 1); });

      var aktifLbl = buatFieldCheckbox('Aktif tampil di siswa', g.Aktif, function (v) { g.Aktif = v; });

      fotoRow.appendChild(prev);
      fotoRow.appendChild(fileInp);
      fotoRow.appendChild(urutanInp);
      fotoRow.appendChild(aktifLbl);
      card.appendChild(fotoRow);

      wadah.appendChild(card);
    });
  }

  function tambahItemGuru() {
    var nextNum = state.draft.guru.length + 1;
    state.draft.guru.push({
      ID: 'GRU-' + ('00' + Date.now().toString().slice(-3)).slice(-3),
      Nama: '',
      Jabatan: 'Guru Bimbingan & Konseling',
      Jenjang: '7, 8, 9',
      Kontak: 'Ruang BK',
      Foto: '',
      Bio: '',
      Aktif: true,
      Urutan: nextNum
    });
    renderEditorGuru();
  }

  async function simpanDaftarGuru() {
    for (var i = 0; i < state.draft.guru.length; i++) {
      if (!state.draft.guru[i].Nama.trim()) {
        tampilkanToast('Nama guru pada baris #' + (i + 1) + ' tidak boleh kosong.');
        return;
      }
    }
    try {
      await panggilApiAdmin('adminSimpanPengaturan', { bagian: 'guru', data: state.draft.guru });
      state.data.guru = JSON.parse(JSON.stringify(state.draft.guru));
      isiOpsiFilterDanLaporan();
      tampilkanToast('Daftar Guru BK berhasil disimpan!');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan daftar Guru BK.');
    }
  }

  // --- Editor Daftar Kelas ---
  function renderEditorKelas() {
    var wadah = document.getElementById('editor-kelas-list');
    wadah.innerHTML = '';

    state.draft.kelas.forEach(function (kls, idx) {
      var card = document.createElement('div');
      card.className = 'item-editor-card';
      card.style.display = 'flex';
      card.style.flexWrap = 'wrap';
      card.style.alignItems = 'center';
      card.style.gap = '0.75rem';

      var inpKelas = document.createElement('input');
      inpKelas.type = 'text';
      inpKelas.className = 'form-control';
      inpKelas.style.width = '140px';
      inpKelas.placeholder = 'Nama Kelas (7A)';
      inpKelas.value = kls.Kelas;
      inpKelas.addEventListener('input', function () { kls.Kelas = inpKelas.value; });

      var selJenjang = document.createElement('select');
      selJenjang.className = 'form-control';
      selJenjang.style.width = '140px';
      ['7', '8', '9'].forEach(function (j) {
        var opt = document.createElement('option');
        opt.value = j;
        opt.textContent = 'Jenjang Kelas ' + j;
        if (String(kls.Jenjang) === j) opt.selected = true;
        selJenjang.appendChild(opt);
      });
      selJenjang.addEventListener('change', function () { kls.Jenjang = selJenjang.value; });

      var aktifLbl = buatFieldCheckbox('Aktif', kls.Aktif, function (v) { kls.Aktif = v; });

      card.appendChild(inpKelas);
      card.appendChild(selJenjang);
      card.appendChild(aktifLbl);
      card.appendChild(buatTombolHapusDuaKlik(function () {
        state.draft.kelas.splice(idx, 1);
        renderEditorKelas();
      }));

      wadah.appendChild(card);
    });
  }

  function tambahItemKelas() {
    state.draft.kelas.push({ Kelas: '', Jenjang: '7', Aktif: true });
    renderEditorKelas();
  }

  async function simpanDaftarKelas() {
    for (var i = 0; i < state.draft.kelas.length; i++) {
      if (!state.draft.kelas[i].Kelas.trim()) {
        tampilkanToast('Nama kelas tidak boleh kosong.');
        return;
      }
    }
    try {
      await panggilApiAdmin('adminSimpanPengaturan', { bagian: 'kelas', data: state.draft.kelas });
      state.data.kelas = JSON.parse(JSON.stringify(state.draft.kelas));
      tampilkanToast('Daftar kelas berhasil disimpan!');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan daftar kelas.');
    }
  }

  // --- Editor Kategori Curhat ---
  function renderEditorKategori() {
    var wadah = document.getElementById('editor-kategori-list');
    wadah.innerHTML = '';

    state.draft.kategori.forEach(function (kat, idx) {
      var card = document.createElement('div');
      card.className = 'item-editor-card';

      var head = document.createElement('div');
      head.className = 'item-editor-head';
      var title = document.createElement('strong');
      title.textContent = 'Kategori #' + (idx + 1) + ' (' + kat.ID + ')';
      head.appendChild(title);
      head.appendChild(buatTombolHapusDuaKlik(function () {
        state.draft.kategori.splice(idx, 1);
        renderEditorKategori();
      }));
      card.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'form-grid-2';
      grid.appendChild(buatFieldInput('Nama Kategori', kat.Nama, function (v) { kat.Nama = v; }));

      var grpBidang = document.createElement('div');
      grpBidang.className = 'form-group';
      var lblB = document.createElement('label');
      lblB.className = 'form-label';
      lblB.textContent = 'Bidang Layanan BK';
      var selB = document.createElement('select');
      selB.className = 'form-control';
      ['pribadi', 'belajar', 'sosial', 'karier', 'perundungan-kekerasan'].forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        if (kat.Bidang === b) opt.selected = true;
        selB.appendChild(opt);
      });
      selB.addEventListener('change', function () { kat.Bidang = selB.value; });
      grpBidang.appendChild(lblB);
      grpBidang.appendChild(selB);
      grid.appendChild(grpBidang);
      card.appendChild(grid);

      card.appendChild(buatFieldInput('Deskripsi Singkat untuk Siswa', kat.Deskripsi, function (v) { kat.Deskripsi = v; }));

      var rowChecks = document.createElement('div');
      rowChecks.style.display = 'flex';
      rowChecks.style.flexWrap = 'wrap';
      rowChecks.style.gap = '1.25rem';
      rowChecks.appendChild(buatFieldCheckbox('Tandai Eskalasi TPPK (Peringatan Khusus)', kat.Eskalasi, function (v) { kat.Eskalasi = v; }));
      rowChecks.appendChild(buatFieldCheckbox('Aktif', kat.Aktif, function (v) { kat.Aktif = v; }));
      card.appendChild(rowChecks);

      wadah.appendChild(card);
    });
  }

  function tambahItemKategori() {
    state.draft.kategori.push({
      ID: 'KAT-' + ('00' + Date.now().toString().slice(-3)).slice(-3),
      Nama: '',
      Bidang: 'pribadi',
      Deskripsi: '',
      Eskalasi: false,
      Aktif: true
    });
    renderEditorKategori();
  }

  async function simpanDaftarKategori() {
    for (var i = 0; i < state.draft.kategori.length; i++) {
      if (!state.draft.kategori[i].Nama.trim()) {
        tampilkanToast('Nama kategori tidak boleh kosong.');
        return;
      }
    }
    try {
      await panggilApiAdmin('adminSimpanPengaturan', { bagian: 'kategori', data: state.draft.kategori });
      state.data.kategori = JSON.parse(JSON.stringify(state.draft.kategori));
      isiOpsiFilterDanLaporan();
      tampilkanToast('Daftar kategori curhat berhasil disimpan!');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan kategori.');
    }
  }

  // --- Editor Layanan BK & FAQ ---
  function renderEditorLayanan() {
    var wadah = document.getElementById('editor-layanan-list');
    wadah.innerHTML = '';

    state.draft.layanan.forEach(function (lay, idx) {
      var card = document.createElement('div');
      card.className = 'item-editor-card';

      var head = document.createElement('div');
      head.className = 'item-editor-head';
      var title = document.createElement('strong');
      title.textContent = 'Layanan #' + (idx + 1);
      head.appendChild(title);
      head.appendChild(buatTombolHapusDuaKlik(function () {
        state.draft.layanan.splice(idx, 1);
        renderEditorLayanan();
      }));
      card.appendChild(head);

      card.appendChild(buatFieldInput('Judul Layanan', lay.Judul, function (v) { lay.Judul = v; }));
      card.appendChild(buatFieldTextarea('Deskripsi Layanan', lay.Deskripsi, function (v) { lay.Deskripsi = v; }));
      card.appendChild(buatFieldCheckbox('Aktif', lay.Aktif, function (v) { lay.Aktif = v; }));

      wadah.appendChild(card);
    });
  }

  function tambahItemLayanan() {
    state.draft.layanan.push({
      ID: 'LAY-' + ('00' + Date.now().toString().slice(-3)).slice(-3),
      Judul: '',
      Deskripsi: '',
      Urutan: state.draft.layanan.length + 1,
      Aktif: true
    });
    renderEditorLayanan();
  }

  async function simpanDaftarLayanan() {
    try {
      await panggilApiAdmin('adminSimpanPengaturan', { bagian: 'layanan', data: state.draft.layanan });
      state.data.layanan = JSON.parse(JSON.stringify(state.draft.layanan));
      tampilkanToast('Daftar layanan BK berhasil disimpan!');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan daftar layanan.');
    }
  }

  function renderEditorFaq() {
    var wadah = document.getElementById('editor-faq-list');
    wadah.innerHTML = '';

    state.draft.faq.forEach(function (f, idx) {
      var card = document.createElement('div');
      card.className = 'item-editor-card';

      var head = document.createElement('div');
      head.className = 'item-editor-head';
      var title = document.createElement('strong');
      title.textContent = 'FAQ #' + (idx + 1);
      head.appendChild(title);
      head.appendChild(buatTombolHapusDuaKlik(function () {
        state.draft.faq.splice(idx, 1);
        renderEditorFaq();
      }));
      card.appendChild(head);

      card.appendChild(buatFieldInput('Pertanyaan', f.Pertanyaan, function (v) { f.Pertanyaan = v; }));
      card.appendChild(buatFieldTextarea('Jawaban', f.Jawaban, function (v) { f.Jawaban = v; }));
      card.appendChild(buatFieldCheckbox('Aktif', f.Aktif, function (v) { f.Aktif = v; }));

      wadah.appendChild(card);
    });
  }

  function tambahItemFaq() {
    state.draft.faq.push({
      ID: 'FAQ-' + ('00' + Date.now().toString().slice(-3)).slice(-3),
      Pertanyaan: '',
      Jawaban: '',
      Urutan: state.draft.faq.length + 1,
      Aktif: true
    });
    renderEditorFaq();
  }

  async function simpanDaftarFaq() {
    try {
      await panggilApiAdmin('adminSimpanPengaturan', { bagian: 'faq', data: state.draft.faq });
      state.data.faq = JSON.parse(JSON.stringify(state.draft.faq));
      tampilkanToast('Daftar FAQ berhasil disimpan!');
    } catch (err) {
      tampilkanToast(err.message || 'Gagal menyimpan FAQ.');
    }
  }

  // ==========================================================================
  // UTILITAS FORM EDITOR & UI
  // ==========================================================================

  function buatFieldInput(labelTeks, nilaiAwal, onChange) {
    var grp = document.createElement('div');
    grp.className = 'form-group';
    var lbl = document.createElement('label');
    lbl.className = 'form-label';
    lbl.textContent = labelTeks;
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-control';
    inp.value = nilaiAwal || '';
    inp.addEventListener('input', function () { onChange(inp.value); });
    grp.appendChild(lbl);
    grp.appendChild(inp);
    return grp;
  }

  function buatFieldTextarea(labelTeks, nilaiAwal, onChange) {
    var grp = document.createElement('div');
    grp.className = 'form-group';
    var lbl = document.createElement('label');
    lbl.className = 'form-label';
    lbl.textContent = labelTeks;
    var ta = document.createElement('textarea');
    ta.className = 'form-control';
    ta.style.minHeight = '76px';
    ta.value = nilaiAwal || '';
    ta.addEventListener('input', function () { onChange(ta.value); });
    grp.appendChild(lbl);
    grp.appendChild(ta);
    return grp;
  }

  function buatFieldCheckbox(labelTeks, nilaiAwal, onChange) {
    var lbl = document.createElement('label');
    lbl.className = 'checkbox-inline';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(nilaiAwal);
    cb.addEventListener('change', function () { onChange(cb.checked); });
    var span = document.createElement('span');
    span.textContent = labelTeks;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    return lbl;
  }

  // Konfirmasi hapus dua langkah tanpa dialog confirm() browser
  function buatTombolHapusDuaKlik(onConfirmDelete) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = 'Hapus';
    var siapHapus = false;
    var timer = null;

    btn.addEventListener('click', function () {
      if (!siapHapus) {
        siapHapus = true;
        btn.className = 'btn btn-danger btn-sm';
        btn.textContent = 'Klik Lagi untuk Hapus';
        timer = setTimeout(function () {
          siapHapus = false;
          btn.className = 'btn btn-ghost btn-sm';
          btn.textContent = 'Hapus';
        }, 3500);
      } else {
        if (timer) clearTimeout(timer);
        onConfirmDelete();
      }
    });
    return btn;
  }

  function formatWaktuSingkat(isoStr) {
    if (!isoStr) return '-';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  var timerToast = null;
  function tampilkanToast(pesan) {
    var el = document.getElementById('toast-notification');
    if (!el) return;
    el.textContent = pesan;
    el.classList.remove('hidden');
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(function () {
      el.classList.add('hidden');
    }, 3600);
  }
})();
