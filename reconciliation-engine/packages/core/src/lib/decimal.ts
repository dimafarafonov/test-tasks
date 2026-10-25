import { Decimal } from 'decimal.js';

// Own clone: global Decimal settings stay untouched. Round half away from zero (O3).
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type D = InstanceType<typeof D>;

const NS_PER_SECOND = new D('1e9');

// Fixed-point text, never "-0.00" (O1).
export function toFixed(value: D, digits: number): string {
  const text = value.toFixed(digits);
  return /^-0\.?0*$/.test(text) ? text.slice(1) : text;
}

// Same text for the same value: "100.0" and "100.00" → "100", "-0" → "0".
export const decimalKey = (value: D): string => (value.isZero() ? '0' : value.toString());

export function nanosToSeconds(ns: bigint): D {
  return new D(ns.toString()).div(NS_PER_SECOND);
}

export function secondsToNanos(seconds: string): D {
  return new D(seconds).mul(NS_PER_SECOND);
}
