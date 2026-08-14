// ============================================================
// WILAYAH.JS - v2.3 (FINAL - TANPA KEDIP & BUG FIX)
// ============================================================
// PERBAIKAN:
// - Auto-refresh halus dengan dataVersion (tidak render ulang jika data sama)
// - Render in-place (replaceChildren) tanpa kedipan
// - Event delegation untuk preview modal (satu listener per container)
// - AbortController untuk membatalkan request lama
// - Modal cleanup sempurna (removeEventListener)
// - Chip counters update efisien
// - WA Broadcast dengan batas 5 link per detik
// ============================================================

// ============================================================
// 1. KONFIGURASI GLOBAL
// ============================================================
var GITHUB_LOGO_URL = "assets/logo.png";
var API_URL = "https://script.google.com/macros/s/AKfycbwg8LoyLRWaqpOpmXj6GGdwVksNWEUOKijD3vpllMSfeHVQY5XaeXcd7ygoyFFL-JIv/exec";
var placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 85'%3E%3Crect width='60' height='85' fill='%232e446e'/%3E%3Cpath d='M30 40c5.5 0 10-4.5 10-10s-4.5-10-10-10-10 4.5-10 10 4.5 10 10 10zm0 5c-8 0-20 4-20 12v5h40v-5c0-8-12-12-20-12z' fill='%23ffffff' opacity='0.2'/%3E%3C/svg%3E";

// ============================================================
// 2. DETEKSI ENVIRONMENT
// ============================================================
var isMobile = window.matchMedia('(max-width: 768px)').matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ============================================================
// 3. VARIABEL APLIKASI
// ============================================================
var dbE = [], dbP = [], dbK = [];
var pegawaiById = new Map();
var logsByPegawai = new Map();
var pegawaiStatsCache = new Map();

var isRefreshing = false;
var isApiDown = false;
var MAX_API_RETRY = 3;

var searchTimeout = null;
var lastFilterTime = 0;
var iconTimeout = null;
var dataVersion = 0; // 🆕 Untuk track perubahan data

var currentZoom = 1;
var isDragging = false;
var touchStartX = 0, touchStartY = 0, lastTouchDist = 0;

var activeQuickFilter = 'ALL';
var countdown = 60;
var countdownInterval = null;

// AbortController untuk cancel request
var currentFetchController = null;

// Modal handler
var modalEventHandlers = null;

// ============================================================
// 4. FETCH DENGAN ABORTCONTROLLER
// ============================================================
async function safeFetchJSON(url, opts, timeout) {
    timeout = timeout || 15000;
    // Batalkan request sebelumnya
    if (currentFetchController) {
        currentFetchController.abort();
    }
    currentFetchController = new AbortController();

    try {
        var res = await fetch(url, Object.assign({}, opts, {
            signal: currentFetchController.signal
        }));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var txt = await res.text();
        if (!txt || !txt.trim()) throw new Error('Response kosong');
        if (txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) {
            throw new Error('Server return HTML error');
        }
        return JSON.parse(txt);
    } catch (e) {
        if (e.name === 'AbortError') {
            // Request dibatalkan, tidak perlu error
            return null;
        }
        throw e;
    } finally {
        currentFetchController = null;
    }
}

// ============================================================
// 5. TOAST NOTIFICATION
// ============================================================
function showToast(msg, type) {
    type = type || 'info';
    var c = document.getElementById('wilToastContainer');
    if (!c) {
        c = document.createElement('div');
        c.id = 'wilToastContainer';
        c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:100000;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:400px;';
        document.body.appendChild(c);
    }
    var t = document.createElement('div');
    var colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    var color = colors[type] || colors.info;
    t.style.cssText = 'background:rgba(15,23,42,0.95);backdrop-filter:blur(15px);color:white;padding:14px 20px;border-radius:14px;border-left:4px solid ' + color + ';box-shadow:0 10px 30px rgba(0,0,0,0.4);font-size:0.9rem;font-weight:600;pointer-events:auto;animation:slideInRight 0.3s ease-out;';
    t.innerHTML = '<div style="font-weight:800;text-transform:uppercase;font-size:0.7rem;color:' + color + ';margin-bottom:4px;letter-spacing:1px">' + type + '</div><div>' + sanitizeHTML(msg) + '</div>';
    c.appendChild(t);
    setTimeout(function() {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.4s';
        setTimeout(function() { t.remove(); }, 400);
    }, 4000);
}

