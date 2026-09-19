import { useEffect, useRef, useState } from 'react';

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

    // Auto-resume banner state
    const [autoResumeBanner, setAutoResumeBanner] = useState<string | null>(null);
    const autoResumeAttempted = useRef(false);

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

    // Sync real account balance to engine
    useEffect(() => {
        const numBalance = balance !== undefined && balance !== null ? Number(balance) : 0;
        autoTradeEngine.setAccountInfo(numBalance, currency || 'USD');
    }, [balance, currency]);

    // AUTO-RESUME: when user logs in (or is already logged in), check if bot was running
    // before a network drop / page reload — and auto-restart it silently
    useEffect(() => {
        if (!is_logged_in || autoResumeAttempted.current) return;
        autoResumeAttempted.current = true;

        const shouldResume = autoTradeEngine.wasRunningBeforeReload();
        if (shouldResume && !autoTradeEngine.getState().isRunning) {
            // Small delay to let WS fully reconnect before we start trading
            const resumeTimeout = setTimeout(() => {
                autoTradeEngine.start();
                const strategy = autoTradeEngine.getState().activeStrategy;
                setAutoResumeBanner(
                    `🔄 Auto-resumed ${strategy} trading after reconnect. Bot is running.`
                );
            }, 3000);
            return () => clearTimeout(resumeTimeout);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_logged_in]);

    // NETWORK RECONNECT: if browser goes offline then back online, restart the bot
    useEffect(() => {
        let offlineTime = 0;

        const handleOffline = () => {
            offlineTime = Date.now();
            // eslint-disable-next-line no-console
            console.warn('[AutotradesDashboard] Network offline — bot paused');
        };

        const handleOnline = () => {
            const downFor = Date.now() - offlineTime;
            // eslint-disable-next-line no-console
            console.log(`[AutotradesDashboard] Network restored after ${Math.round(downFor / 1000)}s`);

            // If bot was running before disconnect, auto-resume
            if (autoTradeEngine.wasRunningBeforeReload()) {
                // Wait 4s for WS to fully reconnect before resuming
                setTimeout(() => {
                    if (!autoTradeEngine.getState().isRunning) {
                        autoTradeEngine.start();
                        setAutoResumeBanner(
                            `✅ Network restored — bot auto-resumed after ${Math.round(downFor / 1000)}s offline`
                        );
                    }
                }, 4000);
            }
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

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
                        <div className='balance-account-type'>
                            <span className={`account-badge ${client.is_virtual ? 'is-demo' : 'is-real'}`}>
                                {client.is_virtual ? 'DEMO' : 'REAL'}
                            </span>
                            {client.loginid && <span className='account-loginid'>{client.loginid}</span>}
                        </div>
                        <span className='balance-label'>LIVE BALANCE</span>
                        <strong className='balance-num'>
                            {currency || 'USD'} {balance !== undefined && balance !== null ? Number(balance).toFixed(2) : '0.00'}
                        </strong>
                    </div>
                </div>
            </header>

            {!is_logged_in && (
                <div className='autotrades-login-banner'>
                    <span>⚠️ <strong>Not Logged In:</strong> Please log in to your Deriv account to connect live market streams and trade with real account funds.</span>
                </div>
            )}

            {/* Auto-Resume Notification Banner */}
            {autoResumeBanner && (
                <div className='autotrades-resume-banner'>
                    <span>{autoResumeBanner}</span>
                    <button
                        type='button'
                        className='btn-dismiss-banner'
                        onClick={() => setAutoResumeBanner(null)}
                    >
                        ✕
                    </button>
                </div>
            )}

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
                    onStop={() => autoTradeEngine.stop(true)} // clearPersist=true: user stops intentionally
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
                            autoTradeEngine.stop(true); // clearPersist=true
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
