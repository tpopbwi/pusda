// ============================================================
// WEATHER.JS - WEATHER CENTER (TEMA UPT PUSDA)
// ============================================================

const API_KEY = 'a427dbab5ea52ac024503493f94aaf36';
const CACHE_DURATION = 30 * 60 * 1000;

let currentLocation = { lat: -8.4338918, lng: 114.2217959, name: 'Kantor UPT PUSDA' };
let weatherData = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Tab switching
    document.querySelectorAll('.weather-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.weather-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabName = this.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-' + tabName).classList.add('active');
        });
    });

    loadWeatherData();
});

// ============================================================
// LOAD DATA
// ============================================================
function loadWeatherData() {
    showLoading();
    const cached = localStorage.getItem('weather_cache_' + currentLocation.lat);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            weatherData = data;
            renderAll();
            return;
        }
    }

    fetchWeatherFromAPI();
}

async function fetchWeatherFromAPI() {
    try {
        const currentRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${currentLocation.lat}&lon=${currentLocation.lng}&appid=${API_KEY}&units=metric&lang=id`
        );
        if (!currentRes.ok) throw new Error('API error');
        const currentData = await currentRes.json();

        const forecastRes = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${currentLocation.lat}&lon=${currentLocation.lng}&appid=${API_KEY}&units=metric&lang=id`
        );
        if (!forecastRes.ok) throw new Error('Forecast error');
        const forecastData = await forecastRes.json();

        weatherData = { current: currentData, forecast: forecastData, timestamp: Date.now() };
        localStorage.setItem('weather_cache_' + currentLocation.lat, JSON.stringify({
            data: weatherData,
            timestamp: Date.now()
        }));
        renderAll();
    } catch (err) {
        console.error('Weather fetch error:', err);
        showError('Gagal memuat data cuaca. Periksa koneksi.');
    }
}

