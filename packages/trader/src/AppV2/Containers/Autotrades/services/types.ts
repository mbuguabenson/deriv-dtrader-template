export type TMarketTickStats = {
    symbol: string;
    displayName: string;
    price: number;
    pipSize: number;
    lastDigit: number;
    digits50: number[];
    digits15: number[];
    digits10: number[];
    digits7: number[];
    freq1000: { digit: number; count: number; percentage: number; isIncreasing: boolean }[];
    freq60: { digit: number; count: number; percentage: number; isIncreasing: boolean }[];
    freq15: { digit: number; count: number; percentage: number }[];
    under0_4_count: number;
    over5_9_count: number;
    under0_4_pct: number;
    over5_9_pct: number;
    under0_4_increasing: boolean;
    over5_9_increasing: boolean;
    under0_5_count: number;
    over4_9_count: number;
    under0_5_pct: number;
    over4_9_pct: number;
    mostAppearingDigit: number;
    secondAppearingDigit: number;
    leastAppearingDigit: number;
    highestEntryDigitUnder: number;
    highestEntryDigitOver: number;
    evenCount60: number;
    oddCount60: number;
    evenPct60: number;
    oddPct60: number;
    evenIncreasing: boolean;
    dominantSide: 'UNDER' | 'OVER' | 'NEUTRAL';
    marketScore: number;
    isBestMarket: boolean;
};

export type TStrategyType = 'ELITE_PRO' | 'SMART_DIFFERS' | 'EVEN_ODD' | 'COMPOUNDING' | 'INTERLOCKING';

export type TBotStatus =
    | 'IDLE'
    | 'SCANNING'
    | 'ANALYZING'
    | 'WAITING_TRIGGER'
    | 'EXECUTING'
    | 'COOLDOWN'
    | 'PAUSED'
    | 'TARGET_REACHED';

export type TTradeLogItem = {
    id: string;
    contractId?: number;
    timestamp: string;
    symbol: string;
    strategy: TStrategyType;
    contractType: string;
    barrier?: string | number;
    stake: number;
    payout: number;
    profit: number;
    status: 'WON' | 'LOST' | 'PENDING';
    entryDigit?: number;
    exitDigit?: number;
    errorMessage?: string;
};

export type TCompoundingRow = {
    step: number;
    timeLabel: string;
    startingBalance: number;
    targetProfit: number;
    endingBalance: number;
    isCompleted: boolean;
};

export type TStrategyConfig = {
    // General
    stake: number;
    isAutoStakePercent: boolean;
    stakePercent: number;
    takeProfit: number;
    stopLoss: number;
    durationTicks: number; // 1 or 2
    martingaleMultiplier: number;
    autoSwitchBestMarket: boolean;
    soundEnabled: boolean;
    
    // Strategy Specific
    eliteProPreset?: 'AUTO' | 'OVER3_UNDER6' | 'OVER2_UNDER7' | 'OVER1_UNDER8' | 'CUSTOM';
    eliteProPredictionUnder: number; // 6, 7, 8 (default 6)
    eliteProPredictionOver: number; // 1, 2, 3 (default 3)
    differsCandidateDigit: number; // 2 to 7
    differsMaxRuns: number; // default 7
    differsBulkPurchase: number; // default 6
    differsRecoveryMode: boolean; // 2x on Over 2 / Under 8
    evenOddRecoveryMode: boolean;
    interlockingPair: 'EVEN_ODD' | 'OVER_UNDER';
    interlockingFlipOnLoss: boolean;
    maxRunsPerSignalBatch: number; // default 5: pause & re-analyze after 5 trades
    reanalyzeCooldownTicks: number; // default 15: ticks required to verify fresh signal
};
