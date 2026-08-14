// ============================================================
// FLOATING WINDOW MANAGER - v2 (DENGAN BLUR & HP ADJUSTMENT)
// ============================================================

class FloatingWindowManager {
    constructor() {
        this.windows = new Map();
        this.zIndexCounter = 9000;
        this.activeWindow = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        this.blurActive = false;
    }

    // ============================================================
    // BLUR HALAMAN UTAMA
    // ============================================================
    toggleBlur(enable) {
        if (enable && !this.blurActive) {
            document.body.classList.add('floating-active');
            this.blurActive = true;
        } else if (!enable && this.blurActive) {
            document.body.classList.remove('floating-active');
            this.blurActive = false;
        }
    }

    // ============================================================
    // CREATE WINDOW
    // ============================================================
    createWindow(id, title, icon, url, options = {}) {
        const {
            width = 800,
            height = 600,
            x = null,
            y = null,
            resizable = true,
            minimizable = true,
            maximizable = true
        } = options;

        if (this.windows.has(id)) {
            this.focusWindow(id);
            return;
        }

        // Hitung posisi (center jika tidak ada)
        const posX = x ?? (window.innerWidth - width) / 2;
        const posY = y ?? (window.innerHeight - height) / 2;

        // Buat elemen window
        const windowEl = document.createElement('div');
        windowEl.className = 'floating-window';
        windowEl.id = `floating-${id}`;
        windowEl.style.width = `${width}px`;
        windowEl.style.height = `${height}px`;
        windowEl.style.left = `${posX}px`;
        windowEl.style.top = `${posY}px`;
        windowEl.style.zIndex = ++this.zIndexCounter;

        // Cek apakah di HP, sesuaikan ukuran
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            windowEl.style.width = '92vw';
            windowEl.style.height = '70vh';
            windowEl.style.top = '8vh';
            windowEl.style.left = '4vw';
        }

        windowEl.innerHTML = `
            <div class="floating-header">
                <div class="floating-title">
                    <i data-lucide="${icon}" size="18"></i>
                    <span>${title}</span>
                </div>
                <div class="floating-controls">
                    ${minimizable ? '<button class="floating-btn minimize" title="Minimize"><i data-lucide="minus" size="14"></i></button>' : ''}
                    ${maximizable ? '<button class="floating-btn maximize" title="Maximize"><i data-lucide="maximize" size="14"></i></button>' : ''}
                    <button class="floating-btn close" title="Close"><i data-lucide="x" size="14"></i></button>
                </div>
            </div>
            <div class="floating-body">
                <div class="floating-loading">
                    <div class="spinner"></div>
                    <span>Memuat ${title}...</span>
                </div>
                <iframe src="${url}" frameborder="0" allow="geolocation"></iframe>
            </div>
            ${resizable ? '<div class="floating-resize"></div>' : ''}
        `;

        document.body.appendChild(windowEl);

        // Aktifkan blur pada halaman utama
        this.toggleBlur(true);

        // Inisialisasi Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Simpan data
        this.windows.set(id, {
            element: windowEl,
            iframe: windowEl.querySelector('iframe'),
            title: title,
            url: url,
            options: options,
            isMinimized: false,
            isMaximized: false
        });

        // Setup event
        this.setupWindowEvents(id);

        // Tampilkan
        requestAnimationFrame(() => {
            windowEl.classList.add('active');
            this.focusWindow(id);
        });

