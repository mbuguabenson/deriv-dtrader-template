import React from 'react';
import { TBotStatus } from '../services/types';

type TBotHudProps = {
    botStatus: TBotStatus;
    totalProfit: number;
    totalWins: number;
    totalLosses: number;
    consecutiveLosses: number;
    currentStake: number;
    isRecoveryActive: boolean;
    batchRunCount?: number;
    reanalyzeTicksRemaining?: number;
};

export const BotHud: React.FC<TBotHudProps> = ({
    botStatus,
    totalProfit,
    totalWins,
    totalLosses,
    consecutiveLosses,
    currentStake,
    isRecoveryActive,
    batchRunCount = 0,
    reanalyzeTicksRemaining = 0,
}) => {
    const totalTrades = totalWins + totalLosses;
    const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;

    const getStatusBadge = () => {
        switch (botStatus) {
            case 'IDLE':
                return { text: '⚪ IDLE (Ready to Start)', className: 'status-idle' };
            case 'SCANNING':
                return { text: '🔍 SCANNING MARKET PATTERNS', className: 'status-scanning' };
            case 'ANALYZING':
                return { text: '⚡ ANALYZING MOMENTUM & TICKS', className: 'status-analyzing' };
            case 'WAITING_TRIGGER':
                return { text: '🎯 CONDITIONS MET: WAITING ENTRY DIGIT', className: 'status-trigger' };
            case 'EXECUTING':
                return { text: '🚀 EXECUTING TRADE VIA DERIV API', className: 'status-executing' };
            case 'COOLDOWN':
                return {
                    text:
                        reanalyzeTicksRemaining > 0
                            ? `⏳ RE-ANALYZING MARKET: Pausing after 5 runs (${reanalyzeTicksRemaining} ticks left)`
                            : '⏳ POST-TRADE COOLDOWN: Re-analyzing Signal',
                    className: 'status-cooldown',
                };
            case 'PAUSED':
                return { text: '⏸ PAUSED (Stop Loss / Boundary)', className: 'status-paused' };
            case 'TARGET_REACHED':
                return { text: '🎉 TARGET PROFIT ACHIEVED!', className: 'status-target' };
            default:
                return { text: botStatus, className: 'status-idle' };
        }
    };

    const statusBadge = getStatusBadge();

    return (
        <div className='autotrades-hud-container'>
            {/* Live Status Bar */}
            <div className={`hud-status-banner ${statusBadge.className}`}>
                <div className='status-pulse-dot' />
                <span className='status-text'>{statusBadge.text}</span>
                {botStatus !== 'IDLE' && botStatus !== 'PAUSED' && botStatus !== 'TARGET_REACHED' && (
                    <span className='batch-counter-badge' style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.85, fontWeight: 600 }}>
                        Signal Batch: {batchRunCount}/5 Runs
                    </span>
                )}
                {isRecoveryActive && (
                    <span className='recovery-mode-badge'>⚠️ 2x Recovery Active (Over 2 / Under 8)</span>
                )}
            </div>

            {/* Live Metrics Grid */}
            <div className='hud-metrics-grid'>
                <div className='hud-metric-box'>
                    <span className='metric-label'>Session Net P&L</span>
                    <strong className={`metric-val ${totalProfit >= 0 ? 'profit-green' : 'loss-red'}`}>
                        {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
                    </strong>
                </div>

                <div className='hud-metric-box'>
                    <span className='metric-label'>Win Rate</span>
                    <strong className='metric-val color-cyan'>
                        {winRate}% <small>({totalWins}W / {totalLosses}L)</small>
                    </strong>
                </div>

                <div className='hud-metric-box'>
                    <span className='metric-label'>Active Stake</span>
                    <strong className='metric-val color-yellow'>
                        ${currentStake.toFixed(2)}
                    </strong>
                </div>

                <div className='hud-metric-box'>
                    <span className='metric-label'>Consecutive Losses</span>
                    <strong className={`metric-val ${consecutiveLosses > 0 ? 'loss-red' : ''}`}>
                        {consecutiveLosses}
                    </strong>
                </div>
            </div>
        </div>
    );
};
