// ============================================================
// MAPS.JS - PETA EKSPLOITASI DENGAN DATA PINTU AIR
// ============================================================

// ============================================================
// DATA PINTU AIR (CONTOH - GANTI DENGAN DATA DARI SPREADSHEET)
// ============================================================
let pintuAirData = [
    {
        timestamp: '2025-01-15 08:00',
        id: 'PA-001',
        nama_daerah: 'Daerah Irigasi Bondoyudo',
        nama_petugas: 'Bambang S.',
        nama_saluran: 'Saluran Primer Kiri',
        nomenklatur: 'P.01',
        jenis_pintu: 'Pintu Air',
        koordinat: [-8.4338918, 114.2217959],
        h1: 1.2,
        h: 0.8,
        b: 0.6,
        t: 0.05,
        kondisi_daun_pintu: 'Baik',
        kondisi_drat_stang: 'Baik',
        kondisi_rangka: 'Baik',
        keterangan: 'Normal operasional',
        url_foto: 'https://via.placeholder.com/300x200?text=PA-001'
    },
    {
        timestamp: '2025-01-15 09:30',
        id: 'PA-002',
        nama_daerah: 'Daerah Irigasi Bondoyudo',
        nama_petugas: 'Siti R.',
        nama_saluran: 'Saluran Sekunder Kanan',
        nomenklatur: 'P.02',
        jenis_pintu: 'Pintu Pembagi',
        koordinat: [-8.4450, 114.2300],
        h1: 0.9,
        h: 0.5,
        b: 0.4,
        t: 0.03,
        kondisi_daun_pintu: 'Rusak Ringan',
        kondisi_drat_stang: 'Rusak',
        kondisi_rangka: 'Baik',
        keterangan: 'Drat stang patah, perlu penggantian',
        url_foto: 'https://via.placeholder.com/300x200?text=PA-002'
    },
    {
        timestamp: '2025-01-15 10:15',
        id: 'PA-003',
        nama_daerah: 'Daerah Irigasi Lumajang',
        nama_petugas: 'Agus W.',
        nama_saluran: 'Saluran Tersier Utara',
        nomenklatur: 'P.03',
        jenis_pintu: 'Pintu Sorong',
        koordinat: [-8.4600, 114.2400],
        h1: 1.5,
        h: 1.0,
        b: 0.8,
        t: 0.06,
        kondisi_daun_pintu: 'Rusak Berat',
        kondisi_drat_stang: 'Rusak',
        kondisi_rangka: 'Rusak Ringan',
        keterangan: 'Daun pintu bengkok, perlu penggantian total',
        url_foto: 'https://via.placeholder.com/300x200?text=PA-003'
    }
];

// ============================================================
// VARIABEL GLOBAL
// ============================================================
let map = null;
let pintuMarkers = [];

// ============================================================
// INISIALISASI MAP
// ============================================================
function initMap() {
    map = L.map('map', {
        attributionControl: false,
        zoomControl: true
    }).setView([-8.4338918, 114.2217959], 13);

    // Tile layer satelit ESRI (tanpa watermark)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: ''
    }).addTo(map);

    // Layer label untuk referensi (opsional)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '',
        opacity: 0.6
    }).addTo(map);

    populateFilters();
    plotPintuAir();
}

// ============================================================
// FILTER
// ============================================================
function populateFilters() {
    const daerahSet = new Set(pintuAirData.map(d => d.nama_daerah));
    const selectDaerah = document.getElementById('filterDaerah');
    if (!selectDaerah) return;

    daerahSet.forEach(daerah => {
        const opt = document.createElement('option');
        opt.value = daerah;
        opt.textContent = daerah;
        selectDaerah.appendChild(opt);
    });
}

function applyFilter() {
    plotPintuAir();
}

// ============================================================
// PLOT MARKER
// ============================================================
function plotPintuAir() {
    // Hapus marker lama
    pintuMarkers.forEach(m => map.removeLayer(m));
    pintuMarkers = [];

    const daerahFilter = document.getElementById('filterDaerah')?.value || 'ALL';
    const jenisFilter = document.getElementById('filterJenis')?.value || 'ALL';

    const filtered = pintuAirData.filter(item => {
        const matchDaerah = daerahFilter === 'ALL' || item.nama_daerah === daerahFilter;
        const matchJenis = jenisFilter === 'ALL' || item.jenis_pintu === jenisFilter;
        return matchDaerah && matchJenis;
    });

    let baik = 0,
        rusak = 0;

    filtered.forEach(item => {
        const [lat, lng] = item.koordinat;
        let color = '#10b981';
        if (item.kondisi_daun_pintu.includes('Rusak Berat') || item.kondisi_drat_stang === 'Rusak') {
            color = '#ef4444';
            rusak++;
        } else if (item.kondisi_daun_pintu.includes('Rusak Ringan') || item.kondisi_drat_stang === 'Rusak Ringan') {
            color = '#f59e0b';
            rusak++;
        } else {
            baik++;
        }

        const iconHtml =
            `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;">${item.jenis_pintu === 'Pintu Air' ? '💧' : item.jenis_pintu === 'Pintu Pembagi' ? '🔧' : '⚙️'}</div>`;

        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: iconHtml,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            })
        }).addTo(map);

        marker.bindPopup(`
            <b>${item.nama_saluran}</b><br>
            <small>${item.nama_daerah}</small>
            <hr>
            <table>
                <tr><td>ID</td><td>${item.id}</td></tr>
                <tr><td>Petugas</td><td>${item.nama_petugas}</td></tr>
                <tr><td>Jenis</td><td>${item.jenis_pintu}</td></tr>
                <tr><td>Nomenklatur</td><td>${item.nomenklatur}</td></tr>
                <tr><td>H1</td><td>${item.h1}m</td></tr>
                <tr><td>H</td><td>${item.h}m</td></tr>
                <tr><td>B</td><td>${item.b}m</td></tr>
                <tr><td>t</td><td>${item.t}m</td></tr>
                <tr><td>Daun Pintu</td><td>${item.kondisi_daun_pintu}</td></tr>
                <tr><td>Drat Stang</td><td>${item.kondisi_drat_stang}</td></tr>
                <tr><td>Rangka</td><td>${item.kondisi_rangka}</td></tr>
                <tr><td>Keterangan</td><td>${item.keterangan}</td></tr>
            </table>
            ${item.url_foto ? `<img src="${item.url_foto}" style="max-width:100%;border-radius:8px;margin-top:8px;">` : ''}
            <br><small>📅 ${item.timestamp}</small>
        `, { maxWidth: 280, className: 'custom-popup' });

        pintuMarkers.push(marker);
    });

    document.getElementById('totalPintu').textContent = filtered.length;
    document.getElementById('baikCount').textContent = baik;
    document.getElementById('rusakCount').textContent = rusak;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================================
// FIT TO MARKERS
// ============================================================
function fitToMarkers() {
    if (pintuMarkers.length === 0) return;
    const group = L.featureGroup(pintuMarkers);
    map.fitBounds(group.getBounds().pad(0.15));
}

// ============================================================
// LOAD DATA DARI SPREADSHEET (CONTOH)
// ============================================================
async function loadPintuAirFromSpreadsheet() {
    try {
        const response = await fetch('https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getPintuAir');
        const data = await response.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            pintuAirData = data.data;
            populateFilters();
            plotPintuAir();
        }
    } catch (e) {
        console.warn('Gagal memuat data pintu air, pakai data statis:', e);
    }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initMap();
});
