import React, { useMemo, useState } from 'react';
import { TMarketTickStats } from '../services/types';

type TDigitLineChartProps = {
    stats?: TMarketTickStats;
    isDarkMode?: boolean;
};

// 10 distinct unique colors for digits 0 to 9
export const DIGIT_COLORS: Record<number, { text: string; bg: string; border: string }> = {
    0: { text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.45)' }, // Blue
    1: { text: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.45)' }, // Cyan
    2: { text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.45)' }, // Green
    3: { text: '#84cc16', bg: 'rgba(132, 204, 22, 0.15)', border: 'rgba(132, 204, 22, 0.45)' }, // Lime
    4: { text: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.45)' }, // Amber/Yellow
    5: { text: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.45)' }, // Orange
    6: { text: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.45)' }, // Pink
    7: { text: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.45)' }, // Purple
    8: { text: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.45)' }, // Indigo
    9: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.45)' }, // Red
};

export const DigitLineChart: React.FC<TDigitLineChartProps> = ({ stats, isDarkMode = true }) => {
    const [hoveredPoint, setHoveredPoint] = useState<{ index: number; digit: number; x: number; y: number } | null>(null);

    const currentPrice = stats?.price ?? 0;
    const pipSize = stats?.pipSize ?? 2;
    const lastDigit = stats?.lastDigit ?? 0;
    const digits50 = stats?.digits50 || [];

    // Chart Dimensions
    const width = 800;
    const height = 180;
    const padding = { top: 26, right: 30, bottom: 26, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Coordinates calculation
    const points = useMemo(() => {
        if (digits50.length === 0) return [];
        const stepX = chartWidth / Math.max(digits50.length - 1, 1);
        return digits50.map((d, i) => {
            const x = padding.left + i * stepX;
            // 0 is at bottom (chartHeight), 9 is at top (0)
            const y = padding.top + chartHeight - (d / 9) * chartHeight;
            return { x, y, digit: d, index: i };
        });
    }, [digits50, chartWidth, chartHeight, padding.left, padding.top]);

    // Path string for simple grey line
    const pathD = useMemo(() => {
        if (points.length === 0) return '';
        return points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
    }, [points]);

    const textColor = isDarkMode ? '#cbd5e1' : '#334155';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const greyLineColor = isDarkMode ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)';

    return (
        <div className='autotrades-chart-card'>
            {/* Header with reduced size current digit indicator */}
            <div className='autotrades-chart-header'>
                <div className='autotrades-chart-spot-info'>
                    <span className='autotrades-chart-symbol-name'>{stats?.displayName || 'Market'}</span>
                    <span className='autotrades-chart-price'>
                        {currentPrice > 0 ? `$${currentPrice.toFixed(pipSize)}` : 'Connecting...'}
                    </span>
                </div>
                <div className='autotrades-chart-last-digit-badge'>
                    <span className='autotrades-chart-badge-title'>LAST DIGIT</span>
                    <span
                        className='autotrades-chart-digit-glow-compact'
                        style={{
                            color: DIGIT_COLORS[lastDigit]?.text || '#00a79e',
                            borderColor: DIGIT_COLORS[lastDigit]?.border || 'rgba(0, 167, 158, 0.5)',
                            background: DIGIT_COLORS[lastDigit]?.bg || 'rgba(0, 167, 158, 0.15)',
                        }}
                    >
                        {lastDigit}
                    </span>
                </div>
            </div>

            {/* SVG Line Chart */}
            <div className='autotrades-chart-svg-wrap'>
                <svg viewBox={`0 0 ${width} ${height}`} className='autotrades-chart-svg'>
                    <defs>
                        <filter id='pointGlow' x='-50%' y='-50%' width='200%' height='200%'>
                            <feGaussianBlur stdDeviation='2.5' result='coloredBlur' />
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

                    {/* Simple crisp grey line (NO gradient, NO fainted shade) */}
                    {pathD && (
                        <path
                            d={pathD}
                            fill='none'
                            stroke={greyLineColor}
                            strokeWidth='1.8'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    )}

                    {/* Digits on the spot for each point */}
                    {points.map((pt, i) => {
                        const isLatest = i === points.length - 1;
                        const digitColor = DIGIT_COLORS[pt.digit]?.text || '#00a79e';

                        // Text positioning: if spot is near top (digit 8 or 9), position text below dot so it doesn't clip
                        const textY = pt.digit >= 8 ? pt.y + (isLatest ? 16 : 12) : pt.y - (isLatest ? 10 : 7);

                        return (
                            <g
                                key={`pt-${i}`}
                                onMouseEnter={() => setHoveredPoint(pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Historical vs Current spot circle */}
                                {isLatest ? (
                                    <>
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r='10'
                                            fill='none'
                                            stroke='#ffb703'
                                            strokeWidth='2'
                                            className='pulsing-ring'
                                        />
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r='6'
                                            fill='#ffb703'
                                            stroke={isDarkMode ? '#0e111a' : '#ffffff'}
                                            strokeWidth='2'
                                            filter='url(#pointGlow)'
                                        />
                                    </>
                                ) : (
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r='3.5'
                                        fill={digitColor}
                                        stroke={isDarkMode ? '#0e111a' : '#ffffff'}
                                        strokeWidth='1.2'
                                    />
                                )}

                                {/* Digits on the spot: Current is in a different color (#ffb703 gold) and bigger */}
                                <text
                                    x={pt.x}
                                    y={textY}
                                    fill={isLatest ? '#ffb703' : textColor}
                                    fontSize={isLatest ? '15' : '8.5'}
                                    fontWeight={isLatest ? '900' : '700'}
                                    textAnchor='middle'
                                    filter={isLatest ? 'url(#pointGlow)' : undefined}
                                >
                                    {pt.digit}
                                </text>
                            </g>
                        );
                    })}

                    {/* Tooltip on hover */}
                    {hoveredPoint && (
                        <g transform={`translate(${hoveredPoint.x}, ${Math.max(hoveredPoint.y - 32, 16)})`}>
                            <rect
                                x='-24'
                                y='-16'
                                width='48'
                                height='22'
                                rx='4'
                                fill={isDarkMode ? '#0e111a' : '#ffffff'}
                                stroke={DIGIT_COLORS[hoveredPoint.digit]?.border || 'rgba(0,167,158,0.5)'}
                                strokeWidth='1'
                            />
                            <text
                                x='0'
                                y='-1'
                                fill={DIGIT_COLORS[hoveredPoint.digit]?.text || textColor}
                                fontSize='12'
                                fontWeight='800'
                                textAnchor='middle'
                            >
                                {hoveredPoint.digit}
                            </text>
                        </g>
                    )}
                </svg>
            </div>

            {/* Below Chart: Last 50 Digits in small cards with unique colors */}
            <div className='autotrades-50-digits-section'>
                <div className='digits-50-header'>
                    <span className='digits-50-title'>Last 50 Digits Stream</span>
                    <span className='digits-50-sub'>Chronological: oldest → latest</span>
                </div>
                <div className='digits-50-cards-row'>
                    {digits50.map((d, index) => {
                        const isLatest = index === digits50.length - 1;
                        const c = DIGIT_COLORS[d] || { text: '#fff', bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.2)' };

                        return (
                            <div
                                key={`digit-card-${index}`}
                                className={`digit-mini-card ${isLatest ? 'is-latest' : ''}`}
                                style={{
                                    color: c.text,
                                    backgroundColor: c.bg,
                                    borderColor: isLatest ? '#ffb703' : c.border,
                                }}
                                title={`Tick #${index + 1} - Digit ${d}`}
                            >
                                <span className='mini-card-digit'>{d}</span>
                                {isLatest && <span className='mini-card-now-dot' />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className='autotrades-chart-footer'>
                <span className='autotrades-chart-history-label'>Live 50 Ticks Digit Stream</span>
                <div className='autotrades-chart-legend'>
                    <span className='legend-item' style={{ color: '#ffb703' }}>● Current Digit (Highlighted)</span>
                    <span className='legend-item' style={{ color: greyLineColor }}>― Simple Grey Trend Line</span>
                </div>
            </div>
        </div>
    );
};
