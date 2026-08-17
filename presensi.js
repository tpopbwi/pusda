// ============================================================
// PRESENSI.JS - v7.0.0 (MULTI-USER LOGIN)
// ============================================================

// ============================================================
// 0. SESSION DATA
// ============================================================
const SESSION_TOKEN = localStorage.getItem('pegawai_token');
const SESSION_PEGAWAI = JSON.parse(localStorage.getItem('pegawai_data') || 'null');

if (!SESSION_TOKEN || !SESSION_PEGAWAI) {
    window.location.href = 'login.html';
}

// ============================================================
// 1. KONFIGURASI GLOBAL
// ============================================================
const DEBUG_MODE = false;
const GITHUB_LOGO_URL = "assets/logo.png";
const API_URL = 'https://script.google.com/macros/s/AKfycbxfANwhLfJnT1uDqC_4xIFpCvMDLbM0rZcrFPXqLuFc-u0juCrsTgb7v9yGMUedlWiF/exec';

// Time constants
const TIME_CONSTANTS = {
    ONE_DAY_MS: 86400000,
    FETCH_TIMEOUT_MS: 25000,
    SUBMIT_TIMEOUT_MS: 45000,
    GPS_TIMEOUT_MS: 20000,
    BUTTON_UPDATE_INTERVAL_MS: 10000,
    AUTO_REFRESH_INTERVAL_MS: 60000,
    KEEP_ALIVE_INTERVAL_MS: 300000,
    SUBMIT_COOLDOWN_MS: 10000,
    AUTO_RECOVERY_EXPIRY_MS: 86400000,
    STATUS_CACHE_TTL_MS: 5000
};

// ============================================================
// 2. DEVICE PROFILE
// ============================================================
const DeviceProfile = (() => {
    const cores = navigator.hardwareConcurrency || 2;
    const ram = navigator.deviceMemory || 2;
    const isSlowNetwork = navigator.connection
        ? ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType)
        : false;
    
    let tier = 'low';
    if ((ram >= 8 && !isSlowNetwork) || (ram >= 4 && cores >= 6 && !isSlowNetwork)) {
        tier = 'high';
    } else if (ram >= 3 && cores >= 4 && !isSlowNetwork) {
        tier = 'mid';
    }
    
    const configs = {
        high: {
            enableFaceAPI: true,
            enableLandmarks: true,
            enableShadowBlur: true,
            enableLaserLine: true,
            enableWireframeDots: true,
            enableMapTiles: true,
            canvasFPS: 60,
            detectInterval: 200,
            selfieResolution: [600, 800],
            kerjaResolution: [800, 600],
            jpegQuality: 0.5,
            suratQuality: 0.5,
            videoConstraints: { width: 1280, height: 960 },
            imageSize: 400,
            refreshInterval: 30000,
            buttonUpdateInterval: 5000,
            fetchTimeout: 20000,
            submitTimeout: 35000,
            gpsTimeout: 15000,
            enableAnimations: true,
            enableAudio: true
        },
        mid: {
            enableFaceAPI: ram >= 3,
            enableLandmarks: false,
            enableShadowBlur: false,
            enableLaserLine: true,
            enableWireframeDots: false,
            enableMapTiles: true,
            canvasFPS: 30,
            detectInterval: 350,
            selfieResolution: [600, 800],
            kerjaResolution: [800, 600],
            jpegQuality: 0.4,
            suratQuality: 0.45,
            videoConstraints: { width: 960, height: 720 },
            imageSize: 300,
            refreshInterval: 45000,
            buttonUpdateInterval: 8000,
            fetchTimeout: 25000,
            submitTimeout: 40000,
            gpsTimeout: 18000,
            enableAnimations: true,
            enableAudio: true
        },
        low: {
            enableFaceAPI: false,
            enableLandmarks: false,
            enableShadowBlur: false,
            enableLaserLine: false,
            enableWireframeDots: false,
            enableMapTiles: true,
            canvasFPS: 15,
            detectInterval: 0,
            selfieResolution: [400, 533],
            kerjaResolution: [533, 400],
            jpegQuality: 0.35,
            suratQuality: 0.4,
            videoConstraints: { width: 640, height: 480 },
            imageSize: 200,
            refreshInterval: 120000,
            buttonUpdateInterval: 15000,
            fetchTimeout: 30000,
            submitTimeout: 50000,
            gpsTimeout: 25000,
            enableAnimations: false,
            enableAudio: false
        }
    };
    
    if (tier === 'low') {
        document.documentElement.classList.add('low-end-device');
    }
    
    console.info(`📱 Device Profile: ${tier.toUpperCase()} (RAM: ${ram}GB, Cores: ${cores})`);
    
    return { tier, config: configs[tier], cores, ram, isSlowNetwork };
})();

// ============================================================
// 3. VARIABEL GLOBAL
// ============================================================
let isFaceApiLoaded = false, isFaceApiLoading = false;
let isInitialMapBound = false, _lastFrameTime = 0;
let isFormLoading = false, _lastToastKey = '', _lastToastTime = 0;
let toastQueue = [], isToastShowing = false;
let dbE = [], dbF = [], dbP = [], uIdx = 0;
let map = null, marker = null;
let uPos = { lat: 0, lng: 0 };
let cType = '', sB64 = null, kB64 = null;
let selectedStatus = '', calculatedScore = 0;
let isLandmarkReady = false, pendingCamType = null, currentStream = null;
let lastGoodDetection = null, faceDetected = false, detectionStableCount = 0;
const STABLE_THRESHOLD = 3;
let detectIntervalId = null, laserY = 0, laserDirection = 1;
let _activeResizeHandler = null, suratB64 = null;
let _canvasW = 0, _canvasH = 0, _rafRunning = false;
let isSubmitting = false;
let lastSubmitTime = 0;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 30000;
const statusCache = new Map();
let updateButtonStatesTimer = null;
let offlineQueue = [];

const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 85'%3E%3Crect width='60' height='85' fill='%232e446e'/%3E%3Cpath d='M30 40c5.5 0 10-4.5 10-10s-4.5-10-10-10-10 4.5-10 10 4.5 10 10 10zm0 5c-8 0-20 4-20 12v5h40v-5c0-8-12-12-20-12z' fill='%23fff' opacity='.2'/%3E%3C/svg%3E";

let appConfig = { jHadir: "08:00", jTelat: "08:10", jPulang: "16:00" };
let activePegawai = null;

// ============================================================
// 4. STATUS CONFIGURATION
// ============================================================
const STATUS_CONFIG = {
    'HADIR': {
        placeholder: 'Tuliskan ringkasan tugas hari ini...',
        title: '✅ HADIR',
        message: '<b>Aturan Waktu:</b><br>• ≤ 08:00 = Poin 50<br>• 08:01-08:10 = Poin 40<br>• > 08:10 = Poin 25<br><br><b>Pairing:</b> Wajib PULANG biasa',
        icon: 'check-circle',
        color: 'var(--success)',
        borderColor: 'var(--success)',
        actions: []
    },
    'PULANG': {
        placeholder: 'Tuliskan ringkasan hasil kerja hari ini...',
        title: '🌙 PULANG',
        message: 'Absensi pulang tercatat.<br><b>Pairing:</b> Hanya jika Hadir biasa (BUKAN QR)',
        icon: 'moon',
        color: 'var(--pu-blue)',
        borderColor: 'var(--pu-blue)',
        actions: []
    },
    'IZIN': {
        placeholder: 'Jelaskan alasan izin...',
        title: '📝 IZIN',
        message: 'Max 1x sehari. Hubungi Koordinator / Pimpinan.',
        icon: 'file-text',
        color: '#d8b4fe',
        borderColor: '#a855f7',
        actions: [{ label: 'Lampirkan Surat', icon: 'paperclip', action: 'uploadSurat' }]
    },
    'SAKIT': {
        placeholder: 'Jelaskan kondisi sakit...',
        title: '🏥 SAKIT',
        message: 'Max 1x sehari. Lampirkan surat dokter.',
        icon: 'heart-pulse',
        color: '#fde047',
        borderColor: 'var(--warning)',
        actions: [{ label: 'Surat Dokter', icon: 'paperclip', action: 'uploadSurat' }]
    },
    'DINAS': {
        placeholder: 'Jelaskan lokasi dan tujuan dinas...',
        title: '💼 DINAS',
        message: 'Max 1x sehari. Lampirkan surat tugas.',
        icon: 'briefcase',
        color: '#fdba74',
        borderColor: 'var(--accent)',
        actions: [{ label: 'Surat Tugas', icon: 'paperclip', action: 'uploadSurat' }]
    },
    'QUICK RESPONSE': {
        placeholder: 'Tuliskan ringkasan tugas darurat...',
        title: '⚡ QUICK RESPONSE',
        message: '<b>Pagi:</b> QR Hadir (pairing QR Pulang)<br><b>Sore:</b> QR Pulang (hanya jika QR Hadir pagi)',
        icon: 'zap',
        color: '#f9a8d4',
        borderColor: '#ec4899',
        actions: []
    }
};

// ============================================================
// 5. UTILITY FUNCTIONS
// ============================================================
function getApiUrl(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    url.searchParams.append('cb', Date.now());
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });
    return url.toString();
}

function getJakartaTimeVal() {
    try {
        const now = new Date();
        const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        const jakartaDate = new Date(jakartaStr);
        return (jakartaDate.getHours() * 100) + jakartaDate.getMinutes();
    } catch (e) {
        const now = new Date();
        return (now.getHours() * 100) + now.getMinutes();
    }
}

function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':');
    return (parseInt(parts[0]) || 0) * 100 + (parseInt(parts[1]) || 0);
}

