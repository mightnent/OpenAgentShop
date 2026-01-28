/**
 * UCP-Compliant Currency Utilities
 *
 * All prices in UCP are stored and transmitted as integers in minor units
 * (e.g., cents for USD). This module provides conversion and formatting
 * utilities that respect each currency's decimal exponent.
 */

/** Map of ISO 4217 currency codes to their minor-unit exponents */
const CURRENCY_EXPONENTS: Record<string, number> = {
  // 2-decimal currencies (most common)
  USD: 2, EUR: 2, GBP: 2, SGD: 2, AUD: 2, CAD: 2, CHF: 2,
  CNY: 2, HKD: 2, NZD: 2, SEK: 2, NOK: 2, DKK: 2, PLN: 2,
  BRL: 2, MXN: 2, INR: 2, THB: 2, MYR: 2, PHP: 2, IDR: 2,
  ZAR: 2, AED: 2, SAR: 2, TWD: 2, TRY: 2, ILS: 2,
  CZK: 2, HUF: 2, RON: 2, BGN: 2, HRK: 2, RUB: 2, UAH: 2,
  COP: 2, CLP: 0, PEN: 2, ARS: 2,
  // 0-decimal currencies
  JPY: 0, VND: 0, KRW: 0,
  // 3-decimal currencies
  BHD: 3, KWD: 3, OMR: 3,
};

/**
 * Get the minor-unit exponent for a currency.
 * Defaults to 2 for unknown currencies.
 */
export function getCurrencyExponent(currency: string): number {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
}

/**
 * Convert minor units to major units.
 * @example minorToMajor(2999, "USD") → 29.99
 * @example minorToMajor(1000, "JPY") → 1000
 */
export function minorToMajor(amount: number, currency: string): number {
  const exponent = getCurrencyExponent(currency);
  return amount / Math.pow(10, exponent);
}

/**
 * Convert major units to minor units.
 * @example majorToMinor(29.99, "USD") → 2999
 * @example majorToMinor(1000, "JPY") → 1000
 */
export function majorToMinor(amount: number, currency: string): number {
  const exponent = getCurrencyExponent(currency);
  return Math.round(amount * Math.pow(10, exponent));
}

/**
 * Format minor-unit amount for display using Intl.NumberFormat.
 * @example formatCurrencyDisplay(2999, "USD") → "$29.99"
 * @example formatCurrencyDisplay(1000, "JPY") → "¥1,000"
 */
export function formatCurrencyDisplay(
  amount: number,
  currency: string,
  locale: string = "en-US"
): string {
  const majorAmount = minorToMajor(amount, currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: getCurrencyExponent(currency),
    maximumFractionDigits: getCurrencyExponent(currency),
  }).format(majorAmount);
}

/**
 * Format price for commerce feed output (space-separated).
 * @example formatPriceForFeed(2999, "USD") → "29.99 USD"
 * @example formatPriceForFeed(1000, "JPY") → "1000 JPY"
 */
export function formatPriceForFeed(amount: number, currency: string): string {
  const majorAmount = minorToMajor(amount, currency);
  const exponent = getCurrencyExponent(currency);
  return `${majorAmount.toFixed(exponent)} ${currency.toUpperCase()}`;
}

/**
 * Calculate tax amount in minor units.
 * @example calculateTax(10000, 0.08) → 800
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate);
}

/**
 * Calculate checkout totals from line items.
 */
export function calculateTotals(
  lineItems: Array<{ price: number; quantity: number }>,
  taxRate: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = calculateTax(subtotal, taxRate);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}
