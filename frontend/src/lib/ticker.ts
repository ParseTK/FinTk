/**
 * What a ticker symbol looks like: one to six letters, optionally a class suffix (BRK-B, BRK.B).
 * The API enforces the same rule; checking it here first spares a network call for nonsense.
 */
const TICKER_PATTERN = /^[A-Za-z]{1,6}([.-][A-Za-z]{1,2})?$/;

export const isValidTicker = (value: string): boolean => TICKER_PATTERN.test(value);
