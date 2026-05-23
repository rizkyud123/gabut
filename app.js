/* ===== APBD TRACKER — app.js ===== */

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  daerahData: [],
  anggaran_unik: [],
  sortBy: 'pendapatan',
  compareMode: false,
  selectedA: null,
  selectedB: null,
  currentFilter: 'all',
};

// ─── Sector Colors & Emojis ───────────────────────────────────────────────────
const SECTOR_COLORS = ['#6c63ff', '#00d4aa', '#ffd166', '#ff6b9d', '#a29bfe', '#fd79a8'];
const SECTOR_EMOJIS = {
  'Pendidikan': '🎓',
  'Kesehatan': '🏥',
  'Infrastruktur & Fasilitas Umum': '🛣️',
  'Belanja Pegawai (Gaji ASN/Dinas)': '💼',
  'Lain-lain & Bansos': '🤝',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatRupiah(num, short = false) {
  if (short) {
    if (num >= 1e12) return `Rp${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `Rp${(num / 1e9).toFixed(1)}Md`;
    if (num >= 1e6) return `Rp${(num / 1e6).toFixed(1)}Jt`;
    return `Rp${num.toLocaleString('id-ID')}`;
  }
  return `Rp${num.toLocaleString('id-ID')}`;
}

function formatInput(val) {
  const num = val.replace(/\D/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseInput(val) {
  return parseInt(val.replace(/\./g, ''), 10) || 0;
}

function getStatusClass(status) {
  if (status.includes('Selesai')) return 'status-selesai';
  if (status.includes('Berjalan')) return 'status-berjalan';
  return 'status-lelang';
}

function getStatusDot(status) {
  if (status.includes('Selesai')) return '✅';
  if (status.includes('Berjalan')) return '🔄';
  return '📋';
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [daerahRes, unikRes] = await Promise.all([
      fetch('./data/apbd_daerah.json'),
      fetch('./data/anggaran_unik.json'),
    ]);
    if (!daerahRes.ok) throw new Error(`apbd_daerah.json: HTTP ${daerahRes.status}`);
    if (!unikRes.ok) throw new Error(`anggaran_unik.json: HTTP ${unikRes.status}`);
    state.daerahData = await daerahRes.json();
    state.anggaran_unik = await unikRes.json();
    init();
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('❌ Gagal memuat data. Pastikan file JSON tersedia.');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  updateHeroStats();
  renderLeaderboard();
  populateDaerahSelect();
  renderDetektif();
  setupEventListeners();
}

function updateHeroStats() {
  const totalAnggaran = state.daerahData.reduce((s, d) => s + d.total_belanja, 0);
  document.getElementById('hero-total-daerah').textContent = state.daerahData.length;
  document.getElementById('hero-total-anggaran').textContent = formatRupiah(totalAnggaran, true);
  document.getElementById('hero-proyek-unik').textContent = state.anggaran_unik.length;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
function getSortedData() {
  return [...state.daerahData].sort((a, b) => {
    if (state.sortBy === 'pendapatan') return b.total_pendapatan - a.total_pendapatan;
    if (state.sortBy === 'belanja') return b.total_belanja - a.total_belanja;
    if (state.sortBy === 'defisit') return b.defisit - a.defisit;
    return 0;
  });
}

function renderLeaderboard() {
  const grid = document.getElementById('leaderboardGrid');
  const sorted = getSortedData();
  grid.innerHTML = sorted.map((d, i) => buildLeaderboardCard(d, i + 1)).join('');

  // Re-attach click events
  grid.querySelectorAll('.lb-card').forEach(card => {
    const wilayah = card.dataset.wilayah;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('card-detail-btn')) return;
      handleCardClick(wilayah);
    });
    card.querySelector('.card-detail-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetailModal(wilayah);
    });
  });

  // Restore selection highlights
  updateCardHighlights();
}

function buildLeaderboardCard(d, rank) {
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const rankClass = rank <= 3 ? `rank-${rank}` : '';
  const isDeficit = d.defisit > 0;

  const sectorBar = d.alokasi_sektor.map((s, i) =>
    `<div class="sector-segment" style="width:${s.persentase}%;background:${SECTOR_COLORS[i % SECTOR_COLORS.length]}" title="${s.nama_sektor}: ${s.persentase}%"></div>`
  ).join('');

  const legend = d.alokasi_sektor.slice(0, 3).map((s, i) =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${SECTOR_COLORS[i % SECTOR_COLORS.length]}"></div>
      <span>${s.nama_sektor.split(' ')[0]} ${s.persentase}%</span>
    </div>`
  ).join('');

  return `
    <div class="lb-card ${rankClass}" data-wilayah="${d.wilayah}">
      <div class="card-rank-badge ${rank > 3 ? 'rank-other' : ''}">${rankEmoji}</div>
      <div class="card-header">
        <div class="card-wilayah">${d.wilayah}</div>
        <div class="card-level">${d.level} · TA ${d.tahun_anggaran}</div>
      </div>
      <div class="card-metrics">
        <div class="metric-item">
          <div class="metric-label">Pendapatan</div>
          <div class="metric-value income">${formatRupiah(d.total_pendapatan, true)}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Belanja</div>
          <div class="metric-value expense">${formatRupiah(d.total_belanja, true)}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">${isDeficit ? 'Defisit' : 'Surplus'}</div>
          <div class="metric-value ${isDeficit ? 'deficit' : 'surplus'}">${formatRupiah(d.defisit, true)}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Sektor Terbesar</div>
          <div class="metric-value" style="color:var(--text-primary);font-size:0.8rem">
            ${[...d.alokasi_sektor].sort((a,b)=>b.persentase-a.persentase)[0].nama_sektor.split(' ')[0]}
          </div>
        </div>
      </div>
      <div class="sector-bar-label">Alokasi Sektor</div>
      <div class="sector-bar">${sectorBar}</div>
      <div class="sector-legend">${legend}</div>
      <div class="card-footer">
        <button class="card-detail-btn">Lihat Detail →</button>
        <span class="card-compare-hint">${state.compareMode ? 'Klik untuk komparasi' : ''}</span>
      </div>
    </div>`;
}

function updateCardHighlights() {
  document.querySelectorAll('.lb-card').forEach(card => {
    card.classList.remove('selected-a', 'selected-b');
    if (state.selectedA && card.dataset.wilayah === state.selectedA.wilayah) card.classList.add('selected-a');
    if (state.selectedB && card.dataset.wilayah === state.selectedB.wilayah) card.classList.add('selected-b');
  });
}

function handleCardClick(wilayah) {
  if (!state.compareMode) {
    openDetailModal(wilayah);
    return;
  }
  const daerah = state.daerahData.find(d => d.wilayah === wilayah);
  if (!daerah) return;

  if (state.selectedA && state.selectedA.wilayah === wilayah) {
    state.selectedA = null;
  } else if (state.selectedB && state.selectedB.wilayah === wilayah) {
    state.selectedB = null;
  } else if (!state.selectedA) {
    state.selectedA = daerah;
    showToast(`✅ ${wilayah} dipilih sebagai Daerah A`);
  } else if (!state.selectedB) {
    state.selectedB = daerah;
    showToast(`✅ ${wilayah} dipilih sebagai Daerah B`);
  } else {
    showToast('⚠️ Sudah 2 daerah dipilih. Hapus salah satu dulu.');
    return;
  }

  updateCardHighlights();
  renderCompareSlots();
  if (state.selectedA && state.selectedB) renderCompareResult();
  else document.getElementById('compareResult').classList.add('hidden');
}

// ─── Compare Panel ────────────────────────────────────────────────────────────
function renderCompareSlots() {
  renderSlot('slot-a', state.selectedA, 'A', () => { state.selectedA = null; updateCardHighlights(); renderCompareSlots(); document.getElementById('compareResult').classList.add('hidden'); });
  renderSlot('slot-b', state.selectedB, 'B', () => { state.selectedB = null; updateCardHighlights(); renderCompareSlots(); document.getElementById('compareResult').classList.add('hidden'); });
}

function renderSlot(slotId, daerah, label, onRemove) {
  const slot = document.getElementById(slotId);
  if (!daerah) {
    slot.classList.remove('filled');
    slot.innerHTML = `<div class="slot-placeholder"><span>➕</span><p>Pilih Daerah ${label}</p></div>`;
    return;
  }
  slot.classList.add('filled');
  slot.innerHTML = `
    <div class="slot-filled-content">
      <div class="slot-filled-name">${daerah.wilayah}</div>
      <div class="slot-filled-val">${formatRupiah(daerah.total_pendapatan, true)}</div>
      <button class="slot-remove">✕ Hapus</button>
    </div>`;
  slot.querySelector('.slot-remove').addEventListener('click', onRemove);
}

function renderCompareResult() {
  const a = state.selectedA;
  const b = state.selectedB;
  const result = document.getElementById('compareResult');
  result.classList.remove('hidden');

  const rows = [
    { label: 'Total Pendapatan', va: a.total_pendapatan, vb: b.total_pendapatan, fmt: true },
    { label: 'Total Belanja', va: a.total_belanja, vb: b.total_belanja, fmt: true },
    { label: 'Defisit/Surplus', va: a.defisit, vb: b.defisit, fmt: true, lowerBetter: true },
    { label: 'Sektor Terbesar', va: [...a.alokasi_sektor].sort((x,y)=>y.persentase-x.persentase)[0].nama_sektor, vb: [...b.alokasi_sektor].sort((x,y)=>y.persentase-x.persentase)[0].nama_sektor, fmt: false },
    { label: 'Alokasi Pendidikan', va: a.alokasi_sektor.find(s=>s.nama_sektor==='Pendidikan')?.persentase || 0, vb: b.alokasi_sektor.find(s=>s.nama_sektor==='Pendidikan')?.persentase || 0, fmt: false, suffix: '%' },
    { label: 'Alokasi Kesehatan', va: a.alokasi_sektor.find(s=>s.nama_sektor==='Kesehatan')?.persentase || 0, vb: b.alokasi_sektor.find(s=>s.nama_sektor==='Kesehatan')?.persentase || 0, fmt: false, suffix: '%' },
  ];

  const tableRows = rows.map(row => {
    let aClass = '', bClass = '';
    if (typeof row.va === 'number' && typeof row.vb === 'number') {
      const aWins = row.lowerBetter ? row.va < row.vb : row.va > row.vb;
      aClass = aWins ? 'compare-winner' : 'compare-loser';
      bClass = !aWins ? 'compare-winner' : 'compare-loser';
    }
    const aVal = row.fmt ? formatRupiah(row.va, true) : (row.suffix ? `${row.va}${row.suffix}` : row.va);
    const bVal = row.fmt ? formatRupiah(row.vb, true) : (row.suffix ? `${row.vb}${row.suffix}` : row.vb);
    return `<tr>
      <td>${row.label}</td>
      <td class="${aClass}">${aVal}</td>
      <td class="${bClass}">${bVal}</td>
    </tr>`;
  }).join('');

  result.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Indikator</th>
          <th style="color:var(--accent)">${a.wilayah}</th>
          <th style="color:var(--danger)">${b.wilayah}</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function openDetailModal(wilayah) {
  const d = state.daerahData.find(x => x.wilayah === wilayah);
  if (!d) return;

  const sectorList = d.alokasi_sektor.map((s, i) => `
    <div class="modal-sector-item">
      <div class="modal-sector-emoji">${SECTOR_EMOJIS[s.nama_sektor] || '📌'}</div>
      <div class="modal-sector-info">
        <div class="modal-sector-name">${s.nama_sektor}</div>
        <div class="modal-sector-bar-wrap">
          <div class="modal-sector-bar" style="width:${s.persentase}%;background:${SECTOR_COLORS[i % SECTOR_COLORS.length]}"></div>
        </div>
        <div class="modal-sector-nominal">${formatRupiah(s.anggaran_nominal, true)}</div>
      </div>
      <div class="modal-sector-pct">${s.persentase}%</div>
    </div>`).join('');

  const isModalDeficit = d.defisit > 0;
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-wilayah">${d.wilayah}</div>
    <div class="modal-level">${d.level} · Tahun Anggaran ${d.tahun_anggaran}</div>
    <div class="modal-metrics">
      <div class="modal-metric">
        <div class="modal-metric-label">Pendapatan</div>
        <div class="modal-metric-value" style="color:var(--accent)">${formatRupiah(d.total_pendapatan, true)}</div>
      </div>
      <div class="modal-metric">
        <div class="modal-metric-label">Belanja</div>
        <div class="modal-metric-value" style="color:var(--warning)">${formatRupiah(d.total_belanja, true)}</div>
      </div>
      <div class="modal-metric">
        <div class="modal-metric-label">${isModalDeficit ? 'Defisit' : 'Surplus'}</div>
        <div class="modal-metric-value" style="color:${isModalDeficit ? 'var(--danger)' : 'var(--accent)'}">${formatRupiah(Math.abs(d.defisit), true)}</div>
      </div>
    </div>
    <div class="modal-sector-title">Alokasi Per Sektor</div>
    <div class="modal-sector-list">${sectorList}</div>`;

  document.getElementById('modalOverlay').classList.remove('hidden');
}

// ─── Kalkulator ───────────────────────────────────────────────────────────────
function populateDaerahSelect() {
  const sel = document.getElementById('daerahSelect');
  state.daerahData.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.wilayah;
    opt.textContent = `${d.wilayah} (${d.level})`;
    sel.appendChild(opt);
  });
}

function calculateAlokasi() {
  const wilayah = document.getElementById('daerahSelect').value;
  const nominal = parseInput(document.getElementById('nominalInput').value);

  if (!wilayah) { showToast('⚠️ Pilih daerah terlebih dahulu!'); return; }
  if (!nominal || nominal < 1000) { showToast('⚠️ Masukkan nominal minimal Rp1.000'); return; }

  const daerah = state.daerahData.find(d => d.wilayah === wilayah);
  if (!daerah) return;

  const alokasi = daerah.alokasi_sektor.map(s => ({
    sektor: s.nama_sektor,
    persentase: s.persentase,
    nominal_kontribusi: Math.round(nominal * s.persentase / 100),
    icon: s.icon,
  })).sort((a, b) => b.nominal_kontribusi - a.nominal_kontribusi);

  const narasiMap = {
    'Pendidikan': 'dialokasikan ke renovasi sekolah, beasiswa daerah, dan fasilitas belajar.',
    'Kesehatan': 'masuk ke subsidi puskesmas, rumah sakit daerah, dan pengadaan alat medis.',
    'Infrastruktur & Fasilitas Umum': 'berubah jadi aspal jalanan, perbaikan jembatan, dan lampu penerangan jalan.',
    'Belanja Pegawai (Gaji ASN/Dinas)': 'dipakai buat bayar gaji, tunjangan, dan perjalanan dinas para aparatur daerah.',
    'Lain-lain & Bansos': 'digunakan untuk bantuan sosial masyarakat kurang mampu dan dana darurat.',
  };

  const topSektor = alokasi[0];
  const punchline = `Paling banyak buat ${topSektor.sektor.toLowerCase()}! ${topSektor.sektor.includes('Pegawai') ? '💼' : topSektor.sektor.includes('Pendidikan') ? '🎓' : topSektor.sektor.includes('Infrastruktur') ? '🛣️' : '❤️'}`;

  const allocItems = alokasi.map((a, i) => {
    const emoji = SECTOR_EMOJIS[a.sektor] || '📌';
    const narasi = `${formatRupiah(a.nominal_kontribusi)} ${narasiMap[a.sektor] || 'digunakan untuk keperluan daerah.'}`;
    const barColor = SECTOR_COLORS[i % SECTOR_COLORS.length];
    return `
      <div class="alloc-item">
        <div class="alloc-top">
          <div class="alloc-sector">
            <span class="alloc-emoji">${emoji}</span>
            <span class="alloc-name">${a.sektor}</span>
          </div>
          <span class="alloc-amount">${formatRupiah(a.nominal_kontribusi, true)}</span>
        </div>
        <div class="alloc-bar-wrap">
          <div class="alloc-bar-fill" style="width:${a.persentase}%;background:${barColor}"></div>
        </div>
        <div class="alloc-narasi">${narasi}</div>
      </div>`;
  }).join('');

  document.getElementById('kalkulatorResult').innerHTML = `
    <div class="result-header">
      <div class="result-headline">🧾 Pajakku Tahun Ini Jadi Apa Saja?</div>
      <div class="result-punchline">${punchline}</div>
      <div class="result-total">Total pajak: <strong>${formatRupiah(nominal)}</strong> di <strong>${wilayah}</strong></div>
    </div>
    <div class="allocation-list">${allocItems}</div>
    <div class="share-card">
      <h4>📤 Bagikan Hasil Ini</h4>
      <div class="share-buttons">
        <button class="share-btn" onclick="copyShareText('${wilayah}', ${nominal})">📋 Salin Teks</button>
        <button class="share-btn" onclick="shareWhatsApp('${wilayah}', ${nominal})">💬 WhatsApp</button>
        <button class="share-btn" onclick="shareTwitter('${wilayah}', ${nominal})">🐦 Twitter/X</button>
      </div>
    </div>`;
}

function copyShareText(wilayah, nominal) {
  const text = `💰 Pajakku Rp${nominal.toLocaleString('id-ID')} di ${wilayah} jadi apa?\n\nCek di APBDTracker untuk tahu alokasi anggaran daerahmu! 🏛️`;
  navigator.clipboard.writeText(text).then(() => showToast('✅ Teks berhasil disalin!'));
}

function shareWhatsApp(wilayah, nominal) {
  const text = encodeURIComponent(`💰 Pajakku Rp${nominal.toLocaleString('id-ID')} di ${wilayah} jadi apa? Cek APBDTracker!`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareTwitter(wilayah, nominal) {
  const text = encodeURIComponent(`💰 Pajakku Rp${nominal.toLocaleString('id-ID')} di ${wilayah} jadi apa? Cek alokasi anggaran daerahmu! #APBD #Transparansi`);
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

// ─── Detektif ─────────────────────────────────────────────────────────────────
function renderDetektif(filter = 'all') {
  const grid = document.getElementById('detektifGrid');
  const data = filter === 'all' ? state.anggaran_unik : state.anggaran_unik.filter(d => d.level_keanehan === filter);

  grid.innerHTML = data.map(d => buildDetektifCard(d)).join('');
}

function buildDetektifCard(d) {
  const tags = d.tags.map(t => `<span class="tag-chip">#${t}</span>`).join('');
  const statusClass = getStatusClass(d.status);
  const statusDot = getStatusDot(d.status);
  const satuanInfo = d.harga_satuan_per_orang_estimasi
    ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">≈ ${formatRupiah(d.harga_satuan_per_orang_estimasi, true)} / orang</div>`
    : '';

  return `
    <div class="detektif-card keanehan-${d.level_keanehan}">
      <div class="detektif-card-top">
        <div>
          <div class="detektif-id">${d.id}</div>
        </div>
        <span class="keanehan-badge ${d.level_keanehan}">🚨 ${d.level_keanehan}</span>
      </div>
      <div class="detektif-nama">${d.nama_pengadaan}</div>
      <div class="detektif-instansi">🏢 ${d.instansi_pemda}</div>
      <div class="detektif-pagu">${formatRupiah(d.pagu_anggaran, true)}</div>
      <div class="detektif-pagu-label">Pagu Anggaran</div>
      ${satuanInfo}
      <div class="detektif-status ${statusClass}">${statusDot} ${d.status}</div>
      <div class="detektif-fakta">
        <div class="fakta-label">💡 Fakta Menarik</div>
        ${d.fakta_menarik}
      </div>
      <div class="detektif-tags">${tags}</div>
    </div>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ─── Scroll ───────────────────────────────────────────────────────────────────
function scrollToSection(tabName) {
  switchTab(tabName);
  document.querySelector('.main-content').scrollIntoView({ behavior: 'smooth' });
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('active', s.id === `tab-${tabName}`));
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sortBy = btn.dataset.sort;
      renderLeaderboard();
    });
  });

  // Compare toggle
  document.getElementById('compareToggle').addEventListener('click', () => {
    state.compareMode = !state.compareMode;
    const btn = document.getElementById('compareToggle');
    const panel = document.getElementById('comparePanel');
    btn.classList.toggle('active', state.compareMode);
    btn.textContent = state.compareMode ? '✕ Tutup Komparasi' : '⚖️ Mode Komparasi';
    panel.classList.toggle('hidden', !state.compareMode);
    if (!state.compareMode) {
      state.selectedA = null;
      state.selectedB = null;
      updateCardHighlights();
    }
    renderLeaderboard();
  });

  // Kalkulator
  document.getElementById('calcBtn').addEventListener('click', calculateAlokasi);

  document.getElementById('nominalInput').addEventListener('input', (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    e.target.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  });

  document.getElementById('nominalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') calculateAlokasi();
  });

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseInt(btn.dataset.amount);
      document.getElementById('nominalInput').value = amount.toLocaleString('id-ID').replace(/,/g, '.');
    });
  });

  // Detektif filters
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentFilter = chip.dataset.filter;
      renderDetektif(state.currentFilter);
    });
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.add('hidden');
  });
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
      document.getElementById('modalOverlay').classList.add('hidden');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('modalOverlay').classList.add('hidden');
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadData();