function formatTime(timeVal) {
    const hours = String(Math.floor(timeVal / 100)).padStart(2, '0');
    const minutes = String(timeVal % 100).padStart(2, '0');
    return hours + ':' + minutes;
}

function normalizeId(id) {
    if (!id) return '';
    return String(id).trim().toLowerCase();
}

// ============================================================
// 6. FETCH WITH CORS
// ============================================================
async function fetchWithCors(url, options = {}) {
    const defaultOptions = {
        redirect: 'follow',
        mode: 'cors',
        credentials: 'omit'
    };
    const mergedOptions = { ...defaultOptions, ...options };
    
    if (mergedOptions.body && mergedOptions.method === 'POST') {
        mergedOptions.method = 'POST';
        mergedOptions.headers = {
            'Content-Type': 'text/plain;charset=utf-8'
        };
    } else {
        mergedOptions.method = mergedOptions.method || 'GET';
        if (!mergedOptions.headers) mergedOptions.headers = {};
    }
    
    try {
        const response = await fetch(url, mergedOptions);
        if (response.type === 'opaque') {
            console.warn('⚠️ Opaque response - CORS blocked but request sent');
            return {
                ok: true,
                status: 200,
                json: async () => ({ status: 'success', message: 'Request sent (opaque)' }),
                text: async () => '{"status":"success","message":"Request sent"}'
            };
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    } catch (error) {
        console.error('❌ Fetch error:', error);
        throw error;
    }
}

function fetchWithTimeout(url, options = {}, timeout = TIME_CONSTANTS.FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetchWithCors(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

// ============================================================
// 7. TOAST NOTIFICATIONS
// ============================================================
function showToast(title, message, type = "info") {
    const payload = { title, message, type };
    if (isToastShowing) {
        toastQueue.push(payload);
        return;
    }
    _showToastInternal(payload);
}

function _showToastInternal({ title, message, type }) {
    isToastShowing = true;
    const modal = document.getElementById('notificationModal');
    const content = document.getElementById('notifModalContent');
    const iconEl = document.getElementById('notifIcon');
    const titleEl = document.getElementById('notifTitle');
    const msgEl = document.getElementById('notifMessage');
    const btnOk = document.getElementById('btnNotifOk');
    
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
    
    const cleanup = () => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            isToastShowing = false;
            if (toastQueue.length > 0) _showToastInternal(toastQueue.shift());
        }, 300);
    };
    
    const autoCloseTimer = setTimeout(cleanup, 4000);
    btnOk.onclick = () => {
        clearTimeout(autoCloseTimer);
        cleanup();
    };
}

function showToastOnce(key, title, message, type, minInterval = 30000) {
    const now = Date.now();
    if (_lastToastKey === key && (now - _lastToastTime) < minInterval) return;
    _lastToastKey = key;
    _lastToastTime = now;
    showToast(title, message, type);
}

function setLoading(s, t) {
    const o = document.getElementById('sendingOverlay');
    const overlayText = document.getElementById('overlayText');
    if (!o || !overlayText) return;
    overlayText.innerText = t;
    o.style.display = s ? 'flex' : 'none';
    o.style.pointerEvents = s ? 'all' : 'none';
}

// ============================================================
// 8. LOGOUT
// ============================================================
function logoutPegawai() {
    if (!confirm('Yakin ingin keluar?')) return;
    
    showToast('Logout', 'Sedang keluar...', 'info');
    
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'logoutPegawai',
            token: SESSION_TOKEN
        })
    }).catch(() => {});
    
    localStorage.removeItem('pegawai_token');
    localStorage.removeItem('pegawai_data');
    localStorage.removeItem('pegawai_login_method');
    
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 500);
}

// ============================================================
// 9. LOAD DATA (Hanya 1 Pegawai)
// ============================================================
function loadData() {
    const pegawai = SESSION_PEGAWAI;
    
    if (!pegawai) {
        window.location.href = 'login.html';
        return;
    }
    
    dbE = [{
        ID: pegawai.id,
        Nama: pegawai.nama,
        Jabatan: pegawai.jabatan || 'PPA',
        Wilayah: pegawai.wilayah || 'UPT',
        Link_Foto_Profile: pegawai.foto || ''
    }];
    dbF = [...dbE];
    uIdx = 0;
    activePegawai = dbF[0];
    
    // Render UI
    renderUI();
    
    const o = document.getElementById('initialLoadingOverlay');
    if (o) {
        o.style.opacity = '0';
        o.style.pointerEvents = 'none';
        setTimeout(() => o.style.display = 'none', 400);
    }
    
    // Load presensi data
    refreshPresensiData(true).then(() => {
        statusCache.clear();
        updateUIAfterRefresh();
        updateButtonStates();
    });
}

function renderUI() {
    const p = dbF[0];
    if (!p) return;
    
    // Form header
    document.getElementById('formName').innerText = p.Nama;
    document.getElementById('formJobWil').innerHTML = 
        `<i data-lucide="briefcase" size="14"></i> ${p.Jabatan} | <i data-lucide="map-pin" size="14"></i> ${p.Wilayah}`;
    document.getElementById('formName2').innerText = p.Nama;
    document.getElementById('formJobWil2').innerHTML = 
        `<i data-lucide="briefcase" size="14"></i> ${p.Jabatan} | <i data-lucide="map-pin" size="14"></i> ${p.Wilayah}`;
    
    // Hero image
    const rawUrl = p.Link_Foto_Profile || '';
    let finalSrc = placeholderImg;
    if (rawUrl) {
        if (rawUrl.includes('drive.google.com')) {
            let fileId = "";
            let match = rawUrl.match(/\/d\/([^\/\?]+)/);
            if (match && match[1]) fileId = match[1];
            if (!fileId) {
                match = rawUrl.match(/[?&]id=([^&]+)/);
                if (match && match[1]) fileId = match[1];
            }
            if (fileId) {
                finalSrc = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
            } else finalSrc = rawUrl;
        } else finalSrc = rawUrl;
    }
    document.getElementById('formHeroImg').src = finalSrc;
    
    // Sidebar logo
    const sidebarLogo = document.getElementById('sidebarLogo');
    if (sidebarLogo) {
        sidebarLogo.src = GITHUB_LOGO_URL;
    }
    
    lucide.createIcons();
}

// ============================================================
// 10. REFRESH PRESENSI DATA
// ============================================================
async function refreshPresensiData(force = false) {
    if (isSubmitting && !force) {
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (!isSubmitting) {
                    clearInterval(check);
                    resolve();
                }
            }, 200);
        });
    }
    
    if (isSubmitting) return false;
    
    try {
        if (!navigator.onLine) return false;
        
        const url = getApiUrl('getTodayPresensi');
        const r = await fetchWithTimeout(url, { method: 'GET', cache: 'no-store' }, 20000);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        
        const data = await r.json();
        if (data.status === 'success') {
            dbP = data.data || [];
            statusCache.clear();
            return true;
        }
        return false;
    } catch (e) {
        console.warn("⚠️ Gagal refresh dbP:", e.message);
        return false;
    }
}

// ============================================================
// 11. CHECK TODAY STATUS
// ============================================================
function checkTodayStatus(pid) {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    
    const todayRecords = dbP.filter(r => {
        const d = new Date(r.timestamp);
        const recordDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const recordId = String(r.id_pegawai || r.ID_Pegawai || r.ID || r.id || '').trim().toLowerCase();
        const targetId = String(pid).trim().toLowerCase();
        return recordDateStr === todayStr && recordId === targetId;
    });
    
    const result = {
        hasHadirBiasa: false,
        hasQRHadir: false,
        hasPulangBiasa: false,
        hasQRPulang: false,
        hasIzin: false,
        hasSakit: false,
        hasDinas: false,
        totalNilaiHariIni: 0,
        records: todayRecords
    };
    
    todayRecords.forEach(r => {
        const s = String(r.status || '').toLowerCase().trim();
        const nilai = parseInt(r.nilai) || 0;
        result.totalNilaiHariIni += nilai;
        
        const isTerlambat = s.includes('terlambat') || s.includes('telat');
        const isHadir = s === 'hadir' || isTerlambat || (s.includes('hadir') && !s.includes('qr'));
        
        if (isHadir) result.hasHadirBiasa = true;
        if (s.includes('qr hadir') || s.includes('qr terlambat') || s.includes('qr telat')) result.hasQRHadir = true;
        if (s === 'pulang' && !s.includes('qr')) result.hasPulangBiasa = true;
        if (s.includes('qr pulang')) result.hasQRPulang = true;
        if (s.includes('izin')) result.hasIzin = true;
        if (s.includes('sakit')) result.hasSakit = true;
        if (s.includes('dinas')) result.hasDinas = true;
    });
    
    result.hasAnyHadir = result.hasHadirBiasa || result.hasQRHadir;
    result.hasAnyPulang = result.hasPulangBiasa || result.hasQRPulang;
    result.hasSpecial = result.hasIzin || result.hasSakit || result.hasDinas;
    result.specialType = result.hasIzin ? 'izin' : (result.hasSakit ? 'sakit' : (result.hasDinas ? 'dinas' : null));
    
    return result;
}

function getCachedStatus(pid) {
    const key = String(pid);
    const cached = statusCache.get(key);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < TIME_CONSTANTS.STATUS_CACHE_TTL_MS) {
        return cached.data;
    }
    const data = checkTodayStatus(pid);
    statusCache.set(key, { data, timestamp: now });
    return data;
}

