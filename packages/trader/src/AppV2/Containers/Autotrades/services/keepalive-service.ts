import { WS } from '@deriv/shared';

class KeepAliveService {
    private pingInterval: ReturnType<typeof setInterval> | null = null;
    private isRunning: boolean = false;

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Heartbeat ping every 20 seconds
        this.pingInterval = setInterval(() => {
            try {
                if (WS && typeof WS.send === 'function') {
                    WS.send({ ping: 1 }).catch(() => {
                        // Ignore ping errors or auto-recover
                    });
                }
            } catch (_e) {
                // Heartbeat safeguard
            }
        }, 20000);

        // Visibility handler to immediately ping when tab is foregrounded
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    private handleVisibilityChange = () => {
        if (this.isRunning && document.visibilityState === 'visible') {
            try {
                if (WS && typeof WS.send === 'function') {
                    WS.send({ ping: 1 }).catch(() => {});
                }
            } catch (_e) {
                // Fallback
            }
        }
    };

    public stop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.isRunning = false;
    }
}

export const keepAliveService = new KeepAliveService();
