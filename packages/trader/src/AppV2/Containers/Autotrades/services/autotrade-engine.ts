import { WS } from '@deriv/shared';
import { marketDataService } from './market-data-service';
import { TBotStatus, TMarketTickStats, TStrategyConfig, TStrategyType, TTradeLogItem } from './types';

// Audio tone synthesizers using Web Audio API
const playSoundTone = (type: 'WIN' | 'LOSS' | 'TRIGGER') => {
    try {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })?.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'WIN') {
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.0, now + 0.1); // A5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'LOSS') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(311.13, now + 0.12);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'TRIGGER') {
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    } catch (_e) {
        // Audio fallback
    }
};

type TEngineListener = () => void;

// Key used to persist bot state across page reloads / network drops
const PERSIST_KEY = 'autotrades_engine_state_v1';

class AutoTradeEngine {
    private isRunning: boolean = false;
    private botStatus: TBotStatus = 'IDLE';
    private activeStrategy: TStrategyType = 'ELITE_PRO';
    private config: TStrategyConfig = {
        stake: 0.5,
        isAutoStakePercent: true,
        stakePercent: 7, // 7% by default as requested
        takeProfit: 50,
        stopLoss: 50,
        durationTicks: 1, // 1 or 2 ticks
        martingaleMultiplier: 2.6, // 2.6x as requested
        autoSwitchBestMarket: true,
        soundEnabled: true,
        eliteProPreset: 'OVER3_UNDER6',
        eliteProPredictionUnder: 6,
        eliteProPredictionOver: 3,
        differsCandidateDigit: 4,
        differsMaxRuns: 7,
        differsBulkPurchase: 6,
        differsRecoveryMode: true,
        evenOddRecoveryMode: true,
        interlockingPair: 'EVEN_ODD',
        interlockingFlipOnLoss: true,
    };

    // Runtime state
    private accountBalance: number = 100;
    private accountCurrency: string = 'USD';
    private totalProfit: number = 0;
    private totalWins: number = 0;
    private totalLosses: number = 0;
    private consecutiveLosses: number = 0;
    private currentCalculatedStake: number = 0.5;
    private isRecoveryActive: boolean = false;
    private recoveryLossAmount: number = 0;
    private differsRunCount: number = 0;
    private differsWaitingSafeTicks: number = 0;
    private lastSeenCandidateDigitTick: number = 0;
    private consecutiveOppositeParityCount: number = 0;
    private interlockingLastContract: string | null = null;
    private interlockingLastWon: boolean = true;
    private tradeLogs: TTradeLogItem[] = [];
    private listeners: TEngineListener[] = [];
    private unsubscribeMarketData: (() => void) | null = null;
    private isExecutingOrder: boolean = false;
    private ticksSinceLastEval: number = 0;

    constructor() {
        this.currentCalculatedStake = this.config.stake;
        // Restore persisted config on construction
        this.loadPersistedState();
    }

