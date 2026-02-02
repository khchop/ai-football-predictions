/**
 * Design token exports for TypeScript consumers.
 * These mirror the CSS custom properties in globals.css.
 *
 * Usage:
 * - Import for type-safe token references
 * - Use CSS variables (var(--spacing-4)) in styles
 * - Use these exports for programmatic access
 */

export const spacing = {
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const

export const typography = {
  fontSize: {
    xs: '0.694rem',
    sm: '0.833rem',
    base: '1rem',
    lg: '1.2rem',
    xl: '1.44rem',
    '2xl': '1.728rem',
    '3xl': '2.074rem',
    '4xl': '2.488rem',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const

export const colors = {
  // Semantic match state colors (CSS variable names)
  win: 'var(--color-win)',
  draw: 'var(--color-draw)',
  loss: 'var(--color-loss)',

  // Accuracy gradient
  accuracyLow: 'var(--color-accuracy-low)',
  accuracyMid: 'var(--color-accuracy-mid)',
  accuracyHigh: 'var(--color-accuracy-high)',
} as const

export type SpacingKey = keyof typeof spacing
export type FontSizeKey = keyof typeof typography.fontSize
export type LineHeightKey = keyof typeof typography.lineHeight
export type FontWeightKey = keyof typeof typography.fontWeight
