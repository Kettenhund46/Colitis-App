import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  isLastStep,
  nextStepIndex,
  formatStepProgress,
  formatPrimaryLabel,
} from './steps';

describe('ONBOARDING_STEPS', () => {
  it('has three steps in the agreed order', () => {
    expect(ONBOARDING_STEPS.map((step) => step.key)).toEqual(['zweck', 'daten', 'erinnerung']);
  });

  it('shows the reminder settings on the last step only', () => {
    const withReminder = ONBOARDING_STEPS.filter((step) => step.hasReminderSettings);

    expect(withReminder).toHaveLength(1);
    expect(withReminder[0].key).toBe('erinnerung');
  });

  it('gives every step a title and at least one paragraph', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it('uses each paragraph only once, so React keys stay unique', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(new Set(step.paragraphs).size).toBe(step.paragraphs.length);
    }
  });
});

describe('isLastStep', () => {
  it('is false before the last step', () => {
    expect(isLastStep(0)).toBe(false);
    expect(isLastStep(1)).toBe(false);
  });

  it('is true on the last step', () => {
    expect(isLastStep(ONBOARDING_STEPS.length - 1)).toBe(true);
  });
});

describe('nextStepIndex', () => {
  it('advances by one', () => {
    expect(nextStepIndex(0)).toBe(1);
  });

  it('stops at the last step instead of running past it', () => {
    const last = ONBOARDING_STEPS.length - 1;
    expect(nextStepIndex(last)).toBe(last);
  });
});

describe('formatStepProgress', () => {
  it('counts from one, not from zero', () => {
    expect(formatStepProgress(0)).toBe('Schritt 1 von 3');
    expect(formatStepProgress(2)).toBe('Schritt 3 von 3');
  });
});

describe('formatPrimaryLabel', () => {
  it('says Weiter while steps remain', () => {
    expect(formatPrimaryLabel(0)).toBe('Weiter');
  });

  it('says Los geht’s on the last step', () => {
    expect(formatPrimaryLabel(ONBOARDING_STEPS.length - 1)).toBe('Los geht’s');
  });
});