// ============================================================
// 12. UPDATE BUTTON STATES
// ============================================================
function updateButtonStates() {
    if (updateButtonStatesTimer) {
        clearTimeout(updateButtonStatesTimer);
    }
    
    const debounceMs = DeviceProfile.tier === 'low' ? 200 : 100;
    
    updateButtonStatesTimer = setTimeout(() => {
        updateButtonColors();
        updatePulangButton();
        updateQRButton();
        updateSpecialButtons();
        updateButtonStatesTimer = null;
    }, debounceMs);
}

function updateButtonColors() {
    const timeVal = getJakartaTimeVal();
    const jamHadirLimit = parseTime(appConfig.jHadir || "08:00");
    const jamTelatLimit = parseTime(appConfig.jTelat || "08:10");
    
    let btnColor = '#10b981', statusText = 'Tepat Waktu';
    let isLate = false, isHeavyLate = false;
    
    if (timeVal > jamTelatLimit) {
        btnColor = '#ef4444'; statusText = 'Terlambat Berat';
        isHeavyLate = true; isLate = true;
    } else if (timeVal > jamHadirLimit) {
        btnColor = '#facc15'; statusText = 'Terlambat Ringan';
        isLate = true;
    }
    
    const btnHadir = document.getElementById('btnHadirMain');
    if (btnHadir && !btnHadir.classList.contains('btn-done') && !btnHadir.classList.contains('active')) {
        btnHadir.style.backgroundColor = btnColor;
        btnHadir.style.color = '#ffffff';
        btnHadir.style.borderColor = btnColor;
        if (DeviceProfile.tier !== 'low') {
            btnHadir.style.boxShadow = `0 8px 20px ${btnColor}66`;
        }
    }
}

function updatePulangButton() {
    const btnPulang = document.getElementById('btnPulangMain');
    if (!btnPulang) return;
    if (btnPulang.classList.contains('btn-done')) return;
    
    const timeVal = getJakartaTimeVal();
    const jamPulangLimit = parseTime(appConfig.jPulang || "16:00");
    const p = activePegawai || dbF[uIdx];
    if (!p) return;
    
    const pid = p.ID || p.id;
    const status = getCachedStatus(pid);
    
    btnPulang.classList.remove('warning-state');
    
    if (status.hasAnyPulang) {
        btnPulang.classList.add('btn-done');
        btnPulang.innerHTML = '<i data-lucide="check-circle" size="28"></i><span>SUDAH PULANG</span>';
        btnPulang.disabled = true;
        lucide.createIcons();
        return;
    }
    
    const jamSekarang = Math.floor(timeVal / 100);
    const menitSekarang = timeVal % 100;
    const jamPulang = Math.floor(jamPulangLimit / 100);
    const menitPulang = jamPulangLimit % 100;
    const sisaMenit = (jamPulang * 60 + menitPulang) - (jamSekarang * 60 + menitSekarang);
    
    if (sisaMenit > 0) {
        const jamSisa = Math.floor(sisaMenit / 60);
        const menitSisa = sisaMenit % 60;
        btnPulang.disabled = true;
        btnPulang.innerHTML = `
            <i data-lucide="clock" size="24"></i>
            <span>PULANG</span>
            <small>${jamSisa > 0 ? jamSisa + 'j ' : ''}${menitSisa}m lagi</small>
        `;
    } else if (!status.hasAnyHadir) {
        btnPulang.disabled = true;
        btnPulang.classList.add('warning-state');
        btnPulang.innerHTML = `
            <i data-lucide="alert-circle" size="24"></i>
            <span>REFRESH</span>
            <small>Klik untuk refresh</small>
        `;
    } else if (status.hasQRHadir) {
        btnPulang.disabled = true;
        btnPulang.classList.add('warning-state');
        btnPulang.innerHTML = `
            <i data-lucide="zap" size="24"></i>
            <span>PAKAI QR</span>
        `;
    } else {
        btnPulang.disabled = false;
        btnPulang.innerHTML = `
            <i data-lucide="moon" size="28"></i>
            <span>PULANG</span>
        `;
    }
    lucide.createIcons();
}

function updateQRButton() {
    const btnQR = document.querySelector('.btn-qr-status');
    if (!btnQR) return;
    if (btnQR.classList.contains('btn-done')) return;
    
    const p = activePegawai || dbF[uIdx];
    if (!p) return;
    
    const pid = p.ID || p.id;
    const status = getCachedStatus(pid);
    const timeVal = getJakartaTimeVal();
    const jamPulangLimit = parseTime(appConfig.jPulang || "16:00");
    const isMorning = timeVal < jamPulangLimit;
    
    btnQR.classList.remove('warning-state');
    
    if (isMorning) {
        if (status.hasAnyHadir || status.hasSpecial || status.hasAnyPulang) {
            btnQR.disabled = true;
            btnQR.style.opacity = '0.4';
            btnQR.style.pointerEvents = 'none';
        } else {
            btnQR.disabled = false;
            btnQR.style.opacity = '1';
            btnQR.style.pointerEvents = 'auto';
        }
    } else {
        if (status.hasAnyPulang) {
            btnQR.disabled = true;
            btnQR.style.opacity = '0.4';
            btnQR.style.pointerEvents = 'none';
        } else if (!status.hasAnyHadir) {
            btnQR.disabled = true;
            btnQR.style.opacity = '0.4';
            btnQR.style.pointerEvents = 'none';
        } else if (status.hasHadirBiasa && !status.hasQRHadir) {
            btnQR.disabled = true;
            btnQR.classList.add('warning-state');
            btnQR.style.opacity = '0.5';
            btnQR.style.pointerEvents = 'none';
        } else {
            btnQR.disabled = false;
            btnQR.style.opacity = '1';
            btnQR.style.pointerEvents = 'auto';
        }
    }
}

function updateSpecialButtons() {
    const p = activePegawai || dbF[uIdx];
    if (!p) return;
    
    const pid = p.ID || p.id;
    const status = getCachedStatus(pid);
    const specialDisabled = status.hasSpecial || status.hasAnyHadir;
    
    const btnIzin = document.querySelector('.btn-izin');
    const btnSakit = document.querySelector('.btn-sakit');
    const btnDinas = document.querySelector('.btn-dinas');
    
    [btnIzin, btnSakit, btnDinas].forEach(btn => {
        if (!btn) return;
        btn.disabled = specialDisabled;
        btn.style.opacity = specialDisabled ? '0.4' : '1';
        btn.style.pointerEvents = specialDisabled ? 'none' : 'auto';
    });
}

function updateUIAfterRefresh() {
    const stepForm = document.getElementById('stepForm');
    const isFormOpen = stepForm && stepForm.style.display === 'flex';
    if (!isFormOpen) return;
    
    const p = activePegawai || dbF[uIdx];
    if (!p) return;
    
    const pid = p.ID || p.id;
    const btnHadir = document.getElementById('btnHadirMain');
    const btnPulang = document.getElementById('btnPulangMain');
    
    if (!btnHadir || !btnPulang) return;
    
    statusCache.clear();
    const status = getCachedStatus(pid);
    
    btnHadir.classList.remove('active', 'btn-done');
    btnPulang.classList.remove('active', 'btn-done');
    btnHadir.innerHTML = '<i data-lucide="sun" size="28"></i><span>HADIR</span>';
    btnHadir.style.pointerEvents = '';
    btnHadir.style.opacity = '';
    btnHadir.style.backgroundColor = '';
    btnHadir.style.color = '';
    btnHadir.style.borderColor = '';
    btnHadir.style.boxShadow = '';
    
    btnPulang.innerHTML = '<i data-lucide="moon" size="28"></i><span>PULANG</span>';
    btnPulang.style.pointerEvents = '';
    btnPulang.style.opacity = '';
    btnPulang.style.backgroundColor = '';
    btnPulang.style.color = '';
    btnPulang.style.borderColor = '';
    btnPulang.style.boxShadow = '';
    
    if (status.hasAnyHadir) {
        btnHadir.classList.add('btn-done');
        btnHadir.innerHTML = '<i data-lucide="check-circle" size="28"></i><span>SUDAH HADIR</span>';
        btnHadir.style.pointerEvents = 'none';
    }
    
    if (status.hasAnyPulang) {
        btnPulang.classList.add('btn-done');
        btnPulang.innerHTML = '<i data-lucide="check-circle" size="28"></i><span>SUDAH PULANG</span>';
        btnPulang.style.pointerEvents = 'none';
    }
    
    updateButtonStates();
    lucide.createIcons();
}

// ============================================================
// 13. GPS & GEOFENCING
// ============================================================
function upLoc(retryCount = 0) {
    const g = document.getElementById('gpsTxt');
    if (!g) return;
    
    g.innerHTML = '<i data-lucide="refresh-cw" size="14" style="vertical-align:middle;margin-right:5px;animation:spin 1s linear infinite"></i> Mengunci Sinyal...';
    lucide.createIcons();
    
    if (!navigator.geolocation) {
        g.innerText = "GPS tidak didukung";
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (p) => {
            if (p.coords.accuracy > 250) {
                showToastOnce('gps_lemah', "Sinyal Lemah", `Akurasi ${p.coords.accuracy.toFixed(0)}m.`, "error");
                g.innerHTML = `<i data-lucide="x-circle" size="14" style="vertical-align:middle;margin-right:5px;color:var(--danger)"></i> Sinyal Lemah`;
                lucide.createIcons();
                uPos = { lat: 0, lng: 0 };
                updateWorkflow();
                return;
            }
            
            uPos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
            g.innerHTML = `<i data-lucide="check-circle" size="14" style="vertical-align:middle;margin-right:5px;color:var(--success)"></i> GPS: ${uPos.lat.toFixed(5)}, ${uPos.lng.toFixed(5)}`;
            lucide.createIcons();
            
            if (map) {
                map.setView([uPos.lat, uPos.lng], 16);
                marker.setLatLng([uPos.lat, uPos.lng]);
                const mapFrame = document.querySelector('.map-view-frame');
                if (mapFrame) mapFrame.classList.remove('loading');
                tampilkanGeoFence();
            }
            updateWorkflow();
        },
        (e) => {
            if (retryCount < 3) {
                g.innerHTML = `Mencoba ulang (${retryCount + 1}/3)...`;
                setTimeout(() => upLoc(retryCount + 1), 2000);
                return;
            }
            if (e.code === 1) showPermissionModal('gps');
            else showToastOnce('gps_error', "Gagal", "GPS gagal: " + e.message, "error");
        },
        { enableHighAccuracy: true, timeout: TIME_CONSTANTS.GPS_TIMEOUT_MS, maximumAge: 0 }
    );
}

