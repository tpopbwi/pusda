/**
 * ============================================================
 * RAPORT.JS - v2.1 (FIXED CALENDAR & STATUS LABELS)
 * ============================================================
 * Perbaikan:
 * - Status di kalender lebih jelas: H, H50, QR, QR50, TR, TB, I, S, D, A, L
 * - Tooltip menampilkan tanggal lengkap + status + nilai + keterangan
 * - Alpha hanya untuk hari kerja yang terlewat (bukan akhir pekan/libur)
 * - Penanganan cache dan abort controller lebih baik
 * - XSS protection, lazy loading, dan performance optimized
 * ============================================================
 */

// ============================================================
// 1. KONFIGURASI GLOBAL
// ============================================================
const GITHUB_LOGO_URL = "assets/logo.png";
const API_URL = "https://script.google.com/macros/s/AKfycbxfANwhLfJnT1uDqC_4xIFpCvMDLbM0rZcrFPXqLuFc-u0juCrsTgb7v9yGMUedlWiF/exec";
const FALLBACK_IMAGE = GITHUB_LOGO_URL;

const logsMap = new Map();
const calendarCache = new Map();
let fetchDebounceTimer = null;
let currentFetchController = null;

let appConfig = {
    jPulang: "16:00",
    hari_libur: []
};

// ============================================================
// 2. PWA MANIFEST (Data URI)
// ============================================================
try {
    const mf = {
        name: "E-PUSDA UPT Management",
        short_name: "E-PUSDA",
        start_url: "raport.html",
        scope: "./",
        display: "standalone",
        background_color: "#0d1b3e",
        theme_color: "#1e40af",
        icons: [
            { src: GITHUB_LOGO_URL, sizes: "192x192", type: "image/png" },
            { src: GITHUB_LOGO_URL, sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
    };
    const uri = 'data:application/manifest+json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(mf))));
    const el = document.getElementById('pwaManifest');
    if (el) el.setAttribute('href', uri);
    else {
        const l = document.createElement('link');
        l.rel = 'manifest';
        l.href = uri;
        document.head.appendChild(l);
    }
} catch (e) {
    console.warn('Manifest init failed:', e);
}

// ============================================================
// 3. LAZY LOAD OBSERVER
// ============================================================
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(en => {
        if (en.isIntersecting) {
            const img = en.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.classList.remove('lazy-img');
                imageObserver.unobserve(img);
            }
        }
    });
}, { rootMargin: '200px' });

window.addEventListener('beforeunload', () => {
    if (imageObserver) imageObserver.disconnect();
});

// ============================================================
// 4. FETCH UTILITIES
// ============================================================
function fetchWithTimeout(url, opts = {}, timeout = 30000) {
    const controller = new AbortController();
    const tid = setTimeout(() => {
        controller.abort(new DOMException('Timeout ' + timeout + 'ms', 'AbortError'));
    }, timeout);
    return fetch(url, { ...opts, signal: controller.signal })
        .finally(() => clearTimeout(tid));
}

async function safeFetchJSON(url, opts = {}, timeout = 30000) {
    try {
        const res = await fetchWithTimeout(url, opts, timeout);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const txt = await res.text();
        if (!txt || !txt.trim()) throw new Error('Response kosong');
        if (txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) {
            throw new Error('Server return HTML error');
        }
        try {
            return JSON.parse(txt);
        } catch (e) {
            throw new Error('Parse JSON gagal: ' + e.message);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout setelah ' + timeout + 'ms');
        }
        throw new Error('Fetch gagal: ' + (error.message || 'Unknown error'));
    }
}