        return id;
    }

    // ============================================================
    // SETUP EVENTS
    // ============================================================
    setupWindowEvents(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        const windowEl = windowData.element;
        const header = windowEl.querySelector('.floating-header');
        const closeBtn = windowEl.querySelector('.floating-btn.close');
        const minimizeBtn = windowEl.querySelector('.floating-btn.minimize');
        const maximizeBtn = windowEl.querySelector('.floating-btn.maximize');
        const resizeHandle = windowEl.querySelector('.floating-resize');
        const iframe = windowEl.querySelector('iframe');

        // Focus on click
        windowEl.addEventListener('mousedown', () => this.focusWindow(id));
        windowEl.addEventListener('touchstart', () => this.focusWindow(id));

        // Close
        closeBtn?.addEventListener('click', () => this.closeWindow(id));

        // Minimize
        minimizeBtn?.addEventListener('click', () => this.toggleMinimize(id));

        // Maximize
        maximizeBtn?.addEventListener('click', () => this.toggleMaximize(id));

        // Drag
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.floating-btn')) return;
            this.startDrag(e, id);
        });

        // Resize
        resizeHandle?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startResize(e, id);
        });

        // Iframe load
        iframe.addEventListener('load', () => {
            const loading = windowEl.querySelector('.floating-loading');
            if (loading) loading.style.display = 'none';
            this.setupIframeCommunication(id);
        });
    }

    // ============================================================
    // DRAG
    // ============================================================
    startDrag(e, id) {
        const windowData = this.windows.get(id);
        if (!windowData || windowData.isMaximized) return;

        this.isDragging = true;
        this.activeWindow = id;

        const rect = windowData.element.getBoundingClientRect();
        const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
        const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;

        const onMove = (ev) => {
            if (!this.isDragging) return;
            const cx = ev.clientX || ev.touches?.[0]?.clientX || 0;
            const cy = ev.clientY || ev.touches?.[0]?.clientY || 0;

            const newX = cx - this.dragOffset.x;
            const newY = cy - this.dragOffset.y;

            const maxX = window.innerWidth - windowData.element.offsetWidth;
            const maxY = window.innerHeight - windowData.element.offsetHeight;

            windowData.element.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            windowData.element.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
        };

        const onUp = () => {
            this.isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onUp, { passive: true });
    }

    // ============================================================
    // RESIZE
    // ============================================================
    startResize(e, id) {
        const windowData = this.windows.get(id);
        if (!windowData || windowData.isMaximized) return;

        this.isResizing = true;
        this.activeWindow = id;
        const rect = windowData.element.getBoundingClientRect();

        this.resizeStart = {
            x: e.clientX || e.touches?.[0]?.clientX || 0,
            y: e.clientY || e.touches?.[0]?.clientY || 0,
            width: rect.width,
            height: rect.height
        };

        const onMove = (ev) => {
            if (!this.isResizing) return;
            const cx = ev.clientX || ev.touches?.[0]?.clientX || 0;
            const cy = ev.clientY || ev.touches?.[0]?.clientY || 0;

            const newWidth = Math.max(400, this.resizeStart.width + (cx - this.resizeStart.x));
            const newHeight = Math.max(300, this.resizeStart.height + (cy - this.resizeStart.y));

            windowData.element.style.width = `${Math.min(newWidth, window.innerWidth)}px`;
            windowData.element.style.height = `${Math.min(newHeight, window.innerHeight)}px`;
        };

        const onUp = () => {
            this.isResizing = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onUp, { passive: true });
    }

    // ============================================================
    // FOCUS
    // ============================================================
    focusWindow(id) {
        if (!this.windows.has(id)) return;

        this.windows.forEach((win, winId) => {
            if (winId !== id) {
                win.element.style.zIndex = parseInt(win.element.style.zIndex) - 1;
            }
        });

        this.windows.get(id).element.style.zIndex = ++this.zIndexCounter;
        this.activeWindow = id;
    }

    // ============================================================
    // MINIMIZE / MAXIMIZE
    // ============================================================
    toggleMinimize(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.isMinimized = !windowData.isMinimized;
        windowData.element.classList.toggle('minimized', windowData.isMinimized);

        const icon = windowData.element.querySelector('.floating-btn.minimize i');
        if (icon) {
            icon.setAttribute('data-lucide', windowData.isMinimized ? 'maximize' : 'minus');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    toggleMaximize(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.isMaximized = !windowData.isMaximized;
        windowData.element.classList.toggle('maximized', windowData.isMaximized);

        const icon = windowData.element.querySelector('.floating-btn.maximize i');
        if (icon) {
            icon.setAttribute('data-lucide', windowData.isMaximized ? 'minimize' : 'maximize');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    // ============================================================
    // CLOSE
    // ============================================================
    closeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.classList.remove('active');
        setTimeout(() => {
            windowData.element.remove();
            this.windows.delete(id);
            if (this.windows.size === 0) {
                this.toggleBlur(false);
            }
        }, 300);
    }

    // ============================================================
    // COMMUNICATION
    // ============================================================
    sendMessage(id, data) {
        const windowData = this.windows.get(id);
        if (!windowData || !windowData.iframe.contentWindow) return;

        windowData.iframe.contentWindow.postMessage({
            type: 'FLOATING_WINDOW_MESSAGE',
            windowId: id,
            data: data
        }, '*');
    }

    setupIframeCommunication(id) {
        const handler = (event) => {
            const { type, data } = event.data;
            if (type === 'FLOATING_WINDOW_REQUEST') {
                this.handleIframeRequest(id, data);
            }
        };
        window.addEventListener('message', handler);
        // Simpan handler untuk cleanup jika diperlukan
        this._messageHandlers = this._messageHandlers || {};
        this._messageHandlers[id] = handler;
    }

    handleIframeRequest(id, data) {
        switch (data.action) {
            case 'close':
                this.closeWindow(id);
                break;
            case 'minimize':
                this.toggleMinimize(id);
                break;
            case 'maximize':
                this.toggleMaximize(id);
                break;
            case 'resize':
                const windowData = this.windows.get(id);
                if (windowData && data.width && data.height) {
                    windowData.element.style.width = `${data.width}px`;
                    windowData.element.style.height = `${data.height}px`;
                }
                break;
            case 'sendData':
                window.dispatchEvent(new CustomEvent('floatingData', {
                    detail: { windowId: id, data: data.payload }
                }));
                break;
            case 'getData':
                // Kirim data dari localStorage ke iframe
                const cached = localStorage.getItem('wilayah_presensi_' + new Date().toISOString().split('T')[0]);
                if (cached) {
                    this.sendMessage(id, { key: 'presensi', value: JSON.parse(cached) });
                }
                break;
        }
    }

    // ============================================================
    // GET ALL WINDOWS
    // ============================================================
    getWindows() {
        return Array.from(this.windows.entries()).map(([id, win]) => ({
            id,
            title: win.title,
            isMinimized: win.isMinimized,
            isMaximized: win.isMaximized
        }));
    }
}

// ============================================================
// GLOBAL INSTANCE & HELPER
// ============================================================
const floatingManager = new FloatingWindowManager();

function openMaps() {
    floatingManager.createWindow('maps', 'Peta Eksploitasi', 'map', 'maps.html', {
        width: 900,
        height: 650,
        resizable: true
    });
}

function openWeather() {
    floatingManager.createWindow('weather', 'Weather Center', 'cloud-sun', 'weather.html', {
        width: 850,
        height: 750,
        resizable: true
    });
}

function openSignal() {
    floatingManager.createWindow('signal', 'Signal Validator', 'signal', 'signal.html', {
        width: 700,
        height: 800,
        resizable: true
    });
}