function hitungJarak(a, b, c, d) {
    if (!a || !b || !c || !d) return 999999;
    const R = 6371000, dL = (c - a) * Math.PI / 180, dG = (d - b) * Math.PI / 180;
    const x = Math.sin(dL / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dG / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function validasiGeoFencing() {
    const p = activePegawai || dbF[uIdx];
    let pts = [];
    if (p.Koordinat_Tugas) try { pts = JSON.parse(p.Koordinat_Tugas); } catch (e) {}
    else if (p.Lat_Kantor) pts = [{ nama: "Lokasi Utama", lat: p.Lat_Kantor, lng: p.Lng_Kantor, radius: p.Radius_Meter }];
    
    if (!pts.length) return { valid: true, status: 'NO_FENCE', jarak: 0, radius: 0, nama: 'Tanpa Batas' };
    
    let best = null;
    for (const pt of pts) {
        const j = hitungJarak(uPos.lat, uPos.lng, pt.lat, pt.lng);
        if (j <= (pt.radius + 20)) return { valid: true, status: 'IN_ZONE', jarak: Math.round(j), radius: pt.radius, nama: pt.nama || 'Lokasi' };
        if (!best || j < best.jarak) best = { jarak: Math.round(j), radius: pt.radius, nama: pt.nama || 'Lokasi' };
    }
    return { valid: false, status: 'OUT_ZONE', jarak: best.jarak, radius: best.radius, nama: best.nama };
}

function tampilkanGeoFence() {
    if (!map) return;
    
    const p = activePegawai || dbF[uIdx];
    let pts = [];
    if (p.Koordinat_Tugas) try { pts = JSON.parse(p.Koordinat_Tugas); } catch (e) {}
    else if (p.Lat_Kantor) pts = [{ lat: p.Lat_Kantor, lng: p.Lng_Kantor, radius: p.Radius_Meter }];
    
    if (window.fenceCircles) window.fenceCircles.forEach(c => map.removeLayer(c));
    window.fenceCircles = [];
    
    pts.forEach(pt => {
        if (pt.lat && pt.lng && pt.radius) {
            const c = L.circle([pt.lat, pt.lng], { 
                color: '#2dd4bf', 
                fillColor: '#2dd4bf', 
                fillOpacity: .15, 
                radius: pt.radius, 
                weight: 2 
            }).addTo(map);
            window.fenceCircles.push(c);
        }
    });
    
    if (window.fenceCircles.length && !isInitialMapBound) {
        map.fitBounds(new L.featureGroup(window.fenceCircles).getBounds().pad(.2));
        isInitialMapBound = true;
    }
}

// ============================================================
// 14. MAP
// ============================================================
function initMap() {
    if (map) return;
    
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([-8.13, 113.22], 15);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
    
    if (DeviceProfile.tier !== 'low') {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    }
    
    marker = L.marker([-8.13, 113.22]).addTo(map);
    requestAnimationFrame(() => { if (map) map.invalidateSize(); });
}

// ============================================================
// 15. PERMISSION MODAL
// ============================================================
function showPermissionModal(type) {
    const m = document.getElementById('permissionModal');
    const t = document.getElementById('permTitle');
    const d = document.getElementById('permDesc');
    const s = document.getElementById('permSteps');
    const b = document.getElementById('permRetryBtn');
    
    if (!m || !t || !d || !s || !b) return;
    
    if (type === 'camera') {
        t.innerText = 'Akses Kamera Dibutuhkan';
        d.innerText = 'Izinkan akses kamera untuk foto presensi.';
        s.innerHTML = '<div class="permission-step"><div class="permission-step-num">1</div><div>Klik <b>Coba Lagi</b></div></div>';
        b.onclick = () => { closePermissionModal(); triggerCam(pendingCamType); };
    } else {
        t.innerText = 'Akses Lokasi Dibutuhkan';
        d.innerText = 'GPS diperlukan untuk verifikasi lokasi.';
        s.innerHTML = '<div class="permission-step"><div class="permission-step-num">1</div><div>Aktifkan <b>GPS HP</b></div></div>';
        b.onclick = () => { closePermissionModal(); upLoc(); };
    }
    
    m.classList.add('show');
    lucide.createIcons();
}

function closePermissionModal() {
    const m = document.getElementById('permissionModal');
    if (m) m.classList.remove('show');
}

// ============================================================
// 16. SURAT MODAL
// ============================================================
function showSuratModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('suratModal');
        const statusText = document.getElementById('modalStatusText');
        const btnAttach = document.getElementById('btnModalAttach');
        const btnSkip = document.getElementById('btnModalSkip');
        
        if (!modal || !btnAttach || !btnSkip) { resolve('skip'); return; }
        
        if (statusText) statusText.innerText = selectedStatus;
        lucide.createIcons();
        
        modal.style.display = 'flex';
        requestAnimationFrame(() => { modal.classList.add('show'); });
        
        const cleanup = () => {
            modal.classList.remove('show');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
            btnAttach.onclick = null;
            btnSkip.onclick = null;
        };
        
        btnAttach.onclick = () => { cleanup(); resolve('attach'); };
        btnSkip.onclick = () => { cleanup(); resolve('skip'); };
    });
}

// ============================================================
// 17. SET STATUS
// ============================================================
function setS(el, st) {
    if (uPos.lat === 0 || !uPos.lat) {
        showToast("GPS Hilang", "Mengambil lokasi ulang...", "warning");
        upLoc();
        setTimeout(() => {
            if (uPos.lat === 0) showToast("GPS Gagal", "Silakan tunggu GPS terkunci.", "error");
        }, 3000);
        return;
    }
    
    const g = validasiGeoFencing();
    const outside = g.status === 'OUT_ZONE';
    const exc = ['IZIN', 'SAKIT', 'DINAS', 'QUICK RESPONSE'].includes(st);
    
    if (outside && !exc) {
        showToast("Ditolak", `Anda di luar area geo-fencing (${g.jarak}m).`, "error");
        return;
    }
    
    const p = activePegawai || dbF[uIdx];
    const pid = p.ID || p.id;
    const status = getCachedStatus(pid);
    const timeVal = getJakartaTimeVal();
    const jamPulangLimit = parseTime(appConfig.jPulang);
    
    if (st === 'IZIN') {
        if (status.hasIzin) { showToast("Ditolak", "❌ Anda sudah IZIN hari ini. Hanya boleh 1x sehari.", "error"); return; }
        if (status.hasSpecial) { showToast("Ditolak", `❌ Anda sudah punya status khusus hari ini (${status.specialType.toUpperCase()}).`, "error"); return; }
        if (status.hasAnyHadir) { showToast("Ditolak", "❌ Anda sudah HADIR hari ini. Tidak bisa IZIN.", "error"); return; }
    }
    
    if (st === 'SAKIT') {
        if (status.hasSakit) { showToast("Ditolak", "❌ Anda sudah SAKIT hari ini. Hanya boleh 1x sehari.", "error"); return; }
        if (status.hasSpecial) { showToast("Ditolak", `❌ Anda sudah punya status khusus hari ini (${status.specialType.toUpperCase()}).`, "error"); return; }
        if (status.hasAnyHadir) { showToast("Ditolak", "❌ Anda sudah HADIR hari ini. Tidak bisa SAKIT.", "error"); return; }
    }
    
    if (st === 'DINAS') {
        if (status.hasDinas) { showToast("Ditolak", "❌ Anda sudah DINAS hari ini. Hanya boleh 1x sehari.", "error"); return; }
        if (status.hasSpecial) { showToast("Ditolak", `❌ Anda sudah punya status khusus hari ini (${status.specialType.toUpperCase()}).`, "error"); return; }
        if (status.hasAnyHadir) { showToast("Ditolak", "❌ Anda sudah HADIR hari ini. Tidak bisa DINAS.", "error"); return; }
    }
    
    if (st === 'HADIR') {
        if (status.hasAnyHadir) { showToast("Sudah Absen", "❌ Anda sudah HADIR/QR HADIR hari ini. Hanya boleh 1x.", "error"); return; }
        if (status.hasSpecial) { showToast("Ditolak", `❌ Anda sudah ${status.specialType.toUpperCase()} hari ini. Tidak bisa HADIR.`, "error"); return; }
        if (status.hasAnyPulang) { showToast("Ditolak", "❌ Anda sudah PULANG hari ini. Tidak bisa HADIR.", "error"); return; }
    }
    
    if (st === 'PULANG') {
        if (status.hasAnyPulang) { showToast("Sudah Absen", "❌ Anda sudah PULANG/QR PULANG hari ini.", "error"); return; }
        if (!status.hasAnyHadir) { showToast("Urutan Salah", "❌ Harap HADIR terlebih dahulu sebelum PULANG.", "error"); return; }
        if (status.hasQRHadir) { showToast("Pairing Salah", "❌ Anda QR HADIR pagi ini. Gunakan QUICK RESPONSE untuk QR PULANG.", "warning"); return; }
    }
    
    if (st === 'QUICK RESPONSE') {
        const isMorning = timeVal < jamPulangLimit;
        if (isMorning) {
            if (status.hasAnyHadir) { showToast("Sudah Absen", "❌ Anda sudah HADIR/QR HADIR hari ini. Hanya boleh 1x.", "error"); return; }
            if (status.hasSpecial) { showToast("Ditolak", `❌ Anda sudah ${status.specialType.toUpperCase()} hari ini.`, "error"); return; }
            if (status.hasAnyPulang) { showToast("Ditolak", "❌ Anda sudah PULANG hari ini. Tidak bisa QR HADIR.", "error"); return; }
        } else {
            if (status.hasAnyPulang) { showToast("Sudah Absen", "❌ Anda sudah PULANG/QR PULANG hari ini.", "error"); return; }
            if (!status.hasAnyHadir) { showToast("Urutan Salah", "❌ Harap HADIR/QR HADIR terlebih dahulu.", "error"); return; }
            if (status.hasHadirBiasa && !status.hasQRHadir) { showToast("Pairing Salah", "❌ Anda HADIR biasa pagi ini. Gunakan tombol PULANG biasa.", "warning"); return; }
        }
    }
    
    const notes = document.getElementById('notes');
    if (notes) notes.value = '';
    updateNotesCounter();
    
    sB64 = null; kB64 = null; suratB64 = null;
    
    const sImg = document.getElementById('sImg');
    const kImg = document.getElementById('kImg');
    const sPh = document.getElementById('sPh');
    const kPh = document.getElementById('kPh');
    
    if (sImg) sImg.style.display = 'none';
    if (kImg) kImg.style.display = 'none';
    if (sPh) sPh.style.display = 'block';
    if (kPh) kPh.style.display = 'block';
    
    document.querySelectorAll('.btn-presence-mega,.btn-special-status').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    selectedStatus = st;
    
    updateStatusInfo(st);
    updateWorkflow();
    saveAutoRecovery();
}

