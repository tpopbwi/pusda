// ============================================================
// SW.JS - v2.0 (Push Notifications + Badge)
// ============================================================

const CACHE_NAME = 'pusda-presensi-v2';
const NOTIF_CACHE = 'pusda-notif-state';

const ASSETS_TO_CACHE = [
    './',
    './presensi.html',
    './profile_raport.html',
    './css/presensi.css',
    './css/profile_raport.css',
    './js/presensi.js',
    './js/profile_raport.js',
    './assets/logo.png',
    'https://unpkg.com/lucide@latest',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ============================================================
// INSTALL EVENT - Cache Core Assets
// ============================================================
self.addEventListener('install', (event) => {
    console.log('🔧 SW: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 SW: Caching core assets');
                return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                    console.warn('⚠️ SW: Some assets failed to cache:', err);
                    return Promise.resolve();
                });
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================================
// ACTIVATE EVENT - Clean Old Caches
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('✅ SW: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH EVENT - Cache First Strategy
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip API calls (always network)
    if (request.url.includes('script.google.com') || 
        request.url.includes('script.googleusercontent.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) {
                    // Return cache, but update in background
                    fetch(request).then(response => {
                        if (response && response.status === 200) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, response);
                            });
                        }
                    }).catch(() => {});
                    return cached;
                }
                
                return fetch(request).then(response => {
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    
                    // Cache successful responses
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                    
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback
                if (request.mode === 'navigate') {
                    return caches.match('./presensi.html');
                }
            })
    );
});

// ============================================================
// MESSAGE EVENT - Communication with Main Thread
// ============================================================
self.addEventListener('message', (event) => {
    if (!event.data) return;
    
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'SCHEDULE_NOTIFICATION':
            handleScheduleNotification(payload);
            break;
            
        case 'UPDATE_BADGE':
            updateBadge(payload.count || 0);
            break;
            
        case 'CLEAR_BADGE':
            clearBadge();
            break;
            
        case 'CANCEL_NOTIFICATIONS':
            cancelAllScheduled();
            break;
    }
});

// ============================================================
// NOTIFICATION CLICK - Open App
// ============================================================
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 SW: Notification clicked:', event.notification.tag);
    event.notification.close();
    
    const targetUrl = event.notification.data?.url || './presensi.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('presensi.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});

// ============================================================
// SCHEDULED NOTIFICATIONS HANDLER
// ============================================================
async function handleScheduleNotification(payload) {
    const { type, time, data } = payload;
    
    try {
        // Show notification immediately if time is now
        if (time === 'now') {
            await showNotification(type, data);
            return;
        }
        
        // Schedule for specific time
        const now = new Date();
        const targetTime = new Date(time);
        const delay = targetTime.getTime() - now.getTime();
        
        if (delay > 0 && delay < 86400000) { // Max 24 hours
            setTimeout(async () => {
                await showNotification(type, data);
            }, delay);
        }
    } catch (err) {
        console.warn('⚠️ SW: Schedule notification failed:', err);
    }
}

async function showNotification(type, data = {}) {
    const configs = {
        morning: {
            title: '☀️ Selamat Pagi!',
            body: 'Jangan lupa absen HADIR hari ini. Semangat bekerja!',
            icon: './assets/logo.png',
            badge: './assets/logo.png',
            tag: 'morning-reminder',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            data: { url: './presensi.html', action: 'hadir' }
        },
        afternoon: {
            title: '🌙 Waktunya Pulang',
            body: 'Jangan lupa absen PULANG sebelum meninggalkan kantor.',
            icon: './assets/logo.png',
            badge: './assets/logo.png',
            tag: 'afternoon-reminder',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            data: { url: './presensi.html', action: 'pulang' }
        },
        warning: {
            title: '⚠️ Peringatan',
            body: 'Anda belum absen PULANG hari ini! Segera lakukan absensi.',
            icon: './assets/logo.png',
            badge: './assets/logo.png',
            tag: 'late-warning',
            vibrate: [300, 100, 300, 100, 300],
            requireInteraction: true,
            data: { url: './presensi.html', action: 'pulang' }
        },
        success: {
            title: '✅ Presensi Berhasil',
            body: data.message || 'Presensi Anda telah tercatat.',
            icon: './assets/logo.png',
            badge: './assets/logo.png',
            tag: 'success-' + Date.now(),
            vibrate: [100],
            requireInteraction: false,
            data: { url: './profile_raport.html' }
        }
    };
    
    const config = configs[type];
    if (!config) return;
    
    try {
        await self.registration.showNotification(config.title, config);
        console.log(`🔔 SW: ${type} notification shown`);
    } catch (err) {
        console.warn('⚠️ SW: Failed to show notification:', err);
    }
}

// ============================================================
// BADGE API
// ============================================================
async function updateBadge(count) {
    try {
        if ('setAppBadge' in self.navigator) {
            if (count > 0) {
                await self.navigator.setAppBadge(count);
                console.log(`🔢 SW: Badge set to ${count}`);
            } else {
                await self.navigator.clearAppBadge();
                console.log('🔢 SW: Badge cleared');
            }
        }
    } catch (err) {
        console.warn('⚠️ SW: Badge API not supported:', err);
    }
}

async function clearBadge() {
    try {
        if ('clearAppBadge' in self.navigator) {
            await self.navigator.clearAppBadge();
            console.log('🔢 SW: Badge cleared');
        }
    } catch (err) {
        console.warn('⚠️ SW: Clear badge failed:', err);
    }
}

function cancelAllScheduled() {
    // Clear all scheduled notifications
    self.registration.getNotifications().then(notifications => {
        notifications.forEach(n => n.close());
    });
    clearBadge();
}

console.log('🚀 SW: Service Worker v2.0 loaded');