// ============================================================
// 5. UTILITIES
// ============================================================
function sanitizeHTML(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function getLocalDateString(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function initFilters() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('startD').value = getLocalDateString(firstDay);
    document.getElementById('endD').value = getLocalDateString(now);
}

function getSmartUrl(url) {
    if (!url) return FALLBACK_IMAGE;
    if (url.includes("googleusercontent")) return url.split("=")[0] + "=s500";
    if (url.includes("drive.google.com")) {
        let fileId = "";
        const match = url.match(/\/d\/([^\/\?]+)/);
        if (match && match[1]) fileId = match[1];
        if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
        return url.replace("/view", "/preview");
    }
    return url;
}

function formatScore(score) {
    const num = parseFloat(score);
    if (num === 0) return '0';
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(1);
}

// ============================================================
// 6. TOAST NOTIFICATION
// ============================================================
function showToast(msg, type = 'info') {
    let c = document.getElementById('toastContainer');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toastContainer';
        c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:100000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(c);
    }
    const t = document.createElement('div');
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    const color = colors[type] || colors.info;
    t.style.cssText = `background:rgba(15,23,42,0.95);backdrop-filter:blur(15px);color:white;padding:14px 20px;border-radius:14px;border-left:4px solid ${color};box-shadow:0 10px 30px rgba(0,0,0,0.4);font-size:0.9rem;font-weight:600;max-width:380px;pointer-events:auto;animation:slideInRight 0.3s ease-out;`;
    t.innerHTML = `<div style="font-weight:800;text-transform:uppercase;font-size:0.7rem;color:${color};margin-bottom:4px;letter-spacing:1px">${type}</div><div>${msg}</div>`;
    c.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.4s';
        setTimeout(() => t.remove(), 400);
    }, 4000);
}

// ============================================================
// 7. LOADING SKELETON
// ============================================================
function toggleLoading(show) {
    const grid = document.getElementById('raportGrid');
    if (!grid) return;
    if (show) {
        let s = '';
        for (let i = 0; i < 6; i++) {
            s += `<div class="skeleton-card">
                    <div class="skel-top">
                        <div class="skel-photo shimmer"></div>
                        <div class="skel-info">
                            <div class="skel-line w-60 shimmer"></div>
                            <div class="skel-line w-40 shimmer"></div>
                        </div>
                        <div class="skel-grade shimmer"></div>
                    </div>
                    <div class="skel-body">
                        <div class="skel-score shimmer"></div>
                        <div class="skel-stats">
                            <div class="skel-stat-pill shimmer"></div>
                            <div class="skel-stat-pill shimmer"></div>
                            <div class="skel-stat-pill shimmer"></div>
                            <div class="skel-stat-pill shimmer"></div>
                        </div>
                    </div>
                </div>`;
        }
        grid.innerHTML = s;
    }
}

function buildReportUrl() {
    const start = document.getElementById('startD').value,
        end = document.getElementById('endD').value,
        reg = document.getElementById('wilF').value;
    const searchEl = document.getElementById('searchName'),
        search = searchEl ? searchEl.value.trim() : '';
    return `${API_URL}?action=getReportData&start=${start}&end=${end}&region=${encodeURIComponent(reg)}&detail=true&limit=9999&search=${encodeURIComponent(search)}`;
}

