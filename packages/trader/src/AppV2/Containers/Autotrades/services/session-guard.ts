/**
 * SessionGuardService
 *
 * Keeps the autotrade session alive during 24-hour trading runs by:
 * 1. WebSocket Heartbeat       — pings the WS every 30s to prevent idle disconnect
 * 2. Page Visibility Watcher   — detects tab hidden/restored, pauses/resumes
 * 3. Web Wake Lock             — prevents device screen from sleeping (where supported)
 * 4. WS Reconnect Watcher      — detects WS going dead and triggers a reconnect
 * 5. Anti-Throttle Ticker      — keeps setInterval/setTimeout from being throttled
 *    in background tabs by using a no-op AudioContext ping
 * 6. Activity Simulation       — dispatches a fake mousemove every 5 min to
 *    prevent browser idle-tab suspension
 */

import { WS } from '@deriv/shared';

type TGuardEvent = 'ws_dead' | 'tab_hidden' | 'tab_visible' | 'reconnected' | 'wakelock_fail';
type TGuardListener = (event: TGuardEvent, detail?: string) => void;

class SessionGuardService {
    private isActive = false;
    private listeners: TGuardListener[] = [];

    // Timers
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private activityTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setInterval> | null = null;

    // WakeLock handle
    private wakeLock: WakeLockSentinel | null = null;

    // AudioContext for anti-throttle
    private audioCtx: AudioContext | null = null;

    // Tracks last WS ping success
    private lastPingSuccess: number = Date.now();
    private readonly PING_INTERVAL_MS = 30_000; // 30 seconds
    private readonly MAX_SILENCE_MS = 90_000; // 90 seconds = WS is dead
    private readonly ACTIVITY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    public subscribe(listener: TGuardListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public start() {
        if (this.isActive) return;
        this.isActive = true;

        this.startHeartbeat();
        this.startVisibilityWatcher();
        this.startWakeLock();
        this.startAntiThrottle();
        this.startActivitySimulation();
        this.startReconnectWatcher();

        // eslint-disable-next-line no-console
        console.log('[SessionGuard] Started — protecting 24h session');
    }

    public stop() {
        this.isActive = false;

        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.activityTimer) clearInterval(this.activityTimer);
        if (this.reconnectTimer) clearInterval(this.reconnectTimer);

        this.heartbeatTimer = null;
        this.activityTimer = null;
        this.reconnectTimer = null;

        this.releaseWakeLock();
        this.stopAntiThrottle();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // eslint-disable-next-line no-console
        console.log('[SessionGuard] Stopped');
    }

    // ---------------------------------------------------------------
    // 1. WebSocket Heartbeat
    // ---------------------------------------------------------------
    private startHeartbeat() {
        this.lastPingSuccess = Date.now();

        this.heartbeatTimer = setInterval(async () => {
            if (!this.isActive) return;
            try {
                if (!WS || typeof WS.send !== 'function') return;
                // Send a lightweight ping (time request — minimal overhead)
                const res = await WS.send({ time: 1 });
                if (res && res.time) {
                    this.lastPingSuccess = Date.now();
                }
            } catch (_e) {
                // Silent — reconnect watcher handles dead detection
            }
        }, this.PING_INTERVAL_MS);
    }

    // ---------------------------------------------------------------
    // 2. WS Reconnect Watcher — detects when WS goes silent
    // ---------------------------------------------------------------
    private startReconnectWatcher() {
        this.reconnectTimer = setInterval(() => {
            if (!this.isActive) return;
            const silenceDuration = Date.now() - this.lastPingSuccess;
            if (silenceDuration > this.MAX_SILENCE_MS) {
                // eslint-disable-next-line no-console
                console.warn('[SessionGuard] WS silent for', Math.round(silenceDuration / 1000), 's — triggering reconnect');
                this.emit('ws_dead', `Silent for ${Math.round(silenceDuration / 1000)}s`);

                // Force page reload to reconnect everything cleanly
                // (Deriv WS reconnects on page load automatically)
                // Give 3 second grace before reload to allow user to see toast
                setTimeout(() => {
                    if (this.isActive) {
                        window.location.reload();
                    }
                }, 3000);
            }
        }, 15_000); // Check every 15 seconds
    }

    // ---------------------------------------------------------------
    // 3. Page Visibility Watcher
    // ---------------------------------------------------------------
    private handleVisibilityChange = () => {
        if (document.hidden) {
            this.emit('tab_hidden');
            // eslint-disable-next-line no-console
            console.log('[SessionGuard] Tab hidden — heartbeat continues');
        } else {
            this.emit('tab_visible');
            this.lastPingSuccess = Date.now(); // Reset timer on tab focus
            // Re-acquire wake lock when tab regains focus (may have been released)
            this.startWakeLock();
            // eslint-disable-next-line no-console
            console.log('[SessionGuard] Tab visible again');
        }
    };

    private startVisibilityWatcher() {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // ---------------------------------------------------------------
    // 4. Web Wake Lock — prevents screen/CPU sleep
    // ---------------------------------------------------------------
    private async startWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    // Re-acquire if still active (system may release on tab hide)
                    if (this.isActive && !document.hidden) {
                        this.startWakeLock();
                    }
                });
                // eslint-disable-next-line no-console
                console.log('[SessionGuard] Wake Lock acquired');
            } else {
                this.emit('wakelock_fail', 'API not supported in this browser');
            }
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.warn('[SessionGuard] Wake Lock failed:', err.message);
            this.emit('wakelock_fail', err.message);
        }
    }

    private releaseWakeLock() {
        if (this.wakeLock) {
            try {
                this.wakeLock.release();
            } catch (_e) {
                // ignore
            }
            this.wakeLock = null;
        }
    }

    // ---------------------------------------------------------------
    // 5. Anti-Throttle via AudioContext
    //    Browsers throttle background tabs (reduce timer resolution to 1s+).
    //    A running AudioContext prevents most of this throttling.
    // ---------------------------------------------------------------
    private startAntiThrottle() {
        try {
            const AudioContextClass =
                window.AudioContext ||
                (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            this.audioCtx = new AudioContextClass();

            // Create a silent oscillator — just keeps AudioContext "running"
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime); // Silent
            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            oscillator.start();

            // eslint-disable-next-line no-console
            console.log('[SessionGuard] Anti-throttle AudioContext running');
        } catch (_e) {
            // Silently fail — not all browsers allow autoplay AudioContext
        }
    }

    private stopAntiThrottle() {
        try {
            if (this.audioCtx) {
                this.audioCtx.close();
                this.audioCtx = null;
            }
        } catch (_e) {
            // ignore
        }
    }

    // ---------------------------------------------------------------
    // 6. Activity Simulation
    //    Dispatches fake mousemove every 5 minutes to prevent
    //    browser "idle" detection and tab suspension on some browsers.
    // ---------------------------------------------------------------
    private startActivitySimulation() {
        this.activityTimer = setInterval(() => {
            if (!this.isActive) return;
            try {
                const evt = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    clientX: Math.floor(Math.random() * 10),
                    clientY: Math.floor(Math.random() * 10),
                });
                document.dispatchEvent(evt);
            } catch (_e) {
                // ignore
            }
        }, this.ACTIVITY_INTERVAL_MS);
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------
    private emit(event: TGuardEvent, detail?: string) {
        this.listeners.forEach(l => {
            try {
                l(event, detail);
            } catch (_e) {
                // listener error
            }
        });
    }
}

export const sessionGuard = new SessionGuardService();
