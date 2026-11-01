/**
 * script.js — Kantong
 * Fase 1: CRUD transaksi, localStorage, validasi form, rendering daftar.
 *
 * Arsitektur sederhana:
 *  - State : satu sumber kebenaran di memory (transactions, categories)
 *  - Store : baca/tulis localStorage
 *  - UI    : render ulang bagian tertentu setiap ada perubahan data
 */

'use strict';

/* ============================================================
   1. KONSTANTA & KATEGORI BAWAAN
   ============================================================ */

const STORAGE_KEY_TRANSACTIONS = 'kantong_transactions';
const STORAGE_KEY_CATEGORIES   = 'kantong_categories';
const STORAGE_KEY_SETTINGS     = 'kantong_settings';

/** Kategori bawaan sesuai spesifikasi plan.md */
const DEFAULT_CATEGORIES = [
  { id: 'makan',     name: 'Makan',     color: '#f97316', icon: '🍜' },
  { id: 'transport', name: 'Transport', color: '#3b82f6', icon: '🚗' },
  { id: 'belanja',   name: 'Belanja',   color: '#a855f7', icon: '🛍️' },
  { id: 'hiburan',   name: 'Hiburan',   color: '#ec4899', icon: '🎮' },
  { id: 'tagihan',   name: 'Tagihan',   color: '#ef4444', icon: '🧾' },
  { id: 'kesehatan', name: 'Kesehatan', color: '#22c55e', icon: '💊' },
  { id: 'lainnya',   name: 'Lainnya',   color: '#94a3b8', icon: '📦' },
];

/* ============================================================
   2. STORE — localStorage helpers
   ============================================================ */

const Store = {
  /** Baca array transaksi dari localStorage */
  getTransactions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS)) || [];
    } catch {
      return [];
    }
  },

  /** Tulis array transaksi ke localStorage */
  saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  },

  /** Baca kategori; inisialisasi dengan DEFAULT_CATEGORIES jika belum ada */
  getCategories() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES));
      return stored && stored.length ? stored : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  },

  /** Tulis kategori ke localStorage */
  saveCategories(categories) {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
  },

  /** Baca pengaturan */
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS)) || { monthlyBudget: 0, darkMode: false };
    } catch {
      return { monthlyBudget: 0, darkMode: false };
    }
  },

  /** Tulis pengaturan ke localStorage */
  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  },
};

/* ============================================================
   3. STATE (runtime)
   ============================================================ */

let transactions = Store.getTransactions();
let categories   = Store.getCategories();
let settings     = Store.getSettings();

// Simpan kategori bawaan jika belum ada
if (!localStorage.getItem(STORAGE_KEY_CATEGORIES)) {
  Store.saveCategories(DEFAULT_CATEGORIES);
}

/** ID transaksi yang sedang diedit (null = mode tambah baru) */
let editingId = null;

/** ID transaksi yang akan dihapus (tunggu konfirmasi) */
let pendingDeleteId = null;

/** Layar aktif saat ini */
let activeScreen = 'dashboard';

/** Urutan sortir aktif di Riwayat: newest | oldest | largest | smallest */
let activeSortOrder = 'newest';

/**
 * Periode aktif untuk filter. Single source of truth untuk semua render.
 * type: 'month' | 'week' | 'today' | 'custom'
 * start/end: 'YYYY-MM-DD' — hanya dipakai saat type === 'custom'
 */
let activePeriod = { type: 'month', start: null, end: null };

/* ============================================================
   4. UTILITAS
   ============================================================ */

/**
 * Format angka ke format Rupiah: 25000 → "Rp 25.000"
 * @param {number} amount
 * @returns {string}
 */
function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

/**
 * Format tanggal YYYY-MM-DD ke tampilan lokal: "31 Okt 2026"
 * @param {string} dateStr format YYYY-MM-DD
 * @returns {string}
 */
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

/**
 * Tanggal hari ini dalam format YYYY-MM-DD (untuk value default field tanggal)
 * @returns {string}
 */
function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ============================================================
   3b. FILTER PERIODE — Fase 3
   ============================================================ */

/**
 * Kembalikan daftar transaksi yang sesuai dengan `activePeriod`.
 * INI adalah satu-satunya tempat logika filter periode.
 * Semua fungsi render harus memanggil ini, bukan memfilter sendiri.
 *
 * @returns {object[]} array transaksi yang sudah difilter
 */
function getFilteredTransactions() {
  const now   = new Date();
  const today = todayString();

  if (activePeriod.type === 'today') {
    return transactions.filter(tx => tx.date === today);
  }

  if (activePeriod.type === 'week') {
    // Minggu dimulai Senin (ISO): hitung Senin minggu ini
    const day = now.getDay();                       // 0=Sun…6=Sat
    const diffToMonday = (day === 0 ? -6 : 1 - day); // jarak ke Senin
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monStr = monday.toISOString().slice(0, 10);
    const sunStr = sunday.toISOString().slice(0, 10);

    return transactions.filter(tx => tx.date >= monStr && tx.date <= sunStr);
  }

  if (activePeriod.type === 'custom') {
    const { start, end } = activePeriod;
    if (!start || !end) return [];
    return transactions.filter(tx => tx.date >= start && tx.date <= end);
  }

  // default: 'month'
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return transactions.filter(tx => {
    const [ty, tm] = tx.date.split('-').map(Number);
    return ty === y && tm === m;
  });
}

/**
 * Teks label untuk total-card dan header sesuai periode aktif.
 * @returns {string}
 */
