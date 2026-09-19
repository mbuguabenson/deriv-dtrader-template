import { TCompoundingRow } from './types';

export type TCompoundingInput = {
    startingCapital: number;
    targetAmount: number;
    periodCount: number; // Number of Days or Hours
    periodType: 'DAYS' | 'HOURS';
    profitPercent: number; // e.g. 5 for 5%
};

const STORAGE_KEY = 'autotrades_compounding_challenge_v1';

export class CompoundingService {
    public static generatePlan(input: TCompoundingInput): TCompoundingRow[] {
        const rows: TCompoundingRow[] = [];
        let currentBalance = input.startingCapital;
        const rate = input.profitPercent / 100;

        for (let i = 1; i <= input.periodCount; i++) {
            const profit = currentBalance * rate;
            const ending = currentBalance + profit;
            const timeLabel = `${input.periodType === 'DAYS' ? 'Day' : 'Hour'} ${i}`;

            rows.push({
                step: i,
                timeLabel,
                startingBalance: parseFloat(currentBalance.toFixed(2)),
                targetProfit: parseFloat(profit.toFixed(2)),
                endingBalance: parseFloat(ending.toFixed(2)),
                isCompleted: false,
            });

            currentBalance = ending;
            if (input.targetAmount > 0 && currentBalance >= input.targetAmount && rows.length >= 3) {
                break;
            }
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
        const headers = ['Step', 'Period', 'Starting Balance ($)', 'Target Profit ($)', 'Ending Balance ($)', 'Status'];
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
        link.setAttribute('download', `compounding_challenge_${input.profitPercent}pct.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
