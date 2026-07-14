export const PIN_LENGTH = 6;
export const RESET_CONFIRMATION_PHRASE = 'LÖSCHEN';

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function isResetConfirmationValid(input: string): boolean {
  return input.trim() === RESET_CONFIRMATION_PHRASE;
}