function getPeriodLabel() {
  if (activePeriod.type === 'today')  return 'Hari Ini';
  if (activePeriod.type === 'week')   return 'Minggu Ini';
  if (activePeriod.type === 'custom') {
    const { start, end } = activePeriod;
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
    return 'Custom';
  }
  return 'Bulan Ini';
}

/**
 * Hitung jumlah transaksi untuk tipe periode tertentu
 * (untuk badge pada tab).
 * @param {string} type - 'today' | 'week' | 'month' | 'custom'
 * @returns {number}
 */
function countForPeriod(type) {
  const saved = activePeriod;
  // Ubah sementara, hitung, kembalikan
  activePeriod = { ...saved, type };
  const count = getFilteredTransactions().length;
  activePeriod = saved;
  return count;
}

/**
 * Perbarui tampilan visual kedua set tab (dashboard + riwayat):
 *  - aktifkan tab yang sesuai activePeriod
 *  - tulis badge jumlah transaksi di setiap tab
 */
function renderPeriodTabs() {
  // Hitung badge sekali, reuse untuk kedua set tab
  const counts = {
    today:  countForPeriod('today'),
    week:   countForPeriod('week'),
    month:  countForPeriod('month'),
    custom: activePeriod.type === 'custom' ? getFilteredTransactions().length : null,
  };

  const labelMap = {
    today:  'Hari Ini',
    week:   'Minggu Ini',
    month:  'Bulan Ini',
    custom: 'Custom',
  };

  ['period-tabs', 'period-tabs-history'].forEach(tabsId => {
    const container = document.getElementById(tabsId);
    if (!container) return;

    container.querySelectorAll('.period-tab').forEach(btn => {
      const p     = btn.dataset.period;
      const isActive = p === activePeriod.type;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      // Badge: tampilkan jika ada data; untuk custom hanya saat aktif
      const n = counts[p];
      if (n !== null && n > 0) {
        btn.textContent = `${labelMap[p]} (${n})`;
      } else {
        btn.textContent = labelMap[p];
      }
    });
  });

  // Perbarui teks di header top bar
  const headerPeriod = document.getElementById('header-period');
  if (headerPeriod) headerPeriod.textContent = getPeriodLabel();
}

/**
 * Ambil objek kategori berdasarkan id
 * @param {string} categoryId
 * @returns {object|undefined}
 */
function getCategoryById(categoryId) {
  return categories.find(c => c.id === categoryId);
}

/**
 * Buat elemen <li> untuk satu transaksi
 * @param {object} tx - objek transaksi
 * @returns {HTMLLIElement}
 */
function createTransactionItem(tx) {
  const cat = getCategoryById(tx.categoryId);
  const icon  = cat ? cat.icon  : '📦';
  const name  = cat ? cat.name  : 'Lainnya';
  const color = cat ? cat.color : '#94a3b8';

  const li = document.createElement('li');
  li.className = 'transaction-item flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0';
  li.dataset.id = tx.id;

  li.innerHTML = `
    <!-- Ikon kategori -->
    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
         style="background-color: ${color}22;">
      <span>${icon}</span>
    </div>

    <!-- Info transaksi -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${escapeHtml(tx.note || name)}</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">${formatDate(tx.date)} · ${escapeHtml(name)}</p>
    </div>

    <!-- Nominal + tombol aksi -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">${formatRupiah(tx.amount)}</span>
      <button
        class="btn-edit text-gray-400 hover:text-blue-600 transition p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40"
        data-id="${tx.id}"
        aria-label="Edit transaksi"
      >✏️</button>
      <button
        class="btn-delete text-gray-400 hover:text-red-600 transition p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40"
        data-id="${tx.id}"
        aria-label="Hapus transaksi"
      >🗑️</button>
    </div>
  `;

  return li;
}

/**
 * Escape karakter HTML untuk menghindari XSS pada input user
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, ch => map[ch]);
}

/**
 * Tampilkan toast notifikasi singkat di layar.
 * @param {string} message - pesan yang ditampilkan
 * @param {number} [duration=2200] - durasi tampil dalam ms
 */