// ============================================================
// RENDER
// ============================================================
function renderAll() {
    hideLoading();
    renderCurrentWeather();
    renderHourlyForecast();
    renderDailyForecast();
    renderAlerts();
    renderSuggestions();
    updateLastUpdated();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderCurrentWeather() {
    const d = weatherData.current;
    document.getElementById('currentIcon').src = `https://openweathermap.org/img/wn/${d.weather[0].icon}@4x.png`;
    document.getElementById('currentTemp').textContent = Math.round(d.main.temp) + '°C';
    document.getElementById('currentDesc').textContent = d.weather[0].description;
    document.getElementById('currentFeels').textContent = `Terasa seperti ${Math.round(d.main.feels_like)}°C`;
    document.getElementById('humidity').textContent = d.main.humidity + '%';
    document.getElementById('wind').textContent = (d.wind.speed * 3.6).toFixed(1) + ' km/h';
    document.getElementById('pressure').textContent = d.main.pressure + ' hPa';
    document.getElementById('visibility').textContent = (d.visibility / 1000).toFixed(1) + ' km';
    document.getElementById('sunrise').textContent = formatTime(d.sys.sunrise);
    document.getElementById('sunset').textContent = formatTime(d.sys.sunset);
}

function renderHourlyForecast() {
    const container = document.getElementById('hourlyScroll');
    const items = weatherData.forecast.list.slice(0, 8);
    container.innerHTML = items.map((item, idx) => {
        const time = new Date(item.dt * 1000);
        const hour = time.getHours().toString().padStart(2, '0') + ':00';
        const isNow = idx === 0;
        const rain = Math.round((item.pop || 0) * 100);
        return `
            <div class="hourly-item ${isNow ? 'now' : ''}">
                <div class="hourly-time">${isNow ? 'Sekarang' : hour}</div>
                <img class="hourly-icon" src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="">
                <div class="hourly-temp">${Math.round(item.main.temp)}°</div>
                ${rain > 0 ? `<div class="hourly-rain">💧 ${rain}%</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderDailyForecast() {
    const container = document.getElementById('dailyList');
    const dailyMap = {};
    weatherData.forecast.list.forEach(item => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyMap[date]) dailyMap[date] = { temps: [], icons: [], descs: [], rains: [] };
        dailyMap[date].temps.push(item.main.temp);
        dailyMap[date].icons.push(item.weather[0].icon);
        dailyMap[date].descs.push(item.weather[0].description);
        dailyMap[date].rains.push(item.pop || 0);
    });
    const days = Object.keys(dailyMap).slice(0, 7);
    container.innerHTML = days.map((date, idx) => {
        const data = dailyMap[date];
        const dateObj = new Date(date);
        const dayName = idx === 0 ? 'Hari Ini' : dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const maxT = Math.round(Math.max(...data.temps));
        const minT = Math.round(Math.min(...data.temps));
        const avgRain = Math.round(data.rains.reduce((a, b) => a + b, 0) / data.rains.length * 100);
        const iconCount = {};
        data.icons.forEach(ic => iconCount[ic] = (iconCount[ic] || 0) + 1);
        const mainIcon = Object.keys(iconCount).sort((a, b) => iconCount[b] - iconCount[a])[0];
        const mainDesc = data.descs[0];
        return `
            <div class="daily-item">
                <div class="daily-day">
                    <div>${dayName}</div>
                    <div class="daily-date">${dateStr}</div>
                </div>
                <img class="daily-icon" src="https://openweathermap.org/img/wn/${mainIcon}@2x.png" alt="">
                <div class="daily-desc">${mainDesc}</div>
                <div class="daily-temps">
                    <span class="temp-max">${maxT}°</span>
                    <span class="temp-min">${minT}°</span>
                </div>
                ${avgRain > 0 ? `<div class="daily-rain">💧 ${avgRain}%</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderAlerts() {
    const container = document.getElementById('alertsList');
    const d = weatherData.current;
    const alerts = [];

    if (d.weather[0].main === 'Thunderstorm') {
        alerts.push({ type: 'danger', icon: '⛈️', title: 'Badai Petir', desc: 'Hindari kegiatan outdoor dan cari tempat berlindung aman.' });
    }
    if (d.weather[0].main === 'Rain' && d.rain && d.rain['1h'] > 10) {
        alerts.push({ type: 'danger', icon: '🌧️', title: 'Hujan Deras', desc: `Curah hujan ${d.rain['1h'].toFixed(1)}mm/jam. Risiko banjir.` });
    }
    if (d.wind.speed > 10) {
        alerts.push({ type: 'warning', icon: '💨', title: 'Angin Kencang', desc: `Kecepatan ${(d.wind.speed * 3.6).toFixed(0)} km/h. Hati-hati objek terbang.` });
    }
    if (d.main.temp > 35) {
        alerts.push({ type: 'warning', icon: '🔥', title: 'Suhu Panas', desc: `Suhu ${Math.round(d.main.temp)}°C. Pastikan hidrasi cukup.` });
    }
    if (d.visibility < 1000) {
        alerts.push({ type: 'warning', icon: '🌫️', title: 'Jarak Pandang Rendah', desc: `Jarak pandang ${(d.visibility / 1000).toFixed(1)} km. Hati-hati berkendara.` });
    }

    const next = weatherData.forecast.list.slice(0, 1);
    if (next.some(i => (i.pop || 0) > 0.5) && d.weather[0].main !== 'Rain') {
        alerts.push({ type: 'info', icon: '🌦️', title: 'Hujan Akan Datang', desc: 'Prakiraan hujan dalam 3 jam. Siapkan payung.' });
    }

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="no-alerts">
                <div class="no-alerts-icon">✅</div>
                <div>Tidak ada peringatan cuaca</div>
                <div style="font-size:0.75rem; opacity:0.7; margin-top:6px;">Kondisi aman</div>
            </div>
        `;
    } else {
        container.innerHTML = alerts.map(a => `
            <div class="alert-item ${a.type}">
                <div class="alert-icon">${a.icon}</div>
                <div>
                    <div class="alert-title">${a.title}</div>
                    <div class="alert-desc">${a.desc}</div>
                </div>
            </div>
        `).join('');
    }
}

function renderSuggestions() {
    const container = document.getElementById('suggestionsList');
    const d = weatherData.current;
    const temp = d.main.temp,
        rain = d.weather[0].main === 'Rain',
        wind = d.wind.speed,
        humidity = d.main.humidity;
    const suggestions = [];

    if (!rain && temp >= 20 && temp <= 32 && wind < 8) {
        suggestions.push({ type: 'outdoor', icon: '✅', title: 'Kondisi Ideal Outdoor', desc: 'Cuaca cerah, suhu nyaman. Waktu tepat untuk monitoring lapangan.' });
    }
    if (rain) {
        suggestions.push({ type: 'indoor', icon: '🏢', title: 'Prioritaskan Indoor', desc: 'Hujan berlangsung. Tunda kegiatan lapangan jika memungkinkan.' });
    }
    if (temp > 32) {
        suggestions.push({ type: 'caution', icon: '⏰', title: 'Hindari Jam Terpanas', desc: 'Suhu tinggi. Jadwalkan sebelum 10 pagi atau setelah 3 sore.' });
    }
    if (humidity > 80) {
        suggestions.push({ type: 'caution', icon: '💧', title: 'Kelembaban Tinggi', desc: 'Risiko dehidrasi. Istirahat lebih sering dan minum cukup.' });
    }
    if (wind > 8) {
        suggestions.push({ type: 'caution', icon: '💨', title: 'Perhatikan Angin', desc: 'Angin kencang. Amankan peralatan dan dokumen.' });
    }

    const tomorrow = weatherData.forecast.list.filter(item => {
        const date = new Date(item.dt * 1000);
        const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        return date.toDateString() === tomorrowDate.toDateString();
    });
    if (tomorrow.some(i => (i.pop || 0) > 0.5)) {
        suggestions.push({ type: 'indoor', icon: '📅', title: 'Persiapan Besok', desc: 'Prakiraan hujan besok. Siapkan rencana alternatif.' });
    }
    suggestions.push({ type: 'outdoor', icon: '📱', title: 'Tips Presensi Lapangan', desc: 'Pastikan sinyal cukup, GPS akurat, dan foto dengan pencahayaan baik.' });

    container.innerHTML = suggestions.map(s => `
        <div class="suggestion-item">
            <div class="suggestion-icon ${s.type}">${s.icon}</div>
            <div class="suggestion-content">
                <div class="suggestion-title">${s.title}</div>
                <div class="suggestion-desc">${s.desc}</div>
            </div>
        </div>
    `).join('');
}

// ============================================================
// HELPER
// ============================================================
function formatTime(ts) {
    return new Date(ts * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function updateLastUpdated() {
    document.getElementById('lastUpdated').textContent =
        'Terakhir diperbarui: ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function showLoading() {
    document.getElementById('loadingContainer').style.display = 'flex';
    document.getElementById('errorContainer').style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
}

function hideLoading() {
    document.getElementById('loadingContainer').style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = '');
}

function showError(msg) {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorMessage').textContent = msg;
}

function changeLocation() {
    const select = document.getElementById('locationSelect');
    const [lat, lng] = select.value.split(',').map(Number);
    const name = select.options[select.selectedIndex].text;
    currentLocation = { lat, lng, name };
    loadWeatherData();
}

function refreshWeather() {
    localStorage.removeItem('weather_cache_' + currentLocation.lat);
    loadWeatherData();
}

// Kirim ke parent (floating)
function sendToParent() {
    if (window.parent !== window && weatherData) {
        const d = weatherData.current;
        window.parent.postMessage({
            type: 'FLOATING_WINDOW_REQUEST',
            data: {
                action: 'sendData',
                payload: {
                    type: 'weatherReport',
                    temp: Math.round(d.main.temp),
                    condition: d.weather[0].main,
                    description: d.weather[0].description,
                    humidity: d.main.humidity,
                    windSpeed: d.wind.speed,
                    location: currentLocation.name,
                    timestamp: new Date().toISOString()
                }
            }
        }, '*');
        alert('✅ Data cuaca dikirim ke dashboard!');
    }
}