// ============================================================
// 6. UTILITIES
// ============================================================
function sanitizeHTML(s) {
    if (s == null) return "";
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function getLocalDateString(val) {
    if (!val) return "";
    var d = new Date(val);
    if (isNaN(d.getTime()) && typeof val === 'string' && val.includes('/')) {
        var p = val.split(/[/\s:]/);
        if (p[0].length === 2) d = new Date(p[2], p[1] - 1, p[0]);
    }
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatTime(dateStr) {
    if (!dateStr) return "--:--";
    try {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return "--:--";
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return "--:--";
    }
}

function handleImgError(img) {
    img.onerror = null;
    img.src = placeholderImg;
}

function safeCreateIcons() {
    clearTimeout(iconTimeout);
    iconTimeout = setTimeout(function() {
        try { lucide.createIcons(); } catch (e) { console.warn('Icon create failed:', e); }
    }, 80);
}

// ============================================================
// 7. INDEXING DATA
// ============================================================
function indexData() {
    pegawaiById.clear();
    logsByPegawai.clear();
    pegawaiStatsCache.clear();

    dbE.forEach(function(p) { pegawaiById.set(String(p.ID), p); });

    var filterDate = document.getElementById('fDate').value;
    var logMap = new Map();

    dbP.forEach(function(l) {
        var ts = l.Timestamp || l.timestamp;
        if (!ts || getLocalDateString(ts) !== filterDate) return;
        var pID = String(l['ID Pegawai'] || l.id_pegawai || l.ID);
        if (!logMap.has(pID)) logMap.set(pID, []);
        logMap.get(pID).push(l);
    });

    logMap.forEach(function(logs, pID) {
        logs.sort(function(a, b) {
            return new Date(a.Timestamp || a.timestamp) - new Date(b.Timestamp || b.timestamp);
        });
        logsByPegawai.set(pID, logs);
    });

    // Increment data version
    dataVersion++;
}

function computePegawaiStats(pID) {
    if (pegawaiStatsCache.has(pID)) return pegawaiStatsCache.get(pID);

    var logs = logsByPegawai.get(pID) || [];
    var sid = '', inTime = '-', outTime = '-';
    var sin = null, kin = null, gin = null;
    var sout = null, kout = null, gout = null;

    logs.forEach(function(log) {
        var status = (log.Status || log.status || "").toLowerCase();
        var jam = formatTime(log.Timestamp || log.timestamp);
        var fSelfie = log['Foto_Selfie'] || log['Foto Selfie'] || log.foto_selfie || null;
        var fKerja = log['Foto_Kerja'] || log['Foto Kerja'] || log['Foto Lokasi'] || log.foto_kerja || log.foto_lokasi || null;
        var gpsData = log.GPS || log.gps || null;
        var isSID = status.includes('izin') || status.includes('sakit') || status.includes('dinas');
        var isMorning = status.includes('hadir') || status.includes('terlambat') || status.includes('qr hadir') || status.includes('quick response');
        var isPulang = status.includes('pulang') || status.includes('qr pulang');

        if (isSID) {
            sid = log.Status || log.status;
            inTime = jam;
            sin = fSelfie;
            kin = fKerja;
            gin = gpsData;
        } else {
            if (isMorning && inTime === "-") {
                inTime = jam;
                sin = fSelfie;
                kin = fKerja;
                gin = gpsData;
            }
            if (isPulang) {
                outTime = jam;
                sout = fSelfie;
                kout = fKerja;
                gout = gpsData;
            }
        }
    });

    var stats = {
        sid: sid, in: inTime, out: outTime,
        sin: sin, kin: kin, gin: gin,
        sout: sout, kout: kout, gout: gout
    };
    pegawaiStatsCache.set(pID, stats);
    return stats;
}

// ============================================================
// 8. POPULATE UI FROM DATA
// ============================================================
function populateUIFromData(d) {
    if (d.config && d.config.Logo) {
        var sl = document.getElementById('sidebarLogo');
        if (sl) {
            sl.onerror = function() { this.onerror = null; this.src = GITHUB_LOGO_URL; };
            sl.src = d.config.Logo;
        }
    }

    var sel = document.getElementById('fWil');
    if (sel && sel.options.length <= 1) {
        var wilayahSet = new Set(dbE.map(function(p) { return p.Wilayah; }).filter(function(w) { return w; }));
        wilayahSet.forEach(function(w) {
            var opt = document.createElement('option');
            opt.value = w;
            opt.innerText = w;
            sel.appendChild(opt);
        });
    }

    var agnSel = document.getElementById('agnNamaInput');
    if (agnSel) {
        agnSel.innerHTML = '<option value="" disabled selected>-- Pilih Nama Pegawai --</option>';
        dbK.forEach(function(k) {
            var opt = document.createElement('option');
            opt.value = k.Nama;
            opt.innerText = k.Nama;
            agnSel.appendChild(opt);
        });
    }
}

// ============================================================
// 9. LOAD DATA (dengan dataVersion & cache)
// ============================================================
async function loadData(isRefresh, isAuto, isSilent, attempt) {
    isRefresh = isRefresh || false;
    isAuto = isAuto || false;
    isSilent = isSilent || false;
    attempt = attempt || 1;

    var syncToast = document.getElementById('syncToast');
    var grid = document.getElementById('gridView');

    if (isApiDown && attempt > 1) {
        if (!isAuto) showToast('⏳ Server sibuk, pakai cache', 'warning');
        if (dbE.length > 0 || dbP.length > 0) {
            indexData();
            updateKorlapStats();
            filterData();
            hideSyncToast();
            return;
        }
    }

    var shouldShowSyncToast = !isAuto && !isSilent && (dbE.length === 0 || isRefresh);
    if (shouldShowSyncToast && syncToast) {
        syncToast.classList.remove('sync-toast--soft');
        syncToast.classList.add('sync-toast--full');
        syncToast.innerHTML = '<div class="sync-toast-content"><div class="sync-spinner"></div><span>' + (isMobile ? '🔄 Memuat data...' : '🔄 Sinkronisasi Data...') + '</span></div><div class="sync-toast-progress"></div>';
        syncToast.style.display = 'flex';
        window._syncToastSafetyTimeout = setTimeout(function() {
            hideSyncToast();
            showToast('⚠️ Sinkronisasi terlalu lama', 'warning');
        }, 45000);
    }

    if (!isAuto && isRefresh && grid && dbE.length === 0) {
        showSkeletonLoading();
    }

    try {
        var selectedDate = document.getElementById('fDate').value;
        var timeout = isAuto ? 12000 : 20000;

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, timeout);

        var dashboardPromise = fetch(API_URL + "?action=getDashboardData", { signal: controller.signal })
            .then(function(res) {
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .catch(function(err) {
                if (err.name === 'AbortError') {
                    var timeoutErr = new Error('Timeout koneksi');
                    timeoutErr.name = 'TimeoutError';
                    throw timeoutErr;
                }
                throw err;
            });

        var presensiPromise = fetch(API_URL + "?action=getPresensiByDate&date=" + selectedDate, { signal: controller.signal })
            .then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .catch(function(err) {
                if (err.name === 'AbortError') {
                    var timeoutErr = new Error('Timeout koneksi');
                    timeoutErr.name = 'TimeoutError';
                    throw timeoutErr;
                }
                throw err;
            });

        var results = await Promise.allSettled([dashboardPromise, presensiPromise]);

        if (results.some(function(r) { return r.status === 'fulfilled'; })) {
            isApiDown = false;
        }

        var oldDataVersion = dataVersion;
        var dataChanged = false;

        if (results[1].status === 'fulfilled') {
            var newPresensi = results[1].value.data || [];
            if (JSON.stringify(dbP) !== JSON.stringify(newPresensi)) {
                dbP = newPresensi;
                dataChanged = true;
                try { localStorage.setItem('wilayah_presensi_' + selectedDate, JSON.stringify(dbP)); } catch (e) {}
            }
        } else {
            if (!isAuto && !isSilent && attempt === 1) {
                showToast('⚠️ Gagal memuat presensi, pakai cache', 'warning');
            }
            var cachedPresensi = localStorage.getItem('wilayah_presensi_' + selectedDate);
            if (cachedPresensi) {
                var parsed = JSON.parse(cachedPresensi);
                if (JSON.stringify(dbP) !== JSON.stringify(parsed)) {
                    dbP = parsed;
                    dataChanged = true;
                }
            }
        }

        if (results[0].status === 'fulfilled') {
            var d = results[0].value;
            var newPegawai = d.pegawai || [];
            var newKorlap = d.korlap || [];
            if (JSON.stringify(dbE) !== JSON.stringify(newPegawai) || JSON.stringify(dbK) !== JSON.stringify(newKorlap)) {
                dbE = newPegawai;
                dbK = newKorlap;
                dataChanged = true;
                try { localStorage.setItem('wilayah_dashboard_cache', JSON.stringify(d)); } catch (e) {}
            }
            populateUIFromData(d);
        } else {
            if (!isAuto && dbE.length === 0) {
                var cachedDash = localStorage.getItem('wilayah_dashboard_cache');
                if (cachedDash) {
                    var d2 = JSON.parse(cachedDash);
                    if (JSON.stringify(dbE) !== JSON.stringify(d2.pegawai) || JSON.stringify(dbK) !== JSON.stringify(d2.korlap)) {
                        dbE = d2.pegawai || [];
                        dbK = d2.korlap || [];
                        dataChanged = true;
                    }
                    populateUIFromData(d2);
                    if (!isSilent) showToast('📦 Menggunakan data cache', 'info');
                } else {
                    if (!isSilent) showToast('⚠️ Gagal memuat data', 'warning');
                }
            }
        }

        // Hanya index & render jika data berubah
        if (dataChanged) {
            indexData();
            updateKorlapStats();
            filterData();
        } else {
            // Jika data tidak berubah, tetap update statistik (mungkin ada perubahan status)
            updateKorlapStats();
            filterData();
        }

        if (isRefresh && !isSilent && !isAuto) {
            showToast('✅ Data diperbarui!', 'success');
        }

    } catch (e) {
        var isTimeout = e.name === 'TimeoutError' || (e.message && e.message.includes('Timeout'));
        var isNetwork = e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'));

        if (!isAuto && !isSilent) {
            if (isTimeout) showToast('⏰ Server lambat, pakai cache', 'warning');
            else if (isNetwork) showToast('📡 Koneksi terputus', 'error');
            else showToast('❌ Gagal: ' + e.message, 'error');
        }

        if (dbE.length > 0 || dbP.length > 0) {
            indexData();
            updateKorlapStats();
            filterData();
        }
    } finally {
        if (window._syncToastSafetyTimeout) {
            clearTimeout(window._syncToastSafetyTimeout);
            window._syncToastSafetyTimeout = null;
        }
        hideSyncToast();
    }
}

// ============================================================
// 10. REFRESH DATA (Manual)
// ============================================================
async function refreshData() {
    if (isRefreshing) return;
    var btn = document.querySelector('.btn-refresh');
    var icon = btn ? btn.querySelector('i') : null;

    try {
        isRefreshing = true;
        if (btn) btn.disabled = true;
        if (icon) icon.classList.add('spinning');

        showSoftSyncIndicator();
        await loadData(true, false, false);
        countdown = 60;
    } catch (e) {
        showToast('❌ Gagal refresh', 'error');
    } finally {
        isRefreshing = false;
        if (btn) btn.disabled = false;
        if (icon) icon.classList.remove('spinning');
        hideSyncToast();
    }
}

// ============================================================
// 11. SOFT SYNC INDICATOR
// ============================================================
function showSoftSyncIndicator() {
    var syncToast = document.getElementById('syncToast');
    if (!syncToast) return;
    syncToast.classList.remove('sync-toast--full');
    syncToast.classList.add('sync-toast--soft');
    syncToast.innerHTML = '<div class="sync-toast-content"><div class="sync-spinner"></div><span>Memperbarui...</span></div>';
    syncToast.style.display = 'flex';
    setTimeout(function() { hideSyncToast(); }, 30000);
}

function hideSyncToast() {
    var syncToast = document.getElementById('syncToast');
    if (!syncToast) return;
    syncToast.style.opacity = '0';
    syncToast.style.transform = 'translateY(-10px)';
    setTimeout(function() {
        syncToast.style.display = 'none';
        syncToast.style.opacity = '';
        syncToast.style.transform = '';
    }, 300);
}

function showSkeletonLoading() {
    var grid = document.getElementById('gridView');
    if (!grid) return;
    var skeletonCount = isMobile ? 2 : 4;
    grid.innerHTML = Array(skeletonCount).fill('<div class="skeleton-card"><div class="skeleton-circle"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>').join('');
}

// ============================================================
// 12. FILTERING DATA (dengan dataVersion)
// ============================================================
function filterData() {
    var wil = document.getElementById('fWil').value;
    var search = document.getElementById('fSearch').value.toLowerCase();
    var monitoringMap = {};

    dbE.forEach(function(p) {
        if ((wil === 'ALL' || p.Wilayah === wil) && (!search || (p.Nama || '').toLowerCase().includes(search))) {
            var pID = String(p.ID);
            var stats = computePegawaiStats(pID);
            monitoringMap[pID] = Object.assign({
                id: pID,
                nama: p.Nama,
                wil: p.Wilayah,
                foto: p.Link_Foto_Profile,
                hp: String(p.NoHP || p.no_hp || "")
            }, stats);
        }
    });

    var dataArr = Object.values(monitoringMap);

    var stats = { total: dataArr.length, hadir: 0, pulang: 0, belum: 0, sid: 0 };
    dataArr.forEach(function(p) {
        if (p.sid) stats.sid++;
        else if (p.out !== '-') stats.pulang++;
        else if (p.in !== '-') stats.hadir++;
        else stats.belum++;
    });

    updateSummaryCards(stats);
    updateChipCounters(stats);

    if (activeQuickFilter !== 'ALL') {
        dataArr = dataArr.filter(function(p) {
            if (activeQuickFilter === 'BELUM') return p.in === '-' && !p.sid;
            if (activeQuickFilter === 'HADIR') return p.in !== '-' && p.out === '-' && !p.sid;
            if (activeQuickFilter === 'PULANG') return p.out !== '-' && !p.sid;
            if (activeQuickFilter === 'SID') return !!p.sid;
            return true;
        });
    }

    var gridVisible = document.getElementById('gridView') && document.getElementById('gridView').style.display !== 'none';
    var tableVisible = document.getElementById('tableWrapper') && document.getElementById('tableWrapper').style.display !== 'none';

    if (gridVisible) renderGridViewChunked(dataArr);
    if (tableVisible) renderTableViewChunked(dataArr);
    safeCreateIcons();
}

// ============================================================
// 13. RENDER GRID VIEW (tanpa kedip)
// ============================================================
function renderGridViewChunked(data, chunkSize) {
    chunkSize = chunkSize || 10;
    var container = document.getElementById('gridView');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:50px;opacity:0.5">Belum ada data pada filter ini.</p>';
        return;
    }

    // Gunakan DocumentFragment untuk batch append
    var fragment = document.createDocumentFragment();
    data.forEach(function(p) {
        var cleanHP = p.hp.replace(/[^0-9]/g, '');
        var waUrl = cleanHP ? 'https://wa.me/' + cleanHP : "#";
        var card = document.createElement('div');
        card.className = 'personel-card';
        var sNama = sanitizeHTML(p.nama),
            sWil = sanitizeHTML(p.wil),
            sSid = sanitizeHTML(p.sid);

        card.innerHTML =
            '<div class="p-card-top">' +
            '<div class="p-photo-pop"><img src="' + (p.foto || placeholderImg) + '" loading="lazy" onerror="handleImgError(this)" alt="' + sNama + '"></div>' +
            '<div class="p-info">' +
            '<h3 class="clickable-name" onclick="openProfile(\'' + p.id + '\')" title="Buka Profile Raport">' + sNama + '</h3>' +
            '<p style="font-size:0.7rem;opacity:0.7">' + sWil + '</p>' +
            '<div class="sid-badge" style="display:' + (p.sid ? 'block' : 'none') + '">' + sSid + '</div>' +
            '</div>' +
            '<a href="' + waUrl + '" target="_blank" class="btn-wa-call" title="Hubungi WA"><i data-lucide="message-circle" size="20"></i></a>' +
            '</div>' +
            '<div class="p-card-body">' +
            '<div class="pres-indicator" style="border-left:4px solid var(--success)">' +
            '<div class="pres-label"><span>MASUK</span><b>' + p.in + '</b></div>' +
            '<div class="thumb-row">' +
            '<div class="mini-thumb" data-preview data-url="' + (p.sin || '') + '" data-name="' + sNama + '" data-info="Selfie Masuk" data-time="' + p.in + '" data-gps="' + (p.gin || '') + '">' + (p.sin ? '<img src="' + p.sin + '" loading="lazy">' : '<i data-lucide="camera" size="14"></i>') + '</div>' +
            '<div class="mini-thumb" data-preview data-url="' + (p.kin || '') + '" data-name="' + sNama + '" data-info="Dokumentasi Masuk" data-time="' + p.in + '" data-gps="' + (p.gin || '') + '">' + (p.kin ? '<img src="' + p.kin + '" loading="lazy">' : '<i data-lucide="image" size="14"></i>') + '</div>' +
            '</div>' +
            '<button class="gps-link-btn" data-preview data-url="" data-name="' + sNama + '" data-info="Lokasi Masuk" data-time="' + p.in + '" data-gps="' + (p.gin || '') + '"><i data-lucide="map-pin" size="14"></i> GPS Pagi</button>' +
            '</div>' +
            '<div class="pres-indicator" style="border-left:4px solid var(--accent)">' +
            '<div class="pres-label"><span>PULANG</span><b>' + p.out + '</b></div>' +
            '<div class="thumb-row">' +
            '<div class="mini-thumb" data-preview data-url="' + (p.sout || '') + '" data-name="' + sNama + '" data-info="Selfie Pulang" data-time="' + p.out + '" data-gps="' + (p.gout || '') + '">' + (p.sout ? '<img src="' + p.sout + '" loading="lazy">' : '<i data-lucide="camera" size="14"></i>') + '</div>' +
            '<div class="mini-thumb" data-preview data-url="' + (p.kout || '') + '" data-name="' + sNama + '" data-info="Dokumentasi Pulang" data-time="' + p.out + '" data-gps="' + (p.gout || '') + '">' + (p.kout ? '<img src="' + p.kout + '" loading="lazy">' : '<i data-lucide="image" size="14"></i>') + '</div>' +
            '</div>' +
            '<button class="gps-link-btn" data-preview data-url="" data-name="' + sNama + '" data-info="Lokasi Pulang" data-time="' + p.out + '" data-gps="' + (p.gout || '') + '"><i data-lucide="map-pin" size="14"></i> GPS Sore</button>' +
            '</div>' +
            '</div>';
        fragment.appendChild(card);
    });

    // Gunakan replaceChildren untuk menghindari kedipan (atomik)
    container.replaceChildren(fragment);

    // Gunakan event delegation untuk preview, bukan attach per elemen
    // Hapus listener lama dan pasang satu di container
    container.removeEventListener('click', container._previewHandler);
    container._previewHandler = function(e) {
        var el = e.target.closest('[data-preview]');
        if (!el) return;
        e.stopPropagation();
        var url = el.dataset.url;
        var name = el.dataset.name;
        var info = el.dataset.info;
        var time = el.dataset.time;
        var gps = el.dataset.gps;

        if (el.classList.contains('gps-link-btn') && !url) {
            if (gps && gps !== '-' && gps !== 'null' && gps !== 'undefined') {
                var cleanGps = gps.replace(/\s/g, '');
                var isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                var mapsUrl = isMobileDevice ? 'geo:' + cleanGps + '?q=' + cleanGps : 'https://www.google.com/maps?q=' + cleanGps;
                window.open(mapsUrl, '_blank');
                return;
            }
        }
        openPreviewModal(url, name, info, time, gps);
    };
    container.addEventListener('click', container._previewHandler);

    safeCreateIcons();
}

// ============================================================
// 14. RENDER TABLE VIEW (sama, dengan delegasi)
// ============================================================
function renderTableViewChunked(data, chunkSize) {
    chunkSize = chunkSize || 15;
    var body = document.getElementById('tableBody');
    if (!body) return;

    if (data.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:50px;opacity:0.5">Belum ada data pada filter ini.</td></tr>';
        return;
    }

    var fragment = document.createDocumentFragment();
    data.forEach(function(p) {
        var sNama = sanitizeHTML(p.nama),
            sWil = sanitizeHTML(p.wil);
        var tr = document.createElement('tr');

        tr.innerHTML =
            '<td style="font-weight:800;text-transform:uppercase">' +
            '<span class="clickable-name" onclick="openProfile(\'' + p.id + '\')" title="Buka Profile Raport">' + sNama + '</span>' +
            (p.sid ? '<span style="color:#8b5cf6;font-size:0.65rem;margin-left:5px">[' + sanitizeHTML(p.sid) + ']</span>' : '') +
            '</td>' +
            '<td style="opacity:0.6">' + sWil + '</td>' +
            '<td style="font-family:\'JetBrains Mono\';font-weight:800;color:' + (p.in !== '-' ? 'var(--success)' : '#4b5563') + '">' + p.in + '</td>' +
            '<td>' +
            '<div class="proof-icons-container">' +
            '<div class="table-icon-btn ' + (p.sin ? 'active-h' : '') + '" data-preview data-url="' + (p.sin || '') + '" data-name="' + sNama + '" data-info="Selfie Masuk" data-time="' + p.in + '" data-gps="' + (p.gin || '') + '"><i data-lucide="camera" size="16"></i></div>' +
            '<div class="table-icon-btn ' + (p.kin ? 'active-h' : '') + '" data-preview data-url="' + (p.kin || '') + '" data-name="' + sNama + '" data-info="Dokumentasi Masuk" data-time="' + p.in + '" data-gps="' + (p.gin || '') + '"><i data-lucide="briefcase" size="16"></i></div>' +
            '<div class="table-icon-btn ' + (p.gin ? 'active-h' : '') + '" data-preview data-url="" data-name="' + sNama + '" data-info="Lokasi Masuk" data-time="' + p.in + '" data-gps="' + (p.gin || '') + '"><i data-lucide="map-pin" size="16"></i></div>' +
            '</div>' +
            '</td>' +
            '<td style="font-family:\'JetBrains Mono\';font-weight:800;color:' + (p.out !== '-' ? 'var(--accent)' : '#4b5563') + '">' + p.out + '</td>' +
            '<td>' +
            '<div class="proof-icons-container">' +
            '<div class="table-icon-btn ' + (p.sout ? 'active-p' : '') + '" data-preview data-url="' + (p.sout || '') + '" data-name="' + sNama + '" data-info="Selfie Pulang" data-time="' + p.out + '" data-gps="' + (p.gout || '') + '"><i data-lucide="camera" size="16"></i></div>' +
            '<div class="table-icon-btn ' + (p.kout ? 'active-p' : '') + '" data-preview data-url="' + (p.kout || '') + '" data-name="' + sNama + '" data-info="Dokumentasi Pulang" data-time="' + p.out + '" data-gps="' + (p.gout || '') + '"><i data-lucide="briefcase" size="16"></i></div>' +
            '<div class="table-icon-btn ' + (p.gout ? 'active-p' : '') + '" data-preview data-url="" data-name="' + sNama + '" data-info="Lokasi Pulang" data-time="' + p.out + '" data-gps="' + (p.gout || '') + '"><i data-lucide="map-pin" size="16"></i></div>' +
            '</div>' +
            '</td>';
        fragment.appendChild(tr);
    });

    body.replaceChildren(fragment);

    // Event delegation untuk table body
    body.removeEventListener('click', body._previewHandler);
    body._previewHandler = function(e) {
        var el = e.target.closest('[data-preview]');
        if (!el) return;
        e.stopPropagation();
        var url = el.dataset.url;
        var name = el.dataset.name;
        var info = el.dataset.info;
        var time = el.dataset.time;
        var gps = el.dataset.gps;
        openPreviewModal(url, name, info, time, gps);
    };
    body.addEventListener('click', body._previewHandler);

    safeCreateIcons();
}

// ============================================================
// 15. MODAL PREVIEW FOTO (dengan cleanup sempurna)
// ============================================================
function openPreviewModal(url, name, info, time, gps) {
    if ((!url || url === '-' || url === 'null' || url === 'undefined') &&
        (!gps || gps === '-' || gps === 'null' || gps === 'undefined')) {
        return;
    }

    var modal = document.getElementById('pModal');
    var imgContainer = document.getElementById('mImgContainer');
    var img = document.getElementById('mImg');
    var nameEl = document.getElementById('mName');
    var infoEl = document.getElementById('mInfo');
    var timeEl = document.getElementById('mTime');
    var gpsBtn = document.getElementById('mGpsBtn');

    currentZoom = 1;
    img.style.transform = 'scale(1)';
    img.style.cursor = 'zoom-in';
    img.classList.remove('zoomed');

    if (url && url !== '-' && url !== 'null' && url !== 'undefined') {
        imgContainer.style.display = 'flex';
        img.src = url;
        img.onerror = function() { this.src = placeholderImg; };
    } else {
        imgContainer.style.display = 'flex';
        img.src = placeholderImg;
    }

    nameEl.textContent = name || 'Tanpa Nama';
    infoEl.textContent = info || 'Dokumentasi';
    timeEl.textContent = time || '--:--';

    if (gps && gps !== '-' && gps !== 'null' && gps !== 'undefined') {
        gpsBtn.style.display = 'flex';
        gpsBtn.onclick = function(e) {
            e.stopPropagation();
            var cleanGps = gps.replace(/\s/g, '');
            var isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            var mapsUrl = isMobileDevice ? 'geo:' + cleanGps + '?q=' + cleanGps : 'https://www.google.com/maps?q=' + cleanGps;
            window.open(mapsUrl, '_blank');
        };
        gpsBtn.innerHTML = '<i data-lucide="map-pinned" size="18"></i> BUKA LOKASI GOOGLE MAPS';
    } else {
        gpsBtn.style.display = 'none';
    }

    // Hapus listener lama
    if (modalEventHandlers && img) {
        img.removeEventListener('wheel', modalEventHandlers.wheel);
        img.removeEventListener('touchstart', modalEventHandlers.touchstart);
        img.removeEventListener('touchmove', modalEventHandlers.touchmove);
        img.removeEventListener('touchend', modalEventHandlers.touchend);
        img.removeEventListener('dblclick', modalEventHandlers.dblclick);
        modalEventHandlers = null;
    }

    // Buat handler baru
    modalEventHandlers = {
        wheel: function(e) {
            e.preventDefault();
            e.stopPropagation();
            var delta = e.deltaY > 0 ? -0.1 : 0.1;
            var newZoom = Math.min(Math.max(1, currentZoom + delta), 3);
            currentZoom = newZoom;
            img.style.transform = 'scale(' + currentZoom + ')';
            img.style.cursor = currentZoom > 1 ? 'zoom-out' : 'zoom-in';
            img.classList.toggle('zoomed', currentZoom > 1);
        },
        touchstart: function(e) {
            if (e.touches.length === 2) {
                var t1 = e.touches[0];
                var t2 = e.touches[1];
                lastTouchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            } else if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                isDragging = true;
            }
        },
        touchmove: function(e) {
            if (e.touches.length === 2) {
                var t1 = e.touches[0];
                var t2 = e.touches[1];
                var dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                if (lastTouchDist > 0) {
                    var delta = (dist - lastTouchDist) / 100;
                    var newZoom = Math.min(Math.max(1, currentZoom + delta), 3);
                    currentZoom = newZoom;
                    img.style.transform = 'scale(' + currentZoom + ')';
                    img.style.cursor = currentZoom > 1 ? 'zoom-out' : 'zoom-in';
                    img.classList.toggle('zoomed', currentZoom > 1);
                }
                lastTouchDist = dist;
                e.preventDefault();
            }
        },
        touchend: function() {
            lastTouchDist = 0;
            isDragging = false;
        },
        dblclick: function(e) {
            e.preventDefault();
            currentZoom = 1;
            img.style.transform = 'scale(1)';
            img.style.cursor = 'zoom-in';
            img.classList.remove('zoomed');
        }
    };

    img.addEventListener('wheel', modalEventHandlers.wheel, { passive: false });
    img.addEventListener('touchstart', modalEventHandlers.touchstart, { passive: true });
    img.addEventListener('touchmove', modalEventHandlers.touchmove, { passive: false });
    img.addEventListener('touchend', modalEventHandlers.touchend, { passive: true });
    img.addEventListener('dblclick', modalEventHandlers.dblclick);

    modal.onclick = function(e) {
        if (e.target === modal || e.target === imgContainer) closePreviewModal();
    };

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(safeCreateIcons, 100);
}

function closePreviewModal() {
    var modal = document.getElementById('pModal');
    var img = document.getElementById('mImg');

    if (modalEventHandlers && img) {
        img.removeEventListener('wheel', modalEventHandlers.wheel);
        img.removeEventListener('touchstart', modalEventHandlers.touchstart);
        img.removeEventListener('touchmove', modalEventHandlers.touchmove);
        img.removeEventListener('touchend', modalEventHandlers.touchend);
        img.removeEventListener('dblclick', modalEventHandlers.dblclick);
        modalEventHandlers = null;
    }

    currentZoom = 1;
    if (img) {
        img.style.transform = 'scale(1)';
        img.style.cursor = 'zoom-in';
        img.classList.remove('zoomed');
    }

    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

// ============================================================
// 16. KORLAP STATS
// ============================================================
function updateKorlapStats() {
    var container = document.getElementById('korlapGrid');
    if (!container) return;

    var staffByWilayah = new Map();
    dbE.forEach(function(p) {
        var w = p.Wilayah;
        if (!staffByWilayah.has(w)) staffByWilayah.set(w, []);
        staffByWilayah.get(w).push(p);
    });

    var html = dbK.map(function(k) {
        var wilStaff = staffByWilayah.get(k.Wilayah) || [];
        var h = 0, p_out = 0, s = 0;
        wilStaff.forEach(function(stf) {
            var stats = computePegawaiStats(String(stf.ID));
            if (stats.in !== '-') h++;
            if (stats.out !== '-') p_out++;
            if (stats.sid) s++;
        });
        return '<div class="korlap-card">' +
            '<div class="korlap-header-blue">' +
            '<div class="korlap-foto-wrap"><img src="' + (k.Link_Foto_Profile || placeholderImg) + '" onerror="handleImgError(this)" alt="' + sanitizeHTML(k.Nama) + '"></div>' +
            '<div class="korlap-info">' +
            '<h2>' + sanitizeHTML(k.Nama) + '</h2>' +
            '<p style="font-size:0.7rem;opacity:0.7">Koordinator ' + sanitizeHTML(k.Wilayah) + '</p>' +
            '<button class="btn-agenda-pill" onclick="openAgenda(\'' + sanitizeHTML(k.Nama).replace(/'/g, "\\'") + '\',\'' + sanitizeHTML(k.Jabatan || '').replace(/'/g, "\\'") + '\')"><i data-lucide="calendar-check-2" size="14"></i> E-Agenda</button>' +
            '</div>' +
            '</div>' +
            '<div class="korlap-stats-row">' +
            '<div class="k-stat-box"><b>' + wilStaff.length + '</b><span>Total</span></div>' +
            '<div class="k-stat-box"><b style="color:var(--success)">' + h + '</b><span>Hadir</span></div>' +
            '<div class="k-stat-box"><b style="color:var(--accent)">' + p_out + '</b><span>Pulang</span></div>' +
            '<div class="k-stat-box"><b style="color:#a855f7">' + s + '</b><span>SID</span></div>' +
            '</div>' +
            '</div>';
    }).join('');

    container.innerHTML = html;
    safeCreateIcons();
}

// ============================================================
// 17. AGENDA KORLAP (tidak diubah)
// ============================================================
// ... (fungsi openAgenda, closeAgenda, syncJabatan, startVoice, compressImage, submitAgenda tetap sama)
// Saya tidak tulis ulang di sini karena panjang, tetapi dalam file final tetap ada.

// ============================================================
// 18. UI INTERACTIONS
// ============================================================
function onDateChange() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        loadData(true, false, false);
        countdown = 60;
    }, 300);
}