function showToast(message, duration = 2200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

/* ============================================================
   5. RENDER — memperbarui tampilan berdasarkan state
   ============================================================ */

/** Render daftar 5 transaksi terbaru di Dashboard */
function renderDashboard() {
  const recentList    = document.getElementById('recent-list');
  const emptyDash     = document.getElementById('empty-dashboard');
  const totalAmountEl = document.getElementById('total-amount');
  const totalLabel    = document.getElementById('total-label');

  // Gunakan getFilteredTransactions() — satu sumber kebenaran (Fase 3)
  const filtered = getFilteredTransactions();

  const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  totalAmountEl.textContent = formatRupiah(total);

  // Perbarui label subtitle kartu sesuai periode aktif
  if (totalLabel) totalLabel.textContent = `Total Pengeluaran — ${getPeriodLabel()}`;

  // Diagram lingkar — render terlepas dari ada/tidaknya transaksi
  renderChart();

  // Insight otomatis (Fase 6)
  renderInsights();

  // 5 transaksi terbaru dari hasil filter (urut dari paling baru)
  const recent = [...filtered]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  recentList.innerHTML = '';

  if (recent.length === 0) {
    emptyDash.classList.remove('hidden');
    return;
  }

  emptyDash.classList.add('hidden');
  recent.forEach(tx => recentList.appendChild(createTransactionItem(tx)));
}

/** Render semua transaksi di layar Riwayat (mendukung pencarian + filter periode + sortir) */
function renderHistory(query = '') {
  const historyList  = document.getElementById('history-list');
  const emptyHistory = document.getElementById('empty-history');

  // Mulai dari transaksi yang sudah difilter periode (Fase 3)
  const periodFiltered = getFilteredTransactions();

  // Filter berdasarkan query pencarian (tidak case-sensitive)
  const q = query.trim().toLowerCase();
  const searched = periodFiltered.filter(tx => {
    if (!q) return true;
    const cat = getCategoryById(tx.categoryId);
    const catName = cat ? cat.name.toLowerCase() : '';
    return (
      (tx.note || '').toLowerCase().includes(q) ||
      catName.includes(q)
    );
  });

  // Sortir sesuai activeSortOrder (Fase 5)
  const sortFns = {
    newest:   (a, b) => b.createdAt - a.createdAt,
    oldest:   (a, b) => a.createdAt - b.createdAt,
    largest:  (a, b) => b.amount    - a.amount,
    smallest: (a, b) => a.amount    - b.amount,
  };
  const filtered = [...searched].sort(sortFns[activeSortOrder] || sortFns.newest);

  historyList.innerHTML = '';

  if (filtered.length === 0) {
    emptyHistory.classList.remove('hidden');
    return;
  }

  emptyHistory.classList.add('hidden');
  filtered.forEach(tx => historyList.appendChild(createTransactionItem(tx)));
}

/** Isi opsi <select> kategori pada form */
function renderCategoryOptions() {
  const sel = document.getElementById('field-category');
  // Pertahankan pilihan saat ini jika ada
  const current = sel.value;
  sel.innerHTML = '<option value="">— Pilih kategori —</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat.id;
    opt.textContent = `${cat.icon}  ${cat.name}`;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

/* ============================================================
   5d. INSIGHT OTOMATIS — Fase 6
   ============================================================ */

/**
 * Hitung dan tampilkan 2-3 kalimat insight dari periode aktif.
 * Reuses getFilteredTransactions() dan getCategoryById() yang sudah ada.
 */
function renderInsights() {
  const card = document.getElementById('insight-card');
  const text = document.getElementById('insight-text');
  if (!card || !text) return;

  const filtered = getFilteredTransactions();

  if (filtered.length === 0) {
    card.classList.add('hidden');
    return;
  }

  const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

  // ── Kategori terbesar ──
  const map = {};
  filtered.forEach(tx => {
    map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
  });
  const [topCatId, topAmt] = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  const topCat  = getCategoryById(topCatId);
  const topName = topCat ? `${topCat.icon} ${topCat.name}` : topCatId;
  const topPct  = ((topAmt / total) * 100).toFixed(0);

  // ── Rata-rata harian ──
  const dates = [...new Set(filtered.map(tx => tx.date))];
  const avgDaily = Math.round(total / dates.length);

  // ── Hari pengeluaran tertinggi ──
  const byDate = {};
  filtered.forEach(tx => { byDate[tx.date] = (byDate[tx.date] || 0) + tx.amount; });
  const [peakDate, peakAmt] = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
  const peakLabel = formatDate(peakDate);

  const sentences = [
    `Pengeluaran terbesar: <strong>${escapeHtml(topName)}</strong> sebesar ${formatRupiah(topAmt)} (${topPct}%).`,
    dates.length > 1
      ? `Rata-rata pengeluaran harian ${formatRupiah(avgDaily)}.`
      : null,
    dates.length > 1
      ? `Hari tertinggi: <strong>${peakLabel}</strong> dengan total ${formatRupiah(peakAmt)}.`
      : null,
  ].filter(Boolean);

  text.innerHTML = sentences.join(' ');
  card.classList.remove('hidden');
}

/* ============================================================
   5e. EKSPOR & IMPOR — Fase 6
   ============================================================ */

/**
 * Unduh string sebagai file.
 * @param {string} content  - isi file
 * @param {string} filename - nama file
 * @param {string} mime     - tipe MIME
 */
function downloadFile(content, filename, mime) {
  const a    = document.createElement('a');
  const blob = new Blob([content], { type: mime });
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * Ekspor semua data (transactions, categories, settings) sebagai JSON.
 * Nama file menyertakan tanggal hari ini.
 */
function exportJSON() {
  const payload = { transactions, categories, settings };
  const date    = todayString();
  downloadFile(
    JSON.stringify(payload, null, 2),
    `kantong-backup-${date}.json`,
    'application/json'
  );
  showToast('✅ Data diekspor sebagai JSON');
}

/**
 * Ekspor transaksi sebagai CSV: Tanggal, Kategori, Nominal, Catatan.
 */
function exportCSV() {
  const header = ['Tanggal', 'Kategori', 'Nominal', 'Catatan'];
  const rows   = [...transactions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(tx => {
      const cat  = getCategoryById(tx.categoryId);
      const name = cat ? cat.name : tx.categoryId;
      // Escape nilai yang mengandung koma atau petik
      const esc  = v => `"${String(v).replace(/"/g, '""')}"`;
      return [tx.date, esc(name), tx.amount, esc(tx.note || '')].join(',');
    });
  const csv  = [header.join(','), ...rows].join('\r\n');
  const date = todayString();
  downloadFile(csv, `kantong-${date}.csv`, 'text/csv');
  showToast('✅ Data diekspor sebagai CSV');
}

/**
 * Impor data dari file JSON yang diunggah user.
 * Validasi struktur, minta konfirmasi, lalu timpa data.
 * @param {File} file
 */
function importJSON(file) {
  const errEl = document.getElementById('err-import');
  errEl.classList.add('hidden');

  const reader = new FileReader();
  reader.onload = e => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch {
      errEl.textContent = 'File tidak valid: bukan JSON yang dapat dibaca.';
      errEl.classList.remove('hidden');
      return;
    }

    // Validasi struktur minimum
    if (!Array.isArray(parsed.transactions)) {
      errEl.textContent = 'File tidak valid: field "transactions" tidak ditemukan atau bukan array.';
      errEl.classList.remove('hidden');
      return;
    }

    // Periksa setiap transaksi punya field wajib
    const invalid = parsed.transactions.find(
      tx => !tx.id || typeof tx.amount !== 'number' || !tx.date || !tx.categoryId
    );
    if (invalid) {
      errEl.textContent = 'File tidak valid: ada transaksi dengan data tidak lengkap.';
      errEl.classList.remove('hidden');
      return;
    }

    if (!confirm(`Impor akan menimpa ${transactions.length} transaksi yang ada.\nLanjutkan?`)) {
      // Reset input file agar bisa impor ulang file yang sama
      document.getElementById('input-import').value = '';
      return;
    }

    // Terapkan data yang diimpor
    transactions = parsed.transactions;
    categories   = Array.isArray(parsed.categories) && parsed.categories.length
      ? parsed.categories
      : DEFAULT_CATEGORIES;
    if (parsed.settings && typeof parsed.settings === 'object') {
      settings = parsed.settings;
    }

    Store.saveTransactions(transactions);
    Store.saveCategories(categories);
    Store.saveSettings(settings);

    document.getElementById('input-import').value = '';
    applyDarkMode(settings.darkMode || false);
    renderAll();
    renderCategoryList();
    showScreen('dashboard');
    showToast(`✅ Impor berhasil — ${transactions.length} transaksi dimuat`);
  };
  reader.readAsText(file);
}

/** Render seluruh UI berdasarkan layar aktif */
function renderAll() {
  renderPeriodTabs();               // badge + active state tab (Fase 3)
  renderDashboard();
  renderBudgetCard();               // kartu anggaran (Fase 4)
  const searchInput = document.getElementById('search-input');
  renderHistory(searchInput ? searchInput.value : '');  // sort state used inside
}

/* ============================================================
   5c. KATEGORI KUSTOM — Fase 5
   ============================================================ */

/**
 * Reset form kategori ke mode "tambah baru"
 */
function resetCatForm() {
  document.getElementById('cat-edit-id').value = '';
  document.getElementById('cat-name').value    = '';
  document.getElementById('cat-icon').value    = '';
  document.getElementById('cat-color').value   = '#3b82f6';
  document.getElementById('err-cat-name').classList.add('hidden');
  document.getElementById('btn-cancel-cat').classList.add('hidden');
  document.getElementById('btn-save-cat').textContent = 'Simpan Kategori';
}

/**
 * Render daftar kategori di layar Pengaturan.
 * Dipanggil saat settings dibuka dan setelah setiap perubahan kategori.
 */
function renderCategoryList() {
  const ul = document.getElementById('cat-list');
  if (!ul) return;
  ul.innerHTML = '';

  categories.forEach(cat => {
    const isFixed = cat.id === 'lainnya';   // "Lainnya" tidak bisa dihapus
    const li = document.createElement('li');
    li.className = 'flex items-center gap-3 py-2 border-b border-gray-100 last:border-0';
    li.innerHTML = `
      <span class="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
            style="background:${cat.color}22;">${cat.icon || '📦'}</span>
      <span class="flex-1 text-sm text-gray-800">${escapeHtml(cat.name)}</span>
      <span class="w-4 h-4 rounded-full flex-shrink-0" style="background:${cat.color}"></span>
      <button class="btn-cat-edit text-gray-400 hover:text-blue-600 transition p-1 rounded-lg hover:bg-blue-50"
              data-cat-id="${cat.id}" aria-label="Edit kategori">✏️</button>
      <button class="btn-cat-delete text-gray-400 hover:text-red-600 transition p-1 rounded-lg hover:bg-red-50 ${isFixed ? 'opacity-30 cursor-not-allowed' : ''}"
              data-cat-id="${cat.id}" aria-label="Hapus kategori" ${isFixed ? 'disabled' : ''}>🗑️</button>
    `;
    ul.appendChild(li);
  });
}

/**
 * Simpan (tambah atau perbarui) kategori dari form.
 * Mengembalikan true jika berhasil, false jika validasi gagal.
 */
function saveCategoryFromForm() {
  const editId = document.getElementById('cat-edit-id').value.trim();
  const name   = document.getElementById('cat-name').value.trim();
  const icon   = document.getElementById('cat-icon').value.trim() || '📦';
  const color  = document.getElementById('cat-color').value;
  const errEl  = document.getElementById('err-cat-name');

  // Validasi: nama wajib dan tidak duplikat (kecuali nama milik sendiri saat edit)
  if (!name) {
    errEl.textContent = 'Nama kategori wajib diisi.';
    errEl.classList.remove('hidden');
    return false;
  }

  const duplicate = categories.find(c =>
    c.name.toLowerCase() === name.toLowerCase() && c.id !== editId
  );
  if (duplicate) {
    errEl.textContent = 'Nama kategori sudah ada.';
    errEl.classList.remove('hidden');
    return false;
  }

  errEl.classList.add('hidden');

  if (editId) {
    // Mode edit — pertahankan id
    categories = categories.map(c =>
      c.id === editId ? { ...c, name, icon, color } : c
    );
  } else {
    // Mode tambah — id dari nama (slug sederhana) + timestamp agar unik
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    categories.push({ id, name, icon, color });
  }

  Store.saveCategories(categories);
  renderCategoryList();
  renderCategoryOptions();  // perbarui dropdown di form transaksi
  renderAll();              // diagram & legenda pakai data kategori terbaru
  const wasEdit = !!editId; // simpan sebelum resetCatForm membersihkan field
  resetCatForm();
  showToast(wasEdit ? '✅ Kategori diperbarui' : '✅ Kategori ditambahkan');
  return true;
}

/**
 * Hapus kategori. Jika dipakai transaksi, pindahkan ke "lainnya".
 * @param {string} catId
 */
function deleteCategory(catId) {
  if (catId === 'lainnya') return;   // "Lainnya" tidak bisa dihapus

  const usedCount = transactions.filter(tx => tx.categoryId === catId).length;

  if (usedCount > 0) {
    const cat = getCategoryById(catId);
    const catName = cat ? cat.name : catId;
    const confirmed = confirm(
      `Kategori "${catName}" dipakai oleh ${usedCount} transaksi.\n` +
      `Transaksi tersebut akan dipindahkan ke "Lainnya".\n\nLanjutkan?`
    );
    if (!confirmed) return;

    // Pindahkan semua transaksi ke "lainnya"
    transactions = transactions.map(tx =>
      tx.categoryId === catId ? { ...tx, categoryId: 'lainnya' } : tx
    );
    Store.saveTransactions(transactions);
  }

  categories = categories.filter(c => c.id !== catId);
  Store.saveCategories(categories);
  renderCategoryList();
  renderCategoryOptions();
  renderAll();
  showToast('🗑️ Kategori dihapus');
}

/* ============================================================
   5c. ANGGARAN BULANAN — Fase 4
   ============================================================ */

/**
 * Total pengeluaran bulan berjalan (kalender), terlepas dari filter periode.
 * Reuses state `transactions` yang sudah ada — tidak ada duplikasi kalkulasi.
 * @returns {number}
 */
function getMonthlySpent() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return transactions
    .filter(tx => {
      const [ty, tm] = tx.date.split('-').map(Number);
      return ty === y && tm === m;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Render kartu anggaran bulanan di dashboard.
 * Selalu memakai bulan berjalan (tidak ikut filter periode).
 */
function renderBudgetCard() {
  const card = document.getElementById('budget-card');
  if (!card) return;

  const budget = settings.monthlyBudget || 0;

  // Belum ada anggaran → empty state ajakan mengatur
  if (budget <= 0) {
    card.innerHTML = `
      <div class="text-center py-6 text-gray-400 dark:text-gray-500">
        <p class="text-3xl mb-2">🎯</p>
        <p class="text-sm">Anggaran bulanan belum diatur.</p>
        <p class="text-xs mt-1">Atur di menu <strong class="text-blue-600">Pengaturan</strong>.</p>
      </div>`;
    return;
  }

  const spent = getMonthlySpent();           // reuse — tanpa duplikasi
  const remaining = budget - spent;
  const pct = Math.min((spent / budget) * 100, 100);  // cap 100% untuk bar
  const over = spent > budget;

  // Warna progress: biru <70%, oranye 70-99%, merah >=100%
  let barColor = 'bg-blue-500';
  if (pct >= 100)      barColor = 'bg-red-500';
  else if (pct >= 70)  barColor = 'bg-orange-500';

  const overText = over
    ? `<p class="text-xs text-red-500 font-medium mt-1">
         Melebihi anggaran ${formatRupiah(Math.abs(remaining))}
       </p>`
    : '';

  card.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-gray-700 dark:text-gray-200">Anggaran Bulan Ini</h2>
      <span class="text-xs text-gray-400 dark:text-gray-500">${pct.toFixed(0)}%</span>
    </div>

    <!-- Progress bar -->
    <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden mb-3">
      <div class="${barColor} h-2.5 rounded-full transition-all duration-500"
           style="width:${pct}%"
           role="progressbar"
           aria-valuenow="${pct.toFixed(0)}"
           aria-valuemin="0"
           aria-valuemax="100"></div>
    </div>

    <!-- Tiga angka: anggaran, terpakai, sisa -->
    <div class="grid grid-cols-3 gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
      <div>
        <p class="font-semibold text-gray-800 dark:text-gray-100 text-sm">${formatRupiah(budget)}</p>
        <p>Anggaran</p>
      </div>
      <div>
        <p class="font-semibold text-gray-800 dark:text-gray-100 text-sm">${formatRupiah(spent)}</p>
        <p>Terpakai</p>
      </div>
      <div>
        <p class="font-semibold ${over ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'} text-sm">
          ${formatRupiah(Math.abs(remaining))}
        </p>
        <p>${over ? 'Lebih' : 'Sisa'}</p>
      </div>
    </div>
    ${overText}`;
}

/* ============================================================
   5b. DIAGRAM LINGKAR — Fase 2
   ============================================================ */

/**
 * Referensi ke instance Chart.js yang sedang aktif.
 * Disimpan agar bisa di-destroy sebelum membuat yang baru
 * (mencegah "Canvas already in use" warning dari Chart.js).
 * @type {Chart|null}
 */
let chartInstance = null;

/**
 * Hitung total pengeluaran per kategori untuk transaksi bulan berjalan,
 * menggunakan state `transactions` dan `categories` yang sudah ada.
 *
 * @returns {{ labels: string[], data: number[], colors: string[], total: number }}
 */
function buildChartData() {
  // Gunakan getFilteredTransactions() — ikut filter periode aktif (Fase 3)
  const filtered = getFilteredTransactions();

  const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

  // Akumulasi per kategori
  const map = {};
  filtered.forEach(tx => {
    map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
  });

  // Susun array paralel untuk Chart.js
  const labels = [];
  const data   = [];
  const colors = [];

  Object.entries(map)
    .sort((a, b) => b[1] - a[1])        // urutkan dari terbesar
    .forEach(([catId, amount]) => {
      const cat = getCategoryById(catId);  // fungsi yang sudah ada
      labels.push(cat ? `${cat.icon} ${cat.name}` : catId);
      data.push(amount);
      colors.push(cat ? cat.color : '#94a3b8');
    });

  return { labels, data, colors, total };
}

/**
 * Render diagram doughnut + legenda kustom di dashboard.
 * Dipanggil setiap kali data berubah (lewat renderDashboard).
 * Chart di-destroy lalu dibuat ulang agar selalu segar.
 */
function renderChart() {
  const chartWrap  = document.getElementById('chart-wrap');
  const chartEmpty = document.getElementById('chart-empty');
  const legendEl   = document.getElementById('chart-legend');
  const canvas     = document.getElementById('category-chart');

  const { labels, data, colors, total } = buildChartData();

  // Tidak ada data bulan ini → tampilkan empty state
  if (data.length === 0) {
    chartWrap.classList.add('hidden');
    chartEmpty.classList.remove('hidden');
    // Hancurkan chart lama jika ada
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  chartEmpty.classList.add('hidden');
  chartWrap.classList.remove('hidden');

  // Hancurkan instance lama sebelum membuat baru
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      plugins: {
        legend: { display: false },   // legenda kustom di bawah
        tooltip: {
          callbacks: {
            label(ctx) {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${formatRupiah(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  // ── Legenda kustom ──
  legendEl.innerHTML = '';
  labels.forEach((label, i) => {
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
    const li  = document.createElement('li');
    li.className = 'flex items-center justify-between gap-2 py-1 border-b border-gray-100 last:border-0';
    li.innerHTML = `
      <span class="flex items-center gap-2 min-w-0">
        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${colors[i]}"></span>
        <span class="truncate text-gray-700">${escapeHtml(label)}</span>
      </span>
      <span class="flex-shrink-0 text-right text-gray-500">
        <span class="font-medium text-gray-800">${formatRupiah(data[i])}</span>
        <span class="ml-1 text-xs">${pct}%</span>
      </span>
    `;
    legendEl.appendChild(li);
  });
}

/* ============================================================
   6. NAVIGASI ANTAR LAYAR
   ============================================================ */

/**
 * Tampilkan layar yang diminta, sembunyikan yang lain
 * @param {string} screenName - 'dashboard' | 'history' | 'settings'
 */
function showScreen(screenName) {
  activeScreen = screenName;

  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.remove('hidden');

  // Update status aktif pada bottom nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === screenName);
  });

  // Render konten layar yang baru dibuka
  if (screenName === 'dashboard') renderDashboard();
  if (screenName === 'history')   renderHistory();
  if (screenName === 'settings')  renderCategoryList();
}

/* ============================================================
   7. MODAL — buka / tutup
   ============================================================ */

/** Buka modal tambah transaksi baru */
function openModalAdd() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Tambah Transaksi';
  document.getElementById('field-id').value          = '';
  const amtEl = document.getElementById('field-amount');
  amtEl.value       = '';
  amtEl.dataset.raw = '';
  document.getElementById('field-category').value = '';
  document.getElementById('field-date').value     = todayString();
  document.getElementById('field-note').value     = '';
  clearFormErrors();
  renderCategoryOptions();
  document.getElementById('modal-overlay').classList.remove('hidden');
  amtEl.focus();
}

/**
 * Buka modal edit transaksi yang sudah ada
 * @param {string} id - ID transaksi
 */
function openModalEdit(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Transaksi';
  document.getElementById('field-id').value          = tx.id;
  // Tampilkan nilai terformat; simpan nilai mentah di data-raw
  const amtEl = document.getElementById('field-amount');
  amtEl.dataset.raw = tx.amount;
  amtEl.value       = tx.amount.toLocaleString('id-ID');
  document.getElementById('field-date').value  = tx.date;
  document.getElementById('field-note').value  = tx.note || '';
  clearFormErrors();
  renderCategoryOptions();
  document.getElementById('field-category').value = tx.categoryId;
  document.getElementById('modal-overlay').classList.remove('hidden');
  amtEl.focus();
}

/** Tutup modal transaksi */
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

/** Bersihkan pesan error pada form */
function clearFormErrors() {
  ['amount', 'category', 'date'].forEach(field => {
    document.getElementById(`err-${field}`).classList.add('hidden');
  });
}

/* ============================================================
   8. VALIDASI FORM
   ============================================================ */

/**
 * Validasi isi form transaksi.
 * @returns {{ valid: boolean, amount: number, categoryId: string, date: string, note: string }}
 */
function validateForm() {
  clearFormErrors();

  // Baca nilai mentah dari data-raw (diisi oleh format-on-input handler)
  const amtEl      = document.getElementById('field-amount');
  const rawVal     = amtEl.dataset.raw || amtEl.value.replace(/\./g, '');
  const categoryId = document.getElementById('field-category').value;
  const date       = document.getElementById('field-date').value;
  const note       = document.getElementById('field-note').value.trim();

  let valid = true;
  const amount = parseFloat(rawVal);

  if (!rawVal || isNaN(amount) || amount <= 0) {
    document.getElementById('err-amount').classList.remove('hidden');
    valid = false;
  }

  if (!categoryId) {
    document.getElementById('err-category').classList.remove('hidden');
    valid = false;
  }

  if (!date) {
    document.getElementById('err-date').classList.remove('hidden');
    valid = false;
  }

  return { valid, amount, categoryId, date, note };
}

/* ============================================================
   9. CRUD TRANSAKSI
   ============================================================ */

/**
 * Tambah transaksi baru
 * @param {{ amount: number, categoryId: string, date: string, note: string }} data
 */
function addTransaction(data) {
  const tx = {
    id:         Date.now().toString(),
    amount:     data.amount,
    categoryId: data.categoryId,
    date:       data.date,
    note:       data.note,
    createdAt:  Date.now(),
  };
  transactions.push(tx);
  Store.saveTransactions(transactions);
  renderAll();
  showToast('✅ Transaksi ditambahkan');
}

/**
 * Perbarui transaksi yang sudah ada
 * @param {string} id
 * @param {{ amount: number, categoryId: string, date: string, note: string }} data
 */
function updateTransaction(id, data) {
  transactions = transactions.map(tx =>
    tx.id === id
      ? { ...tx, amount: data.amount, categoryId: data.categoryId, date: data.date, note: data.note }
      : tx
  );
  Store.saveTransactions(transactions);
  renderAll();
  showToast('✅ Transaksi diperbarui');
}

/**
 * Hapus transaksi berdasarkan ID
 * @param {string} id
 */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  Store.saveTransactions(transactions);
  renderAll();
  showToast('🗑️ Transaksi dihapus');
}

/* ============================================================
   10. EVENT LISTENERS
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Tab filter periode — Dashboard ── */
  document.getElementById('period-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.period-tab');
    if (!btn) return;
    const type = btn.dataset.period;

    if (type === 'custom') {
      // Tampilkan panel custom; jangan render dulu sampai user klik Terapkan
      activePeriod = { type: 'custom', start: activePeriod.start, end: activePeriod.end };
      document.getElementById('custom-range').classList.remove('hidden');
      renderPeriodTabs();
    } else {
      activePeriod = { type, start: null, end: null };
      document.getElementById('custom-range').classList.add('hidden');
      renderAll();
    }
  });

  /* ── Tab filter periode — Riwayat (sama, berbagi state) ── */
  document.getElementById('period-tabs-history').addEventListener('click', e => {
    const btn = e.target.closest('.period-tab');
    if (!btn) return;
    const type = btn.dataset.period;

    if (type === 'custom') {
      activePeriod = { type: 'custom', start: activePeriod.start, end: activePeriod.end };
      // Tampilkan panel custom di dashboard (user harus ke dashboard untuk isi tanggal)
      // Tetap perbarui tab highlight di riwayat
      renderPeriodTabs();
    } else {
      activePeriod = { type, start: null, end: null };
      renderAll();
    }
  });

  /* ── Terapkan Custom range ── */
  document.getElementById('btn-apply-custom').addEventListener('click', () => {
    const start = document.getElementById('custom-start').value;
    const end   = document.getElementById('custom-end').value;
    const errEl = document.getElementById('err-custom-range');

    // Validasi: kedua tanggal harus diisi dan end >= start
    if (!start || !end) {
      errEl.textContent = 'Kedua tanggal harus diisi.';
      errEl.classList.remove('hidden');
      return;
    }
    if (end < start) {
      errEl.textContent = 'Tanggal akhir tidak boleh sebelum tanggal mulai.';
      errEl.classList.remove('hidden');
      return;
    }

    errEl.classList.add('hidden');
    activePeriod = { type: 'custom', start, end };
    renderAll();
  });

  /* ── Bottom navigation ── */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.nav));
  });

  /* ── "Lihat Semua" di dashboard → pindah ke Riwayat ── */
  document.getElementById('btn-see-all').addEventListener('click', () => showScreen('history'));

  /* ── FAB: buka modal tambah ── */
  document.getElementById('fab').addEventListener('click', openModalAdd);

  /* ── Tutup modal saat klik overlay di luar box ── */
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  /* ── Tombol X pada modal ── */
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);

  /* ── Submit form: tambah atau edit ── */
  document.getElementById('transaction-form').addEventListener('submit', e => {
    e.preventDefault();
    const { valid, amount, categoryId, date, note } = validateForm();
    if (!valid) return;

    if (editingId) {
      updateTransaction(editingId, { amount, categoryId, date, note });
    } else {
      addTransaction({ amount, categoryId, date, note });
    }

    closeModal();
  });

  /* ── Delegasi event: edit & hapus dari daftar transaksi ── */
  document.getElementById('recent-list').addEventListener('click', handleListClick);
  document.getElementById('history-list').addEventListener('click', handleListClick);

  /* ── Pencarian di Riwayat ── */
  document.getElementById('search-input').addEventListener('input', e => {
    renderHistory(e.target.value);
  });

  /* ── Konfirmasi hapus ── */
  document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (pendingDeleteId) {
      deleteTransaction(pendingDeleteId);
      pendingDeleteId = null;
    }
    document.getElementById('confirm-overlay').classList.add('hidden');
  });

  document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('confirm-overlay').classList.add('hidden');
  });

  /* ── Reset semua data (Pengaturan) ── */
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Yakin ingin menghapus semua data? Tindakan ini tidak dapat dibatalkan.')) {
      localStorage.removeItem(STORAGE_KEY_TRANSACTIONS);
      transactions = [];
      Store.saveTransactions(transactions);
      renderAll();
    }
  });

  /* ── Simpan anggaran bulanan (Pengaturan, Fase 4) ── */
  document.getElementById('btn-save-budget').addEventListener('click', () => {
    const raw = document.getElementById('input-budget').value.trim();
    const errEl = document.getElementById('err-budget');
    const msgEl = document.getElementById('msg-budget-saved');
    const val = parseFloat(raw);

    errEl.classList.add('hidden');
    msgEl.classList.add('hidden');

    if (!raw || isNaN(val) || val <= 0) {
      errEl.classList.remove('hidden');
      return;
    }

    settings.monthlyBudget = val;
    Store.saveSettings(settings);
    renderBudgetCard();   // update kartu di dashboard seketika
    showToast('✅ Anggaran disimpan');

    msgEl.classList.remove('hidden');
    setTimeout(() => msgEl.classList.add('hidden'), 2500);
  });

  /* ── Format Rupiah otomatis pada input nominal (Fase 5b) ── */
  document.getElementById('field-amount').addEventListener('input', function () {
    // Hapus semua non-digit
    const digits = this.value.replace(/\D/g, '');
    const num    = parseInt(digits, 10);
    // Simpan nilai mentah sebagai angka murni
    this.dataset.raw = digits ? String(num) : '';
    // Tampilkan dengan titik ribuan (format Indonesia)
    this.value = digits ? num.toLocaleString('id-ID') : '';
  });

  /* ── Kategori: simpan (Fase 5a) ── */
  document.getElementById('btn-save-cat').addEventListener('click', () => {
    saveCategoryFromForm();
  });

  /* ── Kategori: batal edit ── */
  document.getElementById('btn-cancel-cat').addEventListener('click', () => {
    resetCatForm();
  });

  /* ── Kategori: edit & hapus via delegasi dari daftar ── */
  document.getElementById('cat-list').addEventListener('click', e => {
    const editBtn   = e.target.closest('.btn-cat-edit');
    const deleteBtn = e.target.closest('.btn-cat-delete');

    if (editBtn) {
      const catId = editBtn.dataset.catId;
      const cat   = getCategoryById(catId);
      if (!cat) return;
      // Isi form dengan data kategori yang akan diedit
      document.getElementById('cat-edit-id').value = cat.id;
      document.getElementById('cat-name').value    = cat.name;
      document.getElementById('cat-icon').value    = cat.icon || '';
      document.getElementById('cat-color').value   = cat.color || '#3b82f6';
      document.getElementById('err-cat-name').classList.add('hidden');
      document.getElementById('btn-cancel-cat').classList.remove('hidden');
      document.getElementById('btn-save-cat').textContent = 'Perbarui Kategori';
      document.getElementById('cat-name').focus();
      return;
    }

    if (deleteBtn && !deleteBtn.disabled) {
      deleteCategory(deleteBtn.dataset.catId);
    }
  });

  /* ── Sortir di Riwayat (Fase 5) ── */
  document.getElementById('sort-select').addEventListener('change', e => {
    activeSortOrder = e.target.value;
    const searchInput = document.getElementById('search-input');
    renderHistory(searchInput ? searchInput.value : '');
  });

  /* ── Dark mode toggle (Fase 5) ── */
  document.getElementById('toggle-dark').addEventListener('click', () => {
    const isDark = !settings.darkMode;
    settings.darkMode = isDark;
    Store.saveSettings(settings);
    applyDarkMode(isDark);
  });

  /* ── Ekspor JSON (Fase 6) ── */
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);

  /* ── Ekspor CSV (Fase 6) ── */
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  /* ── Impor JSON (Fase 6) ── */
  document.getElementById('input-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importJSON(file);
  });

  /* ── Escape menutup modal aktif (aksesibilitas keyboard) ── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const modalOpen   = !document.getElementById('modal-overlay').classList.contains('hidden');
    const confirmOpen = !document.getElementById('confirm-overlay').classList.contains('hidden');
    if (modalOpen)   { closeModal(); return; }
    if (confirmOpen) {
      pendingDeleteId = null;
      document.getElementById('confirm-overlay').classList.add('hidden');
    }
  });

  /* ── Klik backdrop confirm-overlay → tutup ── */
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-overlay')) {
      pendingDeleteId = null;
      document.getElementById('confirm-overlay').classList.add('hidden');
    }
  });

  /* ── Render awal ── */
  applyDarkMode(settings.darkMode);   // terapkan preferensi tersimpan
  showScreen('dashboard');

  /* ── Registrasi Service Worker (PWA) ── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {/* gagal diam-diam */});
  }
});

/* ============================================================
   11. DARK MODE — Fase 5
   ============================================================ */

/**
 * Terapkan atau cabut dark mode.
 * Menambah/hapus class "dark" pada <html>.
 * Memperbarui aria-checked pada tombol toggle.
 * @param {boolean} dark
 */
function applyDarkMode(dark) {
  document.documentElement.classList.toggle('dark', dark);
  const btn = document.getElementById('toggle-dark');
  if (btn) btn.setAttribute('aria-checked', dark ? 'true' : 'false');
}

// Inisialisasi: jika settings belum punya preferensi, ikuti prefers-color-scheme
(function initDarkMode() {
  if (typeof settings.darkMode !== 'boolean') {
    settings.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
})();

/**
 * Tangani klik edit/hapus dari daftar transaksi (event delegation)
 * @param {MouseEvent} e
 */
function handleListClick(e) {
  const editBtn   = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    openModalEdit(editBtn.dataset.id);
    return;
  }

  if (deleteBtn) {
    pendingDeleteId = deleteBtn.dataset.id;
    document.getElementById('confirm-overlay').classList.remove('hidden');
  }
}
