import React from 'react';
import { useStore } from '@deriv/stores';
import { TTradeLogItem } from '../services/types';

type TAutotradesTransactionsProps = {
    tradeLogs: TTradeLogItem[];
};

export const AutotradesTransactions: React.FC<TAutotradesTransactionsProps> = ({ tradeLogs }) => {
    const { ui } = useStore();

    const handleOpenTransactionDrawer = () => {
        if (ui && typeof ui.setSidebarFlyout === 'function') {
            ui.setSidebarFlyout('positions');
        }
    };

    return (
        <div className='autotrades-transactions-card'>
            <div className='transactions-header-row'>
                <div className='transactions-title-group'>
                    <span className='transactions-title'>📋 Live Trade Execution Feed</span>
                    <span className='transactions-count-badge'>{tradeLogs.length} Executed</span>
                </div>

                <button
                    type='button'
                    className='btn-open-positions-drawer'
                    onClick={handleOpenTransactionDrawer}
                >
                    📑 Open Deriv Transaction Drawer
                </button>
            </div>

            {tradeLogs.length === 0 ? (
                <div className='transactions-empty-state'>
                    <span>No trades executed yet. Click "Start Autotrading" above to begin.</span>
                </div>
            ) : (
                <div className='transactions-table-wrap'>
                    <table className='transactions-table'>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Market</th>
                                <th>Strategy</th>
                                <th>Contract Type</th>
                                <th>Barrier / Pred</th>
                                <th>Stake</th>
                                <th>Payout / Return</th>
                                <th>Profit</th>
                                <th>Outcome</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tradeLogs.map(item => (
                                <tr key={item.id}>
                                    <td className='tx-time'>{item.timestamp}</td>
                                    <td className='tx-symbol'>{item.symbol}</td>
                                    <td>
                                        <span className='strategy-tag'>{item.strategy}</span>
                                    </td>
                                    <td className='tx-contract'>{item.contractType}</td>
                                    <td className='tx-barrier'>
                                        {item.barrier !== undefined ? item.barrier : '-'}
                                        {item.entryDigit !== undefined && <small> (Trig: {item.entryDigit})</small>}
                                    </td>
                                    <td>${item.stake.toFixed(2)}</td>
                                    <td>${item.payout > 0 ? item.payout.toFixed(2) : '-'}</td>
                                    <td className={item.profit >= 0 ? 'profit-green' : 'loss-red'}>
                                        {item.profit >= 0 ? `+$${item.profit.toFixed(2)}` : `-$${Math.abs(item.profit).toFixed(2)}`}
                                    </td>
                                    <td>
                                        {item.status === 'WON' && <span className='badge-won'>WON</span>}
                                        {item.status === 'LOST' && <span className='badge-lost'>LOST</span>}
                                        {item.status === 'PENDING' && <span className='badge-pending'>PENDING</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