function updateStatusInfo(status) {
    const info = document.getElementById('statusInfo');
    const badge = document.getElementById('statusBadge');
    const badgeText = document.getElementById('statusBadgeText');
    const textarea = document.getElementById('notes');
    const config = STATUS_CONFIG[status];
    
    if (!config) {
        if (info) info.style.display = 'none';
        if (badge) badge.classList.remove('show');
        return;
    }
    
    if (badge) {
        badge.className = 'status-badge show';
        if (status === 'IZIN') badge.classList.add('badge-izin');
        else if (status === 'SAKIT') badge.classList.add('badge-sakit');
        else if (status === 'DINAS') badge.classList.add('badge-dinas');
        else if (status === 'QUICK RESPONSE') badge.classList.add('badge-qr');
        if (badgeText) badgeText.textContent = status;
    }
    
    if (info) {
        info.style.display = 'block';
        info.style.color = config.color;
        info.style.borderLeftColor = config.borderColor;
        
        let actionsHtml = '';
        if (config.actions.length > 0) {
            actionsHtml = '<div class="info-actions">';
            config.actions.forEach(action => {
                actionsHtml += `<button class="info-action-btn" onclick="${action.action}()"><i data-lucide="${action.icon}" size="12"></i>${action.label}</button>`;
            });
            actionsHtml += '</div>';
        }
        
        info.innerHTML = `<div class="info-title"><i data-lucide="${config.icon}" size="18"></i><span>${config.title}</span></div><div class="info-body">${config.message}</div>${actionsHtml}`;
    }
    
    if (textarea) textarea.placeholder = config.placeholder;
    lucide.createIcons();
}

function updateWorkflow() {
    const gpsReady = uPos.lat !== 0;
    const statusReady = selectedStatus !== '';
    const notesEl = document.getElementById('notes');
    const notesReady = notesEl && notesEl.value.trim().length >= 5;
    
    document.getElementById('statusBox1').classList.toggle('workflow-locked', !gpsReady);
    document.getElementById('specialStatusHeader').classList.toggle('workflow-locked', !gpsReady);
    document.getElementById('specialStatusGrid').classList.toggle('workflow-locked', !gpsReady);
    document.getElementById('notesBox').classList.toggle('workflow-locked', !statusReady);
    document.getElementById('photoBox').classList.toggle('workflow-locked', !notesReady);
}

function toggleSpecialStatus() {
    const g = document.getElementById('specialStatusGrid');
    const i = document.getElementById('collapseIcon');
    if (!g || !i) return;
    g.classList.toggle('show');
    i.setAttribute('data-lucide', g.classList.contains('show') ? 'chevron-up' : 'chevron-down');
    lucide.createIcons();
}

function updateNotesCounter() {
    const notes = document.getElementById('notes');
    const counter = document.getElementById('notesCounter');
    const clearBtn = document.getElementById('notesClear');
    
    if (!notes || !counter || !clearBtn) return;
    
    const len = notes.value.length;
    counter.textContent = `${len}/500`;
    counter.classList.remove('warning', 'valid');
    
    if (len === 0) clearBtn.classList.remove('show');
    else if (len < 5) { counter.classList.add('warning'); clearBtn.classList.add('show'); }
    else { counter.classList.add('valid'); clearBtn.classList.add('show'); }
    
    notes.style.height = 'auto';
    notes.style.height = Math.min(notes.scrollHeight, 200) + 'px';
}

function clearNotes() {
    const notes = document.getElementById('notes');
    if (notes) notes.value = '';
    updateNotesCounter();
    saveAutoRecovery();
}

function onNotesInput() {
    updateNotesCounter();
    updateWorkflow();
    saveAutoRecovery();
}

function saveAutoRecovery() {
    const notes = document.getElementById('notes');
    const data = {
        timestamp: Date.now(),
        notes: notes ? notes.value : '',
        status: selectedStatus
    };
    try {
        sessionStorage.setItem('pusda_recovery', JSON.stringify(data));
    } catch (e) {}
}

function loadAutoRecovery() {
    const saved = sessionStorage.getItem('pusda_recovery');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        if (data.timestamp && (Date.now() - data.timestamp < TIME_CONSTANTS.AUTO_RECOVERY_EXPIRY_MS)) {
            const notes = document.getElementById('notes');
            if (notes) notes.value = data.notes || "";
            if (data.status) {
                selectedStatus = data.status;
                updateStatusInfo(selectedStatus);
            }
            updateNotesCounter();
            updateWorkflow();
        } else {
            sessionStorage.removeItem('pusda_recovery');
        }
    } catch (e) {}
}

