# Circular Digit Distribution & Prediction Component

## Overview

This document details the architecture, design, and performance optimizations of the **Last Digit Prediction** widget (`@deriv/trader`, AppV2), which visualizes real-time digit frequency distributions across 1,000 ticks as **interactive circular radial progress gauges**.

---

## 1. Visual Design & Mechanics

### Radial Progress Arc

Each digit ($0$ through $9$) is rendered as an interactive, circular button with an embedded SVG radial progress gauge.

```
         .---.  <- Progress Value Arc (strokeDasharray / strokeDashoffset)
       /   |   \
      |    5    | <- Centered Digit Typography
       \       /
         `---'  <- Background Track Ring (progress__bg)
         8.6%   <- Percentage Caption (min / max highlighted)
```

- **Radius**: $r = 19\text{px}$ in a $44\times 44$ viewport ($C \approx 119.38\text{px}$).
- **Track Ring (`.progress__bg`)**: A continuous, muted baseline ring representing the outer circle boundary.
- **Dynamic Progress Arc (`.progress__value`)**: An SVG arc whose length dynamically represents the frequency proportion of that digit over the last 1,000 ticks.

### Visual Highlighting & Color States

| State             | CSS Selector                                   | Visual Appearance                                                                 | Meaning                                                        |
| :---------------- | :--------------------------------------------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Max Frequency** | `.progress__value--is-max`, `.percentage--max` | Highlighted in success green (`--semantic-color-green-solid-textIcon-normal-mid`) | Most frequent digit over the last 1,000 ticks                  |
| **Min Frequency** | `.progress__value--is-min`, `.percentage--min` | Highlighted in danger red (`--semantic-color-red-solid-textIcon-normal-mid`)      | Least frequent digit over the last 1,000 ticks                 |
| **Standard**      | `.progress__value`                             | Proportional opacity ($0.15$ to $1.0$) based on deviation from the $10\%$ mean    | Average frequency distribution                                 |
| **Selected**      | `button.active`, `.digit--selected`            | Brand border glow (`box-shadow: 0 0 0 2.5px var(--brand-primary)`), inverse fill  | Current digit prediction selected by user                      |
| **Disabled**      | `button:disabled`                              | Opacity $0.4$, `cursor: not-allowed`                                              | Closed market or invalid contract digit (e.g. Digit 9 on Over) |

---

## 2. Mathematical Amplitude Scaling

In a 1,000-tick histogram, digit occurrences naturally hover between $7\%$ and $14\%$. If mapped linearly to a $0\text{--}100\%$ scale, differences between $8\%$ and $12\%$ would appear almost indistinguishable.

We employ Deriv's calibrated non-linear scaling formula to amplify visual contrast:

```ts
const CIRCLE_RADIUS = 19;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~119.3805

// Proportional mapping amplifying 6% to 15% range
let p = (20 * display_percentage - 102) / 3 / 100;
p = Math.max(Math.min(p, 0.75), 0.06);

// Opacity interpolation around the 10% theoretical mean
let opacity = (display_percentage - 10) / 4;
opacity = Math.min(Math.max(opacity, -1), 1);
opacity = ((opacity + 1) / 2) * 0.85 + 0.15;
```

This ensures that even subtle statistical clustering is immediately recognizable to traders at a glance.

---

## 3. Touch Responsiveness & Mobile Performance

1. **Zero Tap Delay (`touch-action: manipulation`)**:
    - Eliminates standard $300\text{ms}$ browser click delays on mobile touch screens.
2. **Accessible Touch Targets**:
    - Circles maintain a minimum **$44\text{px} \times 44\text{px}$** hit target on mobile screens conforming to WCAG touch standards.
3. **Hardware-Accelerated Interaction**:
    - Active press state uses CSS transform scaling (`transform: scale(0.92)`), running on the GPU compositor thread for sub-$16\text{ms}$ tactile feedback.
4. **Fluid Responsiveness**:
    - Layout consists of two symmetrical rows of five digits each (`0-4` and `5-9`), scaling seamlessly within both the desktop trading sidebar and the mobile slide-up parameters sheet (`ActionSheet`).

---

## 4. Performance & Tick-Stream Optimization

1. **Component Isolation (`React.memo`)**:
    - Deriv WebSocket ticks arrive every 1 second (or faster on synthetic indices).
    - Wrapping `<Digit />` in `React.memo` ensures that only the specific digit instances whose percentage or selection state actually changed will re-render, preventing full 10-item DOM thrashing.
2. **Memoized Geometry (`useMemo`)**:
    - All stroke-dasharray and stroke-dashoffset formulas are calculated within `React.useMemo`, ensuring zero layout recalculation overhead during idle frames.

---

## 5. File Structure

- **Component**: [`packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/digit.tsx`](file:///e:/Backup/profhubdtrader/deriv-dtrader-template-master/packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/digit.tsx)
- **Container / Rows**: [`packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-selector.tsx`](file:///e:/Backup/profhubdtrader/deriv-dtrader-template-master/packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-selector.tsx)
- **Modal / Parameter Integration**: [`packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-prediction.tsx`](file:///e:/Backup/profhubdtrader/deriv-dtrader-template-master/packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-prediction.tsx)
- **Styles**: [`packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-prediction.scss`](file:///e:/Backup/profhubdtrader/deriv-dtrader-template-master/packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/last-digit-prediction.scss)
- **Unit Tests**: [`packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/__tests__/digit.spec.tsx`](file:///e:/Backup/profhubdtrader/deriv-dtrader-template-master/packages/trader/src/AppV2/Components/TradeParameters/LastDigitPrediction/__tests__/digit.spec.tsx)
