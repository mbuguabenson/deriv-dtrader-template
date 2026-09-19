import React from 'react';
import { TMarketTickStats } from '../services/types';

type TDigitStatsCardsProps = {
    stats?: TMarketTickStats;
    isDarkMode?: boolean;
};

export const DigitStatsCards: React.FC<TDigitStatsCardsProps> = ({ stats }) => {
    if (!stats) return null;

    const {
        under0_4_count,
        over5_9_count,
        under0_4_pct,
        over5_9_pct,
        under0_4_increasing,
        under0_5_count,
        over4_9_count,
        under0_5_pct,
        over4_9_pct,
        highestEntryDigitUnder,
        highestEntryDigitOver,
        freq1000,
        mostAppearingDigit,
        secondAppearingDigit,
        leastAppearingDigit,
        evenCount60,
        oddCount60,
        evenPct60,
        oddPct60,
        evenIncreasing,
        dominantSide,
    } = stats;

    let powerBadgeClass = 'power-neutral';
    let powerBadgeText = '⚖ Balanced';
    if (dominantSide === 'UNDER') {
        powerBadgeClass = 'power-under';
        powerBadgeText = '🔥 Under Power';
    } else if (dominantSide === 'OVER') {
        powerBadgeClass = 'power-over';
        powerBadgeText = '🔥 Over Power';
    }

    return (
        <div className='autotrades-stats-grid'>
            {/* CARD 1: Under 0-4 vs Over 5-9 */}
            <div className='autotrades-stat-card'>
                <div className='stat-card-title-row'>
                    <span className='stat-card-title'>Under 0–4 vs Over 5–9 (50 Ticks)</span>
                    <span className={`stat-trend-badge ${under0_4_increasing ? 'trend-up' : 'trend-down'}`}>
                        {under0_4_increasing ? '↗ Under Rising' : '↘ Over Rising'}
                    </span>
                </div>
                <div className='stat-card-split'>
                    <div className='stat-split-side side-under'>
                        <span className='split-label'>Under 0–4</span>
                        <span className='split-value'>{under0_4_pct}%</span>
                        <span className='split-count'>{under0_4_count} Digits</span>
                    </div>
                    <div className='stat-split-divider' />
                    <div className='stat-split-side side-over'>
                        <span className='split-label'>Over 5–9</span>
                        <span className='split-value'>{over5_9_pct}%</span>
                        <span className='split-count'>{over5_9_count} Digits</span>
                    </div>
                </div>
                <div className='stat-progress-bar-dual'>
                    <div className='bar-fill-under' style={{ width: `${under0_4_pct}%` }} />
                    <div className='bar-fill-over' style={{ width: `${over5_9_pct}%` }} />
                </div>
            </div>

            {/* CARD 2: Under 0-5 vs Over 4-9 (Power Analysis) */}
            <div className='autotrades-stat-card'>
                <div className='stat-card-title-row'>
                    <span className='stat-card-title'>Market Power (0–5 vs 4–9)</span>
                    <span className={`stat-trend-badge ${powerBadgeClass}`}>
                        {powerBadgeText}
                    </span>
                </div>
                <div className='stat-card-split'>
                    <div className='stat-split-side side-under'>
                        <span className='split-label'>Under 0–5</span>
                        <span className='split-value'>{under0_5_pct}%</span>
                        <span className='split-count'>{under0_5_count} Under</span>
                    </div>
                    <div className='stat-split-divider' />
                    <div className='stat-split-side side-over'>
                        <span className='split-label'>Over 4–9</span>
                        <span className='split-value'>{over4_9_pct}%</span>
                        <span className='split-count'>{over4_9_count} Over</span>
                    </div>
                </div>
                <div className='stat-market-note'>
                    {under0_5_count >= over4_9_count
                        ? `Market strongly favors Under (${under0_5_count} Under vs ${over4_9_count} Over)`
                        : `Market strongly favors Over (${over4_9_count} Over vs ${under0_5_count} Under)`}
                </div>
            </div>

            {/* CARD 3: Glowing Entry Digit Card */}
            <div className='autotrades-stat-card autotrades-glowing-entry-card'>
                <div className='stat-card-title-row'>
                    <span className='stat-card-title'>⚡ High-Probability Entry Digits</span>
                    <span className='stat-glowing-indicator'>Active Signals</span>
                </div>
                <div className='entry-digits-row'>
                    <div className='entry-digit-box under-glow'>
                        <span className='entry-box-label'>UNDER ENTRY</span>
                        <div className='entry-digit-circle neon-under'>
                            {highestEntryDigitUnder}
                        </div>
                        <span className='entry-box-hint'>Triggers Under 6</span>
                    </div>
                    <div className='entry-digit-box over-glow'>
                        <span className='entry-box-label'>OVER ENTRY</span>
                        <div className='entry-digit-circle neon-over'>
                            {highestEntryDigitOver}
                        </div>
                        <span className='entry-box-hint'>Triggers Over 3</span>
                    </div>
                </div>
            </div>

            {/* CARD 4: Even vs Odd Progress Bar (Last 60 Ticks) */}
            <div className='autotrades-stat-card'>
                <div className='stat-card-title-row'>
                    <span className='stat-card-title'>Even vs Odd Analysis (60 Ticks)</span>
                    <span className={`stat-trend-badge ${evenIncreasing ? 'trend-up' : 'trend-down'}`}>
                        {evenIncreasing ? '↗ Even Gaining' : '↘ Odd Gaining'}
                    </span>
                </div>
                <div className='stat-card-split'>
                    <div className='stat-split-side'>
                        <span className='split-label'>EVEN</span>
                        <span className='split-value' style={{ color: '#00a79e' }}>{evenPct60}%</span>
                        <span className='split-count'>{evenCount60} Ticks</span>
                    </div>
                    <div className='stat-split-divider' />
                    <div className='stat-split-side'>
                        <span className='split-label'>ODD</span>
                        <span className='split-value' style={{ color: '#ff444f' }}>{oddPct60}%</span>
                        <span className='split-count'>{oddCount60} Ticks</span>
                    </div>
                </div>
                <div className='stat-progress-bar-dual'>
                    <div className='bar-fill-under' style={{ width: `${evenPct60}%` }} />
                    <div className='bar-fill-over' style={{ width: `${oddPct60}%` }} />
                </div>
            </div>

            {/* CARD 5: Full 0-9 Digit Distribution with Excluded Edge Digits */}
            <div className='autotrades-stat-card autotrades-card-full-width'>
                <div className='stat-card-title-row'>
                    <span className='stat-card-title'>Digit Frequency Distribution (1,000 Ticks)</span>
                    <div className='stat-key-tags'>
                        <span className='key-tag most-tag'>1st: Digit {mostAppearingDigit}</span>
                        <span className='key-tag second-tag'>2nd: Digit {secondAppearingDigit}</span>
                        <span className='key-tag least-tag'>Least: Digit {leastAppearingDigit}</span>
                        <span className='key-tag excluded-tag'>Excluded: 0, 1, 8, 9</span>
                    </div>
                </div>
                <div className='digit-frequency-grid'>
                    {freq1000.map(item => {
                        const isEdgeDigit = [0, 1, 8, 9].includes(item.digit);
                        const isMost = item.digit === mostAppearingDigit;
                        const isSecond = item.digit === secondAppearingDigit;
                        const isLeast = item.digit === leastAppearingDigit;

                        let highlightClass = '';
                        if (isMost) highlightClass = 'is-most';
                        else if (isSecond) highlightClass = 'is-second';
                        else if (isLeast) highlightClass = 'is-least';
                        if (isEdgeDigit) highlightClass += ' is-edge-fainted';

                        return (
                            <div key={`freq-${item.digit}`} className={`digit-freq-pill ${highlightClass}`}>
                                <div className='pill-digit-num'>{item.digit}</div>
                                <div className='pill-percentage'>{item.percentage}%</div>
                                <div className='pill-count-sub'>{item.count}</div>
                                {isMost && <span className='pill-badge'>MAX</span>}
                                {isSecond && <span className='pill-badge pill-badge-second'>2ND</span>}
                                {isLeast && <span className='pill-badge pill-badge-min'>MIN</span>}
                                {isEdgeDigit && <span className='pill-badge pill-badge-edge'>EDGE</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
