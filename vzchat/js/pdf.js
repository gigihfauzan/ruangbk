/**
 * Generator Laporan PDF Resmi Layanan BK SMP
 * Menggunakan jsPDF 2.5.1 dan jspdf-autotable 3.8.2
 * Fitur: Kop surat sekolah otomatis, stempel RAHASIA di setiap halaman,
 * penyembunyian identitas default, tanda tangan, serta dukungan Web Share API.
 */
window.BK_PDF = (function () {
  'use strict';

  function dapatkanJsPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('Pustaka jsPDF belum dimuat. Periksa koneksi internet Anda.');
    }
    return window.jspdf.jsPDF;
  }

  function formatTanggalIndo(isoStr) {
    if (!isoStr) return '-';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatWaktuLengkapIndo(isoStr) {
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

  /**
   * Menggambar stempel "RAHASIA" dan nomor halaman pada setiap halaman PDF.
   */
  function gambarHeaderFooterHalaman(doc, nomorHalaman) {
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();

    // Kotak stempel RAHASIA di pojok kanan atas
    doc.saveGraphicsState();
    doc.setDrawColor(190, 18, 60);
    doc.setFillColor(255, 241, 242);
    doc.roundedRect(pageWidth - 44, 8, 30, 7, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(190, 18, 60);
    doc.text('RAHASIA', pageWidth - 29, 12.8, { align: 'center' });
    doc.restoreGraphicsState();

    // Footer halaman
    doc.saveGraphicsState();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Dokumen Rahasia Layanan Bimbingan dan Konseling Sekolah • Halaman ' + nomorHalaman,
      14,
      pageHeight - 8
    );
    doc.restoreGraphicsState();
  }

  /**
   * Menggambar Kop Surat Sekolah otomatis dari data Pengaturan.
   * Mengembalikan posisi Y berikutnya setelah garis kop surat.
   */
  function gambarKopSurat(doc, pengaturan) {
    var pageWidth = doc.internal.pageSize.getWidth();
    var marginX = 14;
    var yTop = 16;
    var textStartX = marginX;

    // Jika tersedia logo sekolah berupa data URI gambar
    if (pengaturan.logo && String(pengaturan.logo).indexOf('data:image/') === 0) {
      try {
        var formatImg = 'PNG';
        if (pengaturan.logo.indexOf('data:image/jpeg') === 0 || pengaturan.logo.indexOf('data:image/jpg') === 0) {
          formatImg = 'JPEG';
        }
        doc.addImage(pengaturan.logo, formatImg, marginX, yTop - 2, 18, 18);
        textStartX = marginX + 22;
      } catch (e) {
        // Lewati logo jika gagal dirender
      }
    }

    var lebarTeks = pageWidth - textStartX - marginX;
    var tengahX = textStartX + (lebarTeks / 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(String(pengaturan.namaSekolah || 'SEKOLAH MENENGAH PERTAMA').toUpperCase(), tengahX, yTop + 3, {
      align: 'center',
      maxWidth: lebarTeks
    });

    doc.setFontSize(10);
    doc.setTextColor(15, 118, 110);
    doc.text('LAYANAN BIMBINGAN DAN KONSELING (BK)', tengahX, yTop + 8.5, {
      align: 'center',
      maxWidth: lebarTeks
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    var barisInfo = [];
    if (pengaturan.alamat) barisInfo.push(pengaturan.alamat);
    if (pengaturan.kontakSekolah) barisInfo.push(pengaturan.kontakSekolah);
    if (barisInfo.length > 0) {
      doc.text(barisInfo.join(' | '), tengahX, yTop + 13.5, {
        align: 'center',
        maxWidth: lebarTeks
      });
    }

    var yGaris = yTop + 18;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.7);
    doc.line(marginX, yGaris, pageWidth - marginX, yGaris);
    doc.setLineWidth(0.2);
    doc.line(marginX, yGaris + 1.2, pageWidth - marginX, yGaris + 1.2);

    return yGaris + 8;
  }

  /**
   * Menggambar blok tanda tangan resmi di bagian bawah laporan.
   */
  function gambarBlokTandaTangan(doc, pengaturan, startY) {
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var y = startY;

    if (y + 44 > pageHeight - 14) {
      doc.addPage();
      gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
      y = 22;
    }

    var tanggalCetak = formatTanggalIndo(new Date().toISOString());
    var kolomKananX = pageWidth - 78;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    if (pengaturan.kepalaSekolah) {
      doc.text('Mengetahui,', 18, y);
      doc.text('Kepala Sekolah,', 18, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(String(pengaturan.kepalaSekolah), 18, y + 26);
      doc.setFont('helvetica', 'normal');
    }

    doc.text('Dicetak tanggal: ' + tanggalCetak, kolomKananX, y);
    doc.text(String(pengaturan.jabatanPenandaTangan || 'Koordinator Guru BK') + ',', kolomKananX, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(pengaturan.penandaTangan || '______________________'), kolomKananX, y + 26);
  }

  function formatIdentitasSiswa(kasus, sertakanIdentitas) {
    if (kasus.Anonim) {
      return 'Anonim (Jenjang Kelas ' + (kasus.Jenjang || '-') + ')';
    }
    if (!sertakanIdentitas) {
      return 'Identitas Disembunyikan (Jenjang Kelas ' + (kasus.Jenjang || '-') + ')';
    }
    return (kasus.Nama || '-') + ' (Kelas ' + (kasus.Kelas || kasus.Jenjang || '-') + ')';
  }

  /**
   * Membuat PDF Lembar Kasus satuan untuk dikirim ke Guru BK tujuan.
   */
  function buatPdfLembarKasus(opsi) {
    var jsPDF = dapatkanJsPDF();
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var kasus = opsi.kasus;
    var pengaturan = opsi.pengaturan || {};
    var sertakanIdentitas = Boolean(opsi.sertakanIdentitas);

    gambarHeaderFooterHalaman(doc, 1);
    var y = gambarKopSurat(doc, pengaturan);

    var pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('LEMBAR RINGKASAN KASUS KONSELING SISWA', pageWidth / 2, y, { align: 'center' });
    y += 6;

    var rowsMeta = [
      ['ID Kiriman', kasus.IDKiriman || '-'],
      ['Waktu Masuk', formatWaktuLengkapIndo(kasus.Waktu)],
      ['Periode', 'TA ' + (kasus.TahunAjaran || '-') + ' • Semester ' + (kasus.Semester || '-')],
      ['Identitas Siswa', formatIdentitasSiswa(kasus, sertakanIdentitas)],
      ['Kategori Topik', opsi.namaKategori || '-'],
      ['Tingkat Urgensi', kasus.Urgensi || '-'],
      ['Tanda Eskalasi', kasus.LabelEskalasi ? kasus.LabelEskalasi : 'Tidak ada'],
      ['Guru BK Tujuan', opsi.namaGuruTujuan || 'Siapa saja'],
      ['Preferensi Siswa', kasus.PreferensiBalasan || '-'],
      ['Status Penanganan', kasus.Status || 'Baru']
    ];

    if (kasus.DiteruskanKe) {
      rowsMeta.push(['Diteruskan Ke', kasus.DiteruskanKe]);
    }
    if (kasus.RujukanKe) {
      rowsMeta.push(['Rujukan Ke', kasus.RujukanKe]);
    }

    doc.autoTable({
      startY: y,
      head: [['Keterangan', 'Rincian']],
      body: rowsMeta,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold', fillColor: [248, 250, 252] } },
      didDrawPage: function () {
        gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
      }
    });

    y = doc.lastAutoTable.finalY + 7;

    // Bagian Isi Pesan Siswa
    doc.autoTable({
      startY: y,
      head: [['Isi Cerita / Pesan Siswa']],
      body: [[kasus.Pesan || '-']],
      theme: 'grid',
      styles: { fontSize: 9.5, cellPadding: 3.5, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
      didDrawPage: function () {
        gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
      }
    });

    y = doc.lastAutoTable.finalY + 6;

    // Bagian Catatan Internal & Balasan jika ada
    if (kasus.CatatanInternal) {
      doc.autoTable({
        startY: y,
        head: [['Catatan Internal Koordinator / Admin BK']],
        body: [[kasus.CatatanInternal]],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59], overflow: 'linebreak' },
        headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
        didDrawPage: function () {
          gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
        }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    if (kasus.balasan && kasus.balasan.length > 0) {
      var rowsBalasan = kasus.balasan.map(function (b) {
        return [formatWaktuLengkapIndo(b.Waktu), b.Pesan || '-'];
      });
      doc.autoTable({
        startY: y,
        head: [['Waktu Balasan', 'Tanggapan yang Sudah Dikirim ke Siswa']],
        body: rowsBalasan,
        theme: 'grid',
        styles: { fontSize: 8.8, cellPadding: 2.5, textColor: [30, 41, 59], overflow: 'linebreak' },
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 42 } },
        didDrawPage: function () {
          gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
        }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    gambarBlokTandaTangan(doc, pengaturan, y + 4);

    return {
      doc: doc,
      filename: 'Lembar_Kasus_' + (kasus.IDKiriman || 'BK') + '.pdf'
    };
  }

  /**
   * Membuat PDF Rekap Periodik (Bulanan, Semester, atau Tahunan).
   */
  function buatPdfRekapPeriodik(opsi) {
    var jsPDF = dapatkanJsPDF();
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pengaturan = opsi.pengaturan || {};
    var daftarKasus = opsi.daftarKasus || [];
    var petaKategori = opsi.petaKategori || {};
    var petaGuru = opsi.petaGuru || {};
    var sertakanIdentitas = Boolean(opsi.sertakanIdentitas);

    gambarHeaderFooterHalaman(doc, 1);
    var y = gambarKopSurat(doc, pengaturan);

    var pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('LAPORAN REKAPITULASI LAYANAN KONSELING SISWA', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(opsi.subJudulPeriode || 'Periode Laporan', pageWidth / 2, y, { align: 'center' });
    y += 7;

    // Hitung agregasi kategori dan status
    var hitungKategori = {};
    var hitungStatus = { Baru: 0, Dibaca: 0, Ditangani: 0, Selesai: 0, Dirujuk: 0 };

    for (var i = 0; i < daftarKasus.length; i++) {
      var k = daftarKasus[i];
      var namaKat = petaKategori[k.KategoriID] || k.KategoriID || 'Lainnya';
      hitungKategori[namaKat] = (hitungKategori[namaKat] || 0) + 1;

      var st = k.Status || 'Baru';
      hitungStatus[st] = (hitungStatus[st] || 0) + 1;
    }

    var barisKategori = Object.keys(hitungKategori).map(function (nama) {
      return [nama, String(hitungKategori[nama]) + ' kasus'];
    });
    if (barisKategori.length === 0) {
      barisKategori.push(['Tidak ada data kiriman pada periode ini', '0 kasus']);
    }

    doc.autoTable({
      startY: y,
      head: [['Ringkasan Berdasarkan Kategori', 'Jumlah']],
      body: barisKategori,
      theme: 'grid',
      styles: { fontSize: 8.8, cellPadding: 2.3 },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
      columnStyles: { 1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } },
      didDrawPage: function () {
        gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
      }
    });

    y = doc.lastAutoTable.finalY + 5;

    var barisStatus = [
      ['Baru', String(hitungStatus.Baru) + ' kasus'],
      ['Dibaca', String(hitungStatus.Dibaca) + ' kasus'],
      ['Ditangani', String(hitungStatus.Ditangani) + ' kasus'],
      ['Selesai', String(hitungStatus.Selesai) + ' kasus'],
      ['Dirujuk', String(hitungStatus.Dirujuk) + ' kasus'],
      ['TOTAL KESELURUHAN', String(daftarKasus.length) + ' kasus']
    ];

    doc.autoTable({
      startY: y,
      head: [['Ringkasan Berdasarkan Status Penanganan', 'Jumlah']],
      body: barisStatus,
      theme: 'grid',
      styles: { fontSize: 8.8, cellPadding: 2.3 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      columnStyles: { 1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } },
      didDrawPage: function () {
        gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
      }
    });

    y = doc.lastAutoTable.finalY + 7;

    // Daftar Kasus
    var rowsDaftar = daftarKasus.map(function (item, idx) {
      var idTampil = item.Anonim
        ? ('Anonim (Kls ' + item.Jenjang + ')')
        : (sertakanIdentitas ? (item.Nama + ' (' + item.Kelas + ')') : ('Disembunyikan (Kls ' + item.Jenjang + ')'));
      var katTampil = petaKategori[item.KategoriID] || '-';
      if (item.LabelEskalasi) {
        katTampil += ' [ESKALASI]';
      }
      var guruTampil = item.GuruTujuanID ? (petaGuru[item.GuruTujuanID] || '-') : 'Siapa saja';
      return [
        String(idx + 1),
        (item.IDKiriman || '-') + '\n' + formatTanggalIndo(item.Waktu),
        idTampil,
        katTampil,
        item.Urgensi || '-',
        guruTampil,
        item.Status || 'Baru'
      ];
    });

    if (rowsDaftar.length === 0) {
      rowsDaftar.push(['-', '-', 'Tidak ada kasus pada filter yang dipilih', '-', '-', '-', '-']);
    }

    doc.autoTable({
      startY: y,
      head: [['No', 'ID & Tanggal', 'Siswa', 'Kategori', 'Urgensi', 'Guru Tujuan', 'Status']],
      body: rowsDaftar,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 28 },
        4: { cellWidth: 18 },
        6: { cellWidth: 20 }
      },
      didDrawPage: function () {
        gambarHeaderFooterHalaman(doc, doc.internal.getNumberOfPages());
      }
    });

    y = doc.lastAutoTable.finalY + 8;
    gambarBlokTandaTangan(doc, pengaturan, y);

    return {
      doc: doc,
      filename: 'Rekap_BK_' + (opsi.slugPeriode || 'Laporan') + '.pdf'
    };
  }

  /**
   * Mengunduh atau membagikan PDF via Web Share API jika didukung perangkat.
   * Mengembalikan pesan status untuk ditampilkan di toast UI.
   */
  async function keluarkanPdf(hasilPdf, modeShare) {
    var doc = hasilPdf.doc;
    var filename = hasilPdf.filename;

    if (modeShare && navigator.share && navigator.canShare) {
      try {
        var blob = doc.output('blob');
        var file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Laporan Layanan BK (RAHASIA)',
            text: 'Terlampir dokumen laporan layanan BK sekolah (bersifat rahasia).'
          });
          return 'Dokumen PDF siap dibagikan.';
        }
      } catch (errShare) {
        if (errShare && errShare.name === 'AbortError') {
          return 'Berbagi PDF dibatalkan.';
        }
        // Lanjutkan ke unduh otomatis bila gagal berbagi
      }
    }

    doc.save(filename);
    if (modeShare) {
      return 'Perangkat tidak mendukung berbagi berkas langsung; PDF telah diunduh agar dapat dikirim manual.';
    }
    return 'Berkas PDF berhasil diunduh (' + filename + ').';
  }

  return {
    buatPdfLembarKasus: buatPdfLembarKasus,
    buatPdfRekapPeriodik: buatPdfRekapPeriodik,
    keluarkanPdf: keluarkanPdf
  };
})();
