import React from 'react';
import { TBotStatus, TStrategyConfig, TStrategyType } from '../services/types';

type TStrategyControllerProps = {
    activeStrategy: TStrategyType;
    onSelectStrategy: (strategy: TStrategyType) => void;
    config: TStrategyConfig;
    onChangeConfig: (newConfig: Partial<TStrategyConfig>) => void;
    isRunning: boolean;
    botStatus: TBotStatus;
    onStart: () => void;
    onStop: () => void;
    onReset: () => void;
    currentStake: number;
    accountBalance: number;
};

export const StrategyController: React.FC<TStrategyControllerProps> = ({
    activeStrategy,
    onSelectStrategy,
    config,
    onChangeConfig,
    isRunning,
    botStatus: _botStatus,
    onStart,
    onStop,
    onReset,
    currentStake,
    accountBalance,
}) => {
    return (
        <div className='autotrades-controller-card'>
            {/* Strategy Tabs Header */}
            <div className='strategy-tabs-bar'>
                <button
                    type='button'
                    className={`strategy-tab-btn ${activeStrategy === 'ELITE_PRO' ? 'active' : ''}`}
                    onClick={() => onSelectStrategy('ELITE_PRO')}
                >
                    👑 Elite Pro (Over 3 / Under 6)
                </button>
                <button
                    type='button'
                    className={`strategy-tab-btn ${activeStrategy === 'SMART_DIFFERS' ? 'active' : ''}`}
                    onClick={() => onSelectStrategy('SMART_DIFFERS')}
                >
                    🎯 Smart Differs (2–7)
                </button>
                <button
                    type='button'
                    className={`strategy-tab-btn ${activeStrategy === 'EVEN_ODD' ? 'active' : ''}`}
                    onClick={() => onSelectStrategy('EVEN_ODD')}
                >
                    ⚖ Even / Odd Trend AI
                </button>
                <button
                    type='button'
                    className={`strategy-tab-btn ${activeStrategy === 'COMPOUNDING' ? 'active' : ''}`}
                    onClick={() => onSelectStrategy('COMPOUNDING')}
                >
                    📈 Compounding Challenge
                </button>
                <button
                    type='button'
                    className={`strategy-tab-btn ${activeStrategy === 'INTERLOCKING' ? 'active' : ''}`}
                    onClick={() => onSelectStrategy('INTERLOCKING')}
                >
                    🔗 Interlocking AI
                </button>
            </div>

            {/* Strategy Description Banner */}
            <div className='strategy-description-banner'>
                {activeStrategy === 'ELITE_PRO' && (
                    <p>
                        <strong>Elite Pro Engine:</strong> High-probability market power scanner trading Under 6 or Over 3. Requires 55%+ directional power, 7 of 10 recent ticks confirmation, safety filters on 1,000 ticks, and triggers on the highest glowing entry digit.
                    </p>
                )}
                {activeStrategy === 'SMART_DIFFERS' && (
                    <p>
                        <strong>Smart Differs Engine:</strong> Trades digits 2–7 with &lt;10% frequency and &lt;3 appearances in 15 ticks (excluding edge digits 0,1,8,9). Enters after 3 safe ticks with 2x Over 2 / Under 8 single-loss recovery!
                    </p>
                )}
                {activeStrategy === 'EVEN_ODD' && (
                    <p>
                        <strong>Even/Odd Trend AI:</strong> Waits for &gt;=58% parity dominance in 60 ticks and 10 of 15 ticks parity alignment. Enters on 2+ opposite parity then 1 matching parity tick.
                    </p>
                )}
                {activeStrategy === 'COMPOUNDING' && (
                    <p>
                        <strong>Compounding Auto-Trader:</strong> Automatically executes high-probability trades towards the target profit for each hour/day, locking in profits and auto-ticking challenge milestones!
                    </p>
                )}
                {activeStrategy === 'INTERLOCKING' && (
                    <p>
                        <strong>Interlocking AI Engine:</strong> Dynamically paired contract engine with automatic state-flip on loss. Alternates between complementary contracts (Even ↔ Odd or Under 6 ↔ Over 3), preventing streak traps and enforcing strict atomic execution locks.
                    </p>
                )}
            </div>

            {/* Strategy Parameters Form */}
            <div className='strategy-params-grid'>
                {/* Stake Control */}
                <div className='param-group'>
                    <div className='param-header-label'>
                        <span>Stake Mode</span>
                        <span className='param-sub-info'>Balance: ${accountBalance.toFixed(2)}</span>
                    </div>
                    <div className='param-toggle-buttons'>
                        <button
                            type='button'
                            className={`param-toggle-btn ${config.isAutoStakePercent ? 'is-active' : ''}`}
                            onClick={() => onChangeConfig({ isAutoStakePercent: true })}
                        >
                            Auto 7% Balance
                        </button>
                        <button
                            type='button'
                            className={`param-toggle-btn ${!config.isAutoStakePercent ? 'is-active' : ''}`}
                            onClick={() => onChangeConfig({ isAutoStakePercent: false })}
                        >
                            Manual Stake ($)
                        </button>
                    </div>
                    <div className='param-input-wrap'>
                        {config.isAutoStakePercent ? (
                            <div className='param-auto-stake-display'>
                                <span>Active Stake:</span>
                                <strong>${currentStake.toFixed(2)}</strong>
                                <span className='param-pct-hint'>(7% of account)</span>
                            </div>
                        ) : (
                            <input
                                type='number'
                                min='0.35'
                                step='0.5'
                                value={config.stake}
                                onChange={e => onChangeConfig({ stake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })}
                                className='param-input'
                                placeholder='Stake ($)'
                            />
                        )}
                    </div>
                </div>

                {/* Duration Ticks */}
                <div className='param-group'>
                    <div className='param-header-label'>
                        <span>Duration (Ticks)</span>
                        <span className='param-sub-info'>Rec: 1 or 2</span>
                    </div>
                    <div className='param-toggle-buttons'>
                        <button
                            type='button'
                            className={`param-toggle-btn ${config.durationTicks === 1 ? 'is-active' : ''}`}
                            onClick={() => onChangeConfig({ durationTicks: 1 })}
                        >
                            1 Tick
                        </button>
                        <button
                            type='button'
                            className={`param-toggle-btn ${config.durationTicks === 2 ? 'is-active' : ''}`}
                            onClick={() => onChangeConfig({ durationTicks: 2 })}
                        >
                            2 Ticks
                        </button>
                    </div>
                </div>

                {/* Martingale Multiplier */}
                <div className='param-group'>
                    <div className='param-header-label'>
                        <span>Martingale Multiplier</span>
                        <span className='param-sub-info'>Auto: 2.6x</span>
                    </div>
                    <input
                        type='number'
                        min='1.0'
                        step='0.1'
                        value={config.martingaleMultiplier}
                        onChange={e => onChangeConfig({ martingaleMultiplier: parseFloat(e.target.value) || 2.6 })}
                        className='param-input'
                    />
                </div>

                {/* Take Profit */}
                <div className='param-group'>
                    <div className='param-header-label'>
                        <span>Take Profit ($)</span>
                        <span className='param-sub-info'>Auto Pause</span>
                    </div>
                    <input
                        type='number'
                        min='1'
                        step='5'
                        value={config.takeProfit}
                        onChange={e => onChangeConfig({ takeProfit: parseFloat(e.target.value) || 0 })}
                        className='param-input'
                        placeholder='Take Profit ($)'
                    />
                </div>

                {/* Stop Loss */}
                <div className='param-group'>
                    <div className='param-header-label'>
                        <span>Stop Loss ($)</span>
                        <span className='param-sub-info'>Risk Limit</span>
                    </div>
                    <input
                        type='number'
                        min='1'
                        step='5'
                        value={config.stopLoss}
                        onChange={e => onChangeConfig({ stopLoss: parseFloat(e.target.value) || 0 })}
                        className='param-input'
                        placeholder='Stop Loss ($)'
                    />
                </div>

                {/* Signal Batch Guardian (Pause after N runs & re-analyze) */}
                <div className='param-group'>
                    <div className='param-header-label'>
                        <span>Signal Run Limit</span>
                        <span className='param-sub-info'>Pause & Re-analyze</span>
                    </div>
                    <div className='param-toggle-buttons'>
                        {[3, 5, 10].map(runs => (
                            <button
                                key={runs}
                                type='button'
                                className={`param-toggle-btn ${
                                    (config.maxRunsPerSignalBatch || 5) === runs ? 'is-active' : ''
                                }`}
                                onClick={() => onChangeConfig({ maxRunsPerSignalBatch: runs })}
                            >
                                {runs} Runs
                            </button>
                        ))}
                    </div>
                </div>

                {/* Over/Under Prediction Pair: available for ELITE_PRO and INTERLOCKING (when OVER_UNDER selected) */}
                {(activeStrategy === 'ELITE_PRO' ||
                    (activeStrategy === 'INTERLOCKING' && config.interlockingPair === 'OVER_UNDER')) && (
                    <div className='param-group param-group-wide'>
                        <div className='param-header-label'>
                            <span>Prediction Pair</span>
                            <span className='param-sub-info'>
                                {config.eliteProPreset === 'AUTO'
                                    ? '🤖 AI Adaptive'
                                    : config.eliteProPreset === 'OVER1_UNDER8'
                                    ? 'Over 1 / Under 8 (Ultra Safe)'
                                    : config.eliteProPreset === 'OVER2_UNDER7'
                                    ? 'Over 2 / Under 7 (Safe)'
                                    : `Over ${config.eliteProPredictionOver || 3} / Under ${config.eliteProPredictionUnder || 6}`}
                            </span>
                        </div>
                        <div className='param-toggle-buttons' style={{ flexWrap: 'wrap' }}>
                            <button
                                type='button'
                                className={`param-toggle-btn ${
                                    !config.eliteProPreset || config.eliteProPreset === 'OVER3_UNDER6'
                                        ? 'is-active'
                                        : ''
                                }`}
                                onClick={() =>
                                    onChangeConfig({
                                        eliteProPreset: 'OVER3_UNDER6',
                                        eliteProPredictionOver: 3,
                                        eliteProPredictionUnder: 6,
                                    })
                                }
                            >
                                Over 3 / Under 6
                            </button>
                            <button
                                type='button'
                                className={`param-toggle-btn ${
                                    config.eliteProPreset === 'OVER2_UNDER7' ? 'is-active' : ''
                                }`}
                                onClick={() =>
                                    onChangeConfig({
                                        eliteProPreset: 'OVER2_UNDER7',
                                        eliteProPredictionOver: 2,
                                        eliteProPredictionUnder: 7,
                                    })
                                }
                            >
                                Over 2 / Under 7
                            </button>
                            <button
                                type='button'
                                className={`param-toggle-btn ${
                                    config.eliteProPreset === 'OVER1_UNDER8' ? 'is-active' : ''
                                }`}
                                onClick={() =>
                                    onChangeConfig({
                                        eliteProPreset: 'OVER1_UNDER8',
                                        eliteProPredictionOver: 1,
                                        eliteProPredictionUnder: 8,
                                    })
                                }
                            >
                                Over 1 / Under 8
                            </button>
                            <button
                                type='button'
                                className={`param-toggle-btn ${config.eliteProPreset === 'AUTO' ? 'is-active' : ''}`}
                                onClick={() => onChangeConfig({ eliteProPreset: 'AUTO' })}
                            >
                                🤖 Auto Choose
                            </button>
                        </div>
                    </div>
                )}

                {activeStrategy === 'SMART_DIFFERS' && (
                    <div className='param-group'>
                        <div className='param-header-label'>
                            <span>Differs Settings</span>
                            <span className='param-sub-info'>Max Runs: 7</span>
                        </div>
                        <div className='param-dual-inputs'>
                            <div>
                                <label className='param-small-label'>Bulk Runs:</label>
                                <input
                                    type='number'
                                    min='1'
                                    max='15'
                                    value={config.differsBulkPurchase}
                                    onChange={e => onChangeConfig({ differsBulkPurchase: Number(e.target.value) || 6 })}
                                    className='param-input-small'
                                />
                            </div>
                            <div>
                                <label className='param-small-label'>2x Recovery:</label>
                                <button
                                    type='button'
                                    className={`param-toggle-btn ${config.differsRecoveryMode ? 'is-active' : ''}`}
                                    onClick={() => onChangeConfig({ differsRecoveryMode: !config.differsRecoveryMode })}
                                >
                                    {config.differsRecoveryMode ? 'Over2/Under8' : 'Disabled'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeStrategy === 'EVEN_ODD' && (
                    <div className='param-group'>
                        <div className='param-header-label'>
                            <span>Loss Recovery</span>
                            <span className='param-sub-info'>2x Multiplier</span>
                        </div>
                        <button
                            type='button'
                            className={`param-toggle-btn ${config.evenOddRecoveryMode ? 'is-active' : ''}`}
                            onClick={() => onChangeConfig({ evenOddRecoveryMode: !config.evenOddRecoveryMode })}
                        >
                            {config.evenOddRecoveryMode ? 'Over 2 / Under 8 Recovery Enabled' : 'Disabled'}
                        </button>
                    </div>
                )}

                {activeStrategy === 'INTERLOCKING' && (
                    <div className='param-group'>
                        <div className='param-header-label'>
                            <span>Interlocking Pair</span>
                            <span className='param-sub-info'>Dynamic Reversal</span>
                        </div>
                        <div className='param-toggle-buttons'>
                            <button
                                type='button'
                                className={`param-toggle-btn ${config.interlockingPair === 'EVEN_ODD' ? 'is-active' : ''}`}
                                onClick={() => onChangeConfig({ interlockingPair: 'EVEN_ODD' })}
                            >
                                Even ↔ Odd
                            </button>
                            <button
                                type='button'
                                className={`param-toggle-btn ${config.interlockingPair === 'OVER_UNDER' ? 'is-active' : ''}`}
                                onClick={() => onChangeConfig({ interlockingPair: 'OVER_UNDER' })}
                            >
                                Under 6 ↔ Over 3
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Launch & Control Actions */}
            <div className='strategy-actions-row'>
                {!isRunning ? (
                    <button type='button' className='btn-start-autotrade' onClick={onStart}>
                        <span className='btn-icon'>▶</span>
                        <span>START AUTOTRADING</span>
                    </button>
                ) : (
                    <button type='button' className='btn-stop-autotrade' onClick={onStop}>
                        <span className='btn-icon'>⏹</span>
                        <span>STOP AUTOTRADING</span>
                    </button>
                )}

                <button type='button' className='btn-reset-stats' onClick={onReset}>
                    Reset Session P&L
                </button>
            </div>
        </div>
    );
};