// ============================================================
// 18. SUBMIT PRESENSI
// ============================================================
async function submitWithRetry(attempt = 1, trxId = null) {
    if (isSubmitting) {
        showToast('Sedang Memproses', 'Mohon tunggu, data sedang dikirim...', 'warning');
        return;
    }
    
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTime;
    
    if (timeSinceLastSubmit < TIME_CONSTANTS.SUBMIT_COOLDOWN_MS && lastSubmitTime !== 0) {
        const remainingSeconds = Math.ceil((TIME_CONSTANTS.SUBMIT_COOLDOWN_MS - timeSinceLastSubmit) / 1000);
        showToast('Tunggu', `Silakan tunggu ${remainingSeconds} detik sebelum submit lagi.`, 'warning');
        return;
    }
    
    lastSubmitTime = now;
    isSubmitting = true;
    
    const btn = document.getElementById('btnSubmitPresensi');
    if (btn) btn.disabled = true;
    
    const notesEl = document.getElementById('notes');
    const n = notesEl ? notesEl.value.trim() : '';
    
    try {
        if (!selectedStatus) { showToast("Peringatan", "Pilih status presensi!", "warning"); return; }
        if (n.length < 5) { showToast("Peringatan", "Keterangan minimal 5 karakter!", "warning"); return; }
        if (!sB64) { showToast("Data Belum Lengkap", "Foto selfie wajib!", "warning"); return; }
        if (!kB64) { showToast("Data Belum Lengkap", "Foto lokasi wajib!", "warning"); return; }
        
        if (uPos.lat === 0 || !uPos.lat) {
            showToast("GPS Belum Siap", "Mengambil lokasi ulang...", "warning");
            await new Promise((resolve) => {
                upLoc();
                setTimeout(resolve, 3000);
            });
            if (uPos.lat === 0) { showToast("GPS Gagal", "Coba lagi.", "error"); return; }
        }
        
        const needSurat = ['IZIN', 'SAKIT', 'DINAS'].includes(selectedStatus);
        if (needSurat && !suratB64) {
            const userChoice = await showSuratModal();
            if (userChoice === 'attach') { uploadSurat(); return; }
        }
        
        const statusMapping = {
            'HADIR': 'hadir',
            'PULANG': 'pulang',
            'IZIN': 'izin',
            'SAKIT': 'sakit',
            'DINAS': 'dinas',
            'QUICK RESPONSE': 'quick response'
        };
        
        const payloadStatus = statusMapping[selectedStatus] || selectedStatus.toLowerCase();
        
        setLoading(true, attempt > 1 ? `Mencoba ulang ${attempt - 1}/3...` : "Mengunggah Data...");
        
        const p = activePegawai;
        if (!trxId) trxId = `${p.ID}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const payload = {
            action: 'presensi',
            token: SESSION_TOKEN,
            idPegawai: p.ID,
            nama: p.Nama,
            status: payloadStatus,
            selfie: sB64,
            workPhoto: kB64,
            surat: suratB64 || '-',
            keterangan: n,
            gps: `${uPos.lat},${uPos.lng}`,
            wilayah: p.Wilayah || "-",
            trxId: trxId
        };
        
        const r = await fetchWithTimeout(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }, TIME_CONSTANTS.SUBMIT_TIMEOUT_MS);
        
        let j;
        const responseText = await r.text();
        
        try {
            j = JSON.parse(responseText);
        } catch (e) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try { j = JSON.parse(jsonMatch[0]); }
                catch (e2) { throw new Error('Tidak dapat parse JSON dari response'); }
            } else {
                throw new Error('Response bukan JSON: ' + responseText.substring(0, 100));
            }
        }
        
        if (!j || Object.keys(j).length === 0 || !j.status) {
            throw new Error("Server mengembalikan response kosong.");
        }
        
        if (j.status === 'success') {
            setLoading(false);
            if (btn) btn.disabled = false;
            showToast("Presensi Berhasil!", "Data tersinkronisasi.", "success");
            
            const newRecord = {
                timestamp: j.timestamp || new Date().toISOString(),
                id_pegawai: String(p.ID).trim(),
                nama: p.Nama,
                status: j.statusFix || payloadStatus,
                nilai: j.nilai || 0,
                keterangan: n,
                trxId: trxId
            };
            dbP = [newRecord, ...dbP];
            
            try {
                await refreshPresensiData(true);
            } catch (refreshErr) {}
            
            statusCache.clear();
            
            const btnHadir = document.getElementById('btnHadirMain');
            const btnPulang = document.getElementById('btnPulangMain');
            const isPulang = j.statusFix && (
                j.statusFix.toLowerCase().includes('pulang') ||
                j.statusFix.toLowerCase().includes('qr pulang')
            );
            
            if (isPulang) {
                if (btnPulang) {
                    btnPulang.classList.add('btn-done');
                    btnPulang.innerHTML = '<i data-lucide="check-circle" size="28"></i><span>SUDAH PULANG</span>';
                    btnPulang.style.pointerEvents = 'none';
                }
            } else {
                if (btnHadir) {
                    btnHadir.classList.add('btn-done');
                    btnHadir.innerHTML = '<i data-lucide="check-circle" size="28"></i><span>SUDAH HADIR</span>';
                    btnHadir.style.pointerEvents = 'none';
                }
            }
            
            lucide.createIcons();
            updateButtonStates();
            clearHeavyData();
            selectedStatus = '';
            document.querySelectorAll('.btn-presence-mega,.btn-special-status').forEach(i => i.classList.remove('active'));
            
            const statusBadge = document.getElementById('statusBadge');
            if (statusBadge) statusBadge.classList.remove('show');
            const statusInfo = document.getElementById('statusInfo');
            if (statusInfo) statusInfo.style.display = 'none';
            
            updateWorkflow();
            sessionStorage.removeItem('pusda_recovery');
            
            setTimeout(() => {
                const peg = activePegawai || dbF[uIdx];
                if (peg) {
                    const params = new URLSearchParams({
                        id: peg.ID || peg.id,
                        nama: peg.Nama || peg.nama,
                        jabatan: peg.Jabatan || 'PPA',
                        wilayah: peg.Wilayah || 'UPT',
                        foto: peg.Link_Foto_Profile || '',
                        status: 'success',
                        msg: 'Presensi ' + j.statusFix + ' berhasil! Nilai: ' + j.nilai + ' pts'
                    });
                    window.location.href = 'profile_raport.html?' + params.toString();
                }
            }, 1500);
        } else if (j.status === 'error') {
            setLoading(false);
            if (btn) btn.disabled = false;
            
            if (j.message && (j.message.includes('duplikat') || j.message.includes('sudah'))) {
                showToast("Sudah Tercatat", "Data sudah masuk.", "success");
                await refreshPresensiData(true);
                updateUIAfterRefresh();
                clearHeavyData();
            } else {
                showToast("Ditolak", j.message || "Gagal presensi.", "error");
            }
        } else {
            throw new Error(j.message || "Status response tidak dikenal: " + j.status);
        }
    } catch (e) {
        console.error("❌ Submit error:", e);
        
        if (attempt < 4) {
            showToastOnce('submit_retry', "Menunggu Antrian...", `Mencoba ulang (${attempt}/3)...`, "warning");
            setTimeout(() => submitWithRetry(attempt + 1, trxId), 2000 * Math.pow(1.5, attempt));
        } else {
            showToast("Gagal Mengirim", e.message || "Koneksi gagal. Coba lagi.", "error");
            setLoading(false);
            if (btn) btn.disabled = false;
        }
    } finally {
        isSubmitting = false;
    }
}

function clearHeavyData() {
    sB64 = null; kB64 = null; suratB64 = null;
    
    const sImg = document.getElementById('sImg');
    const kImg = document.getElementById('kImg');
    const sPh = document.getElementById('sPh');
    const kPh = document.getElementById('kPh');
    
    if (sImg) { sImg.src = ""; sImg.style.display = 'none'; }
    if (kImg) { kImg.src = ""; kImg.style.display = 'none'; }
    if (sPh) sPh.style.display = 'block';
    if (kPh) kPh.style.display = 'block';
    
    document.getElementById('specialStatusGrid').classList.remove('show');
    document.getElementById('statusBadge').classList.remove('show');
    document.getElementById('statusInfo').style.display = 'none';
    
    const notes = document.getElementById('notes');
    if (notes) notes.value = '';
    updateNotesCounter();
    
    selectedStatus = '';
    document.querySelectorAll('.btn-presence-mega,.btn-special-status').forEach(i => i.classList.remove('active'));
    lucide.createIcons();
    
    sessionStorage.removeItem('pusda_recovery');
    updateWorkflow();
}

// ============================================================
// 19. CAMERA FUNCTIONS
// ============================================================
async function triggerCam(type) {
    const notes = document.getElementById('notes');
    const notesVal = notes ? notes.value.trim() : '';
    
    if (!selectedStatus) return showToast("Peringatan", "Silakan pilih status presensi terlebih dahulu!", "warning");
    if (notesVal.length < 5) return showToast("Peringatan", "Isi keterangan minimal 5 karakter!", "warning");
    
    cType = type;
    stopCurrentStream();
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        triggerFallbackCamera(type);
        return;
    }
    
    const peg = activePegawai || dbF[uIdx];
    const scanPegawai = document.getElementById('scanPegawai');
    const scanLogo = document.getElementById('scanLogo');
    const scanHeaderTitle = document.getElementById('scanHeaderTitle');
    const scanHeaderSub = document.getElementById('scanHeaderSub');
    const scanInstrText = document.getElementById('scanInstrText');
    const scanStatus = document.getElementById('scanStatus');
    const scanStatusText = document.getElementById('scanStatusText');
    
    if (scanPegawai) scanPegawai.innerText = (peg.Nama || peg.nama || "STAFF").toUpperCase();
    if (scanLogo) scanLogo.src = GITHUB_LOGO_URL;
    
    if (type === 'selfie') {
        if (scanHeaderTitle) scanHeaderTitle.innerText = "SECURE FACE VERIFICATION";
        if (scanHeaderSub) scanHeaderSub.innerText = "UPT PUSDA • Face Detection";
        if (scanInstrText) scanInstrText.innerText = "Posisikan wajah di dalam frame";
        if (scanStatus) {
            scanStatus.style.display = 'flex';
        }
    } else {
        if (scanHeaderTitle) scanHeaderTitle.innerText = "LOCATION DOCUMENTATION";
        if (scanHeaderSub) scanHeaderSub.innerText = "UPT PUSDA • Work Site Photo";
        if (scanInstrText) scanInstrText.innerText = "Arahkan kamera ke lokasi kerja";
        if (scanStatus) scanStatus.style.display = 'none';
    }
    lucide.createIcons();
    
    const video = document.getElementById('vStream');
    if (!video) return;
    video.setAttribute('playsinline', 'true');
    
    if (type === 'selfie') video.classList.add('mirror');
    else video.classList.remove('mirror');
    
    const { width: idealW, height: idealH } = DeviceProfile.config.videoConstraints;
    const constraints = type === 'selfie' ? 
        { facingMode: "user", width: { ideal: idealW }, height: { ideal: idealH } } :
        { facingMode: "environment", width: { ideal: idealW }, height: { ideal: idealH } };
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        currentStream = stream;
        video.srcObject = stream;
        document.getElementById('cameraUI').style.display = 'flex';
        
        video.onloadedmetadata = () => {
            video.play().then(() => {
                setTimeout(() => {
                    if (type === 'selfie') startSelfieOverlay();
                    else startWorkOverlay();
                }, 400);
            }).catch(e => {
                showToast("Error Kamera", "Gagal memutar video kamera.", "error");
                stopCam();
            });
        };
    } catch (err) {
        if (err.name === 'OverconstrainedError' || err.name === 'NotSupportedError' || err.name === 'NotFoundError') {
            try {
                const s2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                currentStream = s2;
                video.srcObject = s2;
                document.getElementById('cameraUI').style.display = 'flex';
                
                video.onloadedmetadata = () => {
                    video.play().then(() => {
                        setTimeout(() => {
                            if (type === 'selfie') startSelfieOverlay();
                            else startWorkOverlay();
                        }, 400);
                    }).catch(e => { triggerFallbackCamera(type); });
                };
                return;
            } catch (e2) {
                triggerFallbackCamera(type);
            }
        }
        
        if (err.name === 'NotAllowedError') {
            pendingCamType = type;
            showPermissionModal('camera');
        } else {
            triggerFallbackCamera(type);
        }
    }
}

function stopCam() {
    stopCurrentStream();
    document.getElementById('cameraUI').style.display = 'none';
}

function stopCurrentStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
    }
    const v = document.getElementById('vStream');
    if (v && v.srcObject) v.srcObject = null;
    if (v) v.classList.remove('mirror');
    stopRenderLoop();
    if (detectIntervalId) {
        clearInterval(detectIntervalId);
        detectIntervalId = null;
    }
    const c = document.getElementById('faceOverlay');
    if (c && c.getContext) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    lastGoodDetection = null;
    faceDetected = false;
    detectionStableCount = 0;
}

function triggerFallbackCamera(type) {
    const inp = document.getElementById('fallbackCameraInput');
    if (!inp) return;
    inp.setAttribute('capture', type === 'selfie' ? 'user' : 'environment');
    inp.value = '';
    pendingCamType = type;
    
    const h = e => {
        const f = e.target.files[0];
        if (!f) return;
        if (!f.type.startsWith('image/')) {
            showToast("Format Salah", "File harus berupa gambar", "error");
            return;
        }
        const r = new FileReader();
        r.onload = ev => processFallbackImage(ev.target.result, pendingCamType);
        r.readAsDataURL(f);
        inp.removeEventListener('change', h);
    };
    inp.addEventListener('change', h);
    inp.click();
}

function triggerGallery() {
    if (!selectedStatus) return showToast("Peringatan", "Silakan pilih status presensi terlebih dahulu!", "warning");
    const notes = document.getElementById('notes');
    if (notes && notes.value.trim().length < 5) return showToast("Peringatan", "Isi keterangan minimal 5 karakter!", "warning");
    
    const inp = document.getElementById('galleryInput');
    if (!inp) return;
    inp.value = '';
    
    const handler = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast("Format Salah", "File harus berupa gambar", "error");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast("Ukuran Melebihi Batas", "Maksimal 10MB", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => processGalleryImage(ev.target.result);
        reader.readAsDataURL(file);
        inp.removeEventListener('change', handler);
    };
    inp.addEventListener('change', handler);
    inp.click();
}

function uploadSurat() {
    const inp = document.getElementById('suratInput');
    if (!inp) return;
    inp.value = '';
    
    const handler = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast("Format Salah", "File harus berupa gambar (JPG/PNG)", "error");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast("Ukuran Melebihi Batas", "Maksimal 5MB", "error");
            return;
        }
        setLoading(true, "Mengompresi surat...");
        try {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const compressed = await compressImage(ev.target.result, { 
                        maxWidth: 800, maxHeight: 800, quality: DeviceProfile.config.suratQuality 
                    });
                    suratB64 = compressed;
                    setLoading(false);
                    showToast("Berhasil", `Surat terkompresi`, "success");
                    saveAutoRecovery();
                } catch (err) {
                    setLoading(false);
                    showToast("Gagal", "Gagal mengompresi surat", "error");
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setLoading(false);
            showToast("Error", err.message, "error");
        }
        inp.removeEventListener('change', handler);
    };
    inp.addEventListener('change', handler);
    inp.click();
}

// ============================================================
// 20. IMAGE PROCESSING
// ============================================================
async function compressImage(base64, options = {}) {
    if (DeviceProfile.tier === 'low') {
        options = {
            ...options,
            maxWidth: Math.min(options.maxWidth || 600, 600),
            maxHeight: Math.min(options.maxHeight || 600, 600),
            quality: Math.min(options.quality || 0.35, 0.35)
        };
    }
    
    const { maxWidth = 1024, maxHeight = 1024, quality = 0.5, outputWidth = null, outputHeight = null } = options;
    const img = new Image();
    const canvas = document.createElement('canvas');
    
    try {
        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Gagal memuat gambar (Timeout)')), 10000);
            img.onload = () => { clearTimeout(timeoutId); resolve(); };
            img.onerror = () => { clearTimeout(timeoutId); reject(new Error('Gagal memuat gambar')); };
            img.src = base64;
        });
        
        let w = img.width, h = img.height;
        
        if (outputWidth && outputHeight) {
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const targetRatio = outputWidth / outputHeight, sourceRatio = w / h;
            let sx, sy, sw, sh;
            if (sourceRatio > targetRatio) {
                sh = h; sw = h * targetRatio; sx = (w - sw) / 2; sy = 0;
            } else {
                sw = w; sh = w / targetRatio; sx = 0; sy = (h - sh) / 2;
            }
            canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
        } else {
            if (w > maxWidth) { h = h * (maxWidth / w); w = maxWidth; }
            if (h > maxHeight) { w = w * (maxHeight / h); h = maxHeight; }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        }
        
        return canvas.toDataURL('image/jpeg', quality);
    } finally {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
    }
}

function processGalleryImage(url) {
    const img = new Image();
    img.onload = async () => {
        setLoading(true, "Mengompresi foto...");
        try {
            const compressed = await compressImage(url, { outputWidth: 600, outputHeight: 800, quality: DeviceProfile.config.jpegQuality });
            const c = document.createElement('canvas');
            c.width = 600;
            c.height = 800;
            const tempImg = new Image();
            tempImg.onload = () => {
                c.getContext('2d').drawImage(tempImg, 0, 0, 600, 800);
                addWatermark(c);
                const d = c.toDataURL('image/jpeg', DeviceProfile.config.jpegQuality);
                document.getElementById('kImg').src = d;
                document.getElementById('kImg').style.display = 'block';
                document.getElementById('kPh').style.display = 'none';
                kB64 = d;
                setLoading(false);
                showToast("Berhasil", "Foto lokasi tersimpan", "success");
                saveAutoRecovery();
            };
            tempImg.src = compressed;
        } catch (err) {
            setLoading(false);
            showToast("Gagal", "Gagal mengompresi foto", "error");
        }
    };
    img.src = url;
}

function processFallbackImage(url, type) {
    const img = new Image();
    img.onload = () => {
        const c = document.createElement('canvas');
        const [w, h] = type === 'selfie' ? DeviceProfile.config.selfieResolution : DeviceProfile.config.kerjaResolution;
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (type === 'selfie') {
            ctx.translate(c.width, 0);
            ctx.scale(-1, 1);
        }
        const tr = c.width / c.height, sr = img.width / img.height;
        let sx, sy, sw, sh;
        if (sr > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        addWatermark(c);
        const d = c.toDataURL('image/jpeg', DeviceProfile.config.jpegQuality);
        if (type === 'selfie') {
            document.getElementById('sImg').src = d;
            document.getElementById('sImg').style.display = 'block';
            document.getElementById('sPh').style.display = 'none';
            sB64 = d;
        } else {
            document.getElementById('kImg').src = d;
            document.getElementById('kImg').style.display = 'block';
            document.getElementById('kPh').style.display = 'none';
            kB64 = d;
        }
        showToast("Berhasil", "Foto berhasil diambil", "success");
        saveAutoRecovery();
    };
    img.src = url;
}

async function capturePhoto() {
    const v = document.getElementById('vStream');
    if (!v || v.readyState !== 4 || v.videoWidth === 0) {
        showToast("Peringatan", "Kamera belum siap...", "warning");
        return;
    }
    
    const c = document.createElement('canvas');
    const [w, h] = cType === 'selfie' ? DeviceProfile.config.selfieResolution : DeviceProfile.config.kerjaResolution;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    
    if (cType === 'selfie') {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
    }
    
    const vW = v.videoWidth, vH = v.videoHeight;
    const tr = c.width / c.height, sr = vW / vH;
    let sx, sy, sw, sh;
    if (sr > tr) { sh = vH; sw = sh * tr; sx = (vW - sw) / 2; sy = 0; }
    else { sw = vW; sh = sw / tr; sx = 0; sy = (vH - sh) / 2; }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    addWatermark(c);
    const d = c.toDataURL('image/jpeg', DeviceProfile.config.jpegQuality);
    
    if (cType === 'selfie') {
        document.getElementById('sImg').src = d;
        document.getElementById('sImg').style.display = 'block';
        document.getElementById('sPh').style.display = 'none';
        sB64 = d;
    } else {
        document.getElementById('kImg').src = d;
        document.getElementById('kImg').style.display = 'block';
        document.getElementById('kPh').style.display = 'none';
        kB64 = d;
    }
    
    showToast("Berhasil", "Foto berhasil diambil", "success");
    saveAutoRecovery();
    stopCam();
}

// ============================================================
// 21. WATERMARK ON PHOTO
// ============================================================
function addWatermark(c) {
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const baseSize = Math.min(W, H);
    const margin = baseSize * 0.04;
    
    const nameFontSize = Math.round(baseSize * 0.032),
          jobFontSize = Math.round(baseSize * 0.022),
          infoFontSize = Math.round(baseSize * 0.020),
          footerFontSize = Math.round(baseSize * 0.018),
          iconSize = Math.round(baseSize * 0.025),
          logoSize = Math.round(baseSize * 0.09);
    
    const logoX = margin, logoY = H - margin - logoSize;
    const logoCache = new Image();
    logoCache.crossOrigin = "anonymous";
    logoCache.src = GITHUB_LOGO_URL;
    
    if (logoCache.complete && logoCache.naturalWidth > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.strokeStyle = 'rgba(45,212,191,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(logoX, logoY, logoSize, logoSize, logoSize * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        const logoInnerPad = logoSize * 0.12;
        ctx.drawImage(logoCache, logoX + logoInnerPad, logoY + logoInnerPad, logoSize - logoInnerPad * 2, logoSize - logoInnerPad * 2);
    }
    
    const textStart = logoX + logoSize + baseSize * 0.02;
    const p = activePegawai || dbF[uIdx];
    const nama = (p.Nama || p.nama || "STAFF").toUpperCase();
    const jabatan = (p.Jabatan || "PPA").toUpperCase();
    
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${nameFontSize}px 'Plus Jakarta Sans'`;
    
    let displayName = nama;
    ctx.fillText(displayName, textStart, logoY + logoSize * 0.28);
    
    const nameWidth = ctx.measureText(displayName).width;
    ctx.fillStyle = '#2dd4bf';
    ctx.font = `600 ${jobFontSize}px 'Plus Jakarta Sans'`;
    ctx.fillText(' • ' + jabatan, textStart + nameWidth + 6, logoY + logoSize * 0.28);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 ${infoFontSize}px 'JetBrains Mono'`;
    const gpsStr = `${uPos.lat.toFixed(4)}, ${uPos.lng.toFixed(4)}`;
    ctx.fillText(gpsStr, textStart, logoY + logoSize * 0.58);
    
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    ctx.fillStyle = '#2dd4bf';
    ctx.fillText('⏰ ' + timeStr, textStart + ctx.measureText(gpsStr).width + 20, logoY + logoSize * 0.58);
    
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${footerFontSize}px 'Plus Jakarta Sans'`;
    ctx.fillText('UPT PUSDA WS BONDOYUDO BARU', textStart, logoY + logoSize * 0.88);
    ctx.restore();
}

// ============================================================
// 22. CAMERA OVERLAY
// ============================================================
function startSelfieOverlay() {
    const canvas = document.getElementById('faceOverlay');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!canvas || !ctx) return;
    
    setupCanvas();
    registerResizeHandler();
    
    const renderFrame = () => {
        if (!currentStream) return;
        const W = canvas.width, H = canvas.height;
        if (W <= 0 || H <= 0) return;
        ctx.clearRect(0, 0, W, H);
        
        const mainColor = faceDetected ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)';
        drawCornerBrackets(ctx, W, H, mainColor);
        
        if (DeviceProfile.config.enableLaserLine) {
            drawLaserLine(ctx, W, H, mainColor);
        }
        drawFaceGuide(ctx, W, H, mainColor);
        
        const scanTime = document.getElementById('scanTime');
        if (scanTime) scanTime.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    
    startRenderLoop(renderFrame);
}

