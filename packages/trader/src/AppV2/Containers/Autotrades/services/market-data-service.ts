import { WS } from '@deriv/shared';
import { TMarketTickStats } from './types';

export const SYNTHETIC_MARKETS = [
    { symbol: '1HZ100V', displayName: 'Volatility 100 (1s) Index' },
    { symbol: 'R_100', displayName: 'Volatility 100 Index' },
    { symbol: '1HZ75V', displayName: 'Volatility 75 (1s) Index' },
    { symbol: 'R_75', displayName: 'Volatility 75 Index' },
    { symbol: '1HZ50V', displayName: 'Volatility 50 (1s) Index' },
    { symbol: 'R_50', displayName: 'Volatility 50 Index' },
    { symbol: '1HZ25V', displayName: 'Volatility 25 (1s) Index' },
    { symbol: 'R_25', displayName: 'Volatility 25 Index' },
    { symbol: '1HZ10V', displayName: 'Volatility 10 (1s) Index' },
    { symbol: 'R_10', displayName: 'Volatility 10 Index' },
    { symbol: '1HZ150V', displayName: 'Volatility 150 (1s) Index' },
    { symbol: '1HZ250V', displayName: 'Volatility 250 (1s) Index' },
    { symbol: '1HZ300V', displayName: 'Volatility 300 (1s) Index' },
];

export const getLastDigitFromPrice = (price: number | string, pipSize: number = 2): number => {
    if (typeof price === 'number') {
        const formatted = price.toFixed(pipSize);
        return Number(formatted.slice(-1)) || 0;
    }
    return Number(String(price).slice(-1)) || 0;
};

type TStatsListener = (statsMap: Record<string, TMarketTickStats>, activeSymbol: string) => void;

class MarketDataService {
    private statsMap: Record<string, TMarketTickStats> = {};
    private tickBuffers: Record<string, { prices: number[]; digits: number[] }> = {};
    private subscribers: Record<string, unknown> = {};
    private listeners: TStatsListener[] = [];
    private activeSymbol: string = '1HZ100V';
    private prevFrequencies: Record<string, number[]> = {};

    constructor() {
        // Initialize default empty stats for all synthetic markets
        SYNTHETIC_MARKETS.forEach(m => {
            this.statsMap[m.symbol] = this.createEmptyStats(m.symbol, m.displayName);
            this.tickBuffers[m.symbol] = { prices: [], digits: [] };
        });
    }

    public getActiveSymbol(): string {
        return this.activeSymbol;
    }

    public setActiveSymbol(symbol: string) {
        if (this.statsMap[symbol]) {
            this.activeSymbol = symbol;
            this.notifyListeners();
        }
    }

    public getStats(symbol?: string): TMarketTickStats | undefined {
        const sym = symbol || this.activeSymbol;
        return this.statsMap[sym];
    }

    public getAllStats(): Record<string, TMarketTickStats> {
        return this.statsMap;
    }

