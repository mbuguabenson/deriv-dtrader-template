/**
 * KeepAliveService — 24-Hour Session Guardian
 *
 * Prevents WebSocket disconnections, browser tab throttling,
 * and device sleep during long-running autotrade sessions.
 *
 * Strategies used:
 *  1. WS Heartbeat (ping every 25s)        — prevents idle disconnect
 *  2. Page Visibility Handler              — immediate ping on tab refocus
 *  3. Web Wake Lock API                    — prevents screen/CPU sleep
 *  4. Silent AudioContext                  — prevents timer throttling in BG tabs
 *  5. Activity Simulation (mousemove 5min) — prevents browser idle detection
 *  6. Dead WS Detector (90s silence)       — triggers clean page reload if WS freezes
 */

import { WS } from '@deriv/shared';

type TKeepAliveEvent = 'ws_dead' | 'tab_hidden' | 'tab_visible' | 'wakelock_fail' | 'reconnecting';
type TKeepAliveListener = (event: TKeepAliveEvent, detail?: string) => void;

class KeepAliveService {
    private isRunning = false;
    private listeners: TKeepAliveListener[] = [];

    // Intervals/timers
    private pingInterval: ReturnType<typeof setInterval> | null = null;
    private activityInterval: ReturnType<typeof setInterval> | null = null;
    private deadDetectorInterval: ReturnType<typeof setInterval> | null = null;

    // State
    private lastPingSuccess = Date.now();
    private wakeLock: WakeLockSentinel | null = null;
    private audioCtx: AudioContext | null = null;
    private reloadScheduled = false;

    private readonly PING_INTERVAL_MS = 25_000;       // 25s heartbeat
    private readonly MAX_SILENCE_MS = 90_000;          // 90s = WS dead
    private readonly ACTIVITY_INTERVAL_MS = 5 * 60_000; // 5 min activity sim

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    public subscribe(listener: TKeepAliveListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.reloadScheduled = false;
        this.lastPingSuccess = Date.now();

        this.startHeartbeat();
        this.startDeadDetector();
        this.startWakeLock();
        this.startAntiThrottle();
        this.startActivitySimulation();
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // eslint-disable-next-line no-console
        console.log('[KeepAlive] 24-hour session protection started');
    }

    public stop() {
        this.isRunning = false;

        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.activityInterval) clearInterval(this.activityInterval);
        if (this.deadDetectorInterval) clearInterval(this.deadDetectorInterval);

        this.pingInterval = null;
        this.activityInterval = null;
        this.deadDetectorInterval = null;

        this.releaseWakeLock();
        this.stopAntiThrottle();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // eslint-disable-next-line no-console
        console.log('[KeepAlive] Session protection stopped');
    }

    // ---------------------------------------------------------------
    // 1. WebSocket Heartbeat
    // ---------------------------------------------------------------
    private startHeartbeat() {
        this.pingInterval = setInterval(async () => {
            if (!this.isRunning) return;
            try {
                if (WS && typeof WS.send === 'function') {
                    const res = await WS.send({ ping: 1 });
                    if (res && (res.ping || res.time)) {
                        this.lastPingSuccess = Date.now();
                    }
                }
            } catch (_e) {
                // Dead detector handles prolonged silence
            }
        }, this.PING_INTERVAL_MS);
    }

    // ---------------------------------------------------------------
    // 2. Dead WS Detector — reloads if silent >90 seconds
    // ---------------------------------------------------------------
    private startDeadDetector() {
        this.deadDetectorInterval = setInterval(() => {
            if (!this.isRunning || this.reloadScheduled) return;
            const silence = Date.now() - this.lastPingSuccess;
            if (silence > this.MAX_SILENCE_MS) {
                this.reloadScheduled = true;
                const silenceSec = Math.round(silence / 1000);
                // eslint-disable-next-line no-console
                console.warn(`[KeepAlive] WS silent for ${silenceSec}s — scheduling reconnect`);
                this.emit('ws_dead', `No response for ${silenceSec}s`);

                // Reload page after 3 seconds to reconnect WS cleanly
                setTimeout(() => {
                    if (this.reloadScheduled) {
                        window.location.reload();
                    }
                }, 3000);
            }
        }, 15_000);
    }

    // ---------------------------------------------------------------
    // 3. Page Visibility Handler
    // ---------------------------------------------------------------
    private handleVisibilityChange = () => {
        if (!this.isRunning) return;
        if (document.hidden) {
            this.emit('tab_hidden');
        } else {
            this.emit('tab_visible');
            // Immediate ping on tab return
            this.lastPingSuccess = Date.now(); // Grace period to avoid false reload
            try {
                if (WS && typeof WS.send === 'function') {
                    WS.send({ ping: 1 }).catch(() => {});
                }
            } catch (_e) {
                // ignore
            }
            // Re-acquire wake lock (browser releases it when tab is hidden)
            this.startWakeLock();
        }
    };

    // ---------------------------------------------------------------
    // 4. Web Wake Lock — prevents device screen + CPU sleep
    // ---------------------------------------------------------------
    private async startWakeLock() {
        try {
            if ('wakeLock' in navigator && !document.hidden) {
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    // Auto-reacquire if still running and tab is visible
                    if (this.isRunning && !document.hidden) {
                        this.startWakeLock();
                    }
                });
                // eslint-disable-next-line no-console
                console.log('[KeepAlive] Wake Lock acquired ✓');
            }
        } catch (err: any) {
            this.emit('wakelock_fail', err?.message || 'Wake Lock not supported');
        }
    }

    private releaseWakeLock() {
        try {
            this.wakeLock?.release();
        } catch (_e) {
            // ignore
        }
        this.wakeLock = null;
    }

    // ---------------------------------------------------------------
    // 5. Anti-Throttle via Silent AudioContext
    //    Browsers throttle background tab timers to 1s+ intervals.
    //    A running AudioContext bypasses most of this throttling,
    //    keeping trading tick evaluations at full speed.
    // ---------------------------------------------------------------
    private startAntiThrottle() {
        try {
            const AudioContextClass: typeof AudioContext =
                window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            this.audioCtx = new AudioContextClass();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            // Completely silent — zero volume, just keeps context alive
            gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();

            // eslint-disable-next-line no-console
            console.log('[KeepAlive] Anti-throttle AudioContext active ✓');
        } catch (_e) {
            // Browser may block autoplay — non-critical
        }
    }

    private stopAntiThrottle() {
        try {
            this.audioCtx?.close();
        } catch (_e) {
            // ignore
        }
        this.audioCtx = null;
    }

    // ---------------------------------------------------------------
    // 6. Activity Simulation
    //    Dispatches a ghost mousemove every 5 minutes to prevent
    //    browser idle-tab suspension and inactivity warnings.
    // ---------------------------------------------------------------
    private startActivitySimulation() {
        this.activityInterval = setInterval(() => {
            if (!this.isRunning) return;
            try {
                document.dispatchEvent(
                    new MouseEvent('mousemove', {
                        bubbles: true,
                        cancelable: true,
                        clientX: Math.floor(Math.random() * 5),
                        clientY: Math.floor(Math.random() * 5),
                    })
                );
            } catch (_e) {
                // ignore
            }
        }, this.ACTIVITY_INTERVAL_MS);
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------
    private emit(event: TKeepAliveEvent, detail?: string) {
        this.listeners.forEach(l => {
            try {
                l(event, detail);
            } catch (_e) {
                // listener error
            }
        });
    }
}

export const keepAliveService = new KeepAliveService();
