/* ============================================================
   WEATHER.CSS - WEATHER CENTER (TEMA UPT PUSDA)
   ============================================================ */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --bg-dark: #0d1b3e;
    --bg-card: rgba(15, 32, 77, 0.85);
    --border: rgba(255, 255, 255, 0.12);
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --info: #3b82f6;
    --toska: #2dd4bf;
    --text: #f8fafc;
    --text-muted: rgba(255, 255, 255, 0.6);
    --radius: 16px;
    --shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: radial-gradient(circle at top right, #1e40af, #0d1b3e 85%);
    color: var(--text);
    min-height: 100vh;
    padding: 12px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
}

.weather-container {
    max-width: 720px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

/* Header */
.weather-header {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.weather-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.weather-title {
    font-size: 1.1rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
}
.weather-title i {
    color: var(--toska);
}

.location-selector {
    display: flex;
    align-items: center;
    gap: 6px;
}
.location-selector select {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.4);
    color: white;
    font-size: 0.8rem;
    cursor: pointer;
    min-height: 36px;
}
.location-selector select option {
    background: #0d1b3e;
}

.refresh-btn {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, var(--info), #1e40af);
    color: white;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
    min-height: 36px;
}
.refresh-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.last-updated {
    font-size: 0.7rem;
    color: var(--text-muted);
}

/* Tabs */
.weather-tabs {
    display: flex;
    gap: 6px;
    background: rgba(0, 0, 0, 0.25);
    padding: 6px;
    border-radius: 10px;
    overflow-x: auto;
    flex-wrap: nowrap;
}

.weather-tab {
    padding: 8px 14px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-weight: 700;
    font-size: 0.7rem;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
    min-height: 36px;
}
.weather-tab i {
    font-size: 14px;
}
.weather-tab.active {
    background: var(--info);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}
.weather-tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
    color: white;
}

/* Tab Content */
.tab-content {
    display: none;
    animation: fadeIn 0.25s ease-out;
}
.tab-content.active {
    display: block;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(6px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Current Weather */
.current-weather {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 16px;
}

.current-main {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 18px;
    flex-wrap: wrap;
}

.current-icon {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.3));
}

.current-info {
    flex: 1;
    min-width: 140px;
}
.current-temp {
    font-size: 3rem;
    font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1;
    margin-bottom: 4px;
}
.current-desc {
    font-size: 1rem;
    color: var(--text-muted);
    text-transform: capitalize;
    margin-bottom: 4px;
}
.current-feels {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.current-details {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

.detail-item {
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    padding: 12px 8px;
    text-align: center;
}
.detail-icon {
    font-size: 1.2rem;
    margin-bottom: 4px;
}
.detail-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
}
.detail-label {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-top: 2px;
}

/* Hourly */
.hourly-forecast,
.daily-forecast,
.weather-alerts,
.suggestions-panel {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 16px;
}

.section-title {
    font-size: 0.95rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
}
.section-title i {
    color: var(--toska);
}

.hourly-scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
}
.hourly-scroll::-webkit-scrollbar {
    height: 4px;
}
.hourly-scroll::-webkit-scrollbar-thumb {
    background: var(--info);
    border-radius: 4px;
}

.hourly-item {
    min-width: 70px;
    padding: 12px 8px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    text-align: center;
    transition: 0.2s;
    cursor: default;
}
.hourly-item.now {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(45, 212, 191, 0.2));
    border: 1px solid var(--info);
}
.hourly-time {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin-bottom: 4px;
}
.hourly-icon {
    width: 32px;
    height: 32px;
    margin: 0 auto 4px;
}
.hourly-temp {
    font-size: 0.9rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
}
.hourly-rain {
    font-size: 0.6rem;
    color: var(--info);
    margin-top: 2px;
}

/* Daily */
.daily-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.daily-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 10px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    transition: 0.2s;
}
.daily-item:hover {
    background: rgba(59, 130, 246, 0.15);
    transform: translateX(4px);
}
.daily-day {
    min-width: 80px;
    font-weight: 700;
    font-size: 0.8rem;
}
.daily-date {
    font-size: 0.65rem;
    color: var(--text-muted);
}
.daily-icon {
    width: 32px;
    height: 32px;
}
.daily-desc {
    flex: 1;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: capitalize;
}
.daily-temps {
    display: flex;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
}
.temp-max {
    color: var(--warning);
    font-weight: 700;
}
.temp-min {
    color: var(--info);
    opacity: 0.7;
}
.daily-rain {
    font-size: 0.7rem;
    color: var(--info);
    min-width: 50px;
    text-align: right;
}

/* Alerts */
.alert-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    margin-bottom: 8px;
    border-left: 4px solid;
    background: rgba(0, 0, 0, 0.2);
}
.alert-item.danger {
    border-color: var(--danger);
}
.alert-item.warning {
    border-color: var(--warning);
}
.alert-item.info {
    border-color: var(--info);
}
.alert-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
}
.alert-title {
    font-weight: 700;
    font-size: 0.85rem;
}
.alert-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
}

.no-alerts {
    text-align: center;
    padding: 30px;
    color: var(--text-muted);
}
.no-alerts-icon {
    font-size: 2.5rem;
    margin-bottom: 10px;
    opacity: 0.5;
}

/* Suggestions */
.suggestion-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    margin-bottom: 8px;
}
.suggestion-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
}
.suggestion-icon.outdoor {
    background: rgba(16, 185, 129, 0.2);
}
.suggestion-icon.indoor {
    background: rgba(59, 130, 246, 0.2);
}
.suggestion-icon.caution {
    background: rgba(245, 158, 11, 0.2);
}
.suggestion-icon.danger {
    background: rgba(239, 68, 68, 0.2);
}

.suggestion-content {
    flex: 1;
}
.suggestion-title {
    font-weight: 700;
    font-size: 0.85rem;
}
.suggestion-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
}

/* Loading & Error */
.loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 12px;
}
.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(59, 130, 246, 0.2);
    border-top-color: var(--info);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.error-container {
    text-align: center;
    padding: 40px;
}
.error-icon {
    font-size: 3rem;
    margin-bottom: 12px;
}
.error-message {
    font-size: 1rem;
    margin-bottom: 16px;
}
.retry-btn {
    padding: 10px 24px;
    border-radius: 10px;
    border: none;
    background: var(--info);
    color: white;
    cursor: pointer;
    font-weight: 700;
}

/* Responsive */
@media (max-width: 600px) {
    body {
        padding: 8px;
    }
    .weather-container {
        gap: 10px;
    }
    .weather-header {
        padding: 12px 14px;
    }
    .weather-title {
        font-size: 0.95rem;
    }
    .current-main {
        gap: 12px;
    }
    .current-temp {
        font-size: 2.4rem;
    }
    .current-icon {
        width: 64px;
        height: 64px;
    }
    .current-details {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }
    .hourly-item {
        min-width: 60px;
        padding: 8px 6px;
    }
    .daily-day {
        min-width: 60px;
        font-size: 0.7rem;
    }
    .daily-temps {
        font-size: 0.7rem;
    }
    .weather-tab {
        font-size: 0.65rem;
        padding: 6px 10px;
    }
    .weather-tab i {
        font-size: 12px;
    }
    .location-selector select {
        font-size: 0.7rem;
        padding: 4px 8px;
    }
    .refresh-btn {
        font-size: 0.65rem;
        padding: 4px 10px;
    }
}

@media (max-width: 400px) {
    .current-details {
        grid-template-columns: 1fr 1fr;
    }
    .daily-item {
        flex-wrap: wrap;
        gap: 6px;
    }
    .daily-day {
        min-width: 100%;
    }
}
