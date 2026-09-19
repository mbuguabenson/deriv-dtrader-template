import React, { useEffect, useState } from 'react';
import { CompoundingService, TCompoundingInput } from '../services/compounding-service';
import { TCompoundingRow } from '../services/types';

type TCompoundingPlannerProps = {
    accountBalance: number;
    onStartCompoundingAutoTrade?: () => void;
    isAutoTradeRunning?: boolean;
};

export const CompoundingPlanner: React.FC<TCompoundingPlannerProps> = ({
    accountBalance,
    onStartCompoundingAutoTrade,
    isAutoTradeRunning,
}) => {
    const [inputs, setInputs] = useState<TCompoundingInput>(() => {
        const saved = CompoundingService.loadPlan();
        if (saved?.input) {
            return saved.input;
        }
        const start = accountBalance > 0 ? Math.round(accountBalance) : 100;
        return {
            startingCapital: start,
            targetAmount: start * 5,
            periodCount: 20,
            periodType: 'DAYS',
        };
    });

    const [rows, setRows] = useState<TCompoundingRow[]>([]);

    const updatePlan = (newInputs: TCompoundingInput) => {
        setInputs(newInputs);
        const newRows = CompoundingService.generatePlan(newInputs);
        const checkedRows = CompoundingService.updateMilestonesWithLiveBalance(newRows, accountBalance);
        setRows(checkedRows);
        CompoundingService.savePlan(newInputs, checkedRows);
    };

    // Load persisted plan on mount or generate initial
    useEffect(() => {
        const saved = CompoundingService.loadPlan();
        if (saved && saved.rows && saved.rows.length > 0) {
            setInputs(saved.input);
            const updatedRows = CompoundingService.updateMilestonesWithLiveBalance(saved.rows, accountBalance);
            setRows(updatedRows);
        } else {
            updatePlan(inputs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update milestones when live balance changes
    useEffect(() => {
        if (rows.length > 0) {
            const updatedRows = CompoundingService.updateMilestonesWithLiveBalance(rows, accountBalance);
            setRows(updatedRows);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountBalance]);

    const handleFieldChange = (field: keyof TCompoundingInput, value: number | string) => {
        const next = { ...inputs, [field]: value };
        updatePlan(next);
    };

    const handleGeneratePlan = () => {
        updatePlan(inputs);
    };

    const handleReset = () => {
        const start = accountBalance > 0 ? Math.round(accountBalance) : 100;
        const defaultInputs: TCompoundingInput = {
            startingCapital: start,
            targetAmount: start * 5,
            periodCount: 20,
            periodType: 'DAYS',
        };
        updatePlan(defaultInputs);
    };

    const handleExport = () => {
        CompoundingService.exportToCsv(rows, inputs);
    };

    const calculatedRate = CompoundingService.calculateRate(inputs.startingCapital, inputs.targetAmount, inputs.periodCount);
    const finalBalance = rows.length > 0 ? rows[rows.length - 1].endingBalance : inputs.targetAmount;
    const totalProfit = rows.length > 0 ? finalBalance - inputs.startingCapital : 0;
    const completedCount = rows.filter(r => r.isCompleted).length;
    const progressPercent = rows.length > 0 ? Math.min(100, Math.round((completedCount / rows.length) * 100)) : 0;

    // Simple Growth Chart SVG points
    const chartPoints = rows.map((r, i) => {
        const x = (i / Math.max(rows.length - 1, 1)) * 300;
        const y = 80 - ((r.endingBalance - inputs.startingCapital) / Math.max(finalBalance - inputs.startingCapital, 1)) * 70;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const polylineStr = chartPoints.join(' ');

    return (
        <div className='autotrades-compounding-container'>
            {/* Header / Summary */}
            <div className='compounding-header'>
                <div className='compounding-title-block'>
                    <h3>📈 Compounding Growth Challenge Generator</h3>
                    <p>Auto-calculates needed profit rate and ending balance for each period. Track live account balance and auto-tick milestones!</p>
                </div>

                <div className='compounding-summary-badges'>
                    <div className='summary-badge'>
                        <span className='badge-sub'>Starting Capital</span>
                        <strong className='badge-val'>${inputs.startingCapital.toFixed(2)}</strong>
                    </div>
                    <div className='summary-badge'>
                        <span className='badge-sub'>Target Growth Rate</span>
                        <strong className='badge-val color-green'>+{calculatedRate}% / {inputs.periodType === 'DAYS' ? 'day' : 'hr'}</strong>
                    </div>
                    <div className='summary-badge'>
                        <span className='badge-sub'>Total Profit Needed</span>
                        <strong className='badge-val color-green'>+${Math.max(0, totalProfit).toFixed(2)}</strong>
                    </div>
                    <div className='summary-badge'>
                        <span className='badge-sub'>Needed Ending Balance</span>
                        <strong className='badge-val color-cyan'>${finalBalance.toFixed(2)}</strong>
                    </div>
                    <div className='summary-badge'>
                        <span className='badge-sub'>Challenge Progress</span>
                        <strong className='badge-val color-orange'>{progressPercent}% ({completedCount}/{rows.length})</strong>
                    </div>
                </div>
            </div>

            {/* Input Controls Form */}
            <div className='compounding-inputs-card'>
                <div className='inputs-row'>
                    <div className='input-item'>
                        <label>Starting Capital ($)</label>
                        <input
                            type='number'
                            min='1'
                            value={inputs.startingCapital}
                            onChange={e => handleFieldChange('startingCapital', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className='input-item'>
                        <label>Target Amount ($)</label>
                        <input
                            type='number'
                            min='1'
                            value={inputs.targetAmount}
                            onChange={e => handleFieldChange('targetAmount', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className='input-item'>
                        <label>Period Type</label>
                        <select
                            value={inputs.periodType}
                            onChange={e => handleFieldChange('periodType', e.target.value as 'DAYS' | 'HOURS')}
                        >
                            <option value='DAYS'>Days</option>
                            <option value='HOURS'>Hours</option>
                        </select>
                    </div>
                    <div className='input-item'>
                        <label>Count ({inputs.periodType === 'DAYS' ? 'Days' : 'Hours'})</label>
                        <input
                            type='number'
                            min='1'
                            max='365'
                            value={inputs.periodCount}
                            onChange={e => handleFieldChange('periodCount', Number(e.target.value) || 1)}
                        />
                    </div>
                    <div className='input-item auto-rate-item'>
                        <label>Needed Profit Rate</label>
                        <div
                            className='auto-calculated-rate-pill'
                            title='Auto-calculated using compound growth formula: (Target / Starting)^(1/N) - 1'
                        >
                            <span className='pill-rate-val'>+{calculatedRate}%</span>
                            <span className='pill-rate-sub'>/ {inputs.periodType === 'DAYS' ? 'Day' : 'Hour'}</span>
                        </div>
                    </div>
                </div>

                <div className='compounding-btn-actions'>
                    <button type='button' className='btn-generate-plan' onClick={handleGeneratePlan}>
                        ⚡ Generate Plan
                    </button>
                    <button type='button' className='btn-reset-plan' onClick={handleReset}>
                        ↺ Reset Plan
                    </button>
                    <button type='button' className='btn-export-plan' onClick={handleExport}>
                        📥 Export to Excel (CSV)
                    </button>
                    {onStartCompoundingAutoTrade && (
                        <button
                            type='button'
                            className={`btn-auto-compounding-toggle ${isAutoTradeRunning ? 'is-running' : ''}`}
                            onClick={onStartCompoundingAutoTrade}
                        >
                            {isAutoTradeRunning ? '⏹ Stop Compounding Trader' : '▶ Auto-Trade This Challenge'}
                        </button>
                    )}
                </div>
            </div>

            {/* Simple Growth Curve Chart */}
            <div className='compounding-chart-card'>
                <div className='chart-label-row'>
                    <span>Equity Growth Curve</span>
                    <span>Live Balance: ${accountBalance.toFixed(2)}</span>
                </div>
                <svg viewBox='0 0 300 90' className='compounding-growth-svg'>
                    <defs>
                        <linearGradient id='growthGrad' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='0%' stopColor='#00a79e' stopOpacity='0.4' />
                            <stop offset='100%' stopColor='#00a79e' stopOpacity='0.0' />
                        </linearGradient>
                    </defs>
                    <polyline
                        fill='none'
                        stroke='#00a79e'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        points={polylineStr}
                    />
                </svg>
            </div>

            {/* Day by Day Milestones Table */}
            <div className='compounding-table-wrap'>
                <table className='compounding-table'>
                    <thead>
                        <tr>
                            <th>Period</th>
                            <th>Starting Balance</th>
                            <th>Target Profit</th>
                            <th>Needed Ending Balance</th>
                            <th>Milestone Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => {
                            const isCurrentStep = !r.isCompleted && (i === 0 || rows[i - 1]?.isCompleted);
                            const neededDiff = Math.max(0, r.endingBalance - accountBalance);

                            return (
                                <tr key={r.step} className={r.isCompleted ? 'is-row-completed' : ''}>
                                    <td>
                                        <strong>{r.timeLabel}</strong>
                                    </td>
                                    <td>${r.startingBalance.toFixed(2)}</td>
                                    <td className='color-green'>+${r.targetProfit.toFixed(2)}</td>
                                    <td className='color-cyan'>${r.endingBalance.toFixed(2)}</td>
                                    <td>
                                        <div className='milestone-check-cell'>
                                            <input
                                                type='checkbox'
                                                checked={r.isCompleted}
                                                readOnly
                                                className='milestone-checkbox'
                                            />
                                            <span
                                                className={`milestone-badge ${
                                                    r.isCompleted
                                                        ? 'badge-achieved'
                                                        : isCurrentStep
                                                        ? 'badge-inprogress'
                                                        : 'badge-pending'
                                                }`}
                                            >
                                                {r.isCompleted
                                                    ? '✓ Completed'
                                                    : isCurrentStep
                                                    ? `In Progress (Needed: +$${neededDiff.toFixed(2)})`
                                                    : 'Pending'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
