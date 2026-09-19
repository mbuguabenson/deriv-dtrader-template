import React, { useMemo, useState } from 'react';
import { TMarketTickStats } from '../services/types';

type TDigitLineChartProps = {
    stats?: TMarketTickStats;
    isDarkMode?: boolean;
};

export const DigitLineChart: React.FC<TDigitLineChartProps> = ({ stats, isDarkMode = true }) => {
    const [hoveredPoint, setHoveredPoint] = useState<{ index: number; digit: number; x: number; y: number } | null>(null);

    const currentPrice = stats?.price ?? 0;
    const lastDigit = stats?.lastDigit ?? 0;

    // Dimensions
    const width = 800;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 25, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Coordinates calculation
    const points = useMemo(() => {
        const digits = stats?.digits50 || [];
        if (digits.length === 0) return [];
        const stepX = chartWidth / Math.max(digits.length - 1, 1);
        return digits.map((d, i) => {
            const x = padding.left + i * stepX;
            // 0 is at bottom (height), 9 is at top (0)
            const y = padding.top + chartHeight - (d / 9) * chartHeight;
            return { x, y, digit: d, index: i };
        });
    }, [stats?.digits50, chartWidth, chartHeight, padding.left, padding.top]);

    // Path string
    const pathD = useMemo(() => {
        if (points.length === 0) return '';
        return points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
    }, [points]);

    // Gradient fill area path
    const areaD = useMemo(() => {
        if (points.length === 0) return '';
        const first = points[0];
        const last = points[points.length - 1];
        const baseline = padding.top + chartHeight;
        return `${pathD} L ${last.x.toFixed(1)},${baseline} L ${first.x.toFixed(1)},${baseline} Z`;
    }, [pathD, points, padding.top, chartHeight]);

    const textColor = isDarkMode ? '#e6e6e6' : '#222';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    return (
        <div className='autotrades-chart-card'>
            <div className='autotrades-chart-header'>
                <div className='autotrades-chart-spot-info'>
                    <span className='autotrades-chart-symbol-name'>{stats?.displayName || 'Market'}</span>
                    <span className='autotrades-chart-price'>${currentPrice > 0 ? currentPrice.toFixed(2) : '---'}</span>
                </div>
                <div className='autotrades-chart-last-digit-badge'>
                    <span className='autotrades-chart-badge-title'>LAST DIGIT</span>
                    <span className={`autotrades-chart-digit-glow ${lastDigit <= 4 ? 'is-under' : 'is-over'}`}>
                        {lastDigit}
                    </span>
                </div>
            </div>

            <div className='autotrades-chart-svg-wrap'>
                <svg viewBox={`0 0 ${width} ${height}`} className='autotrades-chart-svg'>
                    <defs>
                        <linearGradient id='digitLineGradient' x1='0%' y1='0%' x2='100%' y2='0%'>
                            <stop offset='0%' stopColor='#00a79e' stopOpacity='0.9' />
                            <stop offset='50%' stopColor='#ff9f1a' stopOpacity='0.9' />
                            <stop offset='100%' stopColor='#ff444f' stopOpacity='1' />
                        </linearGradient>
                        <linearGradient id='digitAreaGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                            <stop offset='0%' stopColor='rgba(0, 167, 158, 0.25)' />
                            <stop offset='100%' stopColor='rgba(0, 167, 158, 0.0)' />
                        </linearGradient>
                        <filter id='pointGlow' x='-50%' y='-50%' width='200%' height='200%'>
                            <feGaussianBlur stdDeviation='3' result='coloredBlur' />
                            <feMerge>
                                <feMergeNode in='coloredBlur' />
                                <feMergeNode in='SourceGraphic' />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Horizontal Grid lines 0 to 9 */}
                    {[0, 2, 4, 6, 8, 9].map(d => {
                        const y = padding.top + chartHeight - (d / 9) * chartHeight;
                        return (
                            <g key={`grid-${d}`}>
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={gridColor} strokeDasharray='3 3' />
                                <text x={padding.left - 8} y={y + 4} fill={textColor} fontSize='10' textAnchor='end' opacity='0.6'>
                                    {d}
                                </text>
                            </g>
                        );
                    })}

                    {/* Gradient Area Fill */}
                    {areaD && <path d={areaD} fill='url(#digitAreaGradient)' />}

                    {/* Main Line */}
                    {pathD && (
                        <path
                            d={pathD}
                            fill='none'
                            stroke='url(#digitLineGradient)'
                            strokeWidth='2.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    )}

                    {/* Digit Points */}
                    {points.map((pt, i) => {
                        const isLatest = i === points.length - 1;
                        const isUnder = pt.digit <= 4;
                        const fillColor = isUnder ? '#00a79e' : '#ff444f';

                        return (
                            <g
                                key={`pt-${i}`}
                                onMouseEnter={() => setHoveredPoint(pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {isLatest && (
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r='9'
                                        fill='none'
                                        stroke={fillColor}
                                        strokeWidth='2'
                                        className='pulsing-ring'
                                    />
                                )}
                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isLatest ? '5.5' : '3.5'}
                                    fill={fillColor}
                                    stroke={isDarkMode ? '#1a1f2c' : '#ffffff'}
                                    strokeWidth='1.5'
                                    filter={isLatest ? 'url(#pointGlow)' : undefined}
                                />
                            </g>
                        );
                    })}

                    {/* Tooltip */}
                    {hoveredPoint && (
                        <g transform={`translate(${hoveredPoint.x}, ${Math.max(hoveredPoint.y - 30, 20)})`}>
                            <rect x='-24' y='-16' width='48' height='22' rx='4' fill={isDarkMode ? '#0e111a' : '#ffffff'} stroke='rgba(0,167,158,0.5)' strokeWidth='1' />
                            <text x='0' y='-2' fill={textColor} fontSize='11' fontWeight='700' textAnchor='middle'>
                                {hoveredPoint.digit}
                            </text>
                        </g>
                    )}
                </svg>
            </div>

            <div className='autotrades-chart-footer'>
                <span className='autotrades-chart-history-label'>50 Ticks Live Digit Stream</span>
                <div className='autotrades-chart-legend'>
                    <span className='legend-item legend-under'>● 0–4 Under</span>
                    <span className='legend-item legend-over'>● 5–9 Over</span>
                </div>
            </div>
        </div>
    );
};
