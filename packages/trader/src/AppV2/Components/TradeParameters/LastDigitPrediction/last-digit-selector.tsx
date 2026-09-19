import React from 'react';
import { observer } from 'mobx-react-lite';
import { useTraderStore } from 'Stores/useTraderStores';
import Digit from './digit';

type TLastDigitSelectorProps = {
    digits: number[];
    digit_stats: number[];
    is_disabled?: boolean;
    invalid_digit?: number | null;
    onDigitSelect?: (digit: number) => void;
    selected_digit?: number;
};

const LastDigitSelector = observer(
    ({
        digits = [],
        digit_stats,
        is_disabled,
        invalid_digit,
        onDigitSelect,
        selected_digit,
    }: TLastDigitSelectorProps) => {
        const { tick_data } = useTraderStore();
        const pip_size =
            tick_data?.pip_size !== undefined && tick_data?.pip_size !== null
                ? +tick_data.pip_size
                : (String(tick_data?.quote || '').split('.')[1]?.length ?? 2);
        const quote_str =
            tick_data?.quote !== undefined && tick_data?.quote !== null
                ? typeof tick_data.quote === 'number'
                    ? tick_data.quote.toFixed(pip_size)
                    : String(tick_data.quote)
                : null;
        const latest_digit = quote_str ? +quote_str.slice(-1) : null;

        return (
            <div className='last-digit-prediction__selector'>
                {[...Array(2).keys()].map(row_key => (
                    <div key={row_key} className='last-digit-prediction__selector-row'>
                        {digits.slice(row_key * 5, (row_key + 1) * 5).map(digit => (
                            <Digit
                                key={digit}
                                digit={digit}
                                digit_stats={digit_stats}
                                is_active={selected_digit === digit}
                                is_disabled={is_disabled || digit === invalid_digit}
                                is_max={digit_stats[digit] === Math.max(...digit_stats)}
                                is_min={digit_stats[digit] === Math.min(...digit_stats)}
                                is_latest={latest_digit === digit}
                                onClick={onDigitSelect}
                            />
                        ))}
                    </div>
                ))}
            </div>
        );
    }
);

export default LastDigitSelector;
