// ============================================================
// PROFILE_RAPORT.JS - v5.1 (BUG FIX + PERFORMANCE)
// ============================================================
// CHANGELOG v5.1:
// ✅ FIXED: showDetail function ditambahkan (sebelumnya hilang!)
// ✅ FIXED: Race condition dengan AbortController
// ✅ FIXED: Event delegation di tabel history (bukan onclick inline)
// ✅ FIXED: Foto di detail dioptimasi untuk HP rendah
// ✅ FIXED: formatDateIndo handle invalid date
// ✅ ADDED: Retry mechanism untuk API gagal
// ✅ ADDED: Error handling yang lebih robust
// ============================================================

const API_BASE = "https://script.google.com/macros/s/AKfycbwg8LoyLRWaqpOpmXj6GGdwVksNWEUOKijD3vpllMSfeHVQY5XaeXcd7ygoyFFL-JIv/exec";
const isLocalFile = window.location.protocol === 'file:';
const API = isLocalFile 
    ? "https://cors-anywhere.herokuapp.com/" + API_BASE
    : API_BASE;

const GITHUB_LOGO_URL = "https://raw.githubusercontent.com/tpopbwi/presensi-pusda/main/assets/logo.png";

// ============================================================
// 0. DEVICE DETECTION - ADAPTIVE PERFORMANCE
// ============================================================
const DeviceProfile = (() => {
    const isLowEnd = () => {
        if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
        if (navigator.connection && navigator.connection.effectiveType) {
            const conn = navigator.connection.effectiveType;
            if (conn === 'slow-2g' || conn === '2g' || conn === '3g') return true;
        }
        if (window.innerWidth < 480) return true;
        return false;
    };
    
    const isLow = isLowEnd();
    if (isLow) document.documentElement.classList.add('low-end-device');
    
    return {
        isLowEnd: isLow,
        config: {
            imageSize: isLow ? 200 : 400,
            detailImageSize: isLow ? 300 : 500,
            pageSize: isLow ? 10 : 20,
            cacheTTL: isLow ? 10 * 60 * 1000 : 5 * 60 * 1000,
            detailCacheTTL: isLow ? 15 * 60 * 1000 : 10 * 60 * 1000,
            enableAnimations: !isLow,
            prefetch: !isLow,
            fetchTimeout: isLow ? 25000 : 20000,
            detailTimeout: isLow ? 20000 : 15000
        }
    };
})();

// ============================================================
// 1. CACHE & CONFIGURATION
// ============================================================
const CACHE_CONFIG = {
    TTL: DeviceProfile.config.cacheTTL,
    DETAIL_TTL: DeviceProfile.config.detailCacheTTL,
    PAGE_SIZE: DeviceProfile.config.pageSize
};

const cache = new Map();
const detailCache = new Map();

// ✅ NEW: AbortController untuk detail request
let currentDetailController = null;

// ============================================================
// 2. GLOBAL VARIABLES
// ============================================================
const DEBUG_MODE = false;
let currentPegawai = null;
let statsData = null;
let recordsData = [];
let holidays = [];
let currentFilter = 'month';
let currentPage = 0;
let isLoadingMore = false;
let hasMoreData = true;

const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' fill='%232e446e' rx='20'/%3E%3Ccircle cx='100' cy='100' r='50' fill='%23ffffff' opacity='.15'/%3E%3C/svg%3E";

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * ✅ IMPROVED: Optimized image URL dengan fallback handling
 */
function getOptimizedImageUrl(url, size = null) {
    if (!url || url === '-' || url === 'null' || url === 'undefined') return placeholderImg;
    
    const imgSize = size || DeviceProfile.config.imageSize;
    
    try {
        // Google Drive / Google User Content
        if (url.includes("googleusercontent") || url.includes("lh3.googleusercontent.com")) {
            const baseUrl = url.split("=")[0];
            return `${baseUrl}=w${imgSize}-h${imgSize}`;
        }
        
        // Drive dengan format /d/FILE_ID/
        if (url.includes("drive.google.com")) {
            let fileId = "";
            let match = url.match(/\/d\/([^\/\?]+)/);
            if (match && match[1]) fileId = match[1];
            if (!fileId) {
                match = url.match(/[?&]id=([^&]+)/);
                if (match && match[1]) fileId = match[1];
            }
            if (fileId) {
                return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${imgSize}`;
            }
        }
        
        // Jika URL valid, return as-is
        if (url.startsWith('http')) return url;
        
        return placeholderImg;
    } catch (e) {
        console.warn('⚠️ Image URL optimization failed:', e);
        return placeholderImg;
    }
}

/**
 * ✅ IMPROVED: formatDateIndo dengan invalid date handling
 */
function formatDateIndo(dateStr) {
    try {
        if (!dateStr) return 'Tanggal tidak valid';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Tanggal tidak valid';
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return 'Tanggal tidak valid';
    }
}

// ============================================================
// 4. FETCH WITH TIMEOUT + RETRY
// ============================================================
async function fetchWithTimeout(url, options = {}, timeout = DeviceProfile.config.fetchTimeout) {
    const localController = new AbortController();
    const timeoutId = setTimeout(() => localController.abort(), timeout);
    
    let combinedSignal = localController.signal;
    if (options.signal) {
        if (typeof AbortSignal.any === 'function') {
            combinedSignal = AbortSignal.any([localController.signal, options.signal]);
        } else {
            options.signal.addEventListener('abort', () => localController.abort(options.signal.reason));
        }
    }

    try {
        const response = await fetch(url, {
            ...options,
            signal: combinedSignal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            if (options.signal && options.signal.aborted) {
                const err = new Error('Request cancelled');
                err.name = 'AbortError';
                throw err;
            }
            throw new Error('Request timeout setelah ' + timeout + 'ms');
        }
        throw error;
    }
}

/**
 * ✅ NEW: Fetch dengan retry mechanism
 */
async function fetchWithRetry(url, options = {}, retries = 2, delay = 1500) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetchWithTimeout(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            lastError = e;
            if (i === retries) break;
            if (DEBUG_MODE) console.warn(`⚠️ Fetch attempt ${i + 1} failed, retrying in ${delay * (i + 1)}ms...`);
            await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
    }
    throw lastError;
}

// ============================================================
// 5. LOAD DATA
// ============================================================
async function loadData() {
    const overlay = document.getElementById('loadingOverlay');
    const statusText = document.getElementById('loadStatus');
    
    if (!currentPegawai) {
        showToast('Error', 'Data pegawai tidak ditemukan.', 'error');
        setTimeout(() => goToPresensi(), 2000);
        return;
    }

    if (overlay) overlay.style.display = 'flex';
    if (statusText) statusText.innerText = 'Memuat Profile Raport...';

    try {
        const pid = currentPegawai.ID || currentPegawai.id;
        const cacheKey = `dashboard_${pid}_${currentFilter}`;
        
        const cachedData = cache.get(cacheKey);
        if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_CONFIG.TTL) {
            if (DEBUG_MODE) console.log('✅ Using cached dashboard data');
            const data = cachedData.data;
            statsData = data.stats;
            statsData.percentages = data.percentages || {};
            statsData.totalHariKerja = data.workingDays || 0;
            statsData.totalMonthWorkingDays = data.totalMonthWorkingDays || 0;
            recordsData = data.records || [];
            holidays = data.holidays || [];
            
            renderAll();
            updateFooterLabel();
            if (overlay) overlay.style.display = 'none';
            return;
        }

        const url = `${API}?action=getPegawaiStats&id=${encodeURIComponent(pid)}&period=${currentFilter}&cb=${Date.now()}`;
        if (DEBUG_MODE) console.log('📡 Fetching:', url);
        
        // ✅ Gunakan retry untuk reliability
        const r = await fetchWithRetry(url, {}, 2, 1500);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        
        const data = await r.json();
        
        if (data.status === 'success') {
            statsData = data.stats || {};
            statsData.percentages = data.percentages || {};
            statsData.totalHariKerja = data.workingDays || 0;
            statsData.totalMonthWorkingDays = data.totalMonthWorkingDays || 0;
            statsData.alpha = Math.max(0, statsData.alpha || 0);
            recordsData = data.records || [];
            holidays = data.holidays || [];
            
            if (DEBUG_MODE) {
                console.log('✅ Data loaded');
                console.log('📊 Working days:', statsData.totalHariKerja);
                console.log('📱 Device Profile:', DeviceProfile.isLowEnd ? 'LOW-END' : 'STANDARD');
            }
            
            cache.set(cacheKey, {
                data: { 
                    stats: statsData, 
                    percentages: statsData.percentages,
                    workingDays: statsData.totalHariKerja,
                    totalMonthWorkingDays: statsData.totalMonthWorkingDays,
                    records: recordsData, 
                    holidays: holidays 
                },
                timestamp: Date.now()
            });
            
            renderAll();
            updateFooterLabel();
        } else {
            throw new Error(data.message || 'Gagal memuat data');
        }
        
        if (overlay) overlay.style.display = 'none';
        
    } catch (e) {
        console.error("❌ Load data error:", e);
        if (overlay) overlay.style.display = 'none';
        showToast('Error', 'Gagal memuat data: ' + e.message, 'error');
    }
}

// ============================================================
// 6. RENDER ALL
// ============================================================
function renderAll() {
    renderProfile();
    renderTodayStatus();
    renderHistory();
    renderStats();
    renderSummaryStats();
}

// ============================================================
// 7. RENDER PROFILE
// ============================================================
function renderProfile() {
    const p = currentPegawai;
    
    const rawUrl = p.Link_Foto_Profile || '';
    let finalSrc = placeholderImg;
    if (rawUrl) {
        finalSrc = getOptimizedImageUrl(rawUrl, 300);
    }
    
    const img = document.getElementById('profileAvatar');
    if (img) {
        img.onload = null;
        img.onerror = null;
        if (DeviceProfile.config.enableAnimations) {
            img.style.transition = 'opacity 0.3s ease';
        }
        img.style.opacity = 0;
        img.src = finalSrc;
        img.onload = () => { img.style.opacity = 1; };
        img.onerror = () => {
            img.onerror = null;
            img.src = placeholderImg;
            img.style.opacity = 1;
        };
    }
    
    const el = (id) => document.getElementById(id);
    if (el('profileName')) el('profileName').innerText = p.Nama || p.nama;
    if (el('profileJob')) el('profileJob').innerHTML = `<i data-lucide="briefcase" size="14"></i> ${p.Jabatan || 'PPA'}`;
    if (el('profileWil')) el('profileWil').innerHTML = `<i data-lucide="map-pin" size="14"></i> ${p.Wilayah || 'UPT'}`;
    if (el('sidebarLogo')) el('sidebarLogo').src = GITHUB_LOGO_URL;
    
    lucide.createIcons();
}

// ============================================================
// 8. RENDER TODAY STATUS
// ============================================================
function renderTodayStatus() {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    
    const el = (id) => document.getElementById(id);
    if (el('todayDate')) {
        el('todayDate').innerText = today.toLocaleDateString('id-ID', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
    }
    
    const todayRecords = recordsData.filter(r => {
        if (r.date) return r.date === todayStr;
        if (r.timestamp) {
            const d = new Date(r.timestamp);
            return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === todayStr;
        }
        return false;
    });
    
    let hadirTime = '--:--', pulangTime = '--:--';
    let hadirNilai = 0, pulangNilai = 0, specialNilai = 0;
    let hasHadir = false, hasPulang = false, hasSpecial = false;
    let specialType = '-';
    let totalPts = 0;
    
    todayRecords.forEach(r => {
        const status = (r.status || '').toLowerCase();
        const nilai = parseInt(r.nilai) || 0;
        totalPts += nilai;
        
        if (status.includes('izin') || status.includes('sakit') || status.includes('dinas')) {
            hasSpecial = true;
            specialType = status.charAt(0).toUpperCase() + status.slice(1);
            specialNilai = nilai;
        } else if (status.includes('hadir') || status.includes('terlambat') || status.includes('qr hadir')) {
            hasHadir = true;
            hadirTime = r.time || r.waktu || '--:--';
            hadirNilai = nilai;
        } else if (status.includes('pulang') || status.includes('qr pulang')) {
            hasPulang = true;
            pulangTime = r.time || r.waktu || '--:--';
            pulangNilai = nilai;
        }
    });
    
    if (el('todayHadir')) {
        el('todayHadir').innerText = hadirTime;
        el('todayHadir').style.color = hasHadir ? 'var(--success)' : 'rgba(255,255,255,0.3)';
    }
    if (el('todayHadirPoint')) el('todayHadirPoint').innerText = hadirNilai + ' pts';
    
    if (el('todayPulang')) {
        el('todayPulang').innerText = pulangTime;
        el('todayPulang').style.color = hasPulang ? 'var(--pu-blue)' : 'rgba(255,255,255,0.3)';
    }
    if (el('todayPulangPoint')) el('todayPulangPoint').innerText = pulangNilai + ' pts';
    
    if (el('todaySpecial')) {
        el('todaySpecial').innerText = specialType;
        el('todaySpecial').style.color = hasSpecial ? '#a855f7' : 'rgba(255,255,255,0.3)';
    }
    if (el('todaySpecialPoint')) el('todaySpecialPoint').innerText = specialNilai + ' pts';
    
    const totalCount = (hasHadir ? 1 : 0) + (hasPulang ? 1 : 0) + (hasSpecial ? 1 : 0);
    if (el('todayTotal')) el('todayTotal').innerText = totalCount;
    if (el('todayTotalPoint')) el('todayTotalPoint').innerText = totalPts + ' pts';
    
    lucide.createIcons();
}

// ============================================================
// 9. RENDER HISTORY (✅ FIXED: Pakai Event Delegation)
// ============================================================
function renderHistory() {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    
    const grouped = recordsData.reduce((acc, r) => {
        const dateKey = r.date || (r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : null);
        if (!dateKey) return acc;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(r);
        return acc;
    }, {});
    
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    
    const start = currentPage * CACHE_CONFIG.PAGE_SIZE;
    const end = start + CACHE_CONFIG.PAGE_SIZE;
    const pageDates = sortedDates.slice(start, end);
    
    hasMoreData = end < sortedDates.length;
    
    if (pageDates.length === 0 && currentPage === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;opacity:0.5">
                    <i data-lucide="inbox" size="48" style="margin-bottom:12px"></i>
                    <p>Belum ada data presensi</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        updateHistoryCount(sortedDates.length);
        return;
    }
    
    const nowD = new Date();
    const todayKey = nowD.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const curMonth = todayKey.slice(0, 7);
    
    let html = '';
    pageDates.forEach(date => {
        const records = grouped[date];
        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
        
        const rowMonth = date.slice(0, 7);
        let rowClass = '';
        if (date === todayKey) rowClass = 'row-today';
        else if (rowMonth === curMonth) rowClass = 'row-current';
        else rowClass = 'row-past';
        
        let masukTime = '-', pulangTime = '-';
        let totalNilai = 0;
        let statuses = [];
        
        records.forEach(r => {
            const status = (r.status || '').toLowerCase();
            totalNilai += parseInt(r.nilai) || 0;
            
            if (status.includes('hadir') || status.includes('terlambat') || status.includes('qr hadir')) masukTime = r.time || r.waktu || '-';
            if (status.includes('pulang') || status.includes('qr pulang')) pulangTime = r.time || r.waktu || '-';
            
            if (status.includes('izin') && !statuses.includes('Izin')) statuses.push('Izin');
            else if (status.includes('sakit') && !statuses.includes('Sakit')) statuses.push('Sakit');
            else if (status.includes('dinas') && !statuses.includes('Dinas')) statuses.push('Dinas');
            else if (status.includes('terlambat') && !statuses.includes('Terlambat')) statuses.push('Terlambat');
            else if ((status.includes('hadir') || status.includes('qr')) && !statuses.includes('Hadir')) statuses.push('Hadir');
        });
        
        let statusClass = 'alpha', statusDisplay = 'Alpha';
        if (statuses.length > 1) {
            statusClass = 'multi-status';
            statusDisplay = statuses.slice(0, 2).join(' + ') + (statuses.length > 2 ? ' +' : '');
        } else if (statuses.length === 1) {
            statusClass = statuses[0].toLowerCase();
            statusDisplay = statuses[0];
        }
        
        // ✅ FIXED: Pakai data-attribute, BUKAN onclick inline
        html += `<tr class="${rowClass}" data-date="${date}" style="cursor:pointer">
                    <td>${dateStr}</td>
                    <td>${dayName}</td>
                    <td>${masukTime}</td>
                    <td>${pulangTime}</td>
                    <td style="font-weight:800;color:var(--sda-toska)">${totalNilai}</td>
                    <td><span class="status-badge-table ${statusClass}">${statusDisplay}</span></td>
                 </tr>`;
    });
    
    tbody.innerHTML = html;
    
    // ✅ NEW: Event delegation untuk semua row (lebih aman & efisien)
    tbody.querySelectorAll('tr[data-date]').forEach(row => {
        row.addEventListener('click', function() {
            const date = this.getAttribute('data-date');
            if (date) showDetail(date);
        });
    });
    
    lucide.createIcons();
    updateHistoryCount(sortedDates.length);
}

// ============================================================
// 10. HISTORY COUNT & LOAD MORE
// ============================================================
function updateHistoryCount(total) {
    const el = document.getElementById('historyCount');
    if (el) {
        const start = currentPage * CACHE_CONFIG.PAGE_SIZE + 1;
        const end = Math.min((currentPage + 1) * CACHE_CONFIG.PAGE_SIZE, total);
        el.innerText = total > 0 ? `Menampilkan ${start}-${end} dari ${total} data` : 'Belum ada data';
    }
    const btn = document.getElementById('btnLoadMore');
    if (btn) {
        if (hasMoreData && total > CACHE_CONFIG.PAGE_SIZE) {
            btn.style.display = 'flex';
            btn.innerHTML = '<i data-lucide="chevron-down" size="16"></i> Load More';
        } else btn.style.display = 'none';
        lucide.createIcons();
    }
}

function loadMoreHistory() {
    if (isLoadingMore || !hasMoreData) return;
    isLoadingMore = true;
    const btn = document.getElementById('btnLoadMore');
    if (btn) { 
        btn.innerHTML = '<i data-lucide="loader" size="16" style="animation:spin 0.8s linear infinite"></i> Loading...'; 
        btn.disabled = true; 
        lucide.createIcons(); 
    }
    currentPage++;
    setTimeout(() => { 
        renderHistory(); 
        isLoadingMore = false; 
        if (btn) { 
            btn.disabled = false; 
            btn.innerHTML = '<i data-lucide="chevron-down" size="16"></i> Load More'; 
            lucide.createIcons(); 
        } 
    }, 200);
}

// ============================================================
// 11. RENDER STATS
// ============================================================
function renderStats() {
    if (!statsData) return;
    const el = (id) => document.getElementById(id);
    
    if (el('statHadir')) el('statHadir').innerText = statsData.hadir || 0;
    if (el('statTerlambat')) el('statTerlambat').innerText = statsData.terlambat || 0;
    if (el('statIzin')) el('statIzin').innerText = statsData.izin || 0;
    if (el('statSakit')) el('statSakit').innerText = statsData.sakit || 0;
    if (el('statDinas')) el('statDinas').innerText = statsData.dinas || 0;
    
    const alpha = Math.max(0, statsData.alpha || 0);
    if (el('statAlpha')) el('statAlpha').innerText = alpha;
    
    const pct = statsData.percentages || {};
    const setPct = (id, val) => { const elPct = document.getElementById(id); if (elPct) elPct.innerText = (val || '0.0') + '%'; };
    setPct('statHadirPct', pct.hadir); setPct('statTerlambatPct', pct.terlambat);
    setPct('statIzinPct', pct.izin); setPct('statSakitPct', pct.sakit);
    setPct('statDinasPct', pct.dinas); setPct('statAlphaPct', pct.alpha);
    
    updateHeroStats(statsData);
    const workingDays = statsData.totalHariKerja || 0;
    if (el('totalWorkingDays')) el('totalWorkingDays').innerText = workingDays;
    
    const maxStat = Math.max(statsData.hadir || 0, statsData.terlambat || 0, statsData.izin || 0, statsData.sakit || 0, statsData.dinas || 0, alpha || 0, 1);
    setTimeout(() => {
        const bar = (id, val) => { const elBar = document.getElementById(id); if (elBar) elBar.style.width = ((val || 0) / maxStat * 100) + '%'; };
        bar('barHadir', statsData.hadir); bar('barTerlambat', statsData.terlambat);
        bar('barIzin', statsData.izin); bar('barSakit', statsData.sakit);
        bar('barDinas', statsData.dinas); bar('barAlpha', alpha);
    }, 100);
}

// ============================================================
// 12. UPDATE HERO STATS
// ============================================================
function updateHeroStats(s) {
    const totalKehadiran = (s.hadir || 0) + (s.terlambat || 0) + (s.izin || 0) + (s.sakit || 0) + (s.dinas || 0);
    const efektifKerjaBulan = s.totalMonthWorkingDays || 0;
    
    const el = (id) => document.getElementById(id);
    if (el('totalKehadiranStats')) el('totalKehadiranStats').innerText = totalKehadiran;
    if (el('totalAlphaStats')) el('totalAlphaStats').innerText = efektifKerjaBulan;
}

// ============================================================
// 13. RENDER SUMMARY STATS
// ============================================================
function renderSummaryStats() {
    if (!statsData) return;
    const workingDays = statsData.totalHariKerja || 0;
    const totalNilai = statsData.totalNilai || 0;
    const maxPossibleScore = workingDays * 100;
    const persentase = maxPossibleScore > 0 ? Math.round((totalNilai / maxPossibleScore) * 100) : 0;
    const totalKehadiran = (statsData.hadir || 0) + (statsData.terlambat || 0) + (statsData.izin || 0) + (statsData.sakit || 0) + (statsData.dinas || 0);
    
    const el = (id) => document.getElementById(id);
    if (el('totalKehadiran')) el('totalKehadiran').innerText = totalKehadiran;
    if (el('totalNilai')) el('totalNilai').innerText = totalNilai;
    if (el('persentaseKehadiran')) el('persentaseKehadiran').innerText = persentase + '%';
    if (el('totalWorkingDays')) el('totalWorkingDays').innerText = workingDays;
    
    updateHeroStats(statsData);
}

// ============================================================
// 14. ✅ NEW: SHOW DETAIL (Dengan AbortController)
// ============================================================
async function showDetail(date) {
    const card = document.getElementById('detailCard');
    const content = document.getElementById('detailContent');
    if (!card || !content) {
        console.error('❌ Detail card or content not found');
        return;
    }
    
    // Cancel previous request jika ada
    if (currentDetailController) {
        currentDetailController.abort();
    }
    
    // Check cache first
    const cacheKey = `detail_${currentPegawai.ID}_${date}`;
    if (detailCache.has(cacheKey)) {
        const cached = detailCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_CONFIG.DETAIL_TTL) {
            renderDetailContent(cached.data);
            card.style.display = 'block';
            card.scrollIntoView({ 
                behavior: DeviceProfile.config.enableAnimations ? 'smooth' : 'auto', 
                block: 'center' 
            });
            return;
        }
        detailCache.delete(cacheKey);
    }
    
    // Show loading state
    content.innerHTML = `
        <div class="detail-loading">
            <i data-lucide="loader" size="32" style="animation:spin 0.8s linear infinite"></i>
            <p>Memuat detail presensi...</p>
        </div>
    `;
    card.style.display = 'block';
    card.scrollIntoView({ 
        behavior: DeviceProfile.config.enableAnimations ? 'smooth' : 'auto', 
        block: 'center' 
    });
    lucide.createIcons();
    
    // Create new AbortController
    currentDetailController = new AbortController();
    
    try {
        const pid = currentPegawai.ID || currentPegawai.id;
        const url = `${API}?action=getPresensiDetail&id=${encodeURIComponent(pid)}&date=${date}&cb=${Date.now()}`;
        
        if (DEBUG_MODE) console.log('📡 Fetching detail:', url);
        
        const r = await fetchWithTimeout(
            url, 
            { signal: currentDetailController.signal }, 
            DeviceProfile.config.detailTimeout
        );
        
        const data = await r.json();
        
        // Check jika request sudah di-cancel
        if (currentDetailController.signal.aborted) return;
        
        if (data.status === 'success') {
            detailCache.set(cacheKey, { data, timestamp: Date.now() });
            renderDetailContent(data);
        } else {
            content.innerHTML = `
                <div class="detail-error">
                    <i data-lucide="alert-circle" size="32" style="color:var(--danger)"></i>
                    <p>${data.message || 'Gagal memuat detail'}</p>
                </div>
            `;
            lucide.createIcons();
        }
    } catch (e) {
        if (e.name === 'AbortError' || e.message.includes('cancelled')) {
            return; // Request di-cancel, abaikan
        }
        console.error('❌ Detail error:', e);
        content.innerHTML = `
            <div class="detail-error">
                <i data-lucide="alert-circle" size="32" style="color:var(--danger)"></i>
                <p>Gagal memuat detail: ${e.message}</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// ============================================================
// 15. RENDER DETAIL CONTENT (✅ FIXED: Foto Dioptimasi)
// ============================================================
function renderDetailContent(data) {
    const content = document.getElementById('detailContent');
    const records = data.records || [];
    
    const hadirRecord = records.find(r => {
        const s = (r.status || '').toLowerCase();
        return s.includes('hadir') || s.includes('terlambat') || s.includes('qr hadir');
    });
    
    const pulangRecord = records.find(r => {
        const s = (r.status || '').toLowerCase();
        return s.includes('pulang') || s.includes('qr pulang');
    });
    
    const specialRecord = records.find(r => {
        const s = (r.status || '').toLowerCase();
        return s.includes('izin') || s.includes('sakit') || s.includes('dinas');
    });
    
    let html = `<div class="detail-date-title">
                    <i data-lucide="calendar-days" size="16"></i>
                    <span>${formatDateIndo(data.date)}</span>
                </div>`;
    
    if (hadirRecord) html += renderDetailSection('Absen Hadir', 'sunrise', hadirRecord, 'hadir');
    if (pulangRecord) html += renderDetailSection('Absen Pulang', 'sunset', pulangRecord, 'pulang');
    if (specialRecord) html += renderDetailSection('Status Khusus', 'file-text', specialRecord, 'special');
    
    if (!hadirRecord && !pulangRecord && !specialRecord) {
        html += `<div class="detail-empty">
                    <i data-lucide="inbox" size="40"></i>
                    <p>Tidak ada data presensi di tanggal ini</p>
                 </div>`;
    }
    
    html += `<div class="detail-close-wrap">
                <button class="btn-close-detail" onclick="closeDetail()">
                    <i data-lucide="x" size="18"></i>
                    <span>Tutup Detail</span>
                </button>
             </div>`;
    
    content.innerHTML = html;
    lucide.createIcons();
    
    // ✅ Event delegation untuk foto
    content.querySelectorAll('.detail-photo-img').forEach(img => {
        img.addEventListener('click', function() {
            openImageModal(this.dataset.full || this.src);
        });
    });
}

// ============================================================
// 16. RENDER DETAIL SECTION (✅ FIXED: Foto Dioptimasi)
// ============================================================
function renderDetailSection(title, icon, record, type) {
    const escapeHtml = (str) => {
        if (!str) return '-';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    
    const escapeAttr = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };
    
    const status = escapeHtml(record.status);
    const keterangan = escapeHtml(record.keterangan || '-');
    const gps = escapeHtml(record.gps || '-');
    const nilai = record.nilai || 0;
    const time = record.time || '--:--';
    const wilayah = escapeHtml(record.wilayah || '-');
    
    // ✅ OPTIMASI FOTO untuk HP rendah
    const detailImgSize = DeviceProfile.config.detailImageSize;
    const optimizedSelfie = record.foto_selfie && record.foto_selfie !== '-' 
        ? getOptimizedImageUrl(record.foto_selfie, detailImgSize) 
        : null;
    const optimizedKerja = record.foto_kerja && record.foto_kerja !== '-' 
        ? getOptimizedImageUrl(record.foto_kerja, detailImgSize) 
        : null;
    
    let html = `
    <div class="detail-section detail-section-${type}">
        <div class="detail-section-header">
            <div class="detail-section-title">
                <i data-lucide="${icon}" size="16"></i>
                <span>${title}</span>
            </div>
            <span class="detail-section-time">
                <i data-lucide="clock" size="12"></i>
                ${time}
            </span>
        </div>
        
        <div class="detail-rows">
            <div class="detail-row">
                <div class="detail-label">Status</div>
                <div class="detail-value">${status}</div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">Nilai</div>
                <div class="detail-value detail-nilai">${nilai} pts</div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">Keterangan</div>
                <div class="detail-value">${keterangan}</div>
            </div>
            
            ${wilayah && wilayah !== '-' ? `
            <div class="detail-row">
                <div class="detail-label">Wilayah</div>
                <div class="detail-value">${wilayah}</div>
            </div>` : ''}
            
            ${gps && gps !== '-' ? `
            <div class="detail-row">
                <div class="detail-label">GPS</div>
                <div class="detail-value detail-gps">${gps}</div>
            </div>` : ''}
        </div>
        
        ${optimizedSelfie || optimizedKerja ? `
        <div class="detail-photos">
            ${optimizedSelfie ? `
            <div class="detail-photo-item">
                <div class="detail-photo-caption">
                    <i data-lucide="camera" size="11"></i>
                    Foto Selfie
                </div>
                <img class="detail-photo-img" 
                     src="${escapeAttr(optimizedSelfie)}" 
                     data-full="${escapeAttr(record.foto_selfie)}"
                     alt="Foto Selfie" 
                     loading="lazy"
                     onerror="this.parentElement.style.display='none'">
            </div>` : ''}
            
            ${optimizedKerja ? `
            <div class="detail-photo-item">
                <div class="detail-photo-caption">
                    <i data-lucide="image" size="11"></i>
                    Foto Lokasi
                </div>
                <img class="detail-photo-img" 
                     src="${escapeAttr(optimizedKerja)}" 
                     data-full="${escapeAttr(record.foto_kerja)}"
                     alt="Foto Lokasi" 
                     loading="lazy"
                     onerror="this.parentElement.style.display='none'">
            </div>` : ''}
        </div>` : ''}
    </div>`;
    
    return html;
}

// ============================================================
// 17. MODALS & UTILITIES
// ============================================================
function openImageModal(url) {
    if (!url || url === '-') return;
    
    const modal = document.createElement('div');
    modal.className = 'image-modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Detail Foto Presensi';
    img.loading = 'lazy';
    
    modal.appendChild(img);
    document.body.appendChild(modal);
}

function closeDetail() {
    const card = document.getElementById('detailCard');
    if (card) card.style.display = 'none';
}

// ============================================================
// 18. FILTER
// ============================================================
function setFilter(period) {
    currentFilter = period;
    currentPage = 0;
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    let filterId = period === 'all' ? 'filterAll' : period === '7' ? 'filter7' : period === '30' ? 'filter30' : 'filterMonth';
    const filterBtn = document.getElementById(filterId);
    if (filterBtn) filterBtn.classList.add('active');
    cache.clear(); 
    detailCache.clear(); 
    loadData();
}

// ============================================================
// 19. MONTH SELECTOR
// ============================================================
function initStatsMonthSelect() {
    const sel = document.getElementById('statsMonthSelect');
    if (!sel) return;
    const now = new Date();
    let html = '';
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        html += `<option value="${val}" ${i === 0 ? 'selected' : ''}>${i === 0 ? '📅 ' : ''}${label}</option>`;
    }
    sel.innerHTML = html;
}

// ============================================================
// 20. LOAD STATS FOR MONTH
// ============================================================
async function onStatsMonthChange(monthStr) { 
    if (currentPegawai) await loadStatsForMonth(monthStr); 
}

async function loadStatsForMonth(monthStr) {
    if (!currentPegawai) return;
    const pid = currentPegawai.ID || currentPegawai.id;
    const cacheKey = `stats_${pid}_${monthStr}`;
    
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_CONFIG.TTL) {
            updateStatsUI(cached.data); 
            updateHeroStats(cached.data); 
            updateFooterLabel(monthStr);
            return;
        }
        cache.delete(cacheKey);
    }
    
    try {
        const url = API + '?action=getPegawaiStats&id=' + encodeURIComponent(pid) + '&month=' + monthStr + '&cb=' + Date.now();
        const r = await fetchWithRetry(url, {}, 2, 1500);
        const d = await r.json();
        if (d.status !== 'success') return;
        
        const s = d.stats || {};
        s.alpha = Math.max(0, s.alpha || 0);
        s.percentages = d.percentages || {};
        s.totalHariKerja = d.workingDays || 0;
        s.totalMonthWorkingDays = d.totalMonthWorkingDays || 0;
        
        cache.set(cacheKey, { data: s, timestamp: Date.now() });
        updateStatsUI(s); 
        updateHeroStats(s); 
        updateFooterLabel(monthStr);
        
        const [y, m] = monthStr.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        const title = document.getElementById('statsTitleText');
        if (title) title.textContent = 'Statistik ' + label;
    } catch (e) { 
        console.warn('⚠️ Gagal load statistik bulan:', e); 
    }
}

// ============================================================
// 21. UPDATE STATS UI
// ============================================================
function updateStatsUI(s) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('statHadir', s.hadir || 0); set('statTerlambat', s.terlambat || 0);
    set('statIzin', s.izin || 0); set('statSakit', s.sakit || 0);
    set('statDinas', s.dinas || 0); set('statAlpha', s.alpha || 0);
    
    const pct = s.percentages || {};
    const setPct = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val || '0.0') + '%'; };
    setPct('statHadirPct', pct.hadir); setPct('statTerlambatPct', pct.terlambat);
    setPct('statIzinPct', pct.izin); setPct('statSakitPct', pct.sakit);
    setPct('statDinasPct', pct.dinas); setPct('statAlphaPct', pct.alpha);

    const max = Math.max(s.hadir || 0, s.terlambat || 0, s.izin || 0, s.sakit || 0, s.dinas || 0, s.alpha || 0, 1);
    const bar = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = ((v || 0) / max * 100) + '%'; };
    bar('barHadir', s.hadir); bar('barTerlambat', s.terlambat);
    bar('barIzin', s.izin); bar('barSakit', s.sakit);
    bar('barDinas', s.dinas); bar('barAlpha', s.alpha);
    updateHeroStats(s);
}

// ============================================================
// 22. UPDATE FOOTER LABEL
// ============================================================
function updateFooterLabel(monthStr) {
    const labelEl = document.getElementById('labelEfektifKerja');
    if (!labelEl) {
        if (DEBUG_MODE) console.warn('⚠️ Label footer tidak ditemukan (#labelEfektifKerja)');
        return;
    }
    
    if (!monthStr) {
        const now = new Date();
        monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    
    const [year, month] = monthStr.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, 1);
    const bulanPendek = selectedDate.toLocaleDateString('id-ID', { month: 'short' });
    const bulanCapitalized = bulanPendek.charAt(0).toUpperCase() + bulanPendek.slice(1);
    
    labelEl.textContent = `Efektif Kerja ${bulanCapitalized}:`;
    
    if (DEBUG_MODE) {
        console.log(`📅 Footer label updated: Efektif Kerja ${bulanCapitalized}`);
    }
}

// ============================================================
// 23. NAVIGATION & UTILITIES
// ============================================================
function getPegawaiFromURL() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        currentPegawai = {
            ID: id, 
            Nama: params.get('nama') || 'Pegawai', 
            Jabatan: params.get('jabatan') || 'PPA',
            Wilayah: params.get('wilayah') || 'UPT', 
            Link_Foto_Profile: params.get('foto') || ''
        };
        const status = params.get('status'), msg = params.get('msg');
        if (status === 'success' && msg) showSuccessToast(msg);
        return true;
    }
    return false;
}

function goBack() { 
    sessionStorage.setItem('return_from_profile', 'true'); 
    window.location.href = 'presensi.html'; 
}

function goToPresensi() { 
    sessionStorage.setItem('return_from_profile', 'true'); 
    window.location.href = 'presensi.html'; 
}

function showSuccessToast(message) {
    const toast = document.getElementById('successToast'), msgEl = document.getElementById('toastMessage');
    if (toast && msgEl) { 
        msgEl.innerText = message; 
        toast.style.display = 'flex'; 
        setTimeout(() => closeToast(), 5000); 
    }
}

function closeToast() { 
    const toast = document.getElementById('successToast'); 
    if (toast) toast.style.display = 'none'; 
}

function showToast(title, message, type = "info") {
    const modal = document.getElementById('notificationModal'), content = document.getElementById('notifModalContent');
    const iconEl = document.getElementById('notifIcon'), titleEl = document.getElementById('notifTitle');
    const msgEl = document.getElementById('notifMessage'), btnOk = document.getElementById('btnNotifOk');
    if (!modal || !content) return;
    content.className = 'notif-modal-content'; 
    content.classList.add(`notif-${type}`);
    titleEl.innerText = title; 
    msgEl.innerText = message;
    btnOk.innerHTML = '<i data-lucide="check" size="18"></i> Mengerti';
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    iconEl.setAttribute('data-lucide', icons[type] || 'info'); 
    lucide.createIcons();
    modal.style.display = 'flex'; 
    requestAnimationFrame(() => { modal.classList.add('show'); });
    btnOk.onclick = () => { 
        modal.classList.remove('show'); 
        setTimeout(() => { modal.style.display = 'none'; }, 300); 
    };
}