function startWorkOverlay() {
    const canvas = document.getElementById('faceOverlay');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!canvas || !ctx) return;
    
    setupCanvas();
    registerResizeHandler();
    
    const renderFrame = () => {
        if (!currentStream) return;
        const W = canvas.width, H = canvas.height;
        if (W <= 0 || H <= 0) return;
        ctx.clearRect(0, 0, W, H);
        
        const cyan = 'rgba(34,211,238,0.9)';
        drawCornerBrackets(ctx, W, H, cyan);
        
        if (DeviceProfile.config.enableLaserLine) {
            drawLaserLine(ctx, W, H, cyan);
        }
        drawCrosshair(ctx, W, H, cyan);
        drawWorkLabel(ctx, W, H);
        
        const scanTime = document.getElementById('scanTime');
        if (scanTime) scanTime.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    
    startRenderLoop(renderFrame);
}

function setupCanvas() {
    const canvas = document.getElementById('faceOverlay');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    if (w <= 0 || h <= 0) return;
    if (Math.abs(w - _canvasW) > 3 || Math.abs(h - _canvasH) > 3) {
        canvas.width = w;
        canvas.height = h;
        _canvasW = w;
        _canvasH = h;
    }
}

function registerResizeHandler() {
    if (_activeResizeHandler) window.removeEventListener('resize', _activeResizeHandler);
    _activeResizeHandler = () => setupCanvas();
    window.addEventListener('resize', _activeResizeHandler);
}

