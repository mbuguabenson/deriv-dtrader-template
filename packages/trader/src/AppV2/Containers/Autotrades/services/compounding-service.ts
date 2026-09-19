import { TCompoundingRow } from './types';

export type TCompoundingInput = {
    startingCapital: number;
    targetAmount: number;
    periodCount: number; // Number of Days or Hours
    periodType: 'DAYS' | 'HOURS';
    profitPercent?: number; // Auto-calculated required % per period
};

const STORAGE_KEY = 'autotrades_compounding_challenge_v1';

export class CompoundingService {
    public static calculateRate(startingCapital: number, targetAmount: number, periodCount: number): number {
        const starting = Math.max(0.01, Number(startingCapital) || 100);
        const target = Math.max(starting * 1.0001, Number(targetAmount) || starting * 2);
        const count = Math.max(1, Math.min(365, Math.round(Number(periodCount) || 1)));

        // Exact compound growth rate: (target / starting) ^ (1 / count) - 1
        const rateDecimal = Math.pow(target / starting, 1 / count) - 1;
        return parseFloat((rateDecimal * 100).toFixed(2));
    }

    public static generatePlan(input: TCompoundingInput): TCompoundingRow[] {
        const rows: TCompoundingRow[] = [];
        const starting = Math.max(0.01, Number(input.startingCapital) || 100);
        const target = Math.max(starting * 1.0001, Number(input.targetAmount) || starting * 2);
        const count = Math.max(1, Math.min(365, Math.round(Number(input.periodCount) || 1)));

        // Exact compound growth rate: (target / starting) ^ (1 / count) - 1
        const rateDecimal = Math.pow(target / starting, 1 / count) - 1;
        input.profitPercent = parseFloat((rateDecimal * 100).toFixed(2));

        let currentBalance = starting;

        for (let i = 1; i <= count; i++) {
            // Ending balance needed to achieve milestone at step i
            const theoreticalEnding = i === count ? target : starting * Math.pow(1 + rateDecimal, i);
            const startBal = parseFloat(currentBalance.toFixed(2));
            const endBal = parseFloat(theoreticalEnding.toFixed(2));
            const profit = parseFloat((endBal - startBal).toFixed(2));
            const timeLabel = `${input.periodType === 'DAYS' ? 'Day' : 'Hour'} ${i}`;

            rows.push({
                step: i,
                timeLabel,
                startingBalance: startBal,
                targetProfit: Math.max(0, profit),
                endingBalance: endBal,
                isCompleted: false,
            });

            currentBalance = endBal;
        }

        return rows;
    }

    public static updateMilestonesWithLiveBalance(rows: TCompoundingRow[], currentAccountBalance: number): TCompoundingRow[] {
        return rows.map(row => {
            return {
                ...row,
                isCompleted: currentAccountBalance >= row.endingBalance,
            };
        });
    }

    public static savePlan(input: TCompoundingInput, rows: TCompoundingRow[]) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    input,
                    rows,
                    updatedAt: new Date().toISOString(),
                })
            );
        } catch (_e) {
            // Storage quota fallback
        }
    }

    public static loadPlan(): { input: TCompoundingInput; rows: TCompoundingRow[] } | null {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return null;
            return JSON.parse(data);
        } catch (_e) {
            return null;
        }
    }

    public static exportToCsv(rows: TCompoundingRow[], input: TCompoundingInput) {
        const headers = ['Step', 'Period', 'Starting Balance ($)', 'Target Profit ($)', 'Needed Ending Balance ($)', 'Status'];
        const csvRows = [headers.join(',')];

        rows.forEach(r => {
            csvRows.push(
                [
                    r.step,
                    `"${r.timeLabel}"`,
                    r.startingBalance.toFixed(2),
                    r.targetProfit.toFixed(2),
                    r.endingBalance.toFixed(2),
                    r.isCompleted ? '"COMPLETED"' : '"IN PROGRESS"',
                ].join(',')
            );
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `compounding_challenge_${input.startingCapital}_to_${input.targetAmount}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
