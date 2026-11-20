/**
 * Logika Aplikasi Siswa - Portal Bimbingan & Konseling SMP
 * Tanpa framework, tanpa pelacakan identitas/IP, proteksi XSS penuh.
 */
(function () {
  'use strict';

  var KATA_KUNCI_BAHAYA_LOKAL = [
    'bunuh diri',
    'mengakhiri hidup',
    'ingin mati',
    'pengen mati',
    'mau mati',
    'menyakiti diri',
    'nyakitin diri',
    'lukai diri',
    'melukai diri',
    'sayat tangan',
    'silet tangan',
    'overdosis',
    'dipukul',
    'dipukuli',
    'disiksa',
    'dilecehkan',
    'pelecehan',
    'diperkosa',
    'pencabulan',
    'diancam dibunuh',
    'takut pulang'
  ];

  var state = {
    publicData: null,
    activeView: 'beranda',
    stepIndex: 0,
    waktuMulaiForm: 0,
    terakhirKodeTiket: '',
    form: {
      anonim: null,        // true | false
      jenjang: '',         // '7' | '8' | '9'
      kelas: '',
      nama: '',
      kategoriId: '',
      urgensi: 'Sedang',
      guruTujuanId: 'SEMUA',
      pesan: '',
      preferensiBalasan: 'Website'
    }
  };

  // ==========================================================================
  // INISIALISASI & KOMUNIKASI API
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', function () {
    ikatEventUtama();
    muatDataPublik();
  });

  function ikatEventUtama() {
    // Tombol Keluar Cepat (langsung alihkan ke situs netral)
    var btnQuickExit = document.getElementById('btn-quick-exit');
    if (btnQuickExit) {
      btnQuickExit.addEventListener('click', function () {
        try {
          window.sessionStorage.clear();
        } catch (e) {
          // Abaikan jika penyimpanan dibatasi browser
        }
        window.location.replace('https://www.google.com');
      });
    }

    // Navigasi antar tampilan
    document.addEventListener('click', function (e) {
      var targetNav = e.target.closest('[data-nav]');
      if (targetNav) {
        e.preventDefault();
        var tujuan = targetNav.getAttribute('data-nav');
        gantiTampilan(tujuan);
      }
    });

    // Tombol Muat Ulang saat galat
    var btnRetry = document.getElementById('btn-retry-init');
    if (btnRetry) {
      btnRetry.addEventListener('click', muatDataPublik);
    }

    // Navigasi Wizard Form Curhat
    document.getElementById('btn-step-prev').addEventListener('click', langkahSebelumnya);
    document.getElementById('btn-step-next').addEventListener('click', langkahBerikutnya);

    // Salin Kode Tiket
    document.getElementById('btn-copy-ticket').addEventListener('click', function () {
      salinTeks(state.terakhirKodeTiket);
    });

    document.getElementById('btn-go-check').addEventListener('click', function () {
      var inputTiket = document.getElementById('input-kode-tiket');
      if (inputTiket && state.terakhirKodeTiket) {
        inputTiket.value = state.terakhirKodeTiket;
      }
      gantiTampilan('cek');
    });

    document.getElementById('btn-new-curhat').addEventListener('click', function () {
      resetFormCurhat();
      renderLangkahWizard();
    });

    // Form Cek Balasan
    document.getElementById('form-cek-tiket').addEventListener('submit', tanganiCekBalasan);
  }

  async function panggilApi(action, payload) {
    var url = (window.BK_CONFIG && window.BK_CONFIG.WEB_APP_URL) ? window.BK_CONFIG.WEB_APP_URL.trim() : '';
    if (!url || url.indexOf('GANTI_DENGAN_ID_DEPLOYMENT_ANDA') !== -1) {
      throw new Error('URL Web App belum diatur pada berkas js/config.js.');
    }

    var respons = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: action,
        token: '',
        payload: payload || {}
      })
    });

    if (!respons.ok) {
      throw new Error('Server merespons dengan status ' + respons.status + '.');
    }

    var json = await respons.json();
    if (!json || json.ok !== true) {
      throw new Error((json && json.error) ? json.error : 'Permintaan tidak dapat diproses.');
    }

    return json.data;
  }

  async function muatDataPublik() {
    tampilkanElemen('app-loading', true);
    tampilkanElemen('app-error', false);

    try {
      var data = await panggilApi('getPublicData', {});
      state.publicData = data;

      terapkanIdentitasDanTema(data.pengaturan || {});
      renderBeranda();
      renderDaftarGuru();
      renderLayananDanFaq();
      renderHalamanPrivasi();

      tampilkanElemen('app-loading', false);
      gantiTampilan('beranda');
    } catch (err) {
      tampilkanElemen('app-loading', false);
      document.getElementById('app-error-msg').textContent = err.message || 'Gagal memuat data layanan BK.';
      tampilkanElemen('app-error', true);
    }
  }

  // ==========================================================================
  // PENGATURAN TEMA, IDENTITAS, & NAVIGASI TAMPILAN
  // ==========================================================================

  function terapkanIdentitasDanTema(pengaturan) {
    var tema = pengaturan.temaWarna || 'teal-hangat';
    document.documentElement.setAttribute('data-theme', tema);

    var namaSingkat = pengaturan.namaSingkat || pengaturan.namaSekolah || 'Ruang BK SMP';
    var namaSekolah = pengaturan.namaSekolah || 'SMP';

    document.title = namaSingkat + ' - Layanan Bimbingan & Konseling';
    document.getElementById('header-title').textContent = namaSingkat;
    document.getElementById('header-subtitle').textContent = namaSekolah;

    if (pengaturan.logo && pengaturan.logo.indexOf('data:image/') === 0) {
      var logoBox = document.getElementById('brand-logo');
      logoBox.innerHTML = '';
      var img = document.createElement('img');
      img.src = pengaturan.logo;
      img.alt = 'Logo ' + namaSekolah;
      logoBox.appendChild(img);
    }

    var footerParts = [namaSekolah];
    if (pengaturan.alamat) footerParts.push(pengaturan.alamat);
    if (pengaturan.kontakSekolah) footerParts.push(pengaturan.kontakSekolah);
    document.getElementById('footer-school-info').textContent = footerParts.join(' • ');
  }

  function gantiTampilan(namaView) {
    if (!state.publicData) return;

    var daftarView = ['beranda', 'curhat', 'cek', 'guru', 'layanan', 'privasi'];
    if (daftarView.indexOf(namaView) === -1) {
      namaView = 'beranda';
    }

    state.activeView = namaView;

    for (var i = 0; i < daftarView.length; i++) {
      var idSec = 'view-' + daftarView[i];
      tampilkanElemen(idSec, daftarView[i] === namaView);
    }

    var navBtns = document.querySelectorAll('.nav-btn');
    for (var j = 0; j < navBtns.length; j++) {
      var cocok = navBtns[j].getAttribute('data-nav') === namaView;
      if (cocok) {
        navBtns[j].setAttribute('aria-current', 'page');
      } else {
        navBtns[j].removeAttribute('aria-current');
      }
    }

    if (namaView === 'curhat') {
      if (state.waktuMulaiForm === 0) {
        resetFormCurhat();
      }
      renderLangkahWizard();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // RENDER HALAMAN INFORMASI (BERANDA, GURU, LAYANAN/FAQ, PRIVASI)
  // ==========================================================================

  function renderBeranda() {
    var peng = state.publicData.pengaturan || {};
    var layanan = state.publicData.layanan || [];

    var bannerEl = document.getElementById('home-banner');
    if (peng.banner && peng.banner.indexOf('data:image/') === 0) {
      bannerEl.src = peng.banner;
      bannerEl.classList.remove('hidden');
    } else {
      bannerEl.classList.add('hidden');
    }

    var periode = [];
    if (peng.tahunAjaranAktif) periode.push('TA ' + peng.tahunAjaranAktif);
    if (peng.semesterAktif) periode.push('Semester ' + peng.semesterAktif);
    document.getElementById('home-period-badge').textContent =
      periode.length > 0 ? ('Ruang Aman Siswa • ' + periode.join(' ')) : 'Ruang Aman Siswa';

    document.getElementById('home-school-name').textContent =
      'Selamat Datang di ' + (peng.namaSingkat || peng.namaSekolah || 'Ruang BK');

    document.getElementById('home-welcome-text').textContent =
      peng.teksSambutan || 'Ruang BK hadir untuk mendengarkan ceritamu dengan aman, nyaman, dan tanpa menghakimi.';

    var jamEl = document.getElementById('home-service-hours');
    if (peng.jamLayanan) {
      jamEl.textContent = 'Jam Layanan Ruang BK: ' + peng.jamLayanan;
      jamEl.classList.remove('hidden');
    } else {
      jamEl.classList.add('hidden');
    }

    var grid = document.getElementById('home-services-grid');
    grid.innerHTML = '';
    if (layanan.length === 0) {
      grid.innerHTML = '<div class="empty-state">Informasi layanan belum ditambahkan.</div>';
      return;
    }

    for (var i = 0; i < layanan.length; i++) {
      var item = document.createElement('article');
      item.className = 'service-item';

      var h3 = document.createElement('h3');
      h3.textContent = layanan[i].judul;

      var p = document.createElement('p');
      p.textContent = layanan[i].deskripsi;

      item.appendChild(h3);
      item.appendChild(p);
      grid.appendChild(item);
    }
  }

  function renderDaftarGuru() {
    var daftar = state.publicData.guru || [];
    var container = document.getElementById('guru-list');
    container.innerHTML = '';

    if (daftar.length === 0) {
      container.innerHTML = '<div class="card empty-state">Data Guru BK belum tersedia.</div>';
      return;
    }

    for (var i = 0; i < daftar.length; i++) {
      var g = daftar[i];
      var card = document.createElement('article');
      card.className = 'teacher-card';

      var avatar = document.createElement('div');
      avatar.className = 'teacher-avatar';
      if (g.foto && g.foto.indexOf('data:image/') === 0) {
        var img = document.createElement('img');
        img.src = g.foto;
        img.alt = 'Foto ' + g.nama;
        avatar.appendChild(img);
      } else {
        avatar.textContent = ambilInisial(g.nama);
      }

      var info = document.createElement('div');
      info.className = 'teacher-info';

      var h3 = document.createElement('h3');
      h3.textContent = g.nama;

      var role = document.createElement('div');
      role.className = 'teacher-role';
      var teksJenjang = g.jenjang ? (' • Kelas ' + g.jenjang) : '';
      role.textContent = (g.jabatan || 'Guru BK') + teksJenjang;

      var bio = document.createElement('p');
      bio.className = 'teacher-bio';
      bio.textContent = g.bio || 'Siap mendampingi dan mendengarkan cerita siswa.';

      info.appendChild(h3);
      info.appendChild(role);
      info.appendChild(bio);

      if (g.kontak) {
        var kontak = document.createElement('div');
        kontak.className = 'teacher-contact';
        kontak.textContent = 'Lokasi / Kontak: ' + g.kontak;
        info.appendChild(kontak);
      }

      card.appendChild(avatar);
      card.appendChild(info);
      container.appendChild(card);
    }
  }

  function renderLayananDanFaq() {
    var layanan = state.publicData.layanan || [];
    var faq = state.publicData.faq || [];

    var layananContainer = document.getElementById('layanan-list');
    layananContainer.innerHTML = '';
    if (layanan.length === 0) {
      layananContainer.innerHTML = '<div class="card empty-state">Belum ada daftar layanan.</div>';
    } else {
      for (var i = 0; i < layanan.length; i++) {
        var card = document.createElement('article');
        card.className = 'service-item';
        var h3 = document.createElement('h3');
        h3.textContent = layanan[i].judul;
        var p = document.createElement('p');
        p.textContent = layanan[i].deskripsi;
        card.appendChild(h3);
        card.appendChild(p);
        layananContainer.appendChild(card);
      }
    }

    var faqContainer = document.getElementById('faq-list');
    faqContainer.innerHTML = '';
    if (faq.length === 0) {
      faqContainer.innerHTML = '<div class="card empty-state">Belum ada pertanyaan umum (FAQ).</div>';
    } else {
      for (var j = 0; j < faq.length; j++) {
        var details = document.createElement('details');
        details.className = 'faq-item';
        if (j === 0) details.open = true;

        var summary = document.createElement('summary');
        summary.textContent = faq[j].pertanyaan;

        var ans = document.createElement('div');
        ans.className = 'faq-answer';
        ans.textContent = faq[j].jawaban;

        details.appendChild(summary);
        details.appendChild(ans);
        faqContainer.appendChild(details);
      }
    }
  }

  function renderHalamanPrivasi() {
    var peng = state.publicData.pengaturan || {};
    document.getElementById('privasi-content').textContent =
      peng.kebijakanPrivasi || 'Kerahasiaan cerita siswa dijaga oleh Guru BK sesuai kode etik profesi.';
    document.getElementById('privasi-emergency').textContent =
      peng.kontakDarurat || 'Hubungi Guru BK atau orang dewasa tepercaya di sekitarmu.';
  }

  // ==========================================================================
  // FORM CURHAT BERTAHAP (WIZARD SATU LANGKAH PER LAYAR)
  // ==========================================================================

  function resetFormCurhat() {
    state.stepIndex = 0;
    state.waktuMulaiForm = Date.now();
    state.form = {
      anonim: null,
      jenjang: '',
      kelas: '',
      nama: '',
      kategoriId: '',
      urgensi: 'Sedang',
      guruTujuanId: 'SEMUA',
      pesan: '',
      preferensiBalasan: 'Website'
    };
    document.getElementById('hp-website').value = '';
    tampilkanElemen('curhat-wizard-card', true);
    tampilkanElemen('curhat-success-card', false);
    sembunyikanGalatWizard();
  }

  function dapatkanDaftarLangkah() {
    var langkah = [
      'identitas',
      'jenjang'
    ];
    if (state.form.anonim === false) {
      langkah.push('dataDiri');
    }
    langkah.push('kategori');
    langkah.push('urgensi');
    langkah.push('guru');
    langkah.push('pesan');
    langkah.push('preferensi');
    langkah.push('ringkasan');
    return langkah;
  }

  function renderLangkahWizard() {
    var langkahList = dapatkanDaftarLangkah();
    if (state.stepIndex >= langkahList.length) {
      state.stepIndex = langkahList.length - 1;
    }

    var kodeLangkah = langkahList[state.stepIndex];
    var total = langkahList.length;
    var nomor = state.stepIndex + 1;
    var persen = Math.round((nomor / total) * 100);

    document.getElementById('wizard-step-label').textContent = 'Langkah ' + nomor + ' dari ' + total;
    document.getElementById('wizard-step-percent').textContent = persen + '%';
    document.getElementById('wizard-progress-fill').style.width = persen + '%';
    document.getElementById('wizard-progressbar').setAttribute('aria-valuenow', String(persen));

    var btnPrev = document.getElementById('btn-step-prev');
    var btnNext = document.getElementById('btn-step-next');

    btnPrev.style.visibility = state.stepIndex === 0 ? 'hidden' : 'visible';
    if (kodeLangkah === 'ringkasan') {
      btnNext.textContent = 'Kirim Ceritaku Sekarang';
    } else {
      btnNext.textContent = 'Lanjut';
    }

    var wadah = document.getElementById('wizard-step-container');
    wadah.innerHTML = '';

    if (kodeLangkah === 'identitas') {
      renderLangkahIdentitas(wadah);
    } else if (kodeLangkah === 'jenjang') {
      renderLangkahJenjang(wadah);
    } else if (kodeLangkah === 'dataDiri') {
      renderLangkahDataDiri(wadah);
    } else if (kodeLangkah === 'kategori') {
      renderLangkahKategori(wadah);
    } else if (kodeLangkah === 'urgensi') {
      renderLangkahUrgensi(wadah);
    } else if (kodeLangkah === 'guru') {
      renderLangkahGuru(wadah);
    } else if (kodeLangkah === 'pesan') {
      renderLangkahPesan(wadah);
    } else if (kodeLangkah === 'preferensi') {
      renderLangkahPreferensi(wadah);
    } else if (kodeLangkah === 'ringkasan') {
      renderLangkahRingkasan(wadah);
    }
  }

  function renderLangkahIdentitas(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Bagaimana kamu ingin mengirim cerita?',
      'Kamu bebas memilih. Keduanya akan dilayani dengan sepenuh hati oleh Guru BK.'
    ));

    var list = document.createElement('div');
    list.className = 'choice-list';

    list.appendChild(buatKartuPilihan(
      state.form.anonim === true,
      'Anonim (Tanpa Nama & Kelas)',
      'Identitasmu tidak ditanyakan. Kamu akan mendapat Kode Tiket rahasia untuk membaca balasan.',
      function () {
        state.form.anonim = true;
        state.form.kelas = '';
        state.form.nama = '';
        sembunyikanGalatWizard();
        renderLangkahWizard();
      }
    ));

    list.appendChild(buatKartuPilihan(
      state.form.anonim === false,
      'Sertakan Identitas (Nama & Kelas)',
      'Memudahkan Guru BK mengenalimu atau mengajak berdiskusi langsung di sekolah.',
      function () {
        state.form.anonim = false;
        sembunyikanGalatWizard();
        renderLangkahWizard();
      }
    ));

    wadah.appendChild(list);
  }

  function renderLangkahJenjang(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Kamu duduk di kelas berapa?',
      'Informasi jenjang diperlukan untuk semua kiriman agar Guru BK dapat menyesuaikan pendampingan.'
    ));

    var grid = document.createElement('div');
    grid.className = 'grade-grid';

    var daftarJenjang = ['7', '8', '9'];
    for (var i = 0; i < daftarJenjang.length; i++) {
      (function (j) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'grade-btn' + (state.form.jenjang === j ? ' selected' : '');
        btn.setAttribute('aria-pressed', state.form.jenjang === j ? 'true' : 'false');
        btn.innerHTML = 'Kelas ' + j + '<span>Jenjang SMP</span>';
        btn.addEventListener('click', function () {
          if (state.form.jenjang !== j) {
            state.form.kelas = '';
          }
          state.form.jenjang = j;
          sembunyikanGalatWizard();
          renderLangkahWizard();
        });
        grid.appendChild(btn);
      })(daftarJenjang[i]);
    }

    wadah.appendChild(grid);
  }

  function renderLangkahDataDiri(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Isi Kelas dan Nama Lengkapmu',
      'Data ini hanya dilihat oleh Guru BK dan tidak dipublikasikan ke siapa pun.'
    ));

    var daftarKelas = (state.publicData.kelas || []).filter(function (k) {
      return String(k.jenjang) === String(state.form.jenjang);
    });

    var grpKelas = document.createElement('div');
    grpKelas.className = 'form-group';
    var lblKelas = document.createElement('label');
    lblKelas.className = 'form-label';
    lblKelas.setAttribute('for', 'field-kelas');
    lblKelas.textContent = 'Pilih Kelas (Jenjang ' + state.form.jenjang + ')';
    grpKelas.appendChild(lblKelas);

    if (daftarKelas.length > 0) {
      var sel = document.createElement('select');
      sel.id = 'field-kelas';
      sel.className = 'form-control';

      var optDefault = document.createElement('option');
      optDefault.value = '';
      optDefault.textContent = '-- Pilih kelasmu --';
      sel.appendChild(optDefault);

      for (var i = 0; i < daftarKelas.length; i++) {
        var opt = document.createElement('option');
        opt.value = daftarKelas[i].kelas;
        opt.textContent = daftarKelas[i].kelas;
        if (state.form.kelas === daftarKelas[i].kelas) {
          opt.selected = true;
        }
        sel.appendChild(opt);
      }

      sel.addEventListener('change', function () {
        state.form.kelas = sel.value;
        sembunyikanGalatWizard();
      });
      grpKelas.appendChild(sel);
    } else {
      var inpKelas = document.createElement('input');
      inpKelas.type = 'text';
      inpKelas.id = 'field-kelas';
      inpKelas.className = 'form-control';
      inpKelas.maxLength = 20;
      inpKelas.placeholder = 'Contoh: ' + state.form.jenjang + 'A';
      inpKelas.value = state.form.kelas;
      inpKelas.addEventListener('input', function () {
        state.form.kelas = inpKelas.value;
        sembunyikanGalatWizard();
      });
      grpKelas.appendChild(inpKelas);
    }

    var grpNama = document.createElement('div');
    grpNama.className = 'form-group';
    var lblNama = document.createElement('label');
    lblNama.className = 'form-label';
    lblNama.setAttribute('for', 'field-nama');
    lblNama.textContent = 'Nama Lengkap';
    var inpNama = document.createElement('input');
    inpNama.type = 'text';
    inpNama.id = 'field-nama';
    inpNama.className = 'form-control';
    inpNama.maxLength = 80;
    inpNama.placeholder = 'Tuliskan nama lengkapmu';
    inpNama.value = state.form.nama;
    inpNama.addEventListener('input', function () {
      state.form.nama = inpNama.value;
      sembunyikanGalatWizard();
    });
    grpNama.appendChild(lblNama);
    grpNama.appendChild(inpNama);

    wadah.appendChild(grpKelas);
    wadah.appendChild(grpNama);
  }

  function renderLangkahKategori(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Topik apa yang ingin kamu ceritakan?',
      'Pilih kategori yang paling mendekati perasaan atau situasimu saat ini.'
    ));

    var daftarKat = state.publicData.kategori || [];
    var list = document.createElement('div');
    list.className = 'choice-list';

    for (var i = 0; i < daftarKat.length; i++) {
      (function (kat) {
        var terpilih = state.form.kategoriId === kat.id;
        list.appendChild(buatKartuPilihan(
          terpilih,
          kat.nama,
          kat.deskripsi,
          function () {
            state.form.kategoriId = kat.id;
            sembunyikanGalatWizard();
            renderLangkahWizard();
          }
        ));
      })(daftarKat[i]);
    }

    wadah.appendChild(list);
  }

  function renderLangkahUrgensi(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Seberapa mendesak hal ini bagimu?',
      'Ini membantu Guru BK mengatur prioritas pendampingan.'
    ));

    var opsi = [
      {
        nilai: 'Rendah',
        judul: 'Santai / Berbagi Cerita',
        sub: 'Tidak terburu-buru, hanya ingin bercerita atau meminta pandangan.'
      },
      {
        nilai: 'Sedang',
        judul: 'Cukup Mengganggu Pikiran',
        sub: 'Membuat tidak nyaman dan berharap segera mendapat saran dari Guru BK.'
      },
      {
        nilai: 'Tinggi',
        judul: 'Sangat Mendesak / Butuh Bantuan Cepat',
        sub: 'Situasi berat, mengancam keselamatan, atau membutuhkan perhatian segera.'
      }
    ];

    var list = document.createElement('div');
    list.className = 'choice-list';

    for (var i = 0; i < opsi.length; i++) {
      (function (item) {
        list.appendChild(buatKartuPilihan(
          state.form.urgensi === item.nilai,
          item.judul,
          item.sub,
          function () {
            state.form.urgensi = item.nilai;
            sembunyikanGalatWizard();
            renderLangkahWizard();
          }
        ));
      })(opsi[i]);
    }

    wadah.appendChild(list);
  }

  function renderLangkahGuru(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Kepada Guru BK siapa cerita ini ditujukan?',
      'Kamu bisa memilih Guru BK tertentu atau memilih "Siapa saja".'
    ));

    var list = document.createElement('div');
    list.className = 'choice-list';

    list.appendChild(buatKartuPilihan(
      state.form.guruTujuanId === 'SEMUA',
      'Siapa saja (Guru BK yang tersedia)',
      'Ceritamu akan ditangani oleh Guru BK yang bertugas.',
      function () {
        state.form.guruTujuanId = 'SEMUA';
        sembunyikanGalatWizard();
        renderLangkahWizard();
      }
    ));

    var daftarGuru = state.publicData.guru || [];
    for (var i = 0; i < daftarGuru.length; i++) {
      (function (g) {
        var subTeks = g.jabatan || 'Guru BK';
        if (g.jenjang && String(g.jenjang).indexOf(state.form.jenjang) !== -1) {
          subTeks += ' • Mengampu Kelas ' + state.form.jenjang;
        }
        list.appendChild(buatKartuPilihan(
          state.form.guruTujuanId === g.id,
          g.nama,
          subTeks,
          function () {
            state.form.guruTujuanId = g.id;
            sembunyikanGalatWizard();
            renderLangkahWizard();
          }
        ));
      })(daftarGuru[i]);
    }

    wadah.appendChild(list);
  }

  function renderLangkahPesan(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Tuliskan ceritamu di sini',
      'Ceritakan apa yang kamu rasakan atau alami dengan bahasamu sendiri. Tidak perlu takut salah kata.'
    ));

    // Kotak dukungan hangat jika terdeteksi kata kunci sensitif
    var kotakDukungan = document.createElement('div');
    kotakDukungan.id = 'live-support-banner';
    kotakDukungan.className = 'alert-box alert-support hidden';
    kotakDukungan.setAttribute('role', 'status');

    var h4 = document.createElement('h4');
    h4.textContent = 'Kami Peduli padamu';
    var p = document.createElement('p');
    p.style.margin = '0 0 0.5rem';
    p.textContent = 'Sepertinya kamu sedang menghadapi hal yang sangat berat. Kamu tetap bisa mengirim pesan ini (akan kami tandai sebagai prioritas tinggi), atau hubungi bantuan segera di bawah ini:';
    var numBox = document.createElement('div');
    numBox.className = 'emergency-numbers';
    numBox.textContent = (state.publicData.pengaturan && state.publicData.pengaturan.kontakDarurat) || '';

    kotakDukungan.appendChild(h4);
    kotakDukungan.appendChild(p);
    kotakDukungan.appendChild(numBox);
    wadah.appendChild(kotakDukungan);

    var grp = document.createElement('div');
    grp.className = 'form-group';

    var lbl = document.createElement('label');
    lbl.className = 'form-label';
    lbl.setAttribute('for', 'field-pesan');
    lbl.textContent = 'Isi Cerita / Pesan (Minimal 10 karakter)';

    var ta = document.createElement('textarea');
    ta.id = 'field-pesan';
    ta.className = 'form-control';
    ta.maxLength = 3000;
    ta.placeholder = 'Halo Bapak/Ibu Guru BK, akhir-akhir ini aku merasa...';
    ta.value = state.form.pesan;

    var counter = document.createElement('div');
    counter.className = 'char-counter';
    counter.textContent = state.form.pesan.length + ' / 3000 karakter';

    function cekKataBahayaLokal(teks) {
      var kecil = teks.toLowerCase();
      var ketemu = false;
      for (var i = 0; i < KATA_KUNCI_BAHAYA_LOKAL.length; i++) {
        if (kecil.indexOf(KATA_KUNCI_BAHAYA_LOKAL[i]) !== -1) {
          ketemu = true;
          break;
        }
      }
      if (ketemu) {
        kotakDukungan.classList.remove('hidden');
      } else {
        kotakDukungan.classList.add('hidden');
      }
    }

    cekKataBahayaLokal(state.form.pesan);

    ta.addEventListener('input', function () {
      state.form.pesan = ta.value;
      counter.textContent = ta.value.length + ' / 3000 karakter';
      sembunyikanGalatWizard();
      cekKataBahayaLokal(ta.value);
    });

    grp.appendChild(lbl);
    grp.appendChild(ta);
    grp.appendChild(counter);
    wadah.appendChild(grp);
  }

  function renderLangkahPreferensi(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Bagaimana kamu ingin ditanggapi?',
      'Pilih cara komunikasi yang paling membuatmu merasa nyaman.'
    ));

    var list = document.createElement('div');
    list.className = 'choice-list';

    list.appendChild(buatKartuPilihan(
      state.form.preferensiBalasan === 'Website',
      'Dibalas lewat website ini',
      'Guru BK akan menulis balasan yang bisa kamu baca memakai Kode Tiket.',
      function () {
        state.form.preferensiBalasan = 'Website';
        sembunyikanGalatWizard();
        renderLangkahWizard();
      }
    ));

    list.appendChild(buatKartuPilihan(
      state.form.preferensiBalasan === 'Bertemu Langsung',
      'Bertemu langsung dengan Guru BK',
      'Kamu ingin menjadwalkan obrolan tatap muka di Ruang BK sekolah.',
      function () {
        state.form.preferensiBalasan = 'Bertemu Langsung';
        sembunyikanGalatWizard();
        renderLangkahWizard();
      }
    ));

    wadah.appendChild(list);
  }

  function renderLangkahRingkasan(wadah) {
    wadah.appendChild(buatJudulLangkah(
      'Periksa Kembali Kirimanmu',
      'Pastikan semua sudah sesuai sebelum dikirim ke Guru BK.'
    ));

    var kategoriNama = '-';
    var daftarKat = state.publicData.kategori || [];
    for (var i = 0; i < daftarKat.length; i++) {
      if (daftarKat[i].id === state.form.kategoriId) {
        kategoriNama = daftarKat[i].nama;
        break;
      }
    }

    var guruNama = 'Siapa saja (Guru BK yang tersedia)';
    if (state.form.guruTujuanId && state.form.guruTujuanId !== 'SEMUA') {
      var daftarGuru = state.publicData.guru || [];
      for (var j = 0; j < daftarGuru.length; j++) {
        if (daftarGuru[j].id === state.form.guruTujuanId) {
          guruNama = daftarGuru[j].nama;
          break;
        }
      }
    }

    var teksIdentitas = state.form.anonim
      ? ('Anonim (Kelas ' + state.form.jenjang + ')')
      : (state.form.nama + ' (Kelas ' + state.form.kelas + ')');

    var labelUrgensi = {
      Rendah: 'Santai / Berbagi Cerita',
      Sedang: 'Cukup Mengganggu Pikiran',
      Tinggi: 'Sangat Mendesak / Butuh Bantuan Cepat'
    }[state.form.urgensi] || state.form.urgensi;

    var labelPref = state.form.preferensiBalasan === 'Website'
      ? 'Dibalas lewat website ini'
      : 'Bertemu langsung dengan Guru BK';

    var box = document.createElement('div');
    box.className = 'summary-list';

    var baris = [
      ['Identitas', teksIdentitas],
      ['Topik Cerita', kategoriNama],
      ['Tingkat Urgensi', labelUrgensi],
      ['Guru Tujuan', guruNama],
      ['Preferensi Tanggapan', labelPref],
      ['Isi Cerita', state.form.pesan]
    ];

    for (var k = 0; k < baris.length; k++) {
      var row = document.createElement('div');
      row.className = 'summary-row';

      var keyEl = document.createElement('span');
      keyEl.className = 'summary-key';
      keyEl.textContent = baris[k][0];

      var valEl = document.createElement('span');
      valEl.className = 'summary-val';
      valEl.textContent = baris[k][1];

      row.appendChild(keyEl);
      row.appendChild(valEl);
      box.appendChild(row);
    }

    wadah.appendChild(box);

    // Penjelasan jujur dekat tombol kirim sesuai spesifikasi
    var jujurBox = document.createElement('div');
    jujurBox.className = 'alert-box alert-info';
    jujurBox.innerHTML =
      '<strong>Catatan Kejujuran &amp; Kerahasiaan:</strong> Pesanmu akan diterima oleh Admin/Koordinator BK dan dapat diteruskan kepada Guru BK yang kamu pilih. Kerahasiaan ceritamu dijaga dengan sungguh-sungguh, tetapi ada batasnya apabila ditemukan bahaya serius bagi keselamatan dirimu atau orang lain, maupun tindak kekerasan terhadap anak.';

    wadah.appendChild(jujurBox);
  }

  function validasiLangkahSaatIni() {
    var langkahList = dapatkanDaftarLangkah();
    var kode = langkahList[state.stepIndex];

    if (kode === 'identitas' && state.form.anonim === null) {
      return 'Pilih terlebih dahulu apakah kamu ingin mengirim secara Anonim atau menyertakan identitas.';
    }
    if (kode === 'jenjang' && !state.form.jenjang) {
      return 'Pilih jenjang kelasmu (Kelas 7, 8, atau 9) terlebih dahulu.';
    }
    if (kode === 'dataDiri') {
      if (!state.form.kelas.trim()) {
        return 'Pilih atau tuliskan kelasmu terlebih dahulu.';
      }
      if (state.form.nama.trim().length < 2) {
        return 'Tuliskan nama lengkapmu minimal 2 karakter.';
      }
    }
    if (kode === 'kategori' && !state.form.kategoriId) {
      return 'Pilih topik cerita yang paling sesuai terlebih dahulu.';
    }
    if (kode === 'urgensi' && !state.form.urgensi) {
      return 'Pilih tingkat urgensi terlebih dahulu.';
    }
    if (kode === 'pesan' && state.form.pesan.trim().length < 10) {
      return 'Tuliskan ceritamu minimal 10 karakter agar Guru BK dapat memahaminya.';
    }
    if (kode === 'preferensi' && !state.form.preferensiBalasan) {
      return 'Pilih cara tanggapan yang kamu inginkan.';
    }
    return '';
  }

  function langkahSebelumnya() {
    if (state.stepIndex > 0) {
      sembunyikanGalatWizard();
      state.stepIndex--;
      renderLangkahWizard();
    }
  }

  async function langkahBerikutnya() {
    var galat = validasiLangkahSaatIni();
    if (galat) {
      tampilkanGalatWizard(galat);
      return;
    }

    sembunyikanGalatWizard();
    var langkahList = dapatkanDaftarLangkah();
    if (state.stepIndex < langkahList.length - 1) {
      state.stepIndex++;
      renderLangkahWizard();
      return;
    }

    // Langkah terakhir: Kirim ke Server
    await kirimCeritaKeServer();
  }

  async function kirimCeritaKeServer() {
    var btnNext = document.getElementById('btn-step-next');
    var btnPrev = document.getElementById('btn-step-prev');
    btnNext.disabled = true;
    btnPrev.disabled = true;
    btnNext.textContent = 'Sedang Mengirim...';

    try {
      var payload = {
        anonim: state.form.anonim === true,
        jenjang: state.form.jenjang,
        kelas: state.form.anonim === false ? state.form.kelas.trim() : '',
        nama: state.form.anonim === false ? state.form.nama.trim() : '',
        kategoriId: state.form.kategoriId,
        urgensi: state.form.urgensi,
        guruTujuanId: state.form.guruTujuanId,
        pesan: state.form.pesan.trim(),
        preferensiBalasan: state.form.preferensiBalasan,
        website: document.getElementById('hp-website').value,
        waktuMulai: state.waktuMulaiForm
      };

      var hasil = await panggilApi('kirimCurhat', payload);
      state.terakhirKodeTiket = hasil.kodeTiket || '';

      document.getElementById('result-ticket-code').textContent = state.terakhirKodeTiket;

      var emergencyBox = document.getElementById('success-emergency-box');
      if (hasil.terdeteksiBahaya) {
        document.getElementById('success-emergency-contacts').textContent =
          hasil.kontakDarurat || ((state.publicData.pengaturan && state.publicData.pengaturan.kontakDarurat) || '');
        emergencyBox.classList.remove('hidden');
      } else {
        emergencyBox.classList.add('hidden');
      }

      tampilkanElemen('curhat-wizard-card', false);
      tampilkanElemen('curhat-success-card', true);
      state.waktuMulaiForm = 0;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      tampilkanGalatWizard(err.message || 'Gagal mengirim cerita. Silakan coba lagi.');
    } finally {
      btnNext.disabled = false;
      btnPrev.disabled = false;
      btnNext.textContent = 'Kirim Ceritaku Sekarang';
    }
  }

  // ==========================================================================
  // CEK BALASAN GURU BK
  // ==========================================================================

  async function tanganiCekBalasan(e) {
    e.preventDefault();

    var input = document.getElementById('input-kode-tiket');
    var errBox = document.getElementById('cek-error-box');
    var btn = document.getElementById('btn-submit-cek');

    var kodeBersih = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    errBox.classList.add('hidden');

    if (kodeBersih.length !== 10) {
      errBox.textContent = 'Kode tiket harus terdiri dari 10 karakter huruf dan angka.';
      errBox.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memeriksa Kode...';

    try {
      var data = await panggilApi('cekBalasan', { kodeTiket: kodeBersih });
      renderHasilCekBalasan(data);
    } catch (err) {
      tampilkanElemen('cek-result-card', false);
      errBox.textContent = err.message || 'Kode tiket tidak ditemukan.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lihat Status & Balasan';
    }
  }

  function renderHasilCekBalasan(data) {
    var statusMap = {
      Baru: { label: 'Menunggu Dibaca', cls: 'badge-baru', desc: 'Pesanmu sudah masuk ke sistem BK dan menunggu dibaca oleh Guru BK.' },
      Dibaca: { label: 'Sudah Dibaca', cls: 'badge-dibaca', desc: 'Guru BK sudah membaca ceritamu dan sedang menyiapkan tanggapan.' },
      Ditangani: { label: 'Sedang Ditangani', cls: 'badge-ditangani', desc: 'Guru BK sedang menindaklanjuti atau membalas ceritamu.' },
      Selesai: { label: 'Selesai', cls: 'badge-selesai', desc: 'Sesi pendampingan untuk tiket ini telah ditandai selesai.' },
      Dirujuk: { label: 'Diteruskan / Dirujuk', cls: 'badge-dirujuk', desc: 'Ceritamu telah diteruskan kepada guru/pihak pendamping yang tepat.' }
    };

    var infoStatus = statusMap[data.status] || { label: data.status, cls: 'badge-baru', desc: '' };
    var badge = document.getElementById('cek-status-badge');
    badge.className = 'badge ' + infoStatus.cls;
    badge.textContent = infoStatus.label;

    document.getElementById('cek-status-desc').textContent = infoStatus.desc;
    document.getElementById('cek-waktu').textContent = formatWaktuIndonesia(data.waktu);
    document.getElementById('cek-topik-guru').textContent = data.kategoriNama + ' • Tujuan: ' + data.guruTujuanNama;
    document.getElementById('cek-preferensi').textContent =
      data.preferensiBalasan === 'Website' ? 'Dibalas lewat website' : 'Bertemu langsung di ruang BK';

    var thread = document.getElementById('cek-thread');
    thread.innerHTML = '';

    // Pesan awal siswa
    var bubbleSiswa = document.createElement('div');
    bubbleSiswa.className = 'bubble-student';
    var metaSiswa = document.createElement('div');
    metaSiswa.className = 'bubble-meta';
    metaSiswa.textContent = 'Ceritamu • ' + formatWaktuIndonesia(data.waktu);
    var bodySiswa = document.createElement('p');
    bodySiswa.className = 'bubble-body';
    bodySiswa.textContent = data.pesanSiswa;
    bubbleSiswa.appendChild(metaSiswa);
    bubbleSiswa.appendChild(bodySiswa);
    thread.appendChild(bubbleSiswa);

    // Balasan dari Guru BK
    var balasanList = data.balasan || [];
    if (balasanList.length === 0) {
      var kosong = document.createElement('div');
      kosong.className = 'alert-box alert-info';
      kosong.style.marginTop = '0.5rem';
      kosong.textContent = 'Belum ada balasan tertulis dari Guru BK. Silakan cek kembali secara berkala menggunakan Kode Tiketmu.';
      thread.appendChild(kosong);
    } else {
      for (var i = 0; i < balasanList.length; i++) {
        var b = balasanList[i];
        var bubbleGuru = document.createElement('div');
        bubbleGuru.className = 'bubble-teacher';
        var metaGuru = document.createElement('div');
        metaGuru.className = 'bubble-meta';
        metaGuru.textContent = 'Balasan Guru BK • ' + formatWaktuIndonesia(b.waktu);
        var bodyGuru = document.createElement('p');
        bodyGuru.className = 'bubble-body';
        bodyGuru.textContent = b.pesan;
        bubbleGuru.appendChild(metaGuru);
        bubbleGuru.appendChild(bodyGuru);
        thread.appendChild(bubbleGuru);
      }
    }

    tampilkanElemen('cek-result-card', true);
  }

  // ==========================================================================
  // UTILITAS UI & KEAMANAN DOM
  // ==========================================================================

  function buatJudulLangkah(judul, petunjuk) {
    var wrap = document.createElement('div');
    var h2 = document.createElement('h2');
    h2.className = 'step-title';
    h2.textContent = judul;
    var p = document.createElement('p');
    p.className = 'step-hint';
    p.textContent = petunjuk;
    wrap.appendChild(h2);
    wrap.appendChild(p);
    return wrap;
  }

  function buatKartuPilihan(terpilih, judul, subJudul, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-card' + (terpilih ? ' selected' : '');
    btn.setAttribute('aria-pressed', terpilih ? 'true' : 'false');

    var dot = document.createElement('span');
    dot.className = 'choice-radio-dot';
    dot.setAttribute('aria-hidden', 'true');

    var content = document.createElement('span');
    content.className = 'choice-content';

    var titleEl = document.createElement('span');
    titleEl.className = 'choice-title';
    titleEl.textContent = judul;
    content.appendChild(titleEl);

    if (subJudul) {
      var subEl = document.createElement('span');
      subEl.className = 'choice-sub';
      subEl.textContent = subJudul;
      content.appendChild(subEl);
    }

    btn.appendChild(dot);
    btn.appendChild(content);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function tampilkanElemen(id, tampil) {
    var el = document.getElementById(id);
    if (!el) return;
    if (tampil) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function tampilkanGalatWizard(pesan) {
    var box = document.getElementById('wizard-alert');
    box.textContent = pesan;
    box.classList.remove('hidden');
  }

  function sembunyikanGalatWizard() {
    var box = document.getElementById('wizard-alert');
    box.classList.add('hidden');
  }

  function ambilInisial(nama) {
    var bagian = String(nama || 'BK').trim().split(/\s+/);
    if (bagian.length === 1) {
      return bagian[0].slice(0, 2).toUpperCase();
    }
    return (bagian[0].charAt(0) + bagian[1].charAt(0)).toUpperCase();
  }

  function formatWaktuIndonesia(isoStr) {
    if (!isoStr) return '-';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  }

  function salinTeks(teks) {
    if (!teks) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(function () {
        tampilkanToast('Kode tiket berhasil disalin!');
      }).catch(function () {
        salinFallback(teks);
      });
    } else {
      salinFallback(teks);
    }
  }

  function salinFallback(teks) {
    var temp = document.createElement('textarea');
    temp.value = teks;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
      tampilkanToast('Kode tiket berhasil disalin!');
    } catch (e) {
      tampilkanToast('Silakan pilih dan salin kode tiket secara manual.');
    }
    document.body.removeChild(temp);
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
    }, 3000);
  }
})();