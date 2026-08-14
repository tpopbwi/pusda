// ============================================================
// MAPS.JS - PETA MONITORING + EKSPLOITASI (DENGAN VIEWPORT)
// ============================================================

// ============================================================
// 1. KONFIGURASI
// ============================================================
const OFFICE_LOCATION = {
    lat: -8.4338918,
    lng: 114.2217959,
    name: 'Kantor UPT PUSDA WS Bondoyudo Baru'
};

// Ganti dengan URL deployment Apps Script Anda
const API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// ============================================================
// 2. DATA & VARIABEL GLOBAL
// ============================================================
let pintuAirData = [];
let map = null;
let currentLayer = 'presensi';

// Presensi
let presensiData = [];
let presensiMarkers = [];
let geofenceCircle = null;

// Pintu Air (viewport rendering)
let filteredPintuData = [];
let visiblePintuMarkers = [];
let activePopupMarker = null;

// ============================================================
// 3. DEBOUNCE HELPER
// ============================================================
function debounce(fn, delay) {
    let timer;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, arguments), delay);
    };
}

// ============================================================
// 4. FETCH DATA PINTU AIR
// ============================================================
async function fetchPintuAirData() {
    try {
        const response = await fetch(API_URL + '?action=getPintuAirData&cb=' + Date.now(), {
            cache: 'no-cache'
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            pintuAirData = result.data;
            console.log('✅ Data pintu air dimuat:', pintuAirData.length, 'item');
        } else {
            console.warn('⚠️ Data pintu air kosong atau error');
            pintuAirData = [];
        }
    } catch (error) {
        console.error('❌ Gagal fetch pintu air:', error);
        pintuAirData = [];
    } finally {
        populatePintuFilters();
        applyPintuFilter();
        if (currentLayer === 'pintu') updatePintuStats();
    }
}

// ============================================================
// 5. INIT MAP
// ============================================================
function initMap() {
    map = L.map('map', {
        attributionControl: false,
        zoomControl: true
    }).setView([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], 13);

    // Tile layer satelit ESRI (maxZoom 18 untuk hemat data)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: ''
    }).addTo(map);

    // Label overlay
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '',
        opacity: 1.0
    }).addTo(map);

    // Marker Kantor
    const officeIcon = L.divIcon({
        html: '<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);">🏢</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    L.marker([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], { icon: officeIcon })
        .addTo(map)
        .bindPopup(`<b>${OFFICE_LOCATION.name}</b>`);

    // Event viewport dengan debounce
    const debouncedRender = debounce(renderVisibleMarkers, 300);
    map.on('moveend', debouncedRender);
    map.on('zoomend', debouncedRender);

    updateGeofence();
    loadPresensiData();
    fetchPintuAirData();
    switchLayer('presensi');
}

// ============================================================
// 6. LAYER SWITCH
// ============================================================
function switchLayer(layer) {
    currentLayer = layer;

    document.querySelectorAll('.layer-toggle button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layer === layer);
    });

    const filterDaerah = document.getElementById('filterDaerah');
    const filterJenis = document.getElementById('filterJenis');

    if (layer === 'pintu') {
        filterDaerah.style.display = 'inline-block';
        filterJenis.style.display = 'inline-block';

        presensiMarkers.forEach(m => map.removeLayer(m));
        if (geofenceCircle) map.removeLayer(geofenceCircle);

        renderVisibleMarkers();
        updatePintuStats();
        updateLegend('pintu');
    } else {
        filterDaerah.style.display = 'none';
        filterJenis.style.display = 'none';

        visiblePintuMarkers.forEach(m => map.removeLayer(m));
        visiblePintuMarkers = [];

        presensiMarkers.forEach(m => map.addLayer(m));
        if (geofenceCircle) map.addLayer(geofenceCircle);

        updatePresensiStats();
        updateLegend('presensi');
    }
}

// ============================================================
// 7. PRESENSI (Circle Markers)
// ============================================================
function loadPresensiData() {
    const cached = localStorage.getItem('wilayah_presensi_' + new Date().toISOString().split('T')[0]);
    if (cached) {
        presensiData = JSON.parse(cached);
        plotPresensiMarkers();
    } else if (window.parent !== window) {
        window.parent.postMessage({
            type: 'FLOATING_WINDOW_REQUEST',
            data: { action: 'getData', key: 'presensi' }
        }, '*');
    }
}

window.addEventListener('message', (event) => {
    if (event.data.type === 'FLOATING_WINDOW_MESSAGE') {
        const { data } = event.data;
        if (data.key === 'presensi') {
            presensiData = data.value;
            plotPresensiMarkers();
        }
    }
});

function plotPresensiMarkers() {
    presensiMarkers.forEach(m => map.removeLayer(m));
    presensiMarkers = [];

    const radius = 500;
    presensiData.forEach(log => {
        const gps = log.GPS || log.gps;
        if (!gps || gps === '-' || gps === 'null') return;
        const [lat, lng] = gps.replace(/\s/g, '').split(',').map(Number);
        if (isNaN(lat) || isNaN(lng)) return;

        const distance = calculateDistance(OFFICE_LOCATION.lat, OFFICE_LOCATION.lng, lat, lng);
        const isInArea = distance <= radius;
        const color = isInArea ? '#10b981' : '#ef4444';

        const marker = L.circleMarker([lat, lng], {
            radius: 6,
            fillColor: color,
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
        });

        const nama = log.Nama || log.nama || 'Pegawai';
        const status = log.Status || log.status || '-';
        const waktu = formatTime(log.Timestamp || log.timestamp);

        marker.bindPopup(`
            <b>${nama}</b><br>
            <small>Status: ${status}</small><br>
            <small>⏰ ${waktu}</small><br>
            <small>📍 ${distance.toFixed(0)}m dari kantor</small>
        `);

        if (currentLayer === 'presensi') map.addLayer(marker);
        presensiMarkers.push(marker);
    });

    if (currentLayer === 'presensi') updatePresensiStats();
}

function updatePresensiStats() {
    const inArea = presensiMarkers.filter(m => m.options.fillColor === '#10b981').length;
    const outArea = presensiMarkers.length - inArea;
    document.getElementById('stat1').textContent = presensiMarkers.length;
    document.getElementById('stat2').textContent = inArea;
    document.getElementById('stat3').textContent = outArea;
    document.getElementById('label1').textContent = 'Total Presensi';
    document.getElementById('label2').textContent = 'Dalam Area';
    document.getElementById('label3').textContent = 'Luar Area';
}

function updateGeofence() {
    if (!map) return;
    if (geofenceCircle) map.removeLayer(geofenceCircle);
    const radius = 500;
    geofenceCircle = L.circle([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], {
        radius: radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '5, 10'
    });
    if (currentLayer === 'presensi') map.addLayer(geofenceCircle);
}

// ============================================================
// 8. PINTU AIR - FILTER & VIEWPORT RENDER
// ============================================================
function populatePintuFilters() {
    const daerahSet = new Set(pintuAirData.map(d => d.nama_daerah));
    const selectDaerah = document.getElementById('filterDaerah');
    selectDaerah.innerHTML = '<option value="ALL">Semua Daerah</option>';
    daerahSet.forEach(daerah => {
        const opt = document.createElement('option');
        opt.value = daerah;
        opt.textContent = daerah;
        selectDaerah.appendChild(opt);
    });
}

function applyPintuFilter() {
    const daerah = document.getElementById('filterDaerah').value;
    const jenis = document.getElementById('filterJenis').value;

    filteredPintuData = pintuAirData.filter(item => {
        const matchDaerah = daerah === 'ALL' || item.nama_daerah === daerah;
        const matchJenis = jenis === 'ALL' || item.jenis_pintu === jenis;
        return matchDaerah && matchJenis;
    });

    visiblePintuMarkers.forEach(m => map.removeLayer(m));
    visiblePintuMarkers = [];
    activePopupMarker = null;

    if (currentLayer === 'pintu') {
        renderVisibleMarkers();
        updatePintuStats();
    }
}