// ============================================================
// 8. APP INIT
// ============================================================
async function initApp() {
    lucide.createIcons();
    initFilters();

    const printDate = document.getElementById('printDate');
    if (printDate) {
        printDate.innerText = new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    setInterval(() => {
        const el = document.getElementById('liveClock');
        if (el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    if (!document.getElementById('raport-toast-style')) {
        const style = document.createElement('style');
        style.id = 'raport-toast-style';
        style.innerHTML = '@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(style);
    }

    logsMap.clear();
    calendarCache.clear();
    triggerReportFetch();
    fetchDashboardDataInBackground();

    setTimeout(() => {
        const grid = document.getElementById('raportGrid');
        if (grid && grid.querySelector('.skeleton-card')) {
            console.warn('Safety net: Force hide skeleton');
            renderCards([]);
            showToast('Koneksi lambat. Menggunakan mode offline.', 'warning');
        }
    }, 12000);
}

// ============================================================
// 9. FETCH REPORT DATA
// ============================================================
async function fetchReportData(attempt = 1) {
    const btn = document.querySelector('.btn-update');

    if (currentFetchController) {
        currentFetchController.abort();
    }
    currentFetchController = new AbortController();

    try {
        const result = await safeFetchJSON(
            buildReportUrl(),
            { signal: currentFetchController.signal },
            30000
        );

        if (result.status === 'success' || Array.isArray(result.data)) {
            renderCards(result.data || []);
            toggleLoading(false);
        } else {
            renderCards([]);
            toggleLoading(false);
        }
    } catch (e) {
        if (e.name === 'AbortError' || e.message.includes('aborted')) {
            return;
        }

        const isAbort = e.name === 'AbortError' || (e.message && e.message.includes('Timeout'));
        if (isAbort && attempt < 3) {
            showToast(`Koneksi lambat, mencoba ulang (${attempt}/3)...`, 'warning');
            setTimeout(() => fetchReportData(attempt + 1), 1500);
            return;
        }

        if (!isAbort) showToast('Gagal memuat laporan: ' + e.message, 'error');
        else showToast('Koneksi timeout. Periksa jaringan Anda.', 'error');
        renderCards([]);
        toggleLoading(false);
    } finally {
        currentFetchController = null;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="check" size="18"></i> SELESAI';
            btn.style.background = 'var(--success)';
            lucide.createIcons({ node: btn });
            setTimeout(() => {
                btn.innerHTML = '<i data-lucide="refresh-cw" size="18"></i> UPDATE';
                btn.style.background = '';
                lucide.createIcons({ node: btn });
            }, 1500);
        }
    }
}

async function fetchDashboardDataInBackground() {
    try {
        const dashData = await safeFetchJSON(API_URL + "?action=getDashboardData", {}, 10000);
        if (dashData && dashData.config) {
            appConfig = {
                jPulang: dashData.config.Jam_Pulang || "16:00",
                hari_libur: dashData.config.hari_libur || []
            };
            const logoUrl = dashData.config.Logo || GITHUB_LOGO_URL;
            const sl = document.getElementById('sidebarLogo');
            const pl = document.getElementById('printKopLogo');
            if (sl) {
                sl.onerror = () => { sl.src = FALLBACK_IMAGE; };
                sl.src = logoUrl;
            }
            if (pl) {
                pl.onerror = () => { pl.src = FALLBACK_IMAGE; };
                pl.src = logoUrl;
            }
        }
        if (dashData && Array.isArray(dashData.pegawai)) {
            const sel = document.getElementById('wilF');
            if (sel) {
                const currentOptions = Array.from(sel.options).map(o => o.value);
                const wilayahList = [...new Set(dashData.pegawai.map(p => p.Wilayah || p.wilayah).filter(w => w))];
                wilayahList.forEach(w => {
                    if (!currentOptions.includes(w)) {
                        const opt = document.createElement('option');
                        opt.value = w;
                        opt.innerText = w;
                        sel.appendChild(opt);
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Dashboard fetch gagal:', e.message);
    }
}

function triggerReportFetch() {
    const btn = document.querySelector('.btn-update');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" size="18" class="spin"></i> MEMUAT...';
        lucide.createIcons({ node: btn });
    }
    clearTimeout(fetchDebounceTimer);
    fetchDebounceTimer = setTimeout(() => {
        logsMap.clear();
        calendarCache.clear();
        toggleLoading(true);
        fetchReportData();
    }, 300);
}

// ============================================================
// 10. CALENDAR BUILDER (PERBAIKAN UTAMA)
// ============================================================
function buildCalendarHTML(logs, startDateStr) {
    const startDate = new Date(startDateStr),
        year = startDate.getFullYear(),
        month = startDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayDate = new Date(year, month, 1);
    let firstDayOfWeek = firstDayDate.getDay();
    firstDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;

    // Map log berdasarkan tanggal (day of month)
    const logMap = {};
    (logs || []).forEach(l => {
        const d = new Date(l.date);
        if (!isNaN(d)) logMap[d.getDate()] = l;
    });

    // Hari libur nasional (dari config)
    const liburDates = [];
    if (appConfig.hari_libur && Array.isArray(appConfig.hari_libur)) {
        appConfig.hari_libur.forEach(dateStr => {
            const d = new Date(dateStr);
            if (d.getFullYear() === year && d.getMonth() === month) {
                liburDates.push(d.getDate());
            }
        });
    }

    const frag = document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'calendar-wrapper';

    // Header hari
    const header = document.createElement('div');
    header.className = 'calendar-header';
    ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].forEach(d => {
        const el = document.createElement('div');
        el.textContent = d;
        header.appendChild(el);
    });
    wrap.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'calendar-micro-grid';

    // empty cells
    for (let i = 0; i < firstDayOfWeek; i++) {
        const el = document.createElement('div');
        el.className = 'day-box';
        el.style.visibility = 'hidden';
        grid.appendChild(el);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jamPulang = parseInt(appConfig?.jPulang?.split(':')[0] || 16);

    for (let i = 1; i <= totalDays; i++) {
        const currentDate = new Date(year, month, i);
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isLibur = liburDates.includes(i);
        const log = logMap[i];

        const box = document.createElement('div');
        box.className = 'day-box';
        const numEl = document.createElement('span');
        numEl.className = 'day-num';
        numEl.textContent = String(i).padStart(2, '0');
        box.appendChild(numEl);

        const indEl = document.createElement('span');
        indEl.className = 'day-indicator';

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'day-tooltip';

        // Tentukan status
        let statusLabel = '';
        let tooltipStatus = '';
        let tooltipNilai = '';
        let tooltipKet = '';

        if (isLibur) {
            // Hari libur nasional
            box.classList.add('libur');
            statusLabel = 'L';
            tooltipStatus = 'Hari Libur Nasional';
            tooltipNilai = '-';
            tooltipKet = 'Tidak wajib absen';
        } else if (isWeekend) {
            // Akhir pekan: tidak dianggap alpha, hanya tampilkan kosong atau khusus
            box.classList.add('weekend');
            statusLabel = '';
            tooltipStatus = 'Akhir Pekan';
            tooltipNilai = '-';
            tooltipKet = 'Tidak wajib absen';
        } else if (log) {
            // Ada log presensi
            const status = (log.status || "").toLowerCase().trim();
            const score = log.score || 0;
            const ket = log.ket || log.keterangan || '-';

            // Tentukan label dan warna
            if (status.includes('hadir 100%')) {
                box.style.background = '#16a34a';
                statusLabel = 'H';
                tooltipStatus = 'Hadir 100%';
            } else if (status.includes('hadir 50%')) {
                box.style.background = 'linear-gradient(to top, #bbf7d0 50%, #ffffff 50%)';
                box.style.color = '#1f2937';
                indEl.style.color = '#1f2937';
                statusLabel = 'H50';
                tooltipStatus = 'Hadir 50%';
            } else if (status.includes('qr 100%')) {
                box.style.background = '#7c3aed';
                statusLabel = 'QR';
                tooltipStatus = 'QR 100%';
            } else if (status.includes('qr 50%')) {
                box.style.background = 'linear-gradient(to top, #ddd6fe 50%, #ffffff 50%)';
                box.style.color = '#1f2937';
                indEl.style.color = '#1f2937';
                statusLabel = 'QR50';
                tooltipStatus = 'QR 50%';
            } else if (status.includes('telat ringan')) {
                box.style.background = '#facc15';
                box.style.color = '#1f2937';
                indEl.style.color = '#1f2937';
                statusLabel = 'TR';
                tooltipStatus = 'Terlambat Ringan';
            } else if (status.includes('telat berat')) {
                box.style.background = '#f97316';
                statusLabel = 'TB';
                tooltipStatus = 'Terlambat Berat';
            } else if (status.includes('izin')) {
                box.style.background = '#9333ea';
                statusLabel = 'I';
                tooltipStatus = 'Izin';
            } else if (status.includes('sakit')) {
                box.style.background = '#2563eb';
                statusLabel = 'S';
                tooltipStatus = 'Sakit';
            } else if (status.includes('dinas')) {
                box.style.background = '#d97706';
                statusLabel = 'D';
                tooltipStatus = 'Dinas';
            } else {
                // Status lain (misal 'pulang' saja) anggap hadir parsial?
                box.style.background = '#6b7280';
                statusLabel = '?';
                tooltipStatus = status || 'Unknown';
            }

            tooltipNilai = 'Nilai: ' + (score || 0);
            tooltipKet = ket;

            // Simpan ke tooltip
            tooltip.innerHTML = `<div class="tooltip-date">${i} ${new Date(year,month,i).toLocaleDateString('id-ID',{month:'short',year:'numeric'})}</div>
                                <div class="tooltip-status">${tooltipStatus}</div>
                                <div class="tooltip-nilai">${tooltipNilai}</div>
                                <div class="tooltip-ket">${tooltipKet}</div>`;
            box.appendChild(tooltip);

        } else {
            // Hari kerja tanpa log
            const cellDate = new Date(year, month, i);
            cellDate.setHours(0, 0, 0, 0);

            if (cellDate.getTime() === today.getTime()) {
                // Hari ini
                if (new Date().getHours() >= jamPulang) {
                    box.style.background = '#dc2626';
                    statusLabel = 'A';
                    tooltipStatus = 'Alpha (Terlewat)';
                    tooltipNilai = 'Nilai: 0';
                    tooltipKet = 'Tidak ada absensi';
                } else {
                    box.style.background = '#f3f4f6';
                    box.style.color = '#9ca3af';
                    indEl.style.color = '#9ca3af';
                    statusLabel = '⌛';
                    tooltipStatus = 'Menunggu Absensi';
                    tooltipNilai = 'Nilai: 0';
                    tooltipKet = 'Belum absen hari ini';
                }
            } else if (cellDate < today) {
                // Hari lampau -> Alpha
                box.style.background = '#dc2626';
                statusLabel = 'A';
                tooltipStatus = 'Alpha (Tidak Hadir)';
                tooltipNilai = 'Nilai: 0';
                tooltipKet = 'Tidak ada absensi';
            } else {
                // Hari mendatang
                box.style.background = '#f9fafb';
                box.style.color = '#d1d5db';
                statusLabel = '';
                tooltipStatus = 'Hari Mendatang';
                tooltipNilai = '';
                tooltipKet = '';
            }
        }

        // Jika tidak ada tooltip status (untuk weekend/libur) kita isi
        if (isLibur || isWeekend) {
            tooltip.innerHTML = `<div class="tooltip-date">${i} ${new Date(year,month,i).toLocaleDateString('id-ID',{month:'short',year:'numeric'})}</div>
                                <div class="tooltip-status">${tooltipStatus}</div>
                                <div class="tooltip-ket">${tooltipKet}</div>`;
            box.appendChild(tooltip);
        }

        if (statusLabel) indEl.textContent = statusLabel;
        box.appendChild(indEl);
        grid.appendChild(box);
    }

    wrap.appendChild(grid);
    frag.appendChild(wrap);

    const temp = document.createElement('div');
    temp.appendChild(frag);
    return temp.innerHTML;
}

// ============================================================
// 11. RENDER CARDS
// ============================================================
function renderCards(data) {
    const container = document.getElementById('raportGrid');
    const printGrid = document.getElementById('printGrid');
    if (!container) return;
    if (printGrid) printGrid.innerHTML = '';

    try {
        if (!data || !data.length) {
            container.innerHTML = `<div class="empty-state"><i data-lucide="file-x" size="48"></i><h3>Tidak Ada Data Kinerja</h3><p>Tidak ditemukan data presensi untuk periode dan wilayah yang dipilih.</p></div>`;
            lucide.createIcons();
            return;
        }

        data.sort((a, b) => (b.score || 0) - (a.score || 0));
        const fragment = document.createDocumentFragment();

        data.forEach(p => {
            const card = document.createElement('div');
            card.className = 'pegawai-card';
            card.dataset.pegawaiId = p.id || p.ID;

            const telatTotal = (p.stats?.telatRingan || 0) + (p.stats?.telatBerat || 0);
            const sidTotal = (p.stats?.izin || 0) + (p.stats?.sakit || 0) + (p.stats?.dinas || 0);
            const hadirQrTotal = (p.stats?.hadir || 0) + (p.stats?.qrHadir || 0);
            const alpha = p.stats?.alpha || 0;

            if (p.logs && p.logs.length > 0) logsMap.set(String(p.id || p.ID), p.logs);

            const scoreColor = (p.score || 0) >= 75 ? 'var(--success)' : ((p.score || 0) >= 60 ? 'var(--warning)' : 'var(--danger)');

            const nama = sanitizeHTML(p.nama) || 'N/A';
            const jabatan = sanitizeHTML(p.jabatan) || 'N/A';
            const wilayah = sanitizeHTML(p.wilayah) || 'N/A';
            const grade = sanitizeHTML(p.grade) || '-';

            card.innerHTML = `
                <div class="card-top">
                    <div class="photo-frame-pro">
                        <img data-src="${getSmartUrl(p.foto)}" class="lazy-img" src="${FALLBACK_IMAGE}" onerror="this.src='${FALLBACK_IMAGE}'">
                    </div>
                    <div class="id-group">
                        <h3>${nama}</h3>
                        <p>${jabatan} | ${wilayah}</p>
                    </div>
                    <div class="grade-badge">${grade}</div>
                </div>
                <div class="card-body">
                    <div class="performance-main">
                        <span>Kinerja Kumulatif</span>
                        <b>${formatScore(p.score)}</b>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${Math.min(p.score || 0, 100)}%;background:${scoreColor}"></div>
                        </div>
                    </div>
                    <div class="stats-summary">
                        <div class="stat-pill stat-hadir">
                            <b>${hadirQrTotal}</b>
                            <span>Hadir/QR</span>
                        </div>
                        <div class="stat-pill stat-telat">
                            <b>${telatTotal}</b>
                            <span>Telat</span>
                        </div>
                        <div class="stat-pill stat-alpha ${alpha > 0 ? 'bad' : 'good'}">
                            <b>${alpha}</b>
                            <span>Alpha</span>
                        </div>
                        <div class="stat-pill stat-sid">
                            <b>${sidTotal}</b>
                            <span>S/I/D</span>
                        </div>
                    </div>
                </div>
                <button class="detail-toggle-btn">
                    <i data-lucide="chevron-down" size="14"></i> Detail Aktivitas Bulanan
                </button>
                <div class="hidden-calendar-panel"></div>
            `;
            fragment.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(fragment);

        document.querySelectorAll('.lazy-img').forEach(img => {
            imageObserver.observe(img);
            const rect = img.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-img');
                    imageObserver.unobserve(img);
                }
            }
        });

        lucide.createIcons();

        document.querySelectorAll('.detail-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const card = this.closest('.pegawai-card');
                toggleDetail(this, card, card.dataset.pegawaiId);
            });
        });

    } catch (e) {
        console.error('Render error:', e);
        container.innerHTML = `<div class="empty-state"><i data-lucide="alert-triangle" size="48"></i><h3>Error Render</h3><p>${e.message}</p></div>`;
        lucide.createIcons();
    }
}

// ============================================================
// 12. TOGGLE DETAIL (dengan cache)
// ============================================================
function toggleDetail(btn, card, pegawaiId) {
    if (!pegawaiId || !card || !btn) {
        console.error('Invalid parameters in toggleDetail');
        return;
    }

    const panel = card.querySelector('.hidden-calendar-panel');
    if (!panel) return;

    const isActive = panel.classList.toggle('active');

    if (isActive) {
        btn.innerHTML = '<i data-lucide="chevron-up" size="14"></i> Sembunyikan Aktivitas';
        const startDate = document.getElementById('startD').value;
        const cacheKey = `${pegawaiId}_${startDate}`;

        if (calendarCache.has(cacheKey)) {
            panel.innerHTML = calendarCache.get(cacheKey);
        } else {
            const logs = logsMap.get(String(pegawaiId)) || [];
            const html = buildCalendarHTML(logs, startDate);
            calendarCache.set(cacheKey, html);
            panel.innerHTML = html;
        }
    } else {
        btn.innerHTML = '<i data-lucide="chevron-down" size="14"></i> Detail Aktivitas Bulanan';
    }
    lucide.createIcons({ node: btn });
}

// ============================================================
// 13. PRINT & PDF
// ============================================================
window.onbeforeprint = () => {
    const pg = document.getElementById('printGrid');
    if (pg) {
        pg.innerHTML = document.getElementById('raportGrid').innerHTML;
        lucide.createIcons();
    }
};

function openPDFGenerator() {
    const start = document.getElementById('startD').value,
        end = document.getElementById('endD').value;
    if (!start || !end) {
        showToast('Pilih rentang tanggal terlebih dahulu!', 'warning');
        return;
    }
    try {
        const reg = document.getElementById('wilF').value;
        window.open(`generate-pdf.html?start=${start}&end=${end}&region=${encodeURIComponent(reg)}`, '_blank');
    } catch (e) {
        window.print();
    }
}

// ============================================================
// 14. START
// ============================================================
window.onload = initApp;

// ============================================================
// END OF RAPORT.JS v2.1
// ============================================================
