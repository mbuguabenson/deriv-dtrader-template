import React from 'react';
import clsx from 'clsx';

import { CaptionText, Skeleton, Text } from '@deriv-com/quill-ui';
import { useDevice } from '@deriv-com/ui';

type TDigitsProps = {
    is_active?: boolean;
    is_disabled?: boolean;
    is_latest?: boolean;
    is_max?: boolean;
    is_min?: boolean;
    digit: number;
    digit_stats: number[];
    onClick?: (digit: number) => void;
};

const CIRCLE_RADIUS = 19;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~119.3805

const Digit = ({
    digit,
    digit_stats = [],
    is_active,
    is_disabled,
    is_latest,
    is_max,
    is_min,
    onClick,
}: TDigitsProps) => {
    const { isDesktop } = useDevice();
    const stats = digit_stats.length ? digit_stats[digit] : null;
    const percentage = stats !== null && stats !== undefined ? (stats * 100) / 1000 : null;
    const display_percentage = percentage !== null && !isNaN(percentage) ? parseFloat(percentage.toFixed(1)) : null;

    // Memoize radial SVG circle calculations for maximum rendering performance during rapid tick feeds
    const { dash_array_stroke, dash_array_gap, dash_offset, stroke_opacity } = React.useMemo(() => {
        if (display_percentage === null) {
            return {
                dash_array_stroke: '0',
                dash_array_gap: CIRCUMFERENCE.toFixed(2),
                dash_offset: '0',
                stroke_opacity: 0.5,
            };
        }

        // Deriv-calibrated dynamic proportion mapping for 1000-tick histogram (amplifies 6% to 15% range)
        let p = (20 * display_percentage - 102) / 3 / 100;
        p = Math.max(Math.min(p, 0.75), 0.06);

        // Normalize stroke opacity based on deviation from 10% average
        let opacity = (display_percentage - 10) / 4;
        opacity = Math.min(Math.max(opacity, -1), 1);
        opacity = ((opacity + 1) / 2) * 0.85 + 0.15;

        return {
            dash_array_stroke: (CIRCUMFERENCE * p).toFixed(2),
            dash_array_gap: (CIRCUMFERENCE * (1 - p)).toFixed(2),
            dash_offset: (CIRCUMFERENCE * ((p + 1) / 2)).toFixed(2),
            stroke_opacity: Number(opacity.toFixed(2)),
        };
    }, [display_percentage]);

    if (digit === undefined || digit === null || isNaN(digit)) return null;

    return (
        <div key={digit} className={clsx('digit', is_active && 'digit--selected')}>
            <button
                className={clsx(is_active && 'active')}
                disabled={is_disabled}
                onClick={() => onClick?.(digit)}
                name='last_digit'
                aria-label={String(digit)}
                type='button'
            >
                <svg className='digit__pie-progress' width='44' height='44' viewBox='0 0 44 44' aria-hidden='true'>
                    <circle
                        className='progress__bg'
                        cx='22'
                        cy='22'
                        r={CIRCLE_RADIUS}
                        fill='none'
                        strokeWidth='3'
                        data-testid='dt_progress_bg'
                    />
                    {display_percentage !== null && (
                        <circle
                            className={clsx('progress__value', {
                                'progress__value--is-max': is_max,
                                'progress__value--is-min': is_min,
                            })}
                            cx='22'
                            cy='22'
                            r={CIRCLE_RADIUS}
                            fill='none'
                            strokeWidth='3'
                            strokeOpacity={is_max || is_min ? 1 : stroke_opacity}
                            strokeDasharray={`${dash_array_stroke} ${dash_array_gap}`}
                            strokeDashoffset={dash_offset}
                            data-testid='dt_progress_value'
                        />
                    )}
                </svg>
                <Text
                    size={isDesktop ? 'md' : 'xl'}
                    color={is_disabled ? 'quill-typography__color--disabled' : ''}
                    className='digit__number'
                >
                    {digit}
                </Text>
            </button>
            {display_percentage !== null ? (
                <CaptionText
                    size='sm'
                    className={clsx('percentage', is_max && 'percentage--max', is_min && 'percentage--min')}
                    data-testid='dt_digit_stats_percentage'
                >
                    {display_percentage}%
                </CaptionText>
            ) : (
                <Skeleton.Square width={36} height={12} rounded />
            )}
            <div className='digit__pointer-wrapper'>
                {is_latest ? (
                    <svg width='16' height='16' viewBox='0 0 16 16' className='digit__pointer' aria-hidden='true'>
                        <path d='m8 4 6 8H2z' fill='var(--brand-orange, #ff444f)' />
                    </svg>
                ) : (
                    <div className='digit__pointer-placeholder' />
                )}
            </div>
        </div>
    );
};

export default React.memo(Digit);