function startRenderLoop(callback) {
    if (_rafRunning) return;
    _rafRunning = true;
    const targetFPS = DeviceProfile.config.canvasFPS;
    const frameDelay = 1000 / targetFPS;
    const loop = (time) => {
        if (!_rafRunning) return;
        if (time - _lastFrameTime >= frameDelay) {
            callback(time);
            _lastFrameTime = time;
        }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

function stopRenderLoop() {
    _rafRunning = false;
}

function drawCornerBrackets(ctx, W, H, color) {
    const p = Math.min(W, H) * .08, l = Math.min(W, H) * .08;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(p, p + l); ctx.lineTo(p, p); ctx.lineTo(p + l, p); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - p - l, p); ctx.lineTo(W - p, p); ctx.lineTo(W - p, p + l); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p, H - p - l); ctx.lineTo(p, H - p); ctx.lineTo(p + l, H - p); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - p - l, H - p); ctx.lineTo(W - p, H - p); ctx.lineTo(W - p, H - p - l); ctx.stroke();
    ctx.restore();
}

function drawLaserLine(ctx, W, H, color) {
    laserY += laserDirection * 3;
    if (laserY >= H * .85) laserDirection = -1;
    if (laserY <= H * .15) laserDirection = 1;
    
    const g = ctx.createLinearGradient(0, laserY, W, laserY);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(.2, color);
    g.addColorStop(.5, color);
    g.addColorStop(.8, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, laserY);
    ctx.lineTo(W, laserY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, laserY);
    ctx.lineTo(W, laserY);
    ctx.stroke();
    ctx.restore();
}

function drawFaceGuide(ctx, W, H, color) {
    const cx = W / 2, cy = H * 0.40;
    const rx = Math.min(W, H) * .25, ry = Math.min(W, H) * .32;
    
    ctx.save();
    ctx.setLineDash([15, 10]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    const cs = 20;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - cs, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + cs, cy);
    ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + cs);
    ctx.stroke();
    ctx.restore();
}

function drawCrosshair(ctx, W, H, color) {
    const cx = W / 2, cy = H / 2, outer = 25, gap = 4;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - outer, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + outer, cy);
    ctx.moveTo(cx, cy - outer); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + outer);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawWorkLabel(ctx, W, H) {
    ctx.save();
    const label = 'WORK SITE', fontSize = Math.max(11, Math.round(W * 0.022));
    ctx.font = `800 ${fontSize}px 'JetBrains Mono',monospace`;
    const textW = ctx.measureText(label).width, padX = 12, padY = 6;
    const x = 20, y = H * 0.12, bw = textW + padX * 2, bh = fontSize + padY * 2;
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.strokeStyle = 'rgba(34,211,238,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.95)';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + padX, y + bh / 2);
    ctx.restore();
}

// ============================================================
// 23. MANUAL REFRESH
// ============================================================
async function manualRefreshStatus() {
    const btn = document.querySelector('.btn-refresh-status');
    if (btn) {
        btn.innerHTML = '<i data-lucide="refresh-cw" size="18" style="animation:spin 0.8s linear infinite"></i>';
        lucide.createIcons();
    }
    
    showToast('Memperbarui', 'Mengambil data terbaru...', 'info');
    
    try {
        const success = await refreshPresensiData(true);
        if (success) {
            statusCache.clear();
            updateUIAfterRefresh();
            showToast('Berhasil', 'Status diperbarui.', 'success');
        } else {
            showToast('Peringatan', 'Gagal refresh.', 'warning');
        }
    } catch (e) {
        showToast('Gagal', 'Gagal memperbarui.', 'error');
    }
    
    if (btn) {
        btn.innerHTML = '<i data-lucide="refresh-cw" size="18"></i>';
        lucide.createIcons();
    }
}

// ============================================================
// 24. PROFILE RAPORT
// ============================================================
function goToProfileRaport() {
    const p = activePegawai || dbF[uIdx];
    if (!p) return showToast('Peringatan', 'Pilih pegawai.', 'warning');
    
    const params = new URLSearchParams({
        id: p.ID || p.id,
        nama: p.Nama || p.nama,
        jabatan: p.Jabatan || 'PPA',
        wilayah: p.Wilayah || 'UPT',
        foto: p.Link_Foto_Profile || ''
    });
    window.open('profile_raport.html?' + params.toString(), '_blank');
}

// ============================================================
// 25. VOICE RECOGNITION
// ============================================================
function startVoice(id, btn) {
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) return;
    const r = new S();
    r.lang = 'id-ID';
    r.onstart = () => { btn.classList.add('active'); };
    r.onresult = e => {
        const t = e.results[0][0].transcript;
        const n = document.getElementById('notes');
        if (n) n.value += (n.value ? ' ' : '') + t;
        onNotesInput();
    };
    r.onend = () => btn.classList.remove('active');
    r.start();
}

// ============================================================
// 26. WATERMARK CLOCK
// ============================================================
function updateWatermarkClock() {
    const now = new Date();
    const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const jakartaDate = new Date(jakartaStr);
    const timeStr = jakartaDate.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const clockEl = document.getElementById('wmClock');
    if (clockEl) clockEl.textContent = timeStr;
}

// ============================================================
// 27. INITIALIZATION
// ============================================================
window.onload = () => {
    lucide.createIcons();
    loadData();
    
    // Set interval untuk jam
    setInterval(() => {
        const now = new Date();
        const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        const jakartaDate = new Date(jakartaStr);
        const timeStr = jakartaDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
        const liveClock = document.getElementById('liveClock');
        if (liveClock) liveClock.innerText = timeStr;
        updateWatermarkClock();
    }, 1000);
    
    updateWatermarkClock();
    
    // Set interval update button states
    setInterval(() => {
        updateButtonStates();
    }, TIME_CONSTANTS.BUTTON_UPDATE_INTERVAL_MS);
    
    // Refresh data periodically
    setInterval(() => {
        refreshPresensiData(true).then(() => {
            statusCache.clear();
            updateUIAfterRefresh();
            updateButtonStates();
        });
    }, TIME_CONSTANTS.AUTO_REFRESH_INTERVAL_MS);
    
    // Init map & GPS after form loads
    setTimeout(() => {
        initMap();
        upLoc();
        loadAutoRecovery();
        updateButtonStates();
    }, 500);
};