// ============================================================
// 9. RENDER MARKER BERDASARKAN VIEWPORT (DENGAN POPUP PERSISTEN)
// ============================================================
function renderVisibleMarkers() {
    if (currentLayer !== 'pintu') return;
    if (!map) return;

    // Cek popup terbuka
    const openPopup = map._popup;
    let keepMarker = null;
    if (openPopup && openPopup._source) {
        keepMarker = openPopup._source;
        activePopupMarker = keepMarker;
    } else {
        activePopupMarker = null;
    }

    // Hapus marker yang tidak terlihat, kecuali yang memiliki popup
    visiblePintuMarkers.forEach(m => {
        if (m !== keepMarker) {
            map.removeLayer(m);
        }
    });
    visiblePintuMarkers = visiblePintuMarkers.filter(m => m === keepMarker);

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < 10) return;

    filteredPintuData.forEach(item => {
        if (!item.koordinat || item.koordinat === '-') return;

        // Parsing koordinat (string → array)
        const parts = item.koordinat.replace(/\s/g, '').split(',').map(Number);
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return;

        const lat = parts[0];
        const lng = parts[1];

        if (!bounds.contains([lat, lng])) return;

        // Tentukan warna & badge
        let color = '#10b981';
        let badgeClass = 'badge-baik';
        const kondisi = item.kondisi_daun_pintu || '';
        if (kondisi.includes('Rusak Berat')) {
            color = '#ef4444';
            badgeClass = 'badge-rusak-berat';
        } else if (kondisi.includes('Rusak Ringan')) {
            color = '#f59e0b';
            badgeClass = 'badge-rusak-ringan';
        } else if (kondisi.includes('Rusak')) {
            color = '#ef4444';
            badgeClass = 'badge-rusak';
        }

        // Ikon Marker
        const iconHtml =
            `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700;">${item.jenis_pintu === 'Pintu Air' ? '💧' : item.jenis_pintu === 'Pintu Pembagi' ? '🔧' : '⚙️'}</div>`;

        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: iconHtml,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            })
        });

        // === POPUP PROFESSIONAL ===
        const statusDisplay = kondisi || 'Tidak Diketahui';
        const coordDisplay = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        const getCondClass = (val) => {
            if (!val) return 'good';
            const v = val.toLowerCase();
            if (v.includes('rusak berat') || v.includes('rusak')) return 'danger';
            if (v.includes('rusak ringan')) return 'warning';
            return 'good';
        };

        const popupContent = `
            <div class="popup-inner">
                <div class="popup-header">
                    <div class="popup-title">${item.nama_saluran || 'Nama Saluran'}</div>
                    <span class="popup-badge ${badgeClass}">${statusDisplay}</span>
                </div>
                <div class="popup-location">
                    <i data-lucide="map-pin" size="12"></i>
                    ${item.nama_daerah || '-'} · ${item.nomenklatur || '-'}
                </div>
                <div class="popup-divider"></div>
                <div class="popup-grid">
                    <div class="popup-item"><span class="label">ID</span><span class="value">${item.id || '-'}</span></div>
                    <div class="popup-item"><span class="label">Petugas</span><span class="value">${item.nama_petugas || '-'}</span></div>
                    <div class="popup-item"><span class="label">Jenis</span><span class="value">${item.jenis_pintu || '-'}</span></div>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-grid popup-specs">
                    <div class="popup-item"><span class="label">H1</span><span class="value">${item.h1 || 0}m</span></div>
                    <div class="popup-item"><span class="label">H</span><span class="value">${item.h || 0}m</span></div>
                    <div class="popup-item"><span class="label">B</span><span class="value">${item.b || 0}m</span></div>
                    <div class="popup-item"><span class="label">t</span><span class="value">${item.t || 0}m</span></div>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-conditions">
                    <div class="cond-item">
                        <span class="cond-label">Daun Pintu</span>
                        <span class="cond-value ${getCondClass(item.kondisi_daun_pintu)}">${item.kondisi_daun_pintu || '-'}</span>
                    </div>
                    <div class="cond-item">
                        <span class="cond-label">Drat Stang</span>
                        <span class="cond-value ${getCondClass(item.kondisi_drat_stang)}">${item.kondisi_drat_stang || '-'}</span>
                    </div>
                    <div class="cond-item">
                        <span class="cond-label">Rangka</span>
                        <span class="cond-value ${getCondClass(item.kondisi_rangka)}">${item.kondisi_rangka || '-'}</span>
                    </div>
                </div>
                ${item.keterangan ? `<div class="popup-notes">📝 ${item.keterangan}</div>` : ''}
                ${item.url_foto && item.url_foto !== '-' ? `
                    <div class="popup-photo">
                        <img src="${item.url_foto}" alt="Foto Pintu" loading="lazy" onerror="this.parentElement.style.display='none'">
                    </div>
                ` : ''}
                <div class="popup-footer">
                    <span class="coord"><i data-lucide="map-pin" size="10"></i> ${coordDisplay}</span>
                    <span>📅 ${item.timestamp ? new Date(item.timestamp).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '-'}</span>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, {
            maxWidth: 380,
            minWidth: 280,
            className: 'pintu-popup'
        });

        map.addLayer(marker);
        visiblePintuMarkers.push(marker);

        // Jika marker ini yang memiliki popup, popup tetap terbuka
        if (marker === keepMarker) {
            // Tidak ada tindakan tambahan
        }
    });

    // Refresh Lucide icons
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            document.querySelectorAll('.popup-inner i[data-lucide]').forEach(el => {
                lucide.createIcons({ node: el });
            });
        }
    }, 100);
}

// ============================================================
// 10. UPDATE STATS PINTU
// ============================================================
function updatePintuStats() {
    const total = filteredPintuData.length;
    let baik = 0,
        rusak = 0;
    filteredPintuData.forEach(item => {
        const kondisi = item.kondisi_daun_pintu || '';
        if (kondisi.includes('Rusak Berat') || kondisi.includes('Rusak Ringan') || kondisi.includes('Rusak')) {
            rusak++;
        } else {
            baik++;
        }
    });
    document.getElementById('stat1').textContent = total;
    document.getElementById('stat2').textContent = baik;
    document.getElementById('stat3').textContent = rusak;
    document.getElementById('label1').textContent = 'Total Pintu';
    document.getElementById('label2').textContent = 'Kondisi Baik';
    document.getElementById('label3').textContent = 'Perlu Perbaikan';
}

// ============================================================
// 11. LEGEND & HELPERS
// ============================================================
function updateLegend(layer) {
    const legend = document.getElementById('mapLegend');
    if (layer === 'presensi') {
        legend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background: #10b981;"></div>
                <span>Dalam Area</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ef4444;"></div>
                <span>Luar Area</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #3b82f6;"></div>
                <span>Kantor</span>
            </div>
        `;
    } else {
        legend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background: #10b981;"></div>
                <span>Kondisi Baik</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #f59e0b;"></div>
                <span>Perawatan</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ef4444;"></div>
                <span>Perlu Perbaikan</span>
            </div>
        `;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(dateStr) {
    if (!dateStr) return '--:--';
    try {
        return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch { return '--:--'; }
}

function refreshData() {
    loadPresensiData();
    fetchPintuAirData();
}

function fitToAll() {
    const allMarkers = [...presensiMarkers, ...visiblePintuMarkers];
    if (allMarkers.length === 0) return;
    const group = L.featureGroup(allMarkers);
    map.fitBounds(group.getBounds().pad(0.15));
}

// ============================================================
// 12. INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initMap();
});
