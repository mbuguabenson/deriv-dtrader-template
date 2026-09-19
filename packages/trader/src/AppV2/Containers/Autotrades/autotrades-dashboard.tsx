import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { routes } from '@deriv/shared';
import { useStore } from '@deriv/stores';

import { autoTradeEngine } from './services/autotrade-engine';
import { keepAliveService } from './services/keepalive-service';
import { marketDataService } from './services/market-data-service';
import { TMarketTickStats } from './services/types';

import { DigitLineChart } from './components/digit-line-chart';
import { DigitStatsCards } from './components/digit-stats-cards';
import { MarketScanner } from './components/market-scanner';
import { StrategyController } from './components/strategy-controller';
import { CompoundingPlanner } from './components/compounding-planner';
import { BotHud } from './components/bot-hud';
import { AutotradesTransactions } from './components/autotrades-transactions';

import './autotrades.scss';

export const AutotradesDashboard = observer(() => {
    const history = useHistory();
    const { client, ui } = useStore();
    const { balance, currency, is_logged_in } = client;
    const { is_dark_mode_on } = ui;

    // Market data state
    const [statsMap, setStatsMap] = useState<Record<string, TMarketTickStats>>({});
    const [activeSymbol, setActiveSymbol] = useState<string>('1HZ100V');
    const [engineState, setEngineState] = useState(autoTradeEngine.getState());

    // Initialize market service and 24/7 keepalive
    useEffect(() => {
        keepAliveService.start();
        marketDataService.init();

        const unsubMarket = marketDataService.subscribe((newStatsMap, currentSymbol) => {
            setStatsMap({ ...newStatsMap });
            setActiveSymbol(currentSymbol);
        });

        const unsubEngine = autoTradeEngine.subscribe(() => {
            setEngineState({ ...autoTradeEngine.getState() });
        });

        return () => {
            unsubMarket();
            unsubEngine();
            keepAliveService.stop();
        };
    }, []);

    // Sync account balance to engine
    useEffect(() => {
        const numBalance = parseFloat(String(balance)) || 100;
        autoTradeEngine.setAccountInfo(numBalance, currency || 'USD');
    }, [balance, currency]);

    const activeStats = statsMap[activeSymbol];

    return (
        <div className={`autotrades-page ${is_dark_mode_on ? 'is-dark-theme' : 'is-light-theme'}`}>
            {/* Top Navigation Header */}
            <header className='autotrades-top-header'>
                <div className='header-left-col'>
                    <button
                        type='button'
                        className='btn-back-to-trade'
                        onClick={() => history.push(routes.index)}
                    >
                        ← Manual Trading
                    </button>
                    <div className='autotrades-branding'>
                        <span className='brand-icon'>🤖</span>
                        <div className='brand-text'>
                            <h2>Elite Pro Autotrades</h2>
                            <small>High-Probability Synthetic Intelligence</small>
                        </div>
                    </div>
                </div>

                <div className='header-right-col'>
                    <div className='account-balance-card'>
                        <span className='balance-label'>ACCOUNT BALANCE</span>
                        <strong className='balance-num'>
                            {currency || 'USD'} {balance !== undefined ? parseFloat(String(balance)).toFixed(2) : '100.00'}
                        </strong>
                    </div>
                </div>
            </header>

            {/* Main Content Layout */}
            <main className='autotrades-content-body'>
                {/* 1. Market Scanner Bar */}
                <MarketScanner
                    statsMap={statsMap}
                    activeSymbol={activeSymbol}
                    autoSwitchEnabled={engineState.config.autoSwitchBestMarket}
                    onToggleAutoSwitch={enabled => autoTradeEngine.setConfig({ autoSwitchBestMarket: enabled })}
                    onSelectMarket={sym => marketDataService.setActiveSymbol(sym)}
                />

                {/* 2. Bot HUD Status Panel */}
                <BotHud
                    botStatus={engineState.botStatus}
                    totalProfit={engineState.totalProfit}
                    totalWins={engineState.totalWins}
                    totalLosses={engineState.totalLosses}
                    consecutiveLosses={engineState.consecutiveLosses}
                    currentStake={engineState.currentStake}
                    isRecoveryActive={engineState.isRecoveryActive}
                />

                {/* 3. Real-Time Visual Analytics: 50-Digit Line Chart */}
                <DigitLineChart stats={activeStats} isDarkMode={is_dark_mode_on} />

                {/* 4. Statistical Analysis Cards: 0-4 vs 5-9, 0-5 vs 4-9, Glowing Entry Digits, Even/Odd Bar, 0-9 Pills */}
                <DigitStatsCards stats={activeStats} isDarkMode={is_dark_mode_on} />

                {/* 5. Strategy Controls (Elite Pro, Differs, Even/Odd, Compounding) */}
                <StrategyController
                    activeStrategy={engineState.activeStrategy}
                    onSelectStrategy={s => autoTradeEngine.setStrategy(s)}
                    config={engineState.config}
                    onChangeConfig={c => autoTradeEngine.setConfig(c)}
                    isRunning={engineState.isRunning}
                    botStatus={engineState.botStatus}
                    onStart={() => autoTradeEngine.start()}
                    onStop={() => autoTradeEngine.stop()}
                    onReset={() => autoTradeEngine.resetStats()}
                    currentStake={engineState.currentStake}
                    accountBalance={engineState.accountBalance}
                />

                {/* 6. Compounding Generator & Challenge Tracker */}
                <CompoundingPlanner
                    accountBalance={engineState.accountBalance}
                    isAutoTradeRunning={engineState.isRunning && engineState.activeStrategy === 'COMPOUNDING'}
                    onStartCompoundingAutoTrade={() => {
                        autoTradeEngine.setStrategy('COMPOUNDING');
                        if (!engineState.isRunning) {
                            autoTradeEngine.start();
                        } else {
                            autoTradeEngine.stop();
                        }
                    }}
                />

                {/* 7. Live Transactions Feed */}
                <AutotradesTransactions tradeLogs={engineState.tradeLogs} />
            </main>
        </div>
    );
});

export default AutotradesDashboard;