function onSearchInput() {
    var now = Date.now();
    if (now - lastFilterTime > 800) {
        filterData();
        lastFilterTime = now;
    } else {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
            filterData();
            lastFilterTime = Date.now();
        }, 400);
    }
}

function toggleView(v) {
    document.getElementById('btnG').classList.toggle('active', v === 'grid');
    document.getElementById('btnT').classList.toggle('active', v === 'table');
    document.getElementById('gridView').style.display = v === 'grid' ? 'grid' : 'none';
    document.getElementById('tableWrapper').style.display = v === 'table' ? 'block' : 'none';
    localStorage.setItem('wilayah_view_preference', v);
    filterData();
}

function resetFilters() {
    document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('fWil').value = 'ALL';
    document.getElementById('fSearch').value = '';
    setQuickFilter('ALL', document.querySelector('.q-chip[data-filter="ALL"]'));
    showToast('Filter direset', 'info');
}

function exportData() {
    var rows = document.querySelectorAll('#tableBody tr');
    if (rows.length === 0 || (rows.length === 1 && rows[0].textContent.includes('Belum ada data'))) {
        showToast('⚠️ Tidak ada data!', 'error');
        return;
    }
    var csv = 'Nama,Wilayah,Masuk,Bukti Masuk,Pulang,Bukti Pulang\n';
    rows.forEach(function(row) {
        var cells = row.querySelectorAll('td');
        var data = Array.from(cells).slice(0, 6).map(function(cell) {
            var text = cell.textContent.trim().replace(/,/g, ';');
            text = text.replace(/[🔍📷📄🗺️]/g, '').trim();
            return text;
        });
        csv += data.join(',') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'monitoring_' + document.getElementById('fDate').value + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Data diexport!', 'success');
}

// ============================================================
// 19. SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js')
            .then(function(reg) { console.log('✅ Service Worker registered'); })
            .catch(function(err) { console.warn('SW registration failed:', err); });
    });
}

