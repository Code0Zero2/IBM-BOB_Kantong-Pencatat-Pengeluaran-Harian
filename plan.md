# PLAN.md — Kantong (Web Pencatat Pengeluaran Harian)

> Dokumen ini adalah sumber acuan utama untuk AI agent. Baca seluruh isi file ini sebelum menulis kode. Kerjakan HANYA fase yang diminta pada prompt, sesuai urutan di bagian "Roadmap".

## 1. Ringkasan Proyek

**Kantong** adalah web app mobile-first untuk mencatat pengeluaran harian dan melihat distribusi pengeluaran per kategori dalam bentuk diagram lingkar. Pengguna dapat membuka aplikasi dan mencatat pengeluaran dalam hitungan detik, baik dari HP maupun desktop.

## 2. Tech Stack & Batasan

- HTML5 semantik, **Tailwind CSS** (via CDN) sebagai styling utama, **Vanilla JavaScript** (tanpa framework).
- Diagram: **Chart.js** via CDN (satu-satunya library tambahan). Jika kelak dilarang memakai library, ganti dengan SVG/CSS `conic-gradient`.
- Penyimpanan: `localStorage` (tanpa backend, tanpa database).
- Bahasa antarmuka: Bahasa Indonesia. Mata uang: Rupiah (format `Rp 25.000`).
- Tiga file utama: `index.html`, `style.css`, `script.js`. `style.css` hanya untuk styling tambahan yang tidak praktis dengan Tailwind.
- Tidak ada build step. Aplikasi harus langsung jalan dengan membuka `index.html` di browser.

## 3. Aturan untuk AI Agent

1. Kode clean, modular, mudah dipelajari; nama variabel dan fungsi jelas; komentar pada bagian penting.
2. Hindari kode yang tidak dipakai dan duplikasi logika.
3. Gunakan kembali fungsi/logika yang sudah ada sebelum membuat yang baru.
4. Jangan mengubah bagian lain di luar yang diminta pada prompt.
5. Semua fitur harus berfungsi tanpa refresh halaman dan bebas error di console.
6. Setelah selesai, tulis ringkasan singkat: file apa yang diubah, fungsi apa yang ditambah, dan cara mengetesnya.
7. Jika instruksi ambigu, pilih opsi paling sederhana dan sebutkan asumsinya di ringkasan.

## 4. Desain & UI

- Palet: biru utama (`blue-600`), putih, aksen oranye (`orange-500`). Merah hanya untuk peringatan budget.
- Card dengan rounded corner (`rounded-2xl`), soft shadow, hover effect, transisi halus.
- Mobile-first: satu kolom di HP, dua kolom di layar `lg`. Tidak boleh ada scroll horizontal pada lebar 320px.
- Area sentuh minimal 44x44px. Tombol tambah mengambang (FAB) di kanan bawah.
- Navigasi: bottom navigation di HP (Dashboard, Riwayat, Pengaturan); di desktop wajib berupa navbar atas di layar lg ke atas; bottom navigation hanya tampil di bawah lg.
- Form tambah/edit tampil sebagai modal / bottom sheet.
- Sediakan empty state yang ramah saat belum ada data.

## 5. Struktur Layar

1. **Dashboard**: total pengeluaran periode terpilih, diagram lingkar per kategori (dengan legenda dan persentase), 5 transaksi terakhir, kartu anggaran bulanan.
2. **Riwayat**: daftar lengkap transaksi, filter periode, pencarian, sortir.
3. **Tambah/Edit Pengeluaran**: modal berisi nominal, kategori, tanggal, catatan.
4. **Pengaturan**: anggaran bulanan, kelola kategori, ekspor/impor data, dark mode.

## 6. Model Data

Disimpan di `localStorage` sebagai JSON.

```js
// key: "kantong_transactions"
{
  id: "string unik",        // contoh: Date.now().toString()
  amount: 25000,            // number, rupiah, > 0
  categoryId: "makan",      // merujuk ke kategori
  date: "2026-10-31",       // format YYYY-MM-DD
  note: "Makan siang",      // string, opsional
  createdAt: 1761900000000  // timestamp
}

// key: "kantong_categories"
{ id: "makan", name: "Makan", color: "#f97316", icon: "🍜" }

// key: "kantong_settings"
{ monthlyBudget: 2000000, darkMode: false }
```

Kategori bawaan: Makan, Transport, Belanja, Hiburan, Tagihan, Kesehatan, Lainnya.

## 7. Roadmap (Kerjakan Per Fase)

### Fase 1 — Fondasi : Selesai 

### Fase 2 — Diagram Lingkar : Selesai HP.

### Fase 3 — Filter Periode : Selesai 

### Fase 4 — Anggaran Bulanan : Selesai 

### Fase 5 — Kustomisasi & Kenyamanan : Selesai 

### Fase 6 — Polishing & Nilai Plus
- Ekspor/impor data (JSON, dan CSV untuk ekspor).
- Insight otomatis (contoh: "Pengeluaran terbesar bulan ini: Makan (42%)").
- Animasi halus, empty state, pesan error yang jelas, toast notifikasi.
- (Opsional) PWA: `manifest.json` dan service worker agar bisa di-install dan offline.
- Pengecekan aksesibilitas dasar: label form, kontras warna, fokus keyboard.

## 8. Definition of Done (Akhir Proyek)

- [ ] CRUD transaksi berfungsi penuh dan tersimpan di `localStorage`.
- [ ] Diagram lingkar per kategori akurat dan dinamis.
- [ ] Filter periode, anggaran bulanan, dan kategori kustom berfungsi.
- [ ] Tampilan rapi di 320px, 375px, 768px, dan 1280px; tidak ada scroll horizontal.
- [ ] Tidak ada error di console browser.
- [ ] Tidak ada kode mati atau duplikasi; komentar pada bagian penting.
- [ ] README singkat berisi cara menjalankan dan daftar fitur.

## 9. Checklist Pengujian Manual

- Tambah, edit, hapus transaksi; refresh halaman; data tetap ada.
- Input nominal 0, kosong, dan sangat besar (misal 999.999.999).
- Hapus semua transaksi: empty state muncul, diagram tidak error.
- Ganti filter periode: total, diagram, dan daftar sinkron.
- Lewati batas anggaran: warna progress berubah.
- Buka di mode responsif DevTools (iPhone SE, Pixel 7, iPad) dan di HP asli.
- Ekspor data lalu impor kembali: hasil identik.
