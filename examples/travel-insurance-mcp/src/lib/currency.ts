/**
 * Currency utility for UCP-compliant minor-unit price handling.
 *
 * All prices are stored as integers in their currency's minor unit
 * (e.g., cents for USD). This module provides conversions between
 * minor units and display/feed formats.
 */

const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  SGD: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
};

const DEFAULT_EXPONENT = 2;

export function getCurrencyExponent(currency: string): number {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? DEFAULT_EXPONENT;
}

/** Convert minor units (integer) to major units. e.g. 2999 USD → 29.99 */
export function minorToMajor(minorUnits: number, currency: string): number {
  const exponent = getCurrencyExponent(currency);
  return minorUnits / Math.pow(10, exponent);
}

/** Convert major units to minor units (integer). e.g. 29.99 USD → 2999 */
export function majorToMinor(
  majorUnits: number | string,
  currency: string
): number {
  const exponent = getCurrencyExponent(currency);
  const num =
    typeof majorUnits === "string" ? parseFloat(majorUnits) : majorUnits;
  return Math.round(num * Math.pow(10, exponent));
}

/** Format minor units for display. e.g. 2999 USD → "$29.99" */
export function formatCurrencyDisplay(
  minorUnits: number,
  currency: string
): string {
  const major = minorToMajor(minorUnits, currency);
  const exponent = getCurrencyExponent(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(major);
}

/** Format minor units for OpenAI product feed. e.g. 2999 USD → "29.99 USD" */
export function formatPriceForFeed(
  minorUnits: number,
  currency: string
): string {
  const major = minorToMajor(minorUnits, currency);
  const exponent = getCurrencyExponent(currency);
  return `${major.toFixed(exponent)} ${currency}`;
}
