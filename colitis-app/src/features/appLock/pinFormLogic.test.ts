import { describe, it, expect } from 'vitest';
import { PIN_LENGTH, RESET_CONFIRMATION_PHRASE, isValidPinFormat, isResetConfirmationValid } from './pinFormLogic';

describe('PIN_LENGTH', () => {
  it('is 6', () => {
    expect(PIN_LENGTH).toBe(6);
  });
});

describe('isValidPinFormat', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidPinFormat('123456')).toBe(true);
  });

  it('rejects fewer than 6 digits', () => {
    expect(isValidPinFormat('12345')).toBe(false);
  });

  it('rejects more than 6 digits', () => {
    expect(isValidPinFormat('1234567')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidPinFormat('12345a')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidPinFormat('')).toBe(false);
  });
});

describe('isResetConfirmationValid', () => {
  it('accepts the exact confirmation phrase', () => {
    expect(isResetConfirmationValid(RESET_CONFIRMATION_PHRASE)).toBe(true);
  });

  it('accepts the phrase with surrounding whitespace trimmed', () => {
    expect(isResetConfirmationValid(`  ${RESET_CONFIRMATION_PHRASE}  `)).toBe(true);
  });

  it('rejects a different string', () => {
    expect(isResetConfirmationValid('loeschen')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isResetConfirmationValid('')).toBe(false);
  });
});