    public subscribe(listener: TStatsListener): () => void {
        this.listeners.push(listener);
        // Immediate notification
        listener(this.statsMap, this.activeSymbol);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.statsMap, this.activeSymbol);
            } catch (_e) {
                // Ignore listener error
            }
        });
    }

    public async init() {
        // Fetch 1000 ticks history for the active symbol first, and top 5 synthetics
        const prioritySymbols = [this.activeSymbol, 'R_100', '1HZ75V', 'R_75', '1HZ50V', '1HZ25V', '1HZ10V'];
        await Promise.all(
            prioritySymbols.map(async sym => {
                await this.loadInitialHistory(sym);
                this.subscribeToTickStream(sym);
            })
        );

        // Background load remaining
        const remaining = SYNTHETIC_MARKETS.filter(m => !prioritySymbols.includes(m.symbol));
        remaining.forEach(m => {
            this.loadInitialHistory(m.symbol).then(() => {
                this.subscribeToTickStream(m.symbol);
            });
        });
    }

    private async loadInitialHistory(symbol: string) {
        try {
            if (!WS || typeof WS.getTicksHistory !== 'function') return;
            const res = await WS.getTicksHistory({
                ticks_history: symbol,
                count: 1000,
                end: 'latest',
                style: 'ticks',
            });

            if (res && res.history && Array.isArray(res.history.prices)) {
                const prices: number[] = res.history.prices;
                const pipSize = res.pip_size || 2;
                const digits = prices.map(p => getLastDigitFromPrice(p, pipSize));

                this.tickBuffers[symbol] = { prices, digits };
                this.recalculateStats(symbol, prices[prices.length - 1] || 0, pipSize);
                this.evaluateBestMarket();
                this.notifyListeners();
            }
        } catch (_e) {
            // Silently handle WS history fallback
        }
    }

    private subscribeToTickStream(symbol: string) {
        if (this.subscribers[symbol]) return;
        try {
            if (!WS || typeof WS.subscribeTicksHistory !== 'function') return;
            const sub = WS.subscribeTicksHistory(
                {
                    ticks_history: symbol,
                    count: 1,
                    end: 'latest',
                    style: 'ticks',
                    subscribe: 1,
                },
                (response: any) => {
                    if (response.tick) {
                        const price = response.tick.quote;
                        const pipSize = response.tick.pip_size || 2;
                        const digit = getLastDigitFromPrice(price, pipSize);

                        const buffer = this.tickBuffers[symbol] || { prices: [], digits: [] };
                        buffer.prices.push(price);
                        buffer.digits.push(digit);

                        if (buffer.prices.length > 1000) {
                            buffer.prices.shift();
                            buffer.digits.shift();
                        }
                        this.tickBuffers[symbol] = buffer;

                        this.recalculateStats(symbol, price, pipSize);
                        this.evaluateBestMarket();
                        this.notifyListeners();
                    }
                }
            );
            this.subscribers[symbol] = sub;
        } catch (_e) {
            // Subscription fallback
        }
    }

    private recalculateStats(symbol: string, currentPrice: number, _pipSize: number) {
        const buffer = this.tickBuffers[symbol];
        if (!buffer || buffer.digits.length === 0) return;

        const digits = buffer.digits;
        const total = digits.length;
        const lastDigit = digits[digits.length - 1];

        const digits50 = digits.slice(-50);
        const digits15 = digits.slice(-15);
        const digits10 = digits.slice(-10);
        const digits7 = digits.slice(-7);
        const digits60 = digits.slice(-60);

        // 1. Calculate frequency distribution across 1000 ticks
        const counts1000 = new Array(10).fill(0);
        digits.forEach(d => counts1000[d]++);

        const prevCounts = this.prevFrequencies[symbol] || counts1000.slice();
        this.prevFrequencies[symbol] = counts1000.slice();

        const freq1000 = counts1000.map((count, d) => ({
            digit: d,
            count,
            percentage: parseFloat(((count / total) * 100).toFixed(1)),
            isIncreasing: count > (prevCounts[d] || 0),
        }));

        // 2. Frequency in last 60 ticks
        const counts60 = new Array(10).fill(0);
        digits60.forEach(d => counts60[d]++);
        const freq60 = counts60.map((count, d) => ({
            digit: d,
            count,
            percentage: parseFloat(((count / (digits60.length || 1)) * 100).toFixed(1)),
            isIncreasing: count >= 7,
        }));

        // 3. Frequency in last 15 ticks
        const counts15 = new Array(10).fill(0);
        digits15.forEach(d => counts15[d]++);
        const freq15 = counts15.map((count, d) => ({
            digit: d,
            count,
            percentage: parseFloat(((count / (digits15.length || 1)) * 100).toFixed(1)),
        }));

        // Under 0-4 vs Over 5-9 in last 50 ticks
        let under0_4_count = 0;
        let over5_9_count = 0;
        digits50.forEach(d => {
            if (d <= 4) under0_4_count++;
            else over5_9_count++;
        });
        const under0_4_pct = parseFloat(((under0_4_count / (digits50.length || 1)) * 100).toFixed(1));
        const over5_9_pct = parseFloat(((over5_9_count / (digits50.length || 1)) * 100).toFixed(1));

        // Under 0-5 vs Over 4-9 in last 50 ticks (As specifically highlighted in user prompt: 34 under 0-5 vs 25 over 4-9)
        let under0_5_count = 0;
        let over4_9_count = 0;
        digits50.forEach(d => {
            if (d <= 5) under0_5_count++;
            if (d >= 4) over4_9_count++;
        });
        const under0_5_pct = parseFloat(((under0_5_count / (digits50.length || 1)) * 100).toFixed(1));
        const over4_9_pct = parseFloat(((over4_9_count / (digits50.length || 1)) * 100).toFixed(1));

        // Determine rate of change in last 15 vs last 50
        const under0_4_last15 = digits15.filter(d => d <= 4).length;
        const under0_4_increasing = (under0_4_last15 / 15) > (under0_4_count / 50);
        const over5_9_increasing = !under0_4_increasing;

        // Most appearing, 2nd highest, least appearing in 1000 ticks
        const sortedIndices = [...freq1000].sort((a, b) => b.count - a.count);
        const mostAppearingDigit = sortedIndices[0]?.digit ?? 0;
        const secondAppearingDigit = sortedIndices[1]?.digit ?? 1;
        const leastAppearingDigit = sortedIndices[sortedIndices.length - 1]?.digit ?? 9;

        // Glowing highest entry digits:
        // Highest entry digit in Under: most frequent digit among 0,1,2,3,4,5 in last 50 ticks
        let highestEntryDigitUnder = 0;
        let maxUnderCount = -1;
        [0, 1, 2, 3, 4, 5].forEach(d => {
            const c = counts1000[d];
            if (c > maxUnderCount) {
                maxUnderCount = c;
                highestEntryDigitUnder = d;
            }
        });

        // Highest entry digit in Over: most frequent digit among 4,5,6,7,8,9 in last 50 ticks
        let highestEntryDigitOver = 9;
        let maxOverCount = -1;
        [4, 5, 6, 7, 8, 9].forEach(d => {
            const c = counts1000[d];
            if (c > maxOverCount) {
                maxOverCount = c;
                highestEntryDigitOver = d;
            }
        });

        // Even vs Odd in last 60 ticks
        let evenCount60 = 0;
        let oddCount60 = 0;
        digits60.forEach(d => {
            if (d % 2 === 0) evenCount60++;
            else oddCount60++;
        });
        const evenPct60 = parseFloat(((evenCount60 / (digits60.length || 1)) * 100).toFixed(1));
        const oddPct60 = parseFloat(((oddCount60 / (digits60.length || 1)) * 100).toFixed(1));

        const evenLast15 = digits15.filter(d => d % 2 === 0).length;
        const evenIncreasing = (evenLast15 / 15) > (evenCount60 / 60);

        // Dominant side determination
        let dominantSide: 'UNDER' | 'OVER' | 'NEUTRAL' = 'NEUTRAL';
        if (under0_4_pct >= 54 && under0_5_count >= over4_9_count) {
            dominantSide = 'UNDER';
        } else if (over5_9_pct >= 54 && over4_9_count >= under0_5_count) {
            dominantSide = 'OVER';
        }

        // Market Score based on strength and stability of trend
        let marketScore = 50;
        if (dominantSide === 'UNDER') {
            marketScore = Math.round(under0_4_pct * 0.7 + (under0_4_increasing ? 15 : 0) + (digits10.filter(d => d <= 5).length * 2));
        } else if (dominantSide === 'OVER') {
            marketScore = Math.round(over5_9_pct * 0.7 + (over5_9_increasing ? 15 : 0) + (digits10.filter(d => d >= 4).length * 2));
        }

        const prevStats = this.statsMap[symbol];
        this.statsMap[symbol] = {
            symbol,
            displayName: prevStats?.displayName || symbol,
            price: currentPrice,
            lastDigit,
            digits50,
            digits15,
            digits10,
            digits7,
            freq1000,
            freq60,
            freq15,
            under0_4_count,
            over5_9_count,
            under0_4_pct,
            over5_9_pct,
            under0_4_increasing,
            over5_9_increasing,
            under0_5_count,
            over4_9_count,
            under0_5_pct,
            over4_9_pct,
            mostAppearingDigit,
            secondAppearingDigit,
            leastAppearingDigit,
            highestEntryDigitUnder,
            highestEntryDigitOver,
            evenCount60,
            oddCount60,
            evenPct60,
            oddPct60,
            evenIncreasing,
            dominantSide,
            marketScore,
            isBestMarket: false,
        };
    }

    private evaluateBestMarket() {
        let bestSymbol = this.activeSymbol;
        let highestScore = -1;

        Object.keys(this.statsMap).forEach(sym => {
            const s = this.statsMap[sym];
            if (s && s.digits50.length >= 30) {
                if (s.marketScore > highestScore) {
                    highestScore = s.marketScore;
                    bestSymbol = sym;
                }
            }
        });

        Object.keys(this.statsMap).forEach(sym => {
            this.statsMap[sym].isBestMarket = sym === bestSymbol;
        });
    }

    private createEmptyStats(symbol: string, displayName: string): TMarketTickStats {
        const dummyFreq = Array.from({ length: 10 }, (_, i) => ({
            digit: i,
            count: 100,
            percentage: 10.0,
            isIncreasing: false,
        }));

        return {
            symbol,
            displayName,
            price: 0,
            lastDigit: 0,
            digits50: [],
            digits15: [],
            digits10: [],
            digits7: [],
            freq1000: dummyFreq,
            freq60: dummyFreq,
            freq15: dummyFreq,
            under0_4_count: 25,
            over5_9_count: 25,
            under0_4_pct: 50.0,
            over5_9_pct: 50.0,
            under0_4_increasing: false,
            over5_9_increasing: false,
            under0_5_count: 30,
            over4_9_count: 30,
            under0_5_pct: 50.0,
            over4_9_pct: 50.0,
            mostAppearingDigit: 0,
            secondAppearingDigit: 1,
            leastAppearingDigit: 9,
            highestEntryDigitUnder: 3,
            highestEntryDigitOver: 7,
            evenCount60: 30,
            oddCount60: 30,
            evenPct60: 50.0,
            oddPct60: 50.0,
            evenIncreasing: false,
            dominantSide: 'NEUTRAL',
            marketScore: 50,
            isBestMarket: symbol === this.activeSymbol,
        };
    }
}

export const marketDataService = new MarketDataService();
