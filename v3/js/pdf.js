// js/pdf.js - Generator laporan PDF untuk admin BK SMP
// Memakai jsPDF 2.5.1 + jspdf-autotable 3.8.2 dari cdnjs.

(function () {
  'use strict';

  // Konstanta tata letak (mm, A4)
  const LEBAR_HAL = 210;
  const TINGGI_HAL = 297;
  const MARGIN = 15;
  const LEBAR_KONTEN = LEBAR_HAL - MARGIN * 2;

  // ===== Helper Format =====

  function formatTanggalLengkap(iso) {
    try {
      const d = new Date(iso);
      const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return hari[d.getDay()] + ', ' + d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear() +
        ' pukul ' + ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) {
      return String(iso);
    }
  }

  function formatTanggalPendek(iso) {
    try {
      const d = new Date(iso);
      return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    } catch (e) {
      return String(iso);
    }
  }

  function deteksiFormatGambar(dataUri) {
    if (!dataUri) return 'JPEG';
    if (dataUri.indexOf('image/png') !== -1) return 'PNG';
    if (dataUri.indexOf('image/gif') !== -1) return 'GIF';
    return 'JPEG';
  }

  function escapeTeksPDF(teks) {
    if (teks === null || teks === undefined) return '';
    return String(teks);
  }

  // ===== Kop Surat =====

  function tambahKopSurat(doc, pengaturan, yMulai) {
    let y = yMulai || 15;
    const p = pengaturan || {};

    // Logo di kiri
    let tinggiLogo = 0;
    if (p.logo) {
      try {
        const fmt = deteksiFormatGambar(p.logo);
        doc.addImage(p.logo, fmt, MARGIN, y, 22, 22);
        tinggiLogo = 22;
      } catch (e) {
        // Abaikan jika gambar rusak
      }
    }

    // Nama sekolah di kanan logo (atau kiri jika tidak ada logo)
    const xTeks = p.logo ? MARGIN + 26 : MARGIN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(escapeTeksPDF(p.namaSekolah || 'SEKOLAH'), xTeks, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let yInfo = y + 11;
    if (p.alamat) {
      doc.text(escapeTeksPDF(p.alamat), xTeks, yInfo);
      yInfo += 4;
    }
    if (p.kontakSekolah) {
      doc.text(escapeTeksPDF('Kontak: ' + p.kontakSekolah), xTeks, yInfo);
      yInfo += 4;
    }

    // Garis pemisah
    const yGaris = Math.max(y + tinggiLogo + 2, yInfo + 1);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yGaris, LEBAR_HAL - MARGIN, yGaris);

    return yGaris + 5;
  }

  // ===== Tanda RAHASIA di setiap halaman =====

  function tambahRahasiaSemuaHalaman(doc) {
    const jumlah = doc.internal.getNumberOfPages();
    for (let i = 1; i <= jumlah; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text('RAHASIA', LEBAR_HAL - MARGIN - 18, 10);
      doc.setTextColor(0, 0, 0);
    }
  }

  // ===== Blok Tanda Tangan =====

  function tambahTandaTangan(doc, pengaturan, y, sertakanKepala) {
    const p = pengaturan || {};
    const now = new Date();
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const teksTanggal = now.getDate() + ' ' + bulan[now.getMonth()] + ' ' + now.getFullYear();

    // Posisi tanda tangan
    const xKanan = LEBAR_HAL - MARGIN - 70;
    const xKiri = MARGIN;
    let ySig = y || 240;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Jika sertakan kepala sekolah: dua kolom (kiri = kepala, kanan = BK)
    if (sertakanKepala && p.kepalaSekolah) {
      // Kiri: Kepala Sekolah
      doc.text(teksTanggal, xKiri, ySig);
      ySig += 6;
      doc.text('Kepala Sekolah', xKiri, ySig);
      ySig += 18;
      doc.setFont('helvetica', 'bold');
      doc.text(escapeTeksPDF(p.kepalaSekolah), xKiri, ySig);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      ySig += 4;
      doc.text('NIP: ' + escapeTeksPDF(p.nipKepalaSekolah || '....................'), xKiri, ySig);

      // Kanan: Guru BK (reset y ke posisi awal)
      ySig = y || 240;
      doc.setFontSize(10);
      doc.text(teksTanggal, xKanan, ySig);
      ySig += 6;
      doc.text(escapeTeksPDF(p.jabatanPenandaTangan || 'Guru Bimbingan Konseling'), xKanan, ySig);
      ySig += 18;
      doc.setFont('helvetica', 'bold');
      doc.text(escapeTeksPDF(p.penandaTangan || '............................'), xKanan, ySig);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      ySig += 4;
      doc.text('NIP: ' + escapeTeksPDF(p.nipPenandaTangan || '....................'), xKanan, ySig);
    } else {
      // Hanya tanda tangan BK (kanan)
      doc.text(teksTanggal, xKanan, ySig);
      ySig += 6;
      doc.text(escapeTeksPDF(p.jabatanPenandaTangan || 'Guru Bimbingan Konseling'), xKanan, ySig);
      ySig += 18;
      doc.setFont('helvetica', 'bold');
      doc.text(escapeTeksPDF(p.penandaTangan || '............................'), xKanan, ySig);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      ySig += 4;
      doc.text('NIP: ' + escapeTeksPDF(p.nipPenandaTangan || '....................'), xKanan, ySig);
    }

    return ySig + 5;
  }

  // ===== Lembar Kasus (satu kasus) =====

  // buatLembarKasus(kiriman, balasan, pengaturan, kategoriNama, sertakanIdentitas)
  // Mengembalikan objek jsPDF doc.
  function buatLembarKasus(kiriman, balasan, pengaturan, kategoriNama, sertakanIdentitas, sertakanKepala) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const p = pengaturan || {};
    const k = kiriman || {};

    // Kop surat
    let y = tambahKopSurat(doc, p, 15);

    // Judul
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('LEMBAR KASUS BIMBINGAN KONSELING', MARGIN, y);
    y += 7;

    // Info kasus
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const anonim = k.Anonim === true || k.Anonim === 'TRUE';
    const namaTampil = anonim ? '(Anonim)' : (sertakanIdentitas ? (k.Nama || '-') : '[Identitas disembunyikan]');
    const kelasTampil = anonim ? '-' : (sertakanIdentitas ? (k.Kelas || '-') : '[Disembunyikan]');

    const infoKasus = [
      ['ID Kiriman', k.IDKiriman || '-'],
      ['Waktu', formatTanggalLengkap(k.Waktu)],
      ['Tahun Ajaran', (k.TahunAjaran || '-') + ' / ' + (k.Semester || '-')],
      ['Jenjang', 'Kelas ' + String(k.Jenjang || '-')],
      ['Nama', namaTampil],
      ['Kelas', kelasTampil],
      ['No. HP', anonim ? '-' : (sertakanIdentitas ? (k.NoHP || '-') : '[Disembunyikan]')],
      ['Kategori', kategoriNama || k.KategoriID || '-'],
      ['Urgensi', (k.Urgensi || '-').charAt(0).toUpperCase() + (k.Urgensi || '').slice(1)],
      ['Guru Tujuan', k.GuruTujuanID === 'Siapa saja' || !k.GuruTujuanID ? 'Siapa Saja' : k.GuruTujuanID],
      ['Status', k.Status || '-'],
      ['Preferensi Balasan', k.PreferensiBalasan === 'website' ? 'Lewat Website' : (k.PreferensiBalasan === 'langsung' ? 'Bertemu Langsung' : '-')]
    ];

    doc.autoTable({
      startY: y,
      head: [['Informasi', 'Detail']],
      body: infoKasus,
      theme: 'grid',
      headStyles: { fillColor: [13, 148, 136], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: LEBAR_KONTEN - 45 } },
      margin: { left: MARGIN, right: MARGIN }
    });

    y = doc.lastAutoTable.finalY + 8;

    // Isi pesan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Isi Pesan:', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const pesanSplit = doc.splitTextToSize(escapeTeksPDF(k.Pesan || '-'), LEBAR_KONTEN);
    doc.text(pesanSplit, MARGIN, y);
    y += pesanSplit.length * 4.5 + 6;

    // Lampiran
    let lampiranList = [];
    try {
      lampiranList = k.Lampiran ? JSON.parse(k.Lampiran) : [];
    } catch (e) {
      lampiranList = [];
    }
    if (lampiranList.length > 0) {
      if (y > TINGGI_HAL - 40) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Lampiran (' + lampiranList.length + ' file):', MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      lampiranList.forEach(function (f, i) {
        doc.text((i + 1) + '. ' + escapeTeksPDF(f.nama || f.url), MARGIN + 3, y);
        y += 4;
      });
      y += 4;
    }

    // Balasan
    if (balasan && balasan.length > 0) {
      if (y > TINGGI_HAL - 40) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Balasan dari Guru BK:', MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      balasan.forEach(function (b, i) {
        const teksBalasan = '[' + formatTanggalPendek(b.Waktu || b.waktu) + '] ' + escapeTeksPDF(b.Pesan || b.pesan || '');
        const split = doc.splitTextToSize(teksBalasan, LEBAR_KONTEN - 3);
        doc.text(split, MARGIN + 3, y);
        y += split.length * 4.5 + 2;
      });
      y += 4;
    }

    // Catatan internal (hanya jika sertakan identitas / versi internal)
    if (sertakanIdentitas && k.CatatanInternal) {
      if (y > TINGGI_HAL - 40) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Catatan Internal:', MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const catatanSplit = doc.splitTextToSize(escapeTeksPDF(k.CatatanInternal), LEBAR_KONTEN);
      doc.text(catatanSplit, MARGIN, y);
      y += catatanSplit.length * 4.5 + 6;
    }

    // Rujukan / Diteruskan
    if (k.RujukanKe || k.DiteruskanKe) {
      if (y > TINGGI_HAL - 30) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Tindak Lanjut:', MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (k.RujukanKe) { doc.text('Dirujuk ke: ' + escapeTeksPDF(k.RujukanKe), MARGIN + 3, y); y += 4; }
      if (k.DiteruskanKe) { doc.text('Diteruskan ke: ' + escapeTeksPDF(k.DiteruskanKe), MARGIN + 3, y); y += 4; }
    }

    // Tanda tangan
    const ySig = Math.max(y + 10, 240);
    tambahTandaTangan(doc, p, ySig, sertakanKepala);

    // RAHASIA di semua halaman
    tambahRahasiaSemuaHalaman(doc);

    // Footer nomor halaman
    const jml = doc.internal.getNumberOfPages();
    for (let i = 1; i <= jml; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('Halaman ' + i + ' dari ' + jml, MARGIN, TINGGI_HAL - 8);
      doc.setTextColor(0, 0, 0);
    }

    return doc;
  }

  // ===== Rekap Periodik =====

  // buatRekap(daftarKiriman, pengaturan, judulPeriode, filterInfo, sertakanIdentitas)
  function buatRekap(daftarKiriman, pengaturan, judulPeriode, filterInfo, sertakanIdentitas, sertakanKepala) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const p = pengaturan || {};
    const daftar = daftarKiriman || [];

    // Kop surat
    let y = tambahKopSurat(doc, p, 15);

    // Judul
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('LAPORAN REKAP BIMBINGAN KONSELING', MARGIN, y);
    y += 6;
    doc.setFontSize(11);
    doc.text(escapeTeksPDF(judulPeriode || 'Rekap Periodik'), MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (filterInfo) {
      doc.text(escapeTeksPDF(filterInfo), MARGIN, y);
      y += 5;
    }
    doc.text('Total kasus: ' + daftar.length, MARGIN, y);
    y += 7;

    // Ringkasan per kategori
    const kategoriCount = {};
    daftar.forEach(function (k) {
      const kat = k.KategoriID || 'Lainnya';
      kategoriCount[kat] = (kategoriCount[kat] || 0) + 1;
    });
    const barisKategori = Object.keys(kategoriCount).map(function (kat) {
      return [kat, String(kategoriCount[kat])];
    });

    doc.autoTable({
      startY: y,
      head: [['Kategori', 'Jumlah']],
      body: barisKategori,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: MARGIN, right: MARGIN }
    });
    y = doc.lastAutoTable.finalY + 6;

    // Ringkasan per status
    const statusCount = {};
    daftar.forEach(function (k) {
      const s = k.Status || 'Baru';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    const barisStatus = Object.keys(statusCount).map(function (s) {
      return [s, String(statusCount[s])];
    });

    doc.autoTable({
      startY: y,
      head: [['Status', 'Jumlah']],
      body: barisStatus,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: MARGIN, right: MARGIN }
    });
    y = doc.lastAutoTable.finalY + 8;

    // Daftar kasus
    if (y > TINGGI_HAL - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Daftar Kasus', MARGIN, y);
    y += 5;

    const barisKasus = daftar.map(function (k) {
      const anonim = k.Anonim === true || k.Anonim === 'TRUE';
      const nama = anonim ? '(Anonim)' : (sertakanIdentitas ? (k.Nama || '-') : '***');
      const kelas = anonim ? '-' : (sertakanIdentitas ? (k.Kelas || '-') : '**');
      return [
        formatTanggalPendek(k.Waktu),
        'K' + String(k.Jenjang || '-'),
        kelas,
        nama,
        k.KategoriID || '-',
        k.Urgensi || '-',
        k.Status || '-'
      ];
    });

    doc.autoTable({
      startY: y,
      head: [['Tanggal', 'Jenjang', 'Kelas', 'Nama', 'Kategori', 'Urgensi', 'Status']],
      body: barisKasus,
      theme: 'grid',
      headStyles: { fillColor: [13, 148, 136], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 14 },
        2: { cellWidth: 14 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35 },
        5: { cellWidth: 20 },
        6: { cellWidth: 25 }
      },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: function () { tambahRahasiaSemuaHalaman(doc); }
    });

    // Tanda tangan di halaman terakhir
    const yAkhir = doc.lastAutoTable.finalY + 15;
    doc.setPage(doc.internal.getNumberOfPages());
    tambahTandaTangan(doc, p, Math.min(yAkhir, TINGGI_HAL - 40), sertakanKepala);

    // RAHASIA di semua halaman
    tambahRahasiaSemuaHalaman(doc);

    // Footer
    const jml = doc.internal.getNumberOfPages();
    for (let i = 1; i <= jml; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('Halaman ' + i + ' dari ' + jml, MARGIN, TINGGI_HAL - 8);
      doc.setTextColor(0, 0, 0);
    }

    return doc;
  }

  // ===== Unduh & Bagikan =====

  function unduhPDF(doc, namaFile) {
    doc.save(namaFile + '.pdf');
  }

  async function bagikanPDF(doc, namaFile) {
    // Web Share API dengan berkas (jika didukung)
    if (!navigator.canShare) return false;
    try {
      const blob = doc.output('blob');
      const file = new File([blob], namaFile + '.pdf', { type: 'application/pdf' });
      if (!navigator.canShare({ files: [file] })) return false;
      await navigator.share({
        files: [file],
        title: namaFile,
        text: 'Laporan BK - ' + namaFile
      });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return true; // pengguna batal share
      return false;
    }
  }

  // Expose ke window
  window.BKPDF = {
    buatLembarKasus: buatLembarKasus,
    buatRekap: buatRekap,
    unduhPDF: unduhPDF,
    bagikanPDF: bagikanPDF,
    formatTanggalLengkap: formatTanggalLengkap,
    formatTanggalPendek: formatTanggalPendek
  };

})();
