# Kantong 👜

Web app mobile-first untuk mencatat pengeluaran harian, melihat distribusi per kategori, dan memantau anggaran bulanan.

## Cara Menjalankan

Tidak perlu server atau build step. Cukup buka **`index.html`** di browser:

```
# Klik dua kali index.html
# atau jalankan server lokal ringan:
npx serve .
# atau
python -m http.server 8080
```

> Untuk fitur PWA (install ke home screen), buka lewat `https://` atau `localhost`.

## Fitur

| Fitur | Keterangan |
|---|---|
| **CRUD Transaksi** | Tambah, edit, hapus dengan konfirmasi. Data tersimpan di `localStorage`. |
| **Diagram Lingkar** | Doughnut Chart.js pengeluaran per kategori; update otomatis. |
| **Filter Periode** | Hari Ini, Minggu Ini (Senin–Minggu), Bulan Ini, atau rentang Custom. |
| **Anggaran Bulanan** | Progress bar warna dinamis (biru → oranye → merah) + peringatan lebih batas. |
| **Kategori Kustom** | Tambah, edit, hapus kategori (nama, ikon emoji, warna). |
| **Format Rupiah** | Input nominal diformat otomatis (titik ribuan); nilai tersimpan tetap number. |
| **Pencarian & Sortir** | Cari catatan/kategori real-time; sortir Terbaru/Terlama/Terbesar/Terkecil. |
| **Dark Mode** | Toggle tersimpan; default mengikuti `prefers-color-scheme`. |
| **Insight Otomatis** | Kategori terbesar, rata-rata harian, hari pengeluaran tertinggi. |
| **Ekspor JSON** | Backup lengkap (transaksi + kategori + pengaturan), nama file berisi tanggal. |
| **Ekspor CSV** | Kompatibel Excel; kolom: Tanggal, Kategori, Nominal, Catatan. |
| **Impor JSON** | Validasi struktur + konfirmasi sebelum menimpa data. |
| **PWA** | `manifest.json` + service worker — dapat di-install dan berjalan offline. |
| **Aksesibilitas** | Label form, `aria-label` tombol ikon, fokus keyboard terlihat, Escape menutup modal. |

## Struktur File

```
kantong/
├── index.html      — shell HTML, semua layar (Dashboard, Riwayat, Pengaturan), modal
├── style.css       — styling tambahan (tab filter, toast, focus-ring, dark mode override)
├── script.js       — seluruh logika: state, CRUD, render, filter, ekspor/impor
├── manifest.json   — PWA manifest
├── sw.js           — service worker (cache-first)
└── plan.md         — dokumen perencanaan
```

## Tech Stack

- **HTML5** semantik
- **Tailwind CSS** via CDN (dark mode class strategy)
- **Vanilla JavaScript** — tanpa framework, tanpa build step
- **Chart.js** via CDN — diagram doughnut
- **localStorage** — penyimpanan lokal

## Catatan Pengembangan

- Data model: `kantong_transactions`, `kantong_categories`, `kantong_settings` di `localStorage`.
- Semua render mengacu ke `getFilteredTransactions()` sebagai satu sumber kebenaran periode.
- `buildChartData()` dan `renderInsights()` reuse state yang sama — tidak ada duplikasi kalkulasi.