function updateClock() {
    const now = new Date();
    const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const jakartaDate = new Date(jakartaStr);
    const timeStr = jakartaDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    const clockEl = document.getElementById('liveClock');
    if (clockEl) clockEl.innerText = timeStr;
}

// ============================================================
// 24. INITIALIZATION
// ============================================================
window.onload = async () => {
    lucide.createIcons();
    
    if (DEBUG_MODE) {
        console.log('📱 Device Profile:', DeviceProfile.isLowEnd ? 'LOW-END' : 'STANDARD');
        console.log('⚙️ Config:', DeviceProfile.config);
    }
    
    const hasParam = getPegawaiFromURL();
    if (!hasParam) {
        const saved = sessionStorage.getItem('profile_pegawai');
        if (saved) { 
            try { 
                currentPegawai = JSON.parse(saved); 
            } catch(e) {} 
        }
    }
    
    if (!currentPegawai) { 
        showToast('Peringatan', 'Data pegawai tidak ditemukan.', 'warning'); 
        setTimeout(() => goToPresensi(), 2000); 
        return; 
    }
    
    sessionStorage.setItem('profile_pegawai', JSON.stringify(currentPegawai));
    initStatsMonthSelect();
    await loadData();
    updateFooterLabel();
    
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    await loadStatsForMonth(currentMonth);
    
    setInterval(updateClock, 1000); 
    updateClock();
    
    try {
        if ('serviceWorker' in navigator) {
            const isSecure = window.location.protocol === 'https:' || 
                (window.location.protocol === 'http:' && 
                 (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
            if (isSecure) navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    } catch (e) {}
    
    window.addEventListener('beforeunload', () => { 
        cache.clear(); 
        detailCache.clear(); 
    });
};

// ============================================================
// END OF PROFILE_RAPORT.JS v5.1
// ============================================================
