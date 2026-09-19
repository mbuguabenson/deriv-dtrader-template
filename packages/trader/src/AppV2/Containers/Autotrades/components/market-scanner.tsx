import React, { useState } from 'react';
import { SYNTHETIC_MARKETS } from '../services/market-data-service';
import { TMarketTickStats } from '../services/types';

type TMarketScannerProps = {
    statsMap: Record<string, TMarketTickStats>;
    activeSymbol: string;
    autoSwitchEnabled: boolean;
    onToggleAutoSwitch: (enabled: boolean) => void;
    onSelectMarket: (symbol: string) => void;
};

export const MarketScanner: React.FC<TMarketScannerProps> = ({
    statsMap,
    activeSymbol,
    autoSwitchEnabled,
    onToggleAutoSwitch,
    onSelectMarket,
}) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    return (
        <div className='autotrades-scanner-container'>
            {/* Scanner Controls Bar */}
            <div className='scanner-top-bar'>
                <div className='scanner-title-group'>
                    <span className='scanner-title'>📊 Synthetic Indices Scanner</span>
                    <span className='scanner-count-badge'>{SYNTHETIC_MARKETS.length} Markets</span>
                </div>

                <div className='scanner-actions-group'>
                    <label className='scanner-auto-switch-toggle'>
                        <input
                            type='checkbox'
                            checked={autoSwitchEnabled}
                            onChange={e => onToggleAutoSwitch(e.target.checked)}
                        />
                        <span className='switch-slider' />
                        <span className='switch-label'>Auto-Select Best Market</span>
                    </label>

                    <button
                        type='button'
                        className='scanner-expand-btn'
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? '▲ Collapse View' : '▼ Wide Market Grid'}
                    </button>
                </div>
            </div>

            {/* Expanded Wide Grid View */}
            {isExpanded ? (
                <div className='scanner-wide-grid'>
                    {SYNTHETIC_MARKETS.map(m => {
                        const s = statsMap[m.symbol];
                        const isSelected = m.symbol === activeSymbol;
                        const isBest = s?.isBestMarket;

                        return (
                            <div
                                key={m.symbol}
                                className={`scanner-market-card ${isSelected ? 'is-selected' : ''} ${isBest ? 'is-best-market' : ''}`}
                                onClick={() => onSelectMarket(m.symbol)}
                            >
                                <div className='market-card-head'>
                                    <span className='market-card-name'>{m.displayName}</span>
                                    {isBest && <span className='best-market-badge'>⭐ BEST MARKET</span>}
                                </div>
                                <div className='market-card-body'>
                                    <div className='market-price-col'>
                                        <span className='market-price-label'>Price</span>
                                        <span className='market-price-val'>
                                            {s && s.price > 0 ? `$${s.price.toFixed(s.pipSize ?? 2)}` : 'Loading...'}
                                        </span>
                                    </div>
                                    <div className='market-last-digit-box'>
                                        <span className='digit-box-label'>Last</span>
                                        <span className={`digit-box-num ${s && s.lastDigit <= 4 ? 'is-under' : 'is-over'}`}>
                                            {s ? s.lastDigit : '-'}
                                        </span>
                                    </div>
                                </div>
                                {s && s.digits50.length > 0 && (
                                    <div className='market-card-mini-stats'>
                                        <span>Under: {s.under0_4_pct}%</span>
                                        <span>Over: {s.over5_9_pct}%</span>
                                        <span className='score-badge'>Score: {s.marketScore}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Collapsed Horizontal Quick Selector */
                <div className='scanner-horizontal-chips'>
                    {SYNTHETIC_MARKETS.map(m => {
                        const s = statsMap[m.symbol];
                        const isSelected = m.symbol === activeSymbol;
                        const isBest = s?.isBestMarket;

                        return (
                            <button
                                key={m.symbol}
                                type='button'
                                className={`scanner-chip ${isSelected ? 'is-selected' : ''} ${isBest ? 'is-best' : ''}`}
                                onClick={() => onSelectMarket(m.symbol)}
                            >
                                <span className='chip-symbol'>{m.displayName.replace(' Index', '').replace('Volatility ', 'V')}</span>
                                {s && <span className='chip-digit'>{s.lastDigit}</span>}
                                {isBest && <span className='chip-star'>⭐</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