    public subscribe(listener: TEngineListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => {
            try {
                l();
            } catch (_e) {
                // listener error
            }
        });
    }

    public getState() {
        return {
            isRunning: this.isRunning,
            botStatus: this.botStatus,
            activeStrategy: this.activeStrategy,
            config: this.config,
            accountBalance: this.accountBalance,
            accountCurrency: this.accountCurrency,
            totalProfit: parseFloat(this.totalProfit.toFixed(2)),
            totalWins: this.totalWins,
            totalLosses: this.totalLosses,
            consecutiveLosses: this.consecutiveLosses,
            currentStake: parseFloat(this.currentCalculatedStake.toFixed(2)),
            isRecoveryActive: this.isRecoveryActive,
            tradeLogs: this.tradeLogs,
        };
    }

    public setConfig(newConfig: Partial<TStrategyConfig>) {
        this.config = { ...this.config, ...newConfig };
        this.recalculateBaseStake();
        this.persistState();
        this.notify();
    }

    public setStrategy(strategy: TStrategyType) {
        this.activeStrategy = strategy;
        this.isRecoveryActive = false;
        this.differsRunCount = 0;
        this.differsWaitingSafeTicks = 0;
        this.consecutiveOppositeParityCount = 0;
        this.persistState();
        this.notify();
    }

    public setAccountInfo(balance: number, currency: string) {
        this.accountBalance = balance;
        this.accountCurrency = currency;
        this.recalculateBaseStake();
        this.notify();
    }

    private recalculateBaseStake() {
        if (this.consecutiveLosses === 0 && !this.isRecoveryActive) {
            if (this.config.isAutoStakePercent && this.accountBalance > 0) {
                // 7% of account balance (minimum 0.35)
                const calculated = Math.max(0.35, (this.accountBalance * this.config.stakePercent) / 100);
                this.currentCalculatedStake = parseFloat(calculated.toFixed(2));
            } else {
                this.currentCalculatedStake = Math.max(0.35, this.config.stake);
            }
        }
    }

    // ---------------------------------------------------------------
    // PERSISTENCE — survives page reloads and network reconnects
    // ---------------------------------------------------------------

    /** Saves critical bot state to localStorage */
    private persistState() {
        try {
            localStorage.setItem(
                PERSIST_KEY,
                JSON.stringify({
                    wasRunning: this.isRunning,
                    activeStrategy: this.activeStrategy,
                    config: this.config,
                    totalProfit: this.totalProfit,
                    totalWins: this.totalWins,
                    totalLosses: this.totalLosses,
                    consecutiveLosses: this.consecutiveLosses,
                    savedAt: Date.now(),
                })
            );
        } catch (_e) {
            // Storage quota — non-critical
        }
    }

    /** Loads persisted state from localStorage on startup */
    private loadPersistedState() {
        try {
            const raw = localStorage.getItem(PERSIST_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            // Only restore if saved within the last 24 hours
            if (!saved.savedAt || Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) return;
            if (saved.config) this.config = { ...this.config, ...saved.config };
            if (saved.activeStrategy) this.activeStrategy = saved.activeStrategy;
            if (typeof saved.totalProfit === 'number') this.totalProfit = saved.totalProfit;
            if (typeof saved.totalWins === 'number') this.totalWins = saved.totalWins;
            if (typeof saved.totalLosses === 'number') this.totalLosses = saved.totalLosses;
            if (typeof saved.consecutiveLosses === 'number') this.consecutiveLosses = saved.consecutiveLosses;
        } catch (_e) {
            // Corrupted storage — ignore
        }
    }

    /** Returns true if the bot was running before the last page reload */
    public wasRunningBeforeReload(): boolean {
        try {
            const raw = localStorage.getItem(PERSIST_KEY);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            // Only auto-resume if state is fresh (<24h)
            if (!saved.savedAt || Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) return false;
            return saved.wasRunning === true;
        } catch (_e) {
            return false;
        }
    }

    /** Clears persisted state — called when user explicitly stops trading */
    public clearPersistedState() {
        try {
            localStorage.removeItem(PERSIST_KEY);
        } catch (_e) {
            // ignore
        }
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.botStatus = 'SCANNING';
        this.ticksSinceLastEval = 0;
        this.recalculateBaseStake();

        this.unsubscribeMarketData = marketDataService.subscribe((statsMap, activeSymbol) => {
            this.handleTickUpdate(statsMap, activeSymbol);
        });

        this.persistState(); // Save running=true so reload can detect it
        this.notify();
    }

    public stop(clearPersist = true) {
        this.isRunning = false;
        this.botStatus = 'IDLE';
        this.isExecutingOrder = false;
        if (this.unsubscribeMarketData) {
            this.unsubscribeMarketData();
            this.unsubscribeMarketData = null;
        }
        this.persistState(); // Save running=false
        if (clearPersist) {
            // User explicitly stopped — clear so reload won't auto-resume
            this.clearPersistedState();
        }
        this.notify();
    }

    public resetStats() {
        this.totalProfit = 0;
        this.totalWins = 0;
        this.totalLosses = 0;
        this.consecutiveLosses = 0;
        this.isRecoveryActive = false;
        this.recoveryLossAmount = 0;
        this.recalculateBaseStake();
        this.notify();
    }

    private handleTickUpdate(statsMap: Record<string, TMarketTickStats>, activeSymbol: string) {
        if (!this.isRunning || this.isExecutingOrder) return;

        // Auto-switch best market if enabled and every 15-30 ticks
        this.ticksSinceLastEval++;
        if (this.config.autoSwitchBestMarket && this.ticksSinceLastEval >= 15) {
            this.ticksSinceLastEval = 0;
            const bestEntry = Object.values(statsMap).find(s => s.isBestMarket);
            if (bestEntry && bestEntry.symbol !== activeSymbol && bestEntry.marketScore > 65) {
                marketDataService.setActiveSymbol(bestEntry.symbol);
                return;
            }
        }

        const stats = statsMap[activeSymbol];
        if (!stats || stats.digits50.length < 30) {
            this.botStatus = 'ANALYZING';
            this.notify();
            return;
        }

        // Check TP / SL boundaries
        if (this.config.takeProfit > 0 && this.totalProfit >= this.config.takeProfit) {
            this.botStatus = 'TARGET_REACHED';
            this.stop();
            return;
        }
        if (this.config.stopLoss > 0 && this.totalProfit <= -this.config.stopLoss) {
            this.botStatus = 'PAUSED';
            this.stop();
            return;
        }

        // Strategy Evaluation
        switch (this.activeStrategy) {
            case 'ELITE_PRO':
                this.evaluateElitePro(stats);
                break;
            case 'SMART_DIFFERS':
                this.evaluateSmartDiffers(stats);
                break;
            case 'EVEN_ODD':
                this.evaluateEvenOdd(stats);
                break;
            case 'COMPOUNDING':
                this.evaluateElitePro(stats); // Compounding challenge uses the high-win Elite Pro engine
                break;
            case 'INTERLOCKING':
                this.evaluateInterlocking(stats);
                break;
            default:
                break;
        }
    }

    // -------------------------------------------------------------
    // BARRIER RESOLVER (AUTO-CHOOSE, OVER 3/UNDER 6, OVER 2/UNDER 7, OVER 1/UNDER 8)
    // -------------------------------------------------------------
    public getEffectiveBarriers(stats?: TMarketTickStats): { under: number; over: number; label: string } {
        const preset = this.config.eliteProPreset || 'OVER3_UNDER6';

        if (preset === 'AUTO') {
            if (!stats) {
                return { under: 6, over: 3, label: 'Auto (Over 3 / Under 6)' };
            }
            const underPct = stats.under0_4_pct || 50;
            const overPct = stats.over5_9_pct || 50;
            const dominantPct = Math.max(underPct, overPct);

            // Dynamic selection based on directional strength:
            // High conviction (>=62%) -> Over 3 / Under 6 (maximum payout)
            // Strong conviction (57-61%) -> Over 2 / Under 7 (solid balance)
            // Standard/Cautious (<=56%) -> Over 1 / Under 8 (ultra safe 80%+ win-rate)
            if (dominantPct >= 62) {
                return { under: 6, over: 3, label: 'Auto: High Power (Over 3 / Under 6)' };
            } else if (dominantPct >= 57) {
                return { under: 7, over: 2, label: 'Auto: Balanced (Over 2 / Under 7)' };
            } else {
                return { under: 8, over: 1, label: 'Auto: Ultra Safe (Over 1 / Under 8)' };
            }
        }

        if (preset === 'OVER1_UNDER8') {
            return { under: 8, over: 1, label: 'Over 1 / Under 8 (Ultra Safe)' };
        }
        if (preset === 'OVER2_UNDER7') {
            return { under: 7, over: 2, label: 'Over 2 / Under 7 (Safe)' };
        }
        if (preset === 'OVER3_UNDER6') {
            return { under: 6, over: 3, label: 'Over 3 / Under 6 (Balanced)' };
        }

        return {
            under: this.config.eliteProPredictionUnder || 6,
            over: this.config.eliteProPredictionOver || 3,
            label: `Custom (Over ${this.config.eliteProPredictionOver || 3} / Under ${this.config.eliteProPredictionUnder || 6})`,
        };
    }

    // -------------------------------------------------------------
    // STRATEGY 1: ELITE PRO (OVER 3 / UNDER 6)
    // -------------------------------------------------------------
    private evaluateElitePro(stats: TMarketTickStats) {
        const lastDigit = stats.lastDigit;
        const barriers = this.getEffectiveBarriers(stats);

        // Condition 1: Under 0-4 vs Over 5-9 threshold > 55% AND increasing
        const isUnderDominant = stats.under0_4_pct >= 54.0 && stats.under0_4_increasing;
        const isOverDominant = stats.over5_9_pct >= 54.0 && stats.over5_9_increasing;

        // Condition 2: Last 50 ticks dominant count & last 10 ticks >= 7 in direction
        const last10UnderCount = stats.digits10.filter(d => d <= 5).length;
        const last10OverCount = stats.digits10.filter(d => d >= 4).length;

        const underCondition2 = stats.under0_5_count >= stats.over4_9_count && last10UnderCount >= 7;
        const overCondition2 = stats.over4_9_count >= stats.under0_5_count && last10OverCount >= 7;

        // Condition 3: Safety filter on 1000 ticks:
        // Under: high digits should be < 10% and not increasing
        const digits789Count = stats.freq1000.filter(f => [7, 8, 9].includes(f.digit) && f.percentage < 10.5).length >= 2;
        // Over: low digits should be < 10% and not increasing
        const digits012Count = stats.freq1000.filter(f => [0, 1, 2].includes(f.digit) && f.percentage < 10.5).length >= 2;

        if (isUnderDominant && underCondition2 && digits789Count) {
            this.botStatus = 'WAITING_TRIGGER';

            // Condition 4: Entry Digit Trigger - wait for highest entry digit in under to appear
            if (lastDigit === stats.highestEntryDigitUnder) {
                if (this.config.soundEnabled) playSoundTone('TRIGGER');
                this.executeTrade({
                    symbol: stats.symbol,
                    strategy: 'ELITE_PRO',
                    contractType: 'DIGITUNDER',
                    barrier: barriers.under,
                    entryDigit: lastDigit,
                });
            }
        } else if (isOverDominant && overCondition2 && digits012Count) {
            this.botStatus = 'WAITING_TRIGGER';

            // Entry Digit Trigger - wait for highest entry digit in over to appear
            if (lastDigit === stats.highestEntryDigitOver) {
                if (this.config.soundEnabled) playSoundTone('TRIGGER');
                this.executeTrade({
                    symbol: stats.symbol,
                    strategy: 'ELITE_PRO',
                    contractType: 'DIGITOVER',
                    barrier: barriers.over,
                    entryDigit: lastDigit,
                });
            }
        } else {
            this.botStatus = 'SCANNING';
        }
        this.notify();
    }

    // -------------------------------------------------------------
    // STRATEGY 2: SMART DIFFERS (DIGITS 2-7) WITH OVER 2 / UNDER 8 RECOVERY
    // -------------------------------------------------------------
    private evaluateSmartDiffers(stats: TMarketTickStats) {
        const lastDigit = stats.lastDigit;

        // If recovery mode is active after a single loss: trade Over 2 or Under 8
        if (this.isRecoveryActive) {
            const recoveryContract = stats.under0_4_pct >= 50 ? 'DIGITUNDER' : 'DIGITOVER';
            const recoveryBarrier = recoveryContract === 'DIGITUNDER' ? 8 : 2;

            this.executeTrade({
                symbol: stats.symbol,
                strategy: 'SMART_DIFFERS',
                contractType: recoveryContract,
                barrier: recoveryBarrier,
                entryDigit: lastDigit,
            });
            return;
        }

        // Exclude 0, 1, 8, 9 and top/least appearing digits
        const excludedDigits = [0, 1, 8, 9, stats.mostAppearingDigit, stats.secondAppearingDigit, stats.leastAppearingDigit];

        // Find candidate from 2 to 7 with < 10% in last 60 ticks and < 3 appearances in last 15 ticks
        let candidateDigit = this.config.differsCandidateDigit;
        const validCandidates = [2, 3, 4, 5, 6, 7].filter(d => {
            if (excludedDigits.includes(d)) return false;
            const freq60 = stats.freq60.find(f => f.digit === d)?.percentage || 0;
            const appearances15 = stats.digits15.filter(x => x === d).length;
            return freq60 < 10.0 && appearances15 <= 2;
        });

        if (validCandidates.length > 0) {
            candidateDigit = validCandidates[0];
            this.config.differsCandidateDigit = candidateDigit;
        }

        // Differs Entry: Wait for candidate digit to appear, then wait 3 safe ticks
        if (lastDigit === candidateDigit) {
            this.differsWaitingSafeTicks = 1;
            this.lastSeenCandidateDigitTick = Date.now();
            this.botStatus = 'WAITING_TRIGGER';
            this.notify();
            return;
        }

        if (this.differsWaitingSafeTicks > 0) {
            this.differsWaitingSafeTicks++;
            if (this.differsWaitingSafeTicks >= 4) {
                // 3 ticks without candidate digit passed!
                this.differsWaitingSafeTicks = 0;
                this.differsRunCount++;

                this.executeTrade({
                    symbol: stats.symbol,
                    strategy: 'SMART_DIFFERS',
                    contractType: 'DIGITDIFF',
                    barrier: candidateDigit,
                    entryDigit: lastDigit,
                });

                if (this.differsRunCount >= this.config.differsMaxRuns) {
                    this.differsRunCount = 0;
                    this.botStatus = 'COOLDOWN';
                }
                return;
            }
        }

        this.botStatus = 'SCANNING';
        this.notify();
    }

    // -------------------------------------------------------------
    // STRATEGY 3: EVEN / ODD TREND AI WITH OVER 2 / UNDER 8 RECOVERY
    // -------------------------------------------------------------
    private evaluateEvenOdd(stats: TMarketTickStats) {
        const lastDigit = stats.lastDigit;

        // If recovery active:
        if (this.isRecoveryActive) {
            const recoveryContract = stats.evenPct60 >= 50 ? 'DIGITUNDER' : 'DIGITOVER';
            const recoveryBarrier = recoveryContract === 'DIGITUNDER' ? 8 : 2;

            this.executeTrade({
                symbol: stats.symbol,
                strategy: 'EVEN_ODD',
                contractType: recoveryContract,
                barrier: recoveryBarrier,
                entryDigit: lastDigit,
            });
            return;
        }

        // Even probability >= 58% and increasing, last 15 ticks >= 10 are even
        const isEvenFavored = stats.evenPct60 >= 57.0 && stats.evenIncreasing;
        const isOddFavored = stats.oddPct60 >= 57.0 && !stats.evenIncreasing;

        const last15EvenCount = stats.digits15.filter(d => d % 2 === 0).length;
        const last15OddCount = stats.digits15.filter(d => d % 2 !== 0).length;

        if (isEvenFavored && last15EvenCount >= 9) {
            // Wait for 2+ consecutive odd ticks, then 1 even tick
            if (lastDigit % 2 !== 0) {
                this.consecutiveOppositeParityCount++;
            } else {
                if (this.consecutiveOppositeParityCount >= 2) {
                    this.consecutiveOppositeParityCount = 0;
                    this.executeTrade({
                        symbol: stats.symbol,
                        strategy: 'EVEN_ODD',
                        contractType: 'DIGITEVEN',
                        entryDigit: lastDigit,
                    });
                    return;
                }
                this.consecutiveOppositeParityCount = 0;
            }
            this.botStatus = 'WAITING_TRIGGER';
        } else if (isOddFavored && last15OddCount >= 9) {
            if (lastDigit % 2 === 0) {
                this.consecutiveOppositeParityCount++;
            } else {
                if (this.consecutiveOppositeParityCount >= 2) {
                    this.consecutiveOppositeParityCount = 0;
                    this.executeTrade({
                        symbol: stats.symbol,
                        strategy: 'EVEN_ODD',
                        contractType: 'DIGITODD',
                        entryDigit: lastDigit,
                    });
                    return;
                }
                this.consecutiveOppositeParityCount = 0;
            }
            this.botStatus = 'WAITING_TRIGGER';
        } else {
            this.botStatus = 'SCANNING';
        }
        this.notify();
    }

    // -------------------------------------------------------------
    // STRATEGY 4: INTERLOCKING AI ENGINE
    // -------------------------------------------------------------
    private evaluateInterlocking(stats: TMarketTickStats) {
        const lastDigit = stats.lastDigit;

        if (this.config.interlockingPair === 'EVEN_ODD') {
            let targetContract = 'DIGITEVEN';

            if (!this.interlockingLastWon && this.config.interlockingFlipOnLoss && this.interlockingLastContract) {
                // FLIP INTERLOCK: Invert to the opposite leg immediately after a loss
                targetContract = this.interlockingLastContract === 'DIGITEVEN' ? 'DIGITODD' : 'DIGITEVEN';
            } else {
                // Trend-following primary leg
                targetContract = stats.evenPct60 >= stats.oddPct60 ? 'DIGITEVEN' : 'DIGITODD';
            }

            // Entry confirmation filter:
            // For DIGITEVEN: trigger when an odd digit precedes, breaking the counter-trend
            // For DIGITODD: trigger when an even digit precedes
            const isEvenTarget = targetContract === 'DIGITEVEN';
            const triggerReady = isEvenTarget ? lastDigit % 2 !== 0 : lastDigit % 2 === 0;

            if (triggerReady) {
                if (this.config.soundEnabled) playSoundTone('TRIGGER');
                this.executeTrade({
                    symbol: stats.symbol,
                    strategy: 'INTERLOCKING',
                    contractType: targetContract,
                    entryDigit: lastDigit,
                });
            } else {
                this.botStatus = 'WAITING_TRIGGER';
                this.notify();
            }
        } else {
            // OVER_UNDER Interlocking Pair
            const barriers = this.getEffectiveBarriers(stats);
            let targetContract = 'DIGITUNDER';
            let targetBarrier: number = barriers.under;

            if (!this.interlockingLastWon && this.config.interlockingFlipOnLoss && this.interlockingLastContract) {
                // Flip interlock between Under and Over
                if (this.interlockingLastContract === 'DIGITUNDER') {
                    targetContract = 'DIGITOVER';
                    targetBarrier = barriers.over;
                } else {
                    targetContract = 'DIGITUNDER';
                    targetBarrier = barriers.under;
                }
            } else {
                // Dominant side selection
                if (stats.over5_9_pct > stats.under0_4_pct) {
                    targetContract = 'DIGITOVER';
                    targetBarrier = barriers.over;
                } else {
                    targetContract = 'DIGITUNDER';
                    targetBarrier = barriers.under;
                }
            }

            // Entry trigger
            const shouldTrigger = targetContract === 'DIGITUNDER' ? lastDigit >= 4 : lastDigit <= 5;
            if (shouldTrigger) {
                if (this.config.soundEnabled) playSoundTone('TRIGGER');
                this.executeTrade({
                    symbol: stats.symbol,
                    strategy: 'INTERLOCKING',
                    contractType: targetContract,
                    barrier: targetBarrier,
                    entryDigit: lastDigit,
                });
            } else {
                this.botStatus = 'WAITING_TRIGGER';
                this.notify();
            }
        }
    }

    // -------------------------------------------------------------
    // TRADE DISPATCH & DERIV API EXECUTION
    // -------------------------------------------------------------
    private async executeTrade(params: {
        symbol: string;
        strategy: TStrategyType;
        contractType: string;
        barrier?: string | number;
        entryDigit?: number;
    }) {
        if (this.isExecutingOrder) return;
        this.isExecutingOrder = true;
        this.botStatus = 'EXECUTING';
        this.notify();

        const currentStake = this.currentCalculatedStake;
        const logId = `trade_${Date.now()}`;

        const tradeLog: TTradeLogItem = {
            id: logId,
            timestamp: new Date().toLocaleTimeString(),
            symbol: params.symbol,
            strategy: params.strategy,
            contractType: params.contractType,
            barrier: params.barrier,
            stake: currentStake,
            payout: 0,
            profit: 0,
            status: 'PENDING',
            entryDigit: params.entryDigit,
        };

        this.tradeLogs.unshift(tradeLog);
        if (this.tradeLogs.length > 150) {
            this.tradeLogs.pop();
        }
        this.notify();

        try {
            if (!WS || typeof WS.send !== 'function') {
                throw new Error('WebSocket not connected to Deriv API');
            }

            // 1. Request price proposal from Deriv API
            const proposalReq: any = {
                proposal: 1,
                amount: currentStake,
                basis: 'stake',
                contract_type: params.contractType,
                currency: this.accountCurrency || 'USD',
                underlying_symbol: params.symbol,
                duration: this.config.durationTicks || 1,
                duration_unit: 't',
            };

            if (params.barrier !== undefined) {
                proposalReq.barrier = String(params.barrier);
            }

            const proposalRes = await WS.send(proposalReq);

            if (!proposalRes) {
                throw new Error('No response from Deriv API proposal request');
            }
            if (proposalRes.error) {
                throw new Error(`Proposal error [${proposalRes.error.code}]: ${proposalRes.error.message}`);
            }
            if (!proposalRes.proposal || !proposalRes.proposal.id) {
                throw new Error('Invalid proposal response - missing proposal ID');
            }

            const proposalId: string = proposalRes.proposal.id;
            const payout: number = proposalRes.proposal.payout || 0;

            // 2. Buy the contract using correct Deriv API parameter format
            const buyRes = await WS.buy({
                proposal_id: proposalId, // ← correct field name per Deriv API spec
                price: currentStake,
            });

            if (!buyRes) {
                throw new Error('No response from Deriv API buy request');
            }
            if (buyRes.error) {
                throw new Error(`Buy error [${buyRes.error.code}]: ${buyRes.error.message}`);
            }
            if (!buyRes.buy || !buyRes.buy.contract_id) {
                throw new Error('Buy response missing contract_id');
            }

            const contractId: number = buyRes.buy.contract_id;
            tradeLog.contractId = contractId;
            tradeLog.payout = payout;

            // 3. Track settlement via proposal_open_contract
            this.trackContractSettlement(contractId, tradeLog, currentStake);
        } catch (error: any) {
            tradeLog.status = 'LOST';
            tradeLog.errorMessage = error?.message || 'Execution error';
            // eslint-disable-next-line no-console
            console.error('[AutoTradeEngine] Trade execution failed:', error?.message);
            this.isExecutingOrder = false;
            this.botStatus = 'PAUSED';
            this.notify();
        }
    }


    private trackContractSettlement(contractId: number, tradeLog: TTradeLogItem, stake: number) {
        try {
            if (!WS) {
                tradeLog.status = 'LOST';
                tradeLog.errorMessage = 'WebSocket disconnected from Deriv API';
                this.isExecutingOrder = false;
                this.botStatus = 'PAUSED';
                this.notify();
                return;
            }

            const onSettlement = (poc: any) => {
                if (!poc || !poc.is_sold) return;
                const isWin = poc.status === 'won';
                const profit = poc.profit !== undefined ? Number(poc.profit) : (isWin ? (poc.payout || 0) - stake : -stake);
                const exitDigit = poc.exit_tick_display_value ? Number(poc.exit_tick_display_value.slice(-1)) : undefined;

                tradeLog.exitDigit = exitDigit;
                this.finishSettlement(tradeLog, isWin, profit);
            };

            if (typeof WS.subscribeProposalOpenContract === 'function') {
                const sub = WS.subscribeProposalOpenContract(contractId, (response: any) => {
                    if (response.proposal_open_contract) {
                        const poc = response.proposal_open_contract;
                        if (poc.is_sold) {
                            try {
                                if (sub && typeof sub.unsubscribe === 'function') {
                                    sub.unsubscribe();
                                }
                            } catch (_e) {
                                // unsubscribe error
                            }
                            onSettlement(poc);
                        }
                    }
                });
            } else if (typeof WS.send === 'function') {
                // Poll contract status directly from real Deriv API
                const pollInterval = setInterval(async () => {
                    try {
                        const res = await WS.send({ proposal_open_contract: 1, contract_id: contractId });
                        if (res?.proposal_open_contract?.is_sold) {
                            clearInterval(pollInterval);
                            onSettlement(res.proposal_open_contract);
                        }
                    } catch (_err) {
                        // Keep polling
                    }
                }, 1200);

                setTimeout(() => clearInterval(pollInterval), 30000);
            }
        } catch (err: any) {
            tradeLog.status = 'LOST';
            tradeLog.errorMessage = err?.message || 'Error tracking contract with Deriv API';
            this.isExecutingOrder = false;
            this.botStatus = 'PAUSED';
            this.notify();
        }
    }

    private finishSettlement(tradeLog: TTradeLogItem, isWin: boolean, profit: number) {
        tradeLog.status = isWin ? 'WON' : 'LOST';
        tradeLog.profit = parseFloat(profit.toFixed(2));
        this.totalProfit += profit;

        // Interlock state tracking
        this.interlockingLastContract = tradeLog.contractType;
        this.interlockingLastWon = isWin;

        if (isWin) {
            this.totalWins++;
            this.consecutiveLosses = 0;
            if (this.config.soundEnabled) playSoundTone('WIN');

            if (this.isRecoveryActive) {
                // Recovery completed! Revert back to original base stake
                this.isRecoveryActive = false;
                this.recoveryLossAmount = 0;
            }
            this.recalculateBaseStake();
        } else {
            this.totalLosses++;
            this.consecutiveLosses++;
            if (this.config.soundEnabled) playSoundTone('LOSS');

            // Apply Martingale or switch to Recovery Mode
            if (this.activeStrategy === 'SMART_DIFFERS' && this.config.differsRecoveryMode) {
                this.isRecoveryActive = true;
                this.recoveryLossAmount = tradeLog.stake;
                this.currentCalculatedStake = parseFloat((tradeLog.stake * 2.0).toFixed(2));
            } else if (this.activeStrategy === 'EVEN_ODD' && this.config.evenOddRecoveryMode) {
                this.isRecoveryActive = true;
                this.recoveryLossAmount = tradeLog.stake;
                this.currentCalculatedStake = parseFloat((tradeLog.stake * 2.0).toFixed(2));
            } else if (this.activeStrategy === 'INTERLOCKING') {
                // Interlocking tiered recovery: 2.1x split multiplier on the flipped contract
                const nextStake = tradeLog.stake * (this.config.martingaleMultiplier || 2.1);
                this.currentCalculatedStake = parseFloat(nextStake.toFixed(2));
            } else {
                // Standard 2.6x Martingale multiplier as requested
                const nextStake = tradeLog.stake * (this.config.martingaleMultiplier || 2.6);
                this.currentCalculatedStake = parseFloat(nextStake.toFixed(2));
            }
        }

        // Brief cooldown between ticks
        setTimeout(() => {
            this.isExecutingOrder = false;
            if (this.isRunning) {
                this.botStatus = 'SCANNING';
            }
            this.notify();
        }, 1200);
    }
}

export const autoTradeEngine = new AutoTradeEngine();
