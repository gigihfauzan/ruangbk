// js/app.js - Logika halaman siswa Layanan BK SMP
(function () {
  'use strict';

  // ===== State =====
  let dataPublik = null;
  let langkahSaatIni = 1;
  let modeAnonim = null; // null | true | false

  // ===== Konstanta =====

  // Kata kunci bahaya (harus sama dengan di server)
  const KATA_BAHAYA = [
    'akhiri hidup', 'mengakhiri hidup', 'bunuh diri', 'ingin mati', 'tidak ingin hidup',
    'menyakiti diri', 'melukai diri', 'memotong tangan', 'memotong pergelangan', 'memotong diri',
    'putus asa', 'tak tahan lagi', 'tidak tahan lagi',
    'dipukul', 'dipukuli', 'dibenturkan', 'ditendang', 'dianiaya', 'penganiayaan',
    'digigit', 'dicekik', 'ditusuk', 'ditelan',
    'dilecehkan', 'diperkosa', 'disentuh paksa', 'pelcehan', 'pelecehan', 'kekerasan seksual'
  ];

  // Daftar langkah form
  const SEMUA_LANGKAH = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Label status untuk tampilan
  const LABEL_STATUS = {
    'Baru': { teks: 'Diterima', kelas: 'baru' },
    'Dibaca': { teks: 'Sudah Dibaca', kelas: 'dibaca' },
    'Ditangani': { teks: 'Sedang Ditangani', kelas: 'ditangani' },
    'Selesai': { teks: 'Selesai', kelas: 'selesai' },
    'Dirujuk': { teks: 'Dirujuk', kelas: 'dirujuk' }
  };

  // Situs netral untuk tombol Keluar Cepat
  const URL_KELUAR = 'https://www.google.com';

  // ===== API =====

  async function panggilAPI(aksi, payload) {
    const body = JSON.stringify(Object.assign({ a: aksi }, payload || {}));
    const res = await fetch(CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: body
    });
    return await res.json();
  }

  // ===== Inisialisasi =====

  document.addEventListener('DOMContentLoaded', function () {
    pasangEventListener();
    muatDataPublik();
  });

  async function muatDataPublik() {
    tampilkanMemuat(true);
    try {
      const resp = await panggilAPI('ambilDataPublik', {});
      if (resp.ok && resp.data) {
        dataPublik = resp.data;
        terapPengaturan();
        renderSemua();
      } else {
        tampilkanError('Gagal memuat data layanan. Periksa koneksi internet lalu muat ulang halaman.');
      }
    } catch (e) {
      tampilkanError('Tidak bisa terhubung ke server. Pastikan js/config.js sudah diisi URL Web App, lalu muat ulang.');
    }
    tampilkanMemuat(false);
  }

  // ===== Terap Pengaturan =====

  function terapPengaturan() {
    const p = dataPublik.pengaturan;

    // Tema warna
    if (p.temaWarna) {
      document.body.setAttribute('data-tema', p.temaWarna);
    }

    // Nama sekolah
    if (p.namaSekolah) {
      document.title = 'Layanan BK ' + p.namaSekolah;
      setText('nama-sekolah-utama', p.namaSekolah);
      setText('footer-nama-sekolah', p.namaSekolah);
    }
    if (p.namaSingkat) {
      setText('nama-singkat-sekolah', p.namaSingkat);
    }

    // Logo
    const logo = document.getElementById('logo-sekolah');
    if (p.logo) {
      logo.src = p.logo;
      logo.alt = 'Logo ' + (p.namaSekolah || 'sekolah');
      logo.hidden = false;
    }

    // Sambutan
    if (p.teksSambutan) {
      setText('teks-sambutan-isi', p.teksSambutan);
    }

    // Jam layanan
    if (p.jamLayanan) {
      setText('jam-layanan-isi', p.jamLayanan);
    }

    // Periode
    if (p.tahunAjaranAktif && p.semesterAktif) {
      setText('periode-isi', 'TA ' + p.tahunAjaranAktif + ' - ' + p.semesterAktif);
    }

    // Footer
    if (p.alamat) setText('footer-alamat', p.alamat);
    if (p.kontakSekolah) setText('footer-kontak', p.kontakSekolah);

    // Banner (background hero)
    if (p.banner) {
      const hero = document.getElementById('hero-banner');
      hero.style.backgroundImage = 'linear-gradient(135deg, rgba(13,148,136,0.85), rgba(15,118,110,0.85)), url("' + p.banner + '")';
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
    }

    // Privasi
    if (p.kebijakanPrivasi) {
      const el = document.getElementById('konten-privasi');
      el.textContent = p.kebijakanPrivasi;
    }

    // Kontak darurat
    if (p.kontakDarurat) {
      const el = document.getElementById('kontak-darurat-isi');
      el.textContent = p.kontakDarurat;
      const elCepat = document.getElementById('kontak-darurat-cepat');
      elCepat.textContent = p.kontakDarurat;
    }
  }

  // ===== Render Semua =====

  function renderSemua() {
    renderLayanan();
    renderGuru();
    renderFAQ();
    renderKategori();
    renderKelas();
  }

  function renderLayanan() {
    const wadah = document.getElementById('ringkasan-layanan');
    const wadah2 = document.getElementById('daftar-layanan');
    const layanan = dataPublik.layanan || [];
    if (layanan.length === 0) {
      if (wadah) wadah.innerHTML = '<p class="keadaan-kosong">Belum ada layanan ditampilkan.</p>';
      if (wadah2) wadah2.innerHTML = '<p class="keadaan-kosong">Belum ada layanan ditampilkan.</p>';
      return;
    }
    const html = layanan.map(function (l) {
      return '<div class="kartu-layanan"><h3>' + escapeHtml(l.Judul) + '</h3><p>' + escapeHtml(l.Deskripsi) + '</p></div>';
    }).join('');
    if (wadah) wadah.innerHTML = html;
    if (wadah2) wadah2.innerHTML = html;
  }

  function renderGuru() {
    const wadah = document.getElementById('daftar-guru');
    const guru = dataPublik.guru || [];
    if (guru.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada guru BK ditampilkan.</p>';
      return;
    }
    wadah.innerHTML = guru.map(function (g) {
      let fotoHtml;
      if (g.Foto) {
        fotoHtml = '<img class="foto-guru" src="' + escapeAttr(g.Foto) + '" alt="Foto ' + escapeAttr(g.Nama) + '">';
      } else {
        fotoHtml = '<div class="foto-guru-placeholder" aria-hidden="true">&#129489;</div>';
      }
      const jenjangArr = String(g.Jenjang || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      const badgeJenjang = jenjangArr.map(function (j) {
        return '<span class="badge-jenjang">Kelas ' + escapeHtml(j) + '</span>';
      }).join('');
      return '<div class="kartu-guru">' + fotoHtml +
        '<div class="info-guru"><h3>' + escapeHtml(g.Nama) + '</h3>' +
        '<div class="jabatan-guru">' + escapeHtml(g.Jabatan || 'Guru BK') + '</div>' +
        (badgeJenjang ? '<div style="margin-bottom:6px">' + badgeJenjang + '</div>' : '') +
        (g.Bio ? '<p class="bio-guru">' + escapeHtml(g.Bio) + '</p>' : '') +
        (g.Kontak ? '<p class="kontak-guru">Kontak: ' + escapeHtml(g.Kontak) + '</p>' : '') +
        '</div></div>';
    }).join('');
  }

  function renderFAQ() {
    const wadah = document.getElementById('daftar-faq');
    const faq = dataPublik.faq || [];
    if (faq.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada FAQ ditampilkan.</p>';
      return;
    }
    wadah.innerHTML = faq.map(function (f) {
      return '<details class="item-faq"><summary>' + escapeHtml(f.Pertanyaan) + '</summary>' +
        '<div class="jawaban-faq">' + escapeHtml(f.Jawaban) + '</div></details>';
    }).join('');
  }

  function renderKategori() {
    const wadah = document.getElementById('grid-kategori');
    const kategori = dataPublik.kategori || [];
    if (kategori.length === 0) {
      wadah.innerHTML = '<p class="keadaan-kosong">Belum ada kategori.</p>';
      return;
    }
    wadah.innerHTML = kategori.map(function (k) {
      const ikonEskalasi = isAktif(k.Eskalasi) ? ' <span class="badge-jenjang" style="background-color:var(--bahaya-ringan);color:var(--bahaya)" title="Kategori eskalasi TPPK">&#9888;&#65039;</span>' : '';
      return '<label class="kartu-pilihan">' +
        '<input type="radio" name="kategoriID" value="' + escapeAttr(k.ID) + '" required>' +
        '<span class="isi-kartu-pilihan"><strong>' + escapeHtml(k.Nama) + ikonEskalasi + '</strong>' +
        (k.Deskripsi ? '<small>' + escapeHtml(k.Deskripsi) + '</small>' : '') +
        '</span></label>';
    }).join('');
  }

  function renderKelas() {
    const select = document.getElementById('input-kelas');
    const semuaKelas = dataPublik.kelas || [];
    // Ambil jenjang yang dipilih
    const jenjang = document.querySelector('input[name="jenjang"]:checked');
    select.innerHTML = '<option value="">Pilih kelas...</option>';
    if (!jenjang) return;
    const kelasCocok = semuaKelas.filter(function (k) { return k.Jenjang === jenjang.value; });
    kelasCocok.forEach(function (k) {
      const opt = document.createElement('option');
      opt.value = k.Kelas;
      opt.textContent = 'Kelas ' + k.Kelas;
      select.appendChild(opt);
    });
  }

  function renderGuruTujuan() {
    const wadah = document.getElementById('grid-guru');
    const semuaGuru = dataPublik.guru || [];
    const jenjang = document.querySelector('input[name="jenjang"]:checked');
    if (!jenjang) {
      wadah.innerHTML = '<p class="keadaan-kosong">Pilih jenjang dulu di langkah sebelumnya.</p>';
      return;
    }
    const guruCocok = semuaGuru.filter(function (g) {
      return guruCocokJenjang(g, jenjang.value);
    });
    let html = '<label class="kartu-pilihan">' +
      '<input type="radio" name="guruTujuanID" value="Siapa saja" checked>' +
      '<span class="isi-kartu-pilihan"><span class="ikon-pilihan" aria-hidden="true">&#129309;</span>' +
      '<strong>Siapa Saja</strong><small>Guru BK yang tersedia</small></span></label>';
    html += guruCocok.map(function (g) {
      let fotoIkon = '&#129489;';
      let fotoHtml = '';
      if (g.Foto) {
        fotoHtml = '<img class="foto-guru" src="' + escapeAttr(g.Foto) + '" alt="" style="width:48px;height:48px;margin-bottom:4px">';
      } else {
        fotoHtml = '<span class="ikon-pilihan" aria-hidden="true">' + fotoIkon + '</span>';
      }
      return '<label class="kartu-pilihan">' +
        '<input type="radio" name="guruTujuanID" value="' + escapeAttr(g.ID) + '">' +
        '<span class="isi-kartu-pilihan">' + fotoHtml +
        '<strong>' + escapeHtml(g.Nama) + '</strong>' +
        '<small>' + escapeHtml(g.Jabatan || 'Guru BK') + '</small></span></label>';
    }).join('');
    wadah.innerHTML = html;
  }

  // ===== Event Listener =====

  function pasangEventListener() {
    // Navigasi header
    document.querySelectorAll('.taut-nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigasiKe(btn.dataset.halaman);
      });
    });

    // Tombol dengan data-halaman-tujuan
    document.addEventListener('click', function (e) {
      const target = e.target.closest('[data-halaman-tujuan]');
      if (target) {
        e.preventDefault();
        navigasiKe(target.dataset.halamanTujuan);
      }
    });

    // Keluar Cepat
    document.getElementById('btn-keluar-cepat').addEventListener('click', function () {
      window.location.href = URL_KELUAR;
    });

    // Form curhat: radio anonim mengubah mode
    document.querySelectorAll('input[name="anonim"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        modeAnonim = (radio.value === 'true');
        perbaruiProgres();
      });
    });

    // Jenjang berubah -> render kelas dan guru
    document.querySelectorAll('input[name="jenjang"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        renderKelas();
        renderGuruTujuan();
      });
    });

    // Pesan: hitung karakter dan deteksi bahaya
    const pesanInput = document.getElementById('input-pesan');
    pesanInput.addEventListener('input', function () {
      setText('hitung-pesan', String(pesanInput.value.length));
      deteksiBahayaForm(pesanInput.value);
    });

    // Tombol navigasi langkah
    document.getElementById('btn-lanjut').addEventListener('click', lanjutLangkah);
    document.getElementById('btn-kembali').addEventListener('click', kembaliLangkah);
    document.getElementById('btn-kirim').addEventListener('click', kirimCurhatan);

    // Salin kode
    document.getElementById('btn-salin-kode').addEventListener('click', function () {
      const kode = document.getElementById('kode-tiket-nilai').textContent;
      salinTeks(kode);
    });

    // Curhat lagi
    document.getElementById('btn-curhat-lagi').addEventListener('click', function () {
      resetForm();
      navigasiKe('curhat');
    });

    // Form cek balasan
    document.getElementById('form-cek').addEventListener('submit', function (e) {
      e.preventDefault();
      cekBalasan();
    });

    // Kode input: auto uppercase
    document.getElementById('input-kode').addEventListener('input', function () {
      this.value = this.value.toUpperCase();
    });
  }

  // ===== Navigasi Halaman =====

  function navigasiKe(nama) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.halaman').forEach(function (s) {
      s.classList.remove('aktif');
    });
    // Tampilkan yang dipilih
    const target = document.getElementById('halaman-' + nama);
    if (target) {
      target.classList.add('aktif');
    }
    // Update nav aktif
    document.querySelectorAll('.taut-nav').forEach(function (btn) {
      btn.classList.toggle('aktif', btn.dataset.halaman === nama);
    });
    // Reset scroll ke atas
    window.scrollTo(0, 0);

    // Jika ke curhat, set timestamp mulai
    if (nama === 'curhat') {
      const mulai = document.getElementById('input-mulai');
      if (!mulai.value) {
        mulai.value = String(Date.now());
      }
    }
  }

  // ===== Manajemen Langkah Form =====

  function daftarLangkahTampak() {
    if (modeAnonim === true) {
      return [1, 2, 4, 5, 6, 7, 8, 9];
    }
    return SEMUA_LANGKAH;
  }

  function tampilkanLangkah(n) {
    langkahSaatIni = n;
    document.querySelectorAll('.langkah').forEach(function (el) {
      el.classList.toggle('aktif', Number(el.dataset.langkah) === n);
    });
    perbaruiProgres();
    perbaruiTombolNav();
    if (n === 9) {
      perbaruiRingkasan();
    }
    // Scroll ke atas form
    const kontainer = document.querySelector('.form-kontainer');
    if (kontainer) kontainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function perbaruiProgres() {
    const tampak = daftarLangkahTampak();
    const idx = tampak.indexOf(langkahSaatIni);
    const total = tampak.length;
    const posisi = idx + 1;
    const persen = (posisi / total) * 100;
    document.getElementById('progres-isi').style.width = persen + '%';
    const bar = document.querySelector('.progres-bar');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(posisi));
      bar.setAttribute('aria-valuemax', String(total));
    }
    document.getElementById('nomor-langkah').textContent = 'Langkah ' + posisi + ' dari ' + total;
  }

  function perbaruiTombolNav() {
    const tampak = daftarLangkahTampak();
    const idx = tampak.indexOf(langkahSaatIni);
    const btnKembali = document.getElementById('btn-kembali');
    const btnLanjut = document.getElementById('btn-lanjut');
    const btnKirim = document.getElementById('btn-kirim');

    btnKembali.disabled = (idx === 0);

    const isTerakhir = (idx === tampak.length - 1);
    btnLanjut.hidden = isTerakhir;
    btnKirim.hidden = !isTerakhir;
  }

  function langkahBerikutnya(n) {
    if (n === 2 && modeAnonim === true) return 4;
    return n + 1;
  }

  function langkahSebelumnya(n) {
    if (n === 4 && modeAnonim === true) return 2;
    return n - 1;
  }

  function lanjutLangkah() {
    const error = validasiLangkah(langkahSaatIni);
    if (error) {
      tampilkanToast(error, 'error');
      return;
    }
    const berikut = langkahBerikutnya(langkahSaatIni);
    tampilkanLangkah(berikut);
  }

  function kembaliLangkah() {
    const sebelum = langkahSebelumnya(langkahSaatIni);
    tampilkanLangkah(sebelum);
  }

  function validasiLangkah(n) {
    switch (n) {
      case 1:
        if (!document.querySelector('input[name="anonim"]:checked')) {
          return 'Pilih anonim atau sertakan identitas dulu.';
        }
        return null;
      case 2:
        if (!document.querySelector('input[name="jenjang"]:checked')) {
          return 'Pilih jenjang kelasmu.';
        }
        return null;
      case 3:
        if (modeAnonim === false) {
          const kelas = document.getElementById('input-kelas').value;
          const nama = document.getElementById('input-nama').value.trim();
          if (!kelas) return 'Pilih kelasmu.';
          if (!nama) return 'Tulis namamu.';
        }
        return null;
      case 4:
        if (!document.querySelector('input[name="kategoriID"]:checked')) {
          return 'Pilih kategori curhatanmu.';
        }
        return null;
      case 5:
        if (!document.querySelector('input[name="urgensi"]:checked')) {
          return 'Pilih tingkat urgensi.';
        }
        return null;
      case 6:
        // Guru tujuan opsional, "Siapa saja" default sudah checked
        return null;
      case 7:
        const pesan = document.getElementById('input-pesan').value.trim();
        if (!pesan) return 'Tulis pesanmu dulu.';
        if (pesan.length < 5) return 'Pesan terlalu pendek. Ceritakan lebih banyak.';
        return null;
      case 8:
        if (!document.querySelector('input[name="preferensiBalasan"]:checked')) {
          return 'Pilih preferensi balasan.';
        }
        return null;
      default:
        return null;
    }
  }

  // ===== Deteksi Bahaya (Sisi Klien) =====

  function deteksiBahayaTeks(teks) {
    const lower = String(teks).toLowerCase();
    for (let i = 0; i < KATA_BAHAYA.length; i++) {
      if (lower.indexOf(KATA_BAHAYA[i]) !== -1) return true;
    }
    return false;
  }

  function deteksiBahayaForm(teks) {
    const peringatan = document.getElementById('peringatan-bahaya');
    const terdeteksi = deteksiBahayaTeks(teks);
    peringatan.hidden = !terdeteksi;
  }

  // ===== Ringkasan =====

  function perbaruiRingkasan() {
    const wadah = document.getElementById('ringkasan-kiriman');
    const data = kumpulDataForm();
    const baris = [];

    baris.push(['Mode', data.anonim ? 'Anonim' : 'Beridentitas']);
    baris.push(['Jenjang', 'Kelas ' + data.jenjang]);
    if (!data.anonim) {
      baris.push(['Kelas', data.kelas || '-']);
      baris.push(['Nama', data.nama || '-']);
    }
    const kat = (dataPublik.kategori || []).find(function (k) { return k.ID === data.kategoriID; });
    baris.push(['Kategori', kat ? kat.Nama : data.kategoriID]);
    const labelUrgensi = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' };
    baris.push(['Urgensi', labelUrgensi[data.urgensi] || data.urgensi]);

    if (data.guruTujuanID && data.guruTujuanID !== 'Siapa saja') {
      const guru = (dataPublik.guru || []).find(function (g) { return g.ID === data.guruTujuanID; });
      baris.push(['Guru Tujuan', guru ? guru.Nama : data.guruTujuanID]);
    } else {
      baris.push(['Guru Tujuan', 'Siapa Saja']);
    }

    baris.push(['Preferensi Balasan', data.preferensiBalasan === 'website' ? 'Lewat Website' : 'Bertemu Langsung']);

    let html = '';
    baris.forEach(function (b) {
      html += '<div class="baris-ringkasan"><span class="label-ringkasan">' + escapeHtml(b[0]) + '</span>' +
        '<span class="nilai-ringkasan">' + escapeHtml(b[1]) + '</span></div>';
    });
    html += '<div class="baris-ringkasan"><span class="label-ringkasan">Pesan</span>' +
      '<span class="nilai-ringkasan">' + escapeHtml(data.pesan.slice(0, 120)) + (data.pesan.length > 120 ? '...' : '') + '</span></div>';
    wadah.innerHTML = html;
  }

  function kumpulDataForm() {
    const form = document.getElementById('form-curhat');
    const anonimRadio = form.querySelector('input[name="anonim"]:checked');
    const jenjangRadio = form.querySelector('input[name="jenjang"]:checked');
    const kategoriRadio = form.querySelector('input[name="kategoriID"]:checked');
    const urgensiRadio = form.querySelector('input[name="urgensi"]:checked');
    const guruRadio = form.querySelector('input[name="guruTujuanID"]:checked');
    const prefRadio = form.querySelector('input[name="preferensiBalasan"]:checked');

    return {
      anonim: anonimRadio ? anonimRadio.value === 'true' : false,
      jenjang: jenjangRadio ? jenjangRadio.value : '',
      kelas: form.querySelector('#input-kelas').value,
      nama: form.querySelector('#input-nama').value.trim(),
      kategoriID: kategoriRadio ? kategoriRadio.value : '',
      urgensi: urgensiRadio ? urgensiRadio.value : '',
      guruTujuanID: guruRadio ? guruRadio.value : 'Siapa saja',
      pesan: form.querySelector('#input-pesan').value.trim(),
      preferensiBalasan: prefRadio ? prefRadio.value : '',
      mulai: form.querySelector('#input-mulai').value,
      website: form.querySelector('input[name="website"]').value
    };
  }

  // ===== Kirim Curhatan =====

  async function kirimCurhatan() {
    const data = kumpulDataForm();
    // Validasi akhir
    if (!data.jenjang || !data.kategoriID || !data.urgensi || !data.pesan || !data.preferensiBalasan) {
      tampilkanToast('Ada isian yang belum lengkap. Periksa kembali.', 'error');
      return;
    }
    if (!data.anonim && (!data.kelas || !data.nama)) {
      tampilkanToast('Nama dan kelas harus diisi untuk mode beridentitas.', 'error');
      return;
    }

    tampilkanMemuat(true);
    try {
      const resp = await panggilAPI('kirimKiriman', {
        anonim: data.anonim,
        jenjang: data.jenjang,
        kelas: data.kelas,
        nama: data.nama,
        kategoriID: data.kategoriID,
        urgensi: data.urgensi,
        guruTujuanID: data.guruTujuanID,
        pesan: data.pesan,
        preferensiBalasan: data.preferensiBalasan,
        mulai: data.mulai,
        website: data.website
      });
      if (resp.ok && resp.data && resp.data.kode) {
        tampilkanHasilKirim(resp.data.kode, resp.data.bahaya);
      } else {
        tampilkanToast(resp.error || 'Gagal mengirim. Coba lagi.', 'error');
      }
    } catch (e) {
      tampilkanToast('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    }
    tampilkanMemuat(false);
  }

  function tampilkanHasilKirim(kode, bahaya) {
    // Sembunyikan form, tampilkan hasil
    document.querySelector('.form-kontainer').style.display = 'none';
    const hasil = document.getElementById('hasil-kirim');
    hasil.hidden = false;
    setText('kode-tiket-nilai', kode);

    // Tampilkan peringatan bahaya jika ada
    const peringatanHasil = document.getElementById('peringatan-bahaya-hasil');
    if (bahaya && dataPublik.pengaturan.kontakDarurat) {
      peringatanHasil.hidden = false;
      peringatanHasil.innerHTML = '<p class="judul-peringatan">Kami peduli padamu</p>' +
        '<p>Terdengar kamu sedang menghadapi hal yang sangat berat. Pesanmu telah ditandai penting dan guru BK akan segera memberi perhatian. Jika butuh bantuan segera, hubungi kontak darurat di bawah ini:</p>' +
        '<div class="kontak-darurat-cepat">' + escapeHtml(dataPublik.pengaturan.kontakDarurat) + '</div>';
    } else {
      peringatanHasil.hidden = true;
    }

    hasil.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    document.getElementById('form-curhat').reset();
    document.getElementById('input-mulai').value = '';
    document.querySelector('.form-kontainer').style.display = '';
    document.getElementById('hasil-kirim').hidden = true;
    document.getElementById('peringatan-bahaya').hidden = true;
    setText('hitung-pesan', '0');
    langkahSaatIni = 1;
    modeAnonim = null;
    tampilkanLangkah(1);
  }

  // ===== Cek Balasan =====

  async function cekBalasan() {
    const kode = document.getElementById('input-kode').value.trim().toUpperCase();
    const wadah = document.getElementById('hasil-cek');

    if (!kode || kode.length !== 10) {
      wadah.innerHTML = '<div class="keadaan-kosong" style="border-color:var(--bahaya-tepi);color:var(--bahaya)">Kode tiket harus 10 karakter.</div>';
      return;
    }

    tampilkanMemuat(true);
    try {
      const resp = await panggilAPI('cekBalasan', { kode: kode });
      if (resp.ok && resp.data) {
        renderHasilCek(resp.data);
      } else {
        wadah.innerHTML = '<div class="keadaan-kosong" style="border-color:var(--bahaya-tepi);color:var(--bahaya)">' +
          escapeHtml(resp.error || 'Kode tidak ditemukan.') + '</div>';
      }
    } catch (e) {
      wadah.innerHTML = '<div class="keadaan-kosong" style="border-color:var(--bahaya-tepi);color:var(--bahaya)">Tidak bisa terhubung ke server. Coba lagi.</div>';
    }
    tampilkanMemuat(false);
  }

  function renderHasilCek(data) {
    const wadah = document.getElementById('hasil-cek');
    const statusInfo = LABEL_STATUS[data.status] || { teks: data.status, kelas: 'baru' };
    const balasan = data.balasan || [];

    let html = '<div class="kartu-status">' +
      '<div class="baris-status">' +
      '<span class="label-status">Status:</span>' +
      '<span class="badge-status ' + statusInfo.kelas + '">' + escapeHtml(statusInfo.teks) + '</span>' +
      '</div>' +
      '<div class="waktu-kiriman">Dikirim: ' + formatTanggal(data.waktu) + '</div>' +
      '</div>';

    if (balasan.length > 0) {
      html += '<h3 style="margin:16px 0 12px;font-size:18px">Balasan dari Guru BK:</h3>';
      html += '<div class="daftar-balasan">';
      balasan.forEach(function (b) {
        html += '<div class="item-balasan">' +
          '<div class="waktu-balasan">' + formatTanggal(b.waktu) + '</div>' +
          '<div class="isi-balasan">' + escapeHtml(b.pesan) + '</div>' +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="belum-dibalas">' +
        '<p>&#9203;&#65039; Belum ada balasan.</p>' +
        '<p style="margin-top:8px">Guru BK akan membalas secepatnya. Cek lagi nanti dengan kode tiket yang sama.</p>' +
        '</div>';
    }

    wadah.innerHTML = html;
  }

  // ===== Utility =====

  function tampilkanMemuat(tampilkan) {
    document.getElementById('overlay-memuat').hidden = !tampilkan;
  }

  function tampilkanToast(pesan, tipe) {
    const toast = document.getElementById('toast');
    toast.textContent = pesan;
    toast.className = 'toast' + (tipe ? ' ' + tipe : '');
    toast.hidden = false;
    setTimeout(function () {
      toast.hidden = true;
    }, 3500);
  }

  function tampilkanError(pesan) {
    const toast = document.getElementById('toast');
    toast.textContent = pesan;
    toast.className = 'toast error';
    toast.hidden = false;
    setTimeout(function () {
      toast.hidden = true;
    }, 6000);
  }

  function setText(id, teks) {
    const el = document.getElementById(id);
    if (el) el.textContent = teks;
  }

  function salinTeks(teks) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(function () {
        tampilkanToast('Kode berhasil disalin!', 'sukses');
      }).catch(function () {
        salinCadangan(teks);
      });
    } else {
      salinCadangan(teks);
    }
  }

  function salinCadangan(teks) {
    const ta = document.createElement('textarea');
    ta.value = teks;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      tampilkanToast('Kode berhasil disalin!', 'sukses');
    } catch (e) {
      tampilkanToast('Tidak bisa menyalin otomatis. Tolong salin manual.', 'peringatan');
    }
    document.body.removeChild(ta);
  }

  function formatTanggal(iso) {
    try {
      const d = new Date(iso);
      const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return hari[d.getDay()] + ', ' + d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear() +
        ' pukul ' + ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) {
      return String(iso);
    }
  }

  function isAktif(v) {
    return v === true || v === 'TRUE' || v === 'True' || v === 'true' || v === 1 || v === '1';
  }

  function guruCocokJenjang(guru, jenjang) {
    if (!guru.Jenjang) return true;
    const daftar = String(guru.Jenjang).split(',').map(function (s) { return s.trim(); });
    return daftar.indexOf(jenjang) !== -1;
  }

  // Escape HTML untuk mencegah XSS saat menampilkan data
  function escapeHtml(teks) {
    if (teks === null || teks === undefined) return '';
    return String(teks)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(teks) {
    return escapeHtml(teks);
  }

})();