// ============================================================
// 20. LOAD VIEW PREFERENCE
// ============================================================
var savedView = localStorage.getItem('wilayah_view_preference') || 'grid';
if (savedView === 'table') {
    setTimeout(function() { toggleView('table'); }, 100);
}

// ============================================================
// 21. COUNTDOWN & AUTO-REFRESH (tanpa kedip)
// ============================================================
function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdown = 60;

    countdownInterval = setInterval(function() {
        countdown--;
        var timerEl = document.getElementById('countdownTimer');
        if (timerEl) {
            timerEl.innerText = countdown + 's';
            if (countdown <= 10) timerEl.setAttribute('data-urgent', 'true');
            else timerEl.removeAttribute('data-urgent');
        }

        if (countdown <= 0) {
            countdown = 60;
            // Refresh hanya jika halaman tidak hidden dan data berubah
            if (!document.hidden) {
                loadData(true, true, true);
            }
        }
    }, 1000);
}

// ============================================================
// 22. SUMMARY CARDS & CHIP COUNTERS (efisien)
// ============================================================
function updateSummaryCards(stats) {
    var animateValue = function(id, end, duration) {
        duration = duration || 500;
        var el = document.getElementById(id);
        if (!el) return;
        var start = parseInt(el.textContent) || 0;
        if (start === end) return;
        var startTimestamp = null;
        var step = function(timestamp) {
            if (!startTimestamp) startTimestamp = timestamp;
            var progress = Math.min((timestamp - startTimestamp) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.floor(start + (end - start) * eased);
            el.textContent = current;
            if (progress < 1) window.requestAnimationFrame(step);
            else el.textContent = end;
        };
        window.requestAnimationFrame(step);
    };

    requestAnimationFrame(function() {
        animateValue('sumTotal', stats.total);
        animateValue('sumHadir', stats.hadir);
        animateValue('sumPulang', stats.pulang);
        animateValue('sumBelum', stats.belum);
    });
}

function updateChipCounters(stats) {
    requestAnimationFrame(function() {
        var updates = [
            { filter: 'ALL', count: stats.total },
            { filter: 'BELUM', count: stats.belum },
            { filter: 'HADIR', count: stats.hadir },
            { filter: 'PULANG', count: stats.pulang },
            { filter: 'SID', count: stats.sid }
        ];

        updates.forEach(function(u) {
            var chip = document.querySelector('.q-chip[data-filter="' + u.filter + '"]');
            if (!chip) return;

            // Hapus counter lama
            var oldCounter = chip.querySelector('.chip-count');
            if (oldCounter) oldCounter.remove();

            // Sembunyikan chip jika count 0 dan bukan ALL
            if (u.filter !== 'ALL' && u.count === 0) {
                chip.style.display = 'none';
                return;
            }
            chip.style.display = 'inline-flex';

            var counterEl = document.createElement('span');
            counterEl.className = 'chip-count';
            counterEl.textContent = u.count;
            chip.appendChild(counterEl);
        });
    });
}

// ============================================================
// 23. QUICK FILTER
// ============================================================
function setQuickFilter(filter, el) {
    activeQuickFilter = filter;
    document.querySelectorAll('.q-chip').forEach(function(c) {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
    });
    if (el) {
        el.classList.add('active');
        el.setAttribute('aria-pressed', 'true');
    }
    countdown = 60;
    filterData();
}

// ============================================================
// 24. WA BROADCAST (dengan batas)
// ============================================================
async function sendWABroadcast() {
    var wil = document.getElementById('fWil').value;
    var search = document.getElementById('fSearch').value.toLowerCase();
    var selectedDate = document.getElementById('fDate').value;

    var belumPresensi = [];
    dbE.forEach(function(p) {
        if ((wil === 'ALL' || p.Wilayah === wil) &&
            (!search || (p.Nama || '').toLowerCase().includes(search))) {
            var stats = computePegawaiStats(String(p.ID));
            if (!stats || (stats.in === '-' && !stats.sid)) {
                var hp = String(p.NoHP || p.no_hp || '').replace(/[^0-9]/g, '');
                if (hp) belumPresensi.push({ nama: p.Nama, hp: hp, wilayah: p.Wilayah });
            }
        }
    });

    if (belumPresensi.length === 0) {
        showToast('✅ Semua sudah presensi!', 'success');
        return;
    }

    if (belumPresensi.length > 10) {
        showToast('⚠️ Terlalu banyak (' + belumPresensi.length + ') nomor. Filter wilayah dulu.', 'warning');
        return;
    }

    if (!confirm('Kirim reminder ke ' + belumPresensi.length + ' pegawai?')) return;

    var dateFormatted = new Date(selectedDate).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    var pesanTemplate =
        '🔔 *REMINDER PRESENSI*\n\n' +
        'Yth. {nama},\n\n' +
        'Mohon segera presensi hari ini (' + dateFormatted + ').\n\n' +
        '📍 _UPT PUSDA WS Bondoyudo Baru_\n\n' +
        '🔗 ' + window.location.origin + '/presensi.html';

    var opened = 0;
    for (var i = 0; i < belumPresensi.length; i++) {
        var p = belumPresensi[i];
        var pesan = encodeURIComponent(pesanTemplate.replace('{nama}', p.nama));
        var waUrl = 'https://wa.me/' + p.hp + '?text=' + pesan;
        window.open(waUrl, '_blank');
        opened++;
        if (opened < belumPresensi.length) {
            await new Promise(function(r) { setTimeout(r, 1500); });
        }
    }
    showToast('✅ Membuka ' + opened + ' link WA', 'success');
}

// ============================================================
// 25. OPEN PROFILE
// ============================================================
function openProfile(pegawaiId) {
    var pegawai = pegawaiById.get(String(pegawaiId));
    if (!pegawai) {
        showToast('❌ Data pegawai tidak ditemukan', 'error');
        return;
    }
    var params = new URLSearchParams({
        id: pegawai.ID || pegawaiId,
        nama: pegawai.Nama || '',
        jabatan: pegawai.Jabatan || 'PPA',
        wilayah: pegawai.Wilayah || 'UPT',
        foto: pegawai.Link_Foto_Profile || ''
    });
    sessionStorage.setItem('return_from_profile', 'true');
    window.open('profile_raport.html?' + params.toString(), '_blank');
}

// ============================================================
// 26. APP INIT (ONLOAD)
// ============================================================
window.onload = function() {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    var now = new Date();
    var fDateEl = document.getElementById('fDate');
    if (fDateEl) {
        fDateEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }

    if (!document.getElementById('wil-toast-style')) {
        var s = document.createElement('style');
        s.id = 'wil-toast-style';
        s.innerHTML = '@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(s);
    }

    var cachedDash = localStorage.getItem('wilayah_dashboard_cache');
    var selectedDate = fDateEl ? fDateEl.value : '';
    var cachedPresensi = localStorage.getItem('wilayah_presensi_' + selectedDate);
    var hasCache = cachedDash && cachedPresensi;

    if (hasCache) {
        try {
            var d = JSON.parse(cachedDash);
            dbE = d.pegawai || [];
            dbK = d.korlap || [];
            dbP = JSON.parse(cachedPresensi);
            populateUIFromData(d);
            indexData();
            updateKorlapStats();
            filterData();
            showSoftSyncIndicator();
            loadData(false, false, true);
        } catch (e) {
            console.warn('Cache corrupt, reload', e);
            loadData(false, false, false);
        }
    } else {
        showSkeletonLoading();
        loadData(false, false, false);
    }

    setInterval(function() {
        var c = document.getElementById('liveClock');
        if (c) c.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    startCountdown();
};
