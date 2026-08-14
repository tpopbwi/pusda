// ============================================================
// SIGNAL.JS - SIGNAL VALIDATOR (TEMA UPT PUSDA)
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxfANwhLfJnT1uDqC_4xIFpCvMDLbM0rZcrFPXqLuFc-u0juCrsTgb7v9yGMUedlWiF/exec';
let connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
let testHistory = JSON.parse(localStorage.getItem('signal_test_history') || '[]');

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    updateNetworkInfo();
    renderHistory();

    if (connection) {
        connection.addEventListener('change', updateNetworkInfo);
    }
    window.addEventListener('online', () => {
        updateStatusBadge(true);
        updateNetworkInfo();
    });
    window.addEventListener('offline', () => {
        updateStatusBadge(false);
        updateNetworkInfo();
    });

    setTimeout(runFullTest, 1200);
});

// ============================================================
// HELPERS
// ============================================================
function sanitizeHTML(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// STATUS BADGE
// ============================================================
function updateStatusBadge(isOnline) {
    const badge = document.getElementById('statusBadge');
    const text = document.getElementById('statusText');
    if (isOnline) {
        badge.className = 'status-badge online';
        text.textContent = 'Online';
    } else {
        badge.className = 'status-badge offline';
        text.textContent = 'Offline';
    }
}

// ============================================================
// UPDATE NETWORK INFO
// ============================================================
async function updateNetworkInfo() {
    const isOnline = navigator.onLine;
    updateStatusBadge(isOnline);

    if (!isOnline) {
        updateQualityDisplay('offline', 0);
        document.getElementById('connectionType').textContent = 'Offline';
        document.getElementById('downlink').textContent = '--';
        document.getElementById('latency').textContent = '--';
        document.getElementById('rtt').textContent = '--';
        return;
    }

    let type = 'Unknown',
        downlink = 0,
        rtt = 0;
    if (connection) {
        type = connection.effectiveType || 'unknown';
        downlink = connection.downlink || 0;
        rtt = connection.rtt || 0;
    }

    const latency = await measureLatency();

    document.getElementById('connectionType').textContent = type.toUpperCase();
    document.getElementById('downlink').textContent = downlink.toFixed(1);
    document.getElementById('latency').textContent = latency;
    document.getElementById('rtt').textContent = rtt;

    const quality = calculateQuality({ type, downlink, rtt, latency, online: true });
    const bars = calculateBars(quality);
    updateQualityDisplay(quality, bars);
    updateRecommendations(quality, { type, downlink, latency });
}

// ============================================================
// MEASURE LATENCY
// ============================================================
async function measureLatency() {
    const samples = [];
    for (let i = 0; i < 5; i++) {
        try {
            const start = performance.now();
            await fetch(API_URL + '?action=ping&t=' + Date.now(), {
                method: 'HEAD',
                cache: 'no-cache',
                mode: 'no-cors'
            });
            samples.push(performance.now() - start);
        } catch {
            samples.push(9999);
        }
    }
    samples.sort((a, b) => a - b);
    const trimmed = samples.slice(1, -1);
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
}

// ============================================================
// CALCULATE QUALITY
// ============================================================
function calculateQuality(info) {
    if (!info.online) return 'offline';
    let score = 0;
    if (info.latency < 100) score += 3;
    else if (info.latency < 300) score += 2;
    else if (info.latency < 1000) score += 1;
    if (info.downlink > 10) score += 3;
    else if (info.downlink > 5) score += 2;
    else if (info.downlink > 1) score += 1;
    if (info.type === '4g' || info.type === 'wifi') score += 3;
    else if (info.type === '3g') score += 2;
    else if (info.type === '2g') score += 1;
    if (info.rtt < 100) score += 3;
    else if (info.rtt < 300) score += 2;
    else if (info.rtt < 1000) score += 1;
    if (score >= 10) return 'excellent';
    if (score >= 7) return 'good';
    if (score >= 4) return 'fair';
    return 'poor';
}

function calculateBars(q) {
    const map = { excellent: 5, good: 4, fair: 3, poor: 2, offline: 0 };
    return map[q] || 1;
}

// ============================================================
// UPDATE UI
// ============================================================
function updateQualityDisplay(quality, bars) {
    const barsContainer = document.getElementById('signalBars');
    const barElements = barsContainer.querySelectorAll('.signal-bar-large');
    barElements.forEach(bar => {
        bar.className = 'signal-bar-large';
        bar.classList.remove('active', 'bar-excellent', 'bar-good', 'bar-fair', 'bar-poor', 'bar-offline');
    });
    const colorClass = `bar-${quality}`;
    for (let i = 0; i < bars; i++) {
        barElements[i].classList.add('active', colorClass);
    }

    const labels = {
        excellent: { text: 'Sangat Baik', subtitle: 'Koneksi optimal', color: 'quality-excellent' },
        good: { text: 'Baik', subtitle: 'Koneksi stabil', color: 'quality-good' },
        fair: { text: 'Cukup', subtitle: 'Koneksi mungkin lambat', color: 'quality-fair' },
        poor: { text: 'Buruk', subtitle: 'Koneksi lemah', color: 'quality-poor' },
        offline: { text: 'Offline', subtitle: 'Tidak ada koneksi', color: 'quality-offline' }
    };
    const label = labels[quality];
    const el = document.getElementById('qualityText');
    el.textContent = label.text;
    el.className = `signal-quality-text ${label.color}`;
    document.getElementById('qualitySubtitle').textContent = label.subtitle;
}

// ============================================================
// RECOMMENDATIONS
// ============================================================
function updateRecommendations(quality, info) {
    const list = document.getElementById('recommendationList');
    const recs = [];

    if (quality === 'excellent' || quality === 'good') {
        recs.push({ icon: '✅', type: 'success', text: 'Koneksi baik! Presensi lancar.' });
        recs.push({ icon: '📸', type: 'info', text: 'Upload foto & GPS optimal.' });
    } else if (quality === 'fair') {
        recs.push({ icon: '⚠️', type: 'warning', text: 'Koneksi cukup lambat. Presensi mungkin butuh waktu lebih lama.' });
        recs.push({ icon: '🔄', type: 'info', text: 'Sistem akan retry otomatis jika gagal.' });
        recs.push({ icon: '📶', type: 'info', text: 'Pindah ke area dengan sinyal lebih baik.' });
    } else if (quality === 'poor') {
        recs.push({ icon: '❌', type: 'danger', text: 'Koneksi sangat lemah! Presensi berisiko gagal.' });
        recs.push({ icon: '📴', type: 'warning', text: 'Data akan di-queue dan sync otomatis.' });
        recs.push({ icon: '📍', type: 'info', text: 'Cari lokasi dengan sinyal lebih kuat atau gunakan WiFi.' });
    } else if (quality === 'offline') {
        recs.push({ icon: '📴', type: 'danger', text: 'Tidak ada koneksi. Presensi akan di-queue.' });
        recs.push({ icon: '⏰', type: 'warning', text: 'Data akan sync saat koneksi kembali.' });
    }

    if (info.latency > 500 && info.latency < 9999) {
        recs.push({ icon: '⏱️', type: 'warning', text: `Latensi tinggi (${info.latency}ms). Server lambat.` });
    }
    if (info.downlink < 1 && info.downlink > 0) {
        recs.push({ icon: '🐌', type: 'warning', text: `Download sangat rendah (${info.downlink.toFixed(1)} Mbps).` });
    }

    list.innerHTML = recs.map(r => `
        <div class="recommendation-item">
            <div class="recommendation-icon ${r.type}">${r.icon}</div>
            <span>${r.text}</span>
        </div>
    `).join('');
}

// ============================================================
// SPEED TEST
// ============================================================
async function runSpeedTest() {
    const btn = document.getElementById('speedTestBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" size="14" class="spin"></i> Testing...';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    progressContainer.classList.add('active');

    try {
        progressText.textContent = 'Mengukur ping...';
        progressFill.style.width = '20%';
        const ping = await measureLatency();
        document.getElementById('pingResult').textContent = ping;

        progressText.textContent = 'Mengukur download...';
        progressFill.style.width = '50%';
        const download = await measureDownloadSpeed();
        document.getElementById('downloadSpeed').textContent = download.toFixed(2);

        progressText.textContent = 'Mengukur upload...';
        progressFill.style.width = '80%';
        const upload = await measureUploadSpeed();
        document.getElementById('uploadSpeed').textContent = upload.toFixed(2);

        progressFill.style.width = '100%';
        progressText.textContent = 'Selesai!';

        const quality = calculateQuality({
            online: true,
            latency: ping,
            downlink: download,
            rtt: ping,
            type: connection?.effectiveType || 'unknown'
        });
        addToHistory({ timestamp: new Date().toISOString(), ping, download, upload, quality });

        setTimeout(() => {
            progressContainer.classList.remove('active');
            progressFill.style.width = '0%';
        }, 2000);
    } catch (e) {
        progressText.textContent = 'Gagal: ' + e.message;
        progressFill.style.width = '0%';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="play" size="14"></i> Mulai';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function measureDownloadSpeed() {
    const start = performance.now();
    try {
        await fetch(API_URL + '?action=downloadTest&t=' + Date.now(), {
            cache: 'no-cache',
            mode: 'no-cors'
        });
        const duration = (performance.now() - start) / 1000;
        return Math.min(100, 8 / Math.max(duration, 0.1));
    } catch {
        return 0;
    }
}

async function measureUploadSpeed() {
    const start = performance.now();
    try {
        await fetch(API_URL + '?action=uploadTest', {
            method: 'POST',
            body: JSON.stringify({ test: 'x'.repeat(10000) }),
            mode: 'no-cors'
        });
        const duration = (performance.now() - start) / 1000;
        return Math.min(50, (0.01 * 8) / Math.max(duration, 0.1));
    } catch {
        return 0;
    }
}

function runFullTest() {
    updateNetworkInfo();
    runSpeedTest();
}

// ============================================================
// HISTORY
// ============================================================
function addToHistory(test) {
    testHistory.unshift(test);
    if (testHistory.length > 20) testHistory.pop();
    localStorage.setItem('signal_test_history', JSON.stringify(testHistory));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (testHistory.length === 0) {
        list.innerHTML = '<div class="history-empty">Belum ada riwayat</div>';
        return;
    }
    list.innerHTML = testHistory.map(item => `
        <div class="history-item">
            <span class="history-time">${formatTime(item.timestamp)}</span>
            <span class="history-quality ${item.quality}">${item.quality}</span>
            <span class="history-details">
                📶 ${item.download?.toFixed(1) || '--'} Mbps | ⏱️ ${item.ping || '--'}ms
            </span>
        </div>
    `).join('');
}

function clearHistory() {
    if (confirm('Hapus semua riwayat?')) {
        testHistory = [];
        localStorage.removeItem('signal_test_history');
        renderHistory();
    }
}

// ============================================================
// EXPORT & SEND
// ============================================================
function exportReport() {
    const report = {
        generated: new Date().toISOString(),
        device: navigator.userAgent,
        currentStatus: {
            online: navigator.onLine,
            type: connection?.effectiveType || 'unknown',
            downlink: connection?.downlink || 0,
            rtt: connection?.rtt || 0
        },
        history: testHistory
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function sendToParent() {
    if (window.parent !== window) {
        const quality = document.getElementById('qualityText').textContent;
        window.parent.postMessage({
            type: 'FLOATING_WINDOW_REQUEST',
            data: {
                action: 'sendData',
                payload: {
                    type: 'signalReport',
                    quality: quality,
                    online: navigator.onLine,
                    connectionType: connection?.effectiveType || 'unknown',
                    timestamp: new Date().toISOString()
                }
            }
        }, '*');
        alert('✅ Data signal dikirim ke dashboard!');
    } else {
        alert('⚠️ Halaman ini tidak dalam floating window');
    }
}

// ============================================================
// CSS SPIN ANIMATION (ditambahkan via JS)
// ============================================================
const styleSpin = document.createElement('style');
styleSpin.textContent = `.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleSpin);
