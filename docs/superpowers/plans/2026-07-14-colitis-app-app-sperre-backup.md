# App-Sperre & Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adrian kann eine PIN-/Biometrie-Sperre vor dem App-Inhalt aktivieren und ein verschlüsseltes Voll-Backup seiner persönlichen Daten manuell erstellen und wiederherstellen.

**Architecture:** Zwei neue, unabhängige Feature-Module (`src/features/appLock/`, `src/features/backup/`) plus gezielte Erweiterungen an bestehenden Kern-Dateien (`src/db/client.ts`, `src/lib/encryption.ts`, `app/_layout.tsx`, `app/(tabs)/einstellungen/index.tsx`). Die Sperre wird als zusätzliches Gate im Root-Layout nach dem bestehenden DB-Lade-Gate eingehängt. Das Backup nutzt eine reine, unabhängig testbare Krypto-Schicht (PBKDF2 + AES-GCM über die neuen Pakete `@noble/hashes`/`@noble/ciphers`) getrennt von der nativen Datei-/Teilen-Schicht (`expo-file-system`/`expo-sharing`/`expo-document-picker`).

**Tech Stack:** TypeScript, React Native/Expo Router, Drizzle ORM, Vitest, better-sqlite3 (Tests), `expo-local-authentication` (neu), `expo-file-system` (neu, klassenbasierte File/Directory-API), `expo-sharing` (neu), `expo-document-picker` (neu), `@noble/hashes` + `@noble/ciphers` (neu, reine JS-Kryptografie ohne native Abhängigkeit).

## Global Constraints

- Alle Daten bleiben 100% lokal, keine Cloud-Übertragung — das Backup wird nur über den OS-Teilen-Dialog angeboten, die App lädt nichts selbst hoch.
- UI-Sprache: Deutsch, durchgehend.
- Design-Ton: ruhig/warm — ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts`, kein neues hartkodiertes Rot/Alarmfarben (`tokens.colors.danger` bleibt die einzige Warnfarbe).
- PIN ist immer genau 6 Ziffern (`PIN_LENGTH = 6`), numerisch. Backup-Passwort mindestens 8 Zeichen.
- Der PIN wird nie im Klartext gespeichert — nur `SHA-256(salt:pin)` als Hex-String in `expo-secure-store`, Salt über `Crypto.randomUUID()`.
- App-Sperre ist standardmäßig deaktiviert (Opt-in über die Einstellungen).
- Sperr-Bildschirm erscheint bei jedem App-Start und bei jedem Wechsel von `background`/`inactive` zurück zu `active`, sofern die Sperre aktiviert ist — kein Backoff/Sperr-Timer bei falscher PIN-Eingabe.
- "PIN vergessen" erfordert eine mehrstufige Bestätigung (Abtippen der exakten Phrase `LÖSCHEN`) und löscht danach unwiderruflich: die SQLite-Datenbankdatei, den DB-Verschlüsselungsschlüssel, den PIN-Hash/Salt — die App verhält sich danach wie eine Neuinstallation.
- Backup enthält ausschließlich die sieben persönlichen Tabellen `diary_entries`, `triggers`, `medications`, `medication_log`, `medication_reminder_times`, `saved_places`, `screening_reminders` — **nicht** `knowledge_content` (wird beim App-Start idempotent neu geseedet) und **nicht** `cached_toilets` (reiner Offline-Cache).
- Backup-Verschlüsselung: PBKDF2-HMAC-SHA256 mit 100.000 Iterationen leitet einen 32-Byte-AES-Schlüssel aus dem Backup-Passwort ab (16-Byte-Salt); AES-256-GCM mit 12-Byte-Nonce verschlüsselt die JSON-Nutzlast. Ein falsches Passwort führt beim Entschlüsseln zu einer geworfenen Ausnahme (GCM-Auth-Tag-Prüfung) — das ist die alleinige, eingebaute Erkennung für "falsches Passwort", keine zusätzliche manuelle Prüfsumme nötig.
- Backup-Import ersetzt alle sieben persönlichen Tabellen vollständig in einer einzigen Datenbank-Transaktion (alles oder nichts) — kein Merge. Original-IDs werden beim Wiederherstellen beibehalten, damit Fremdschlüssel-Beziehungen (z. B. `triggers.diary_entry_id`, `medication_log.medication_id`) erhalten bleiben.
- Der `drizzle-orm/expo-sqlite`-Treiber läuft im synchronen Modus: Der Callback von `db.transaction((tx) => {...})` ist **nicht** `async` und Operationen darin werden über `.run()` synchron ausgeführt, nicht mit `await`. Falls das beim Implementieren nicht zutrifft (z. B. ein Fehler beim Testlauf zeigt anderes Verhalten), sofort stoppen und eskalieren statt zu raten.
- React Native/native Module (Sperr-Bildschirm-UI, `expo-local-authentication`, `expo-secure-store`, `expo-file-system`/`expo-sharing`/`expo-document-picker`, native Datei-/Share-Dialoge) sind wie in allen bisherigen Schritten nicht sinnvoll automatisiert testbar — Verifikation über sorgfältiges Lesen, `tsc --noEmit`, und den späteren manuellen Alltagstest (Schritt 8). Reine Logik und alles, was native Module nur aufruft (per `vi.mock`, Muster aus `src/lib/encryption.test.ts` und `src/features/medications/notifications/notificationService.test.ts`), wird vollständig getestet.
- `AGENTS.md` im Projekt weist darauf hin, dass sich Expo-APIs zwischen Versionen stark ändern. Für diesen Plan bereits verifiziert und verbindlich zu verwenden: `expo-local-authentication` (`hasHardwareAsync`, `isEnrolledAsync`, `authenticateAsync`), `expo-crypto` (`randomUUID`, `digestStringAsync` mit `CryptoDigestAlgorithm.SHA256`/`CryptoEncoding.HEX`, bereits vorhandene Abhängigkeit), `expo-sqlite` (`deleteDatabaseAsync`), `expo-file-system` SDK 57 (neue klassenbasierte `File`/`Directory`/`Paths`-API, **nicht** die alte `FileSystem.writeAsStringAsync`-API), `expo-sharing` (`shareAsync`, `isAvailableAsync`), `expo-document-picker` (`getDocumentAsync`) — alle gegen die offizielle SDK-57-Dokumentation geprüft, Stand dieses Plans.

---

### Task 1: Domain-Typen + reine Logik (PIN-Format, Reset-Bestätigung, Backup-Typen, Backup-Struktur-Validierung)

**Files:**
- Create: `colitis-app/src/features/appLock/pinFormLogic.ts`
- Test: `colitis-app/src/features/appLock/pinFormLogic.test.ts`
- Create: `colitis-app/src/features/backup/types.ts`
- Create: `colitis-app/src/features/backup/backupSerializer.ts`
- Test: `colitis-app/src/features/backup/backupSerializer.test.ts`

**Interfaces:**
- Consumes: Drizzle-Schema-Tabellen `diaryEntries`, `triggers`, `medications`, `medicationLog`, `medicationReminderTimes`, `savedPlaces`, `screeningReminders` aus `colitis-app/src/db/schema.ts` (bereits vorhanden, unverändert).
- Produces: `PIN_LENGTH`, `RESET_CONFIRMATION_PHRASE`, `isValidPinFormat(pin: string): boolean`, `isResetConfirmationValid(input: string): boolean` (in `pinFormLogic.ts`); `BACKUP_FORMAT_VERSION`, `BackupData`, `BackupEnvelope` (in `types.ts`); `serializeBackupData(data: BackupData): string`, `parseBackupData(json: string): BackupData` (in `backupSerializer.ts`). Werden von späteren Tasks (2, 5, 6, 7, 8) verwendet.

- [ ] **Step 1: Fehlschlagenden Test für `pinFormLogic.ts` schreiben**

Erstelle `colitis-app/src/features/appLock/pinFormLogic.test.ts`:

```typescript
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
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/appLock/pinFormLogic.test.ts`
Expected: FAIL mit "Cannot find module './pinFormLogic'"

- [ ] **Step 3: `pinFormLogic.ts` implementieren**

Erstelle `colitis-app/src/features/appLock/pinFormLogic.ts`:

```typescript
export const PIN_LENGTH = 6;
export const RESET_CONFIRMATION_PHRASE = 'LÖSCHEN';

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function isResetConfirmationValid(input: string): boolean {
  return input.trim() === RESET_CONFIRMATION_PHRASE;
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/appLock/pinFormLogic.test.ts`
Expected: PASS (9 Tests)

- [ ] **Step 5: `types.ts` für Backup anlegen (keine Tests nötig — reine Typdeklarationen)**

Erstelle `colitis-app/src/features/backup/types.ts`:

```typescript
import type { diaryEntries, medicationLog, medicationReminderTimes, medications, savedPlaces, screeningReminders, triggers } from '../../db/schema';

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  tables: {
    diaryEntries: (typeof diaryEntries.$inferSelect)[];
    triggers: (typeof triggers.$inferSelect)[];
    medications: (typeof medications.$inferSelect)[];
    medicationLog: (typeof medicationLog.$inferSelect)[];
    medicationReminderTimes: (typeof medicationReminderTimes.$inferSelect)[];
    savedPlaces: (typeof savedPlaces.$inferSelect)[];
    screeningReminders: (typeof screeningReminders.$inferSelect)[];
  };
}

export interface BackupEnvelope {
  version: typeof BACKUP_FORMAT_VERSION;
  saltHex: string;
  nonceHex: string;
  ciphertextHex: string;
}
```

- [ ] **Step 6: Fehlschlagenden Test für `backupSerializer.ts` schreiben**

Erstelle `colitis-app/src/features/backup/backupSerializer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeBackupData, parseBackupData } from './backupSerializer';
import type { BackupData } from './types';

const sampleData: BackupData = {
  version: 1,
  exportedAt: '2026-07-14T10:00:00.000Z',
  tables: {
    diaryEntries: [],
    triggers: [],
    medications: [],
    medicationLog: [],
    medicationReminderTimes: [],
    savedPlaces: [],
    screeningReminders: [],
  },
};

describe('serializeBackupData / parseBackupData', () => {
  it('round-trips valid backup data', () => {
    const json = serializeBackupData(sampleData);
    expect(parseBackupData(json)).toEqual(sampleData);
  });

  it('throws a German error for invalid JSON', () => {
    expect(() => parseBackupData('not json')).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });

  it('throws a German error for an unknown version', () => {
    const json = JSON.stringify({ ...sampleData, version: 99 });
    expect(() => parseBackupData(json)).toThrow('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
  });

  it('throws a German error when a table key is missing', () => {
    const broken = JSON.parse(serializeBackupData(sampleData));
    delete broken.tables.triggers;
    expect(() => parseBackupData(JSON.stringify(broken))).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });

  it('throws a German error when a table value is not an array', () => {
    const broken = JSON.parse(serializeBackupData(sampleData));
    broken.tables.triggers = 'not an array';
    expect(() => parseBackupData(JSON.stringify(broken))).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });

  it('throws a German error when the root is not an object', () => {
    expect(() => parseBackupData('42')).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });
});
```

- [ ] **Step 7: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/backup/backupSerializer.test.ts`
Expected: FAIL mit "Cannot find module './backupSerializer'"

- [ ] **Step 8: `backupSerializer.ts` implementieren**

Erstelle `colitis-app/src/features/backup/backupSerializer.ts`:

```typescript
import { BACKUP_FORMAT_VERSION, type BackupData } from './types';

export function serializeBackupData(data: BackupData): string {
  return JSON.stringify(data);
}

const REQUIRED_TABLE_KEYS = [
  'diaryEntries',
  'triggers',
  'medications',
  'medicationLog',
  'medicationReminderTimes',
  'savedPlaces',
  'screeningReminders',
] as const;

export function parseBackupData(json: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.version !== BACKUP_FORMAT_VERSION) {
    throw new Error('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
  }

  if (typeof candidate.exportedAt !== 'string') {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  if (typeof candidate.tables !== 'object' || candidate.tables === null) {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  const tables = candidate.tables as Record<string, unknown>;
  for (const key of REQUIRED_TABLE_KEYS) {
    if (!Array.isArray(tables[key])) {
      throw new Error('Sicherungsdatei ist kein gültiges Format.');
    }
  }

  return candidate as BackupData;
}
```

- [ ] **Step 9: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/backup/backupSerializer.test.ts`
Expected: PASS (6 Tests)

- [ ] **Step 10: Gesamte Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle bisherigen Tests plus die 15 neuen aus diesem Task)

- [ ] **Step 11: Commit**

```bash
git add src/features/appLock/pinFormLogic.ts src/features/appLock/pinFormLogic.test.ts src/features/backup/types.ts src/features/backup/backupSerializer.ts src/features/backup/backupSerializer.test.ts
git commit -m "feat: Domain-Typen und reine Logik fuer App-Sperre und Backup"
```

---

### Task 2: Backup-Verschlüsselung (PBKDF2 + AES-GCM)

**Files:**
- Create: `colitis-app/src/features/backup/backupCrypto.ts`
- Test: `colitis-app/src/features/backup/backupCrypto.test.ts`

**Interfaces:**
- Consumes: nichts aus früheren Tasks (reine, framework-freie Kryptografie).
- Produces: `PBKDF2_ITERATIONS`, `AES_KEY_LENGTH_BYTES`, `GCM_NONCE_LENGTH_BYTES`, `PBKDF2_SALT_LENGTH_BYTES`, `bytesToHex(bytes: Uint8Array): string`, `hexToBytes(hex: string): Uint8Array`, `deriveKeyFromPassword(password: string, salt: Uint8Array): Uint8Array`, `encryptWithKey(plaintext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array`, `decryptWithKey(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array`. Werden von Task 8 (Einstellungen-Screen) verwendet.

- [ ] **Step 1: Pakete installieren**

Run: `cd colitis-app && npm install @noble/hashes @noble/ciphers`
Expected: Beide Pakete erscheinen in `package.json` unter `dependencies`.

Prüfe danach `node_modules/@noble/hashes/package.json` und `node_modules/@noble/ciphers/package.json` (Feld `exports`), um zu bestätigen, dass die Importpfade `@noble/hashes/pbkdf2.js`, `@noble/hashes/sha2.js` und `@noble/ciphers/aes.js` (siehe Step 3) exakt so von der installierten Version exportiert werden. Falls die tatsächlichen Pfade im `exports`-Feld abweichen (z. B. ohne `.js`-Endung oder andere Unterverzeichnisse), die Importe in Step 3 entsprechend anpassen, bevor fortgefahren wird.

- [ ] **Step 2: Fehlschlagenden Test schreiben**

Erstelle `colitis-app/src/features/backup/backupCrypto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  PBKDF2_SALT_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
  AES_KEY_LENGTH_BYTES,
  bytesToHex,
  hexToBytes,
  deriveKeyFromPassword,
  encryptWithKey,
  decryptWithKey,
} from './backupCrypto';

describe('bytesToHex / hexToBytes', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it('produces lowercase, zero-padded hex', () => {
    expect(bytesToHex(new Uint8Array([0, 255]))).toBe('00ff');
  });
});

describe('deriveKeyFromPassword', () => {
  const salt = new Uint8Array(PBKDF2_SALT_LENGTH_BYTES).fill(7);

  it('derives a key of the expected length', () => {
    const key = deriveKeyFromPassword('correct horse battery staple', salt);
    expect(key).toHaveLength(AES_KEY_LENGTH_BYTES);
  });

  it('is deterministic for the same password and salt', () => {
    const key1 = deriveKeyFromPassword('same-password', salt);
    const key2 = deriveKeyFromPassword('same-password', salt);
    expect(key1).toEqual(key2);
  });

  it('produces a different key for a different password', () => {
    const key1 = deriveKeyFromPassword('password-one', salt);
    const key2 = deriveKeyFromPassword('password-two', salt);
    expect(key1).not.toEqual(key2);
  });

  it('produces a different key for a different salt', () => {
    const otherSalt = new Uint8Array(PBKDF2_SALT_LENGTH_BYTES).fill(9);
    const key1 = deriveKeyFromPassword('same-password', salt);
    const key2 = deriveKeyFromPassword('same-password', otherSalt);
    expect(key1).not.toEqual(key2);
  });
});

describe('encryptWithKey / decryptWithKey', () => {
  const salt = new Uint8Array(PBKDF2_SALT_LENGTH_BYTES).fill(3);
  const nonce = new Uint8Array(GCM_NONCE_LENGTH_BYTES).fill(5);
  const key = deriveKeyFromPassword('backup-password', salt);
  const plaintext = new TextEncoder().encode('geheime Tagebuch-Daten');

  it('round-trips plaintext through encrypt then decrypt', () => {
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    const decrypted = decryptWithKey(ciphertext, key, nonce);
    expect(decrypted).toEqual(plaintext);
  });

  it('produces ciphertext different from the plaintext', () => {
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    expect(ciphertext).not.toEqual(plaintext);
  });

  it('throws when decrypting with the wrong key', () => {
    const wrongKey = deriveKeyFromPassword('different-password', salt);
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    expect(() => decryptWithKey(ciphertext, wrongKey, nonce)).toThrow();
  });

  it('throws when decrypting with the wrong nonce', () => {
    const wrongNonce = new Uint8Array(GCM_NONCE_LENGTH_BYTES).fill(6);
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    expect(() => decryptWithKey(ciphertext, key, wrongNonce)).toThrow();
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/backup/backupCrypto.test.ts`
Expected: FAIL mit "Cannot find module './backupCrypto'"

- [ ] **Step 4: `backupCrypto.ts` implementieren**

Erstelle `colitis-app/src/features/backup/backupCrypto.ts`:

```typescript
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

export const PBKDF2_ITERATIONS = 100_000;
export const AES_KEY_LENGTH_BYTES = 32;
export const GCM_NONCE_LENGTH_BYTES = 12;
export const PBKDF2_SALT_LENGTH_BYTES = 16;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function deriveKeyFromPassword(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, password, salt, { c: PBKDF2_ITERATIONS, dkLen: AES_KEY_LENGTH_BYTES });
}

export function encryptWithKey(plaintext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return gcm(key, nonce).encrypt(plaintext);
}

export function decryptWithKey(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return gcm(key, nonce).decrypt(ciphertext);
}
```

If the exact import paths from Step 1's `exports`-field check differ from `@noble/hashes/pbkdf2.js` / `@noble/hashes/sha2.js` / `@noble/ciphers/aes.js`, use the confirmed correct paths here instead.

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/backup/backupCrypto.test.ts`
Expected: PASS (10 Tests). Hinweis: PBKDF2 mit 100.000 Iterationen kann jeden Testfall spürbar (einige hundert Millisekunden) verlangsamen — das ist erwartet, kein Fehler.

- [ ] **Step 6: Gesamte Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle bisherigen Tests plus die 10 neuen aus diesem Task)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/backup/backupCrypto.ts src/features/backup/backupCrypto.test.ts
git commit -m "feat: PBKDF2- und AES-GCM-Verschluesselung fuer Backups"
```

---

### Task 3: PIN-Speicherung & Biometrie-Wrapper

**Files:**
- Create: `colitis-app/src/features/appLock/pinAuth.ts`
- Test: `colitis-app/src/features/appLock/pinAuth.test.ts`
- Create: `colitis-app/src/features/appLock/biometrics.ts`
- Test: `colitis-app/src/features/appLock/biometrics.test.ts`

**Interfaces:**
- Consumes: nichts aus früheren Tasks (nutzt nur native Module).
- Produces: `isAppLockEnabled(): Promise<boolean>`, `setPin(pin: string): Promise<void>`, `verifyPin(pin: string): Promise<boolean>`, `disableAppLock(): Promise<void>`, `resetAppLock(): Promise<void>` (in `pinAuth.ts`); `isBiometricsAvailable(): Promise<boolean>`, `authenticateWithBiometrics(promptMessage: string): Promise<boolean>` (in `biometrics.ts`). Werden von Task 4 (`resetAppLock`), Task 5 (Sperr-Bildschirm) und Task 8 (Einstellungen-Screen) verwendet.

- [ ] **Step 1: Paket installieren**

Run: `cd colitis-app && npx expo install expo-local-authentication`
Expected: `expo-local-authentication` erscheint in `package.json` unter `dependencies` mit einer zu SDK 57 passenden Versionsangabe (Muster `~57.0.x`, analog zu den anderen `expo-*`-Paketen).

- [ ] **Step 2: Fehlschlagenden Test für `pinAuth.ts` schreiben**

Erstelle `colitis-app/src/features/appLock/pinAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    storeMock.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    storeMock.delete(key);
    return Promise.resolve();
  }),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'test-salt-uuid'),
  digestStringAsync: vi.fn((_algorithm: string, data: string) => Promise.resolve(`hash(${data})`)),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { HEX: 'HEX' },
}));

import { isAppLockEnabled, setPin, verifyPin, disableAppLock, resetAppLock } from './pinAuth';

beforeEach(() => {
  storeMock.clear();
  vi.clearAllMocks();
});

describe('isAppLockEnabled', () => {
  it('returns false before any PIN has been set', async () => {
    expect(await isAppLockEnabled()).toBe(false);
  });

  it('returns true after setPin', async () => {
    await setPin('123456');
    expect(await isAppLockEnabled()).toBe(true);
  });
});

describe('setPin / verifyPin', () => {
  it('verifies the correct PIN', async () => {
    await setPin('123456');
    expect(await verifyPin('123456')).toBe(true);
  });

  it('rejects an incorrect PIN', async () => {
    await setPin('123456');
    expect(await verifyPin('654321')).toBe(false);
  });

  it('rejects verification when no PIN has been set', async () => {
    expect(await verifyPin('123456')).toBe(false);
  });
});

describe('disableAppLock', () => {
  it('clears the PIN and marks the lock as disabled', async () => {
    await setPin('123456');
    await disableAppLock();
    expect(await isAppLockEnabled()).toBe(false);
    expect(await verifyPin('123456')).toBe(false);
  });
});

describe('resetAppLock', () => {
  it('clears the PIN entirely, including the enabled flag', async () => {
    await setPin('123456');
    await resetAppLock();
    expect(await isAppLockEnabled()).toBe(false);
    expect(await verifyPin('123456')).toBe(false);
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/appLock/pinAuth.test.ts`
Expected: FAIL mit "Cannot find module './pinAuth'"

- [ ] **Step 4: `pinAuth.ts` implementieren**

Erstelle `colitis-app/src/features/appLock/pinAuth.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_HASH_STORAGE_KEY = 'colitis_app_lock_pin_hash';
const PIN_SALT_STORAGE_KEY = 'colitis_app_lock_pin_salt';
const LOCK_ENABLED_STORAGE_KEY = 'colitis_app_lock_enabled';

export async function isAppLockEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LOCK_ENABLED_STORAGE_KEY);
  return value === 'true';
}

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_STORAGE_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_STORAGE_KEY, hash);
  await SecureStore.setItemAsync(LOCK_ENABLED_STORAGE_KEY, 'true');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(PIN_SALT_STORAGE_KEY);
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_STORAGE_KEY);
  if (!salt || !storedHash) {
    return false;
  }
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

export async function disableAppLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_STORAGE_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_STORAGE_KEY);
  await SecureStore.setItemAsync(LOCK_ENABLED_STORAGE_KEY, 'false');
}

export async function resetAppLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_STORAGE_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_STORAGE_KEY);
  await SecureStore.deleteItemAsync(LOCK_ENABLED_STORAGE_KEY);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
```

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/appLock/pinAuth.test.ts`
Expected: PASS (7 Tests)

- [ ] **Step 6: Fehlschlagenden Test für `biometrics.ts` schreiben**

Erstelle `colitis-app/src/features/appLock/biometrics.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hasHardwareAsync = vi.fn((..._args: unknown[]) => Promise.resolve(true));
const isEnrolledAsync = vi.fn((..._args: unknown[]) => Promise.resolve(true));
const authenticateAsync = vi.fn((..._args: unknown[]) => Promise.resolve({ success: true }));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (...args: unknown[]) => hasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => isEnrolledAsync(...args),
  authenticateAsync: (...args: unknown[]) => authenticateAsync(...args),
}));

import { isBiometricsAvailable, authenticateWithBiometrics } from './biometrics';

beforeEach(() => {
  vi.clearAllMocks();
  hasHardwareAsync.mockResolvedValue(true);
  isEnrolledAsync.mockResolvedValue(true);
  authenticateAsync.mockResolvedValue({ success: true });
});

describe('isBiometricsAvailable', () => {
  it('returns true when hardware exists and biometrics are enrolled', async () => {
    expect(await isBiometricsAvailable()).toBe(true);
  });

  it('returns false when there is no hardware', async () => {
    hasHardwareAsync.mockResolvedValueOnce(false);
    expect(await isBiometricsAvailable()).toBe(false);
    expect(isEnrolledAsync).not.toHaveBeenCalled();
  });

  it('returns false when hardware exists but nothing is enrolled', async () => {
    isEnrolledAsync.mockResolvedValueOnce(false);
    expect(await isBiometricsAvailable()).toBe(false);
  });
});

describe('authenticateWithBiometrics', () => {
  it('returns true on successful authentication and disables the device fallback', async () => {
    const result = await authenticateWithBiometrics('Colitis-App entsperren');
    expect(result).toBe(true);
    expect(authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Colitis-App entsperren',
      disableDeviceFallback: true,
    });
  });

  it('returns false when authentication fails', async () => {
    authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await authenticateWithBiometrics('Colitis-App entsperren')).toBe(false);
  });
});
```

- [ ] **Step 7: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/appLock/biometrics.test.ts`
Expected: FAIL mit "Cannot find module './biometrics'"

- [ ] **Step 8: `biometrics.ts` implementieren**

Erstelle `colitis-app/src/features/appLock/biometrics.ts`:

```typescript
import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return false;
  }
  return LocalAuthentication.isEnrolledAsync();
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: true });
  return result.success;
}
```

Hinweis: `disableDeviceFallback: true` verhindert, dass `authenticateAsync` bei fehlgeschlagener Biometrie auf die geräteeigene Displaysperre (PIN/Muster des Betriebssystems) zurückfällt — der Fallback soll ausschließlich der eigene App-PIN aus `pinAuth.ts` sein, nicht die Geräte-Displaysperre.

- [ ] **Step 9: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/appLock/biometrics.test.ts`
Expected: PASS (5 Tests)

- [ ] **Step 10: Gesamte Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle bisherigen Tests plus die 12 neuen aus diesem Task)

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/features/appLock/pinAuth.ts src/features/appLock/pinAuth.test.ts src/features/appLock/biometrics.ts src/features/appLock/biometrics.test.ts
git commit -m "feat: PIN-Speicherung und Biometrie-Wrapper fuer die App-Sperre"
```

---

### Task 4: App-Reset ("PIN vergessen") + DB-Client-Cache-Reset

**Files:**
- Modify: `colitis-app/src/db/client.ts`
- Modify: `colitis-app/src/lib/encryption.ts`
- Modify: `colitis-app/src/lib/encryption.test.ts`
- Create: `colitis-app/src/lib/appReset.ts`
- Test: `colitis-app/src/lib/appReset.test.ts`

**Interfaces:**
- Consumes: `resetAppLock()` aus `../features/appLock/pinAuth` (Task 3).
- Produces: `DB_FILE_NAME` (neu exportiert), `resetDbCache(): void` (in `client.ts`); `clearDbKey(): Promise<void>` (in `encryption.ts`); `resetAppData(): Promise<void>` (in `appReset.ts`). Wird von Task 5 (Root-Layout-Gate, "PIN vergessen"-Fluss) verwendet.

- [ ] **Step 1: `src/db/client.ts` erweitern**

Ändere in `colitis-app/src/db/client.ts` die Zeile `const DB_FILE_NAME = 'colitis.db';` zu:

```typescript
export const DB_FILE_NAME = 'colitis.db';
```

Füge am Ende der Datei an:

```typescript

export function resetDbCache(): void {
  cachedDbPromise = null;
}
```

- [ ] **Step 2: `encryption.ts` um `clearDbKey` erweitern**

Füge am Ende von `colitis-app/src/lib/encryption.ts` an:

```typescript

export async function clearDbKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DB_KEY_STORAGE_KEY);
}
```

- [ ] **Step 3: Test für `clearDbKey` zur bestehenden `encryption.test.ts` hinzufügen**

Füge in `colitis-app/src/lib/encryption.test.ts` den Import `clearDbKey` neben `generateOrGetDbKey` hinzu (Zeile `import { generateOrGetDbKey } from './encryption';` wird zu `import { generateOrGetDbKey, clearDbKey } from './encryption';`) und ergänze am Ende der Datei:

```typescript

describe('clearDbKey', () => {
  it('removes the stored key so a subsequent call generates a new one', async () => {
    const first = await generateOrGetDbKey();
    await clearDbKey();
    const second = await generateOrGetDbKey();
    expect(second).not.toBe(first);
  });
});
```

- [ ] **Step 4: Test ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/lib/encryption.test.ts`
Expected: PASS (4 Tests, 1 neu)

- [ ] **Step 5: Fehlschlagenden Test für `appReset.ts` schreiben**

Erstelle `colitis-app/src/lib/appReset.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteDatabaseAsync = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('expo-sqlite', () => ({
  deleteDatabaseAsync: (...args: unknown[]) => deleteDatabaseAsync(...args),
}));

const clearDbKey = vi.fn(() => Promise.resolve());
vi.mock('./encryption', () => ({
  clearDbKey: () => clearDbKey(),
}));

const resetAppLock = vi.fn(() => Promise.resolve());
vi.mock('../features/appLock/pinAuth', () => ({
  resetAppLock: () => resetAppLock(),
}));

const resetDbCache = vi.fn();
vi.mock('../db/client', () => ({
  DB_FILE_NAME: 'colitis.db',
  resetDbCache: () => resetDbCache(),
}));

import { resetAppData } from './appReset';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resetAppData', () => {
  it('deletes the database file by its configured name', async () => {
    await resetAppData();
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('colitis.db');
  });

  it('clears the DB key, resets the app lock, and resets the DB cache', async () => {
    await resetAppData();
    expect(clearDbKey).toHaveBeenCalledTimes(1);
    expect(resetAppLock).toHaveBeenCalledTimes(1);
    expect(resetDbCache).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/lib/appReset.test.ts`
Expected: FAIL mit "Cannot find module './appReset'"

- [ ] **Step 7: `appReset.ts` implementieren**

Erstelle `colitis-app/src/lib/appReset.ts`:

```typescript
import * as SQLite from 'expo-sqlite';
import { DB_FILE_NAME, resetDbCache } from '../db/client';
import { clearDbKey } from './encryption';
import { resetAppLock } from '../features/appLock/pinAuth';

export async function resetAppData(): Promise<void> {
  await SQLite.deleteDatabaseAsync(DB_FILE_NAME);
  await clearDbKey();
  await resetAppLock();
  resetDbCache();
}
```

- [ ] **Step 8: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/lib/appReset.test.ts`
Expected: PASS (2 Tests)

- [ ] **Step 9: Gesamte Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle bisherigen Tests plus die 3 neuen aus diesem Task)

- [ ] **Step 10: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 11: Commit**

```bash
git add src/db/client.ts src/lib/encryption.ts src/lib/encryption.test.ts src/lib/appReset.ts src/lib/appReset.test.ts
git commit -m "feat: App-Reset (PIN vergessen) und DB-Client-Cache-Reset"
```

---

### Task 5: Sperr-Bildschirm-UI + Root-Layout-Gate

**Files:**
- Create: `colitis-app/src/features/appLock/useAppLockGate.ts`
- Create: `colitis-app/src/features/appLock/components/LockScreen.tsx`
- Modify: `colitis-app/app/_layout.tsx`

**Interfaces:**
- Consumes: `isAppLockEnabled` aus `../pinAuth` (Task 3); `verifyPin` aus `../pinAuth` (Task 3); `isBiometricsAvailable`, `authenticateWithBiometrics` aus `../biometrics` (Task 3); `PIN_LENGTH`, `RESET_CONFIRMATION_PHRASE`, `isResetConfirmationValid` aus `../pinFormLogic` (Task 1); `resetAppData` aus `../../../lib/appReset` (Task 4); `tokens` aus `../../../styles/tokens`.
- Produces: `useAppLockGate(): { isResolved: boolean; isLockRequired: boolean; unlock: () => void }` (in `useAppLockGate.ts`); `LockScreen` (Props: `onUnlock: () => void`, `onReset: () => Promise<void>`) (in `components/LockScreen.tsx`). Kein späterer Task konsumiert diese direkt — Endpunkt der App-Sperre-UI.

Dieser Task hat keine neuen automatisierten Tests (React-Native-UI und `AppState`-Verdrahtung, bestätigte projektweite Einschränkung) — Verifikation über `tsc --noEmit` und sorgfältiges Lesen.

- [ ] **Step 1: `useAppLockGate.ts` erstellen**

Erstelle `colitis-app/src/features/appLock/useAppLockGate.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isAppLockEnabled } from './pinAuth';

export function useAppLockGate() {
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let isActive = true;
    isAppLockEnabled().then((enabled) => {
      if (!isActive) {
        return;
      }
      setIsLockEnabled(enabled);
      setIsUnlocked(!enabled);
      setIsResolved(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }
      isAppLockEnabled().then((enabled) => {
        setIsLockEnabled(enabled);
        if (enabled) {
          setIsUnlocked(false);
        }
      });
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const unlock = useCallback(() => {
    setIsUnlocked(true);
  }, []);

  return {
    isResolved,
    isLockRequired: isLockEnabled && !isUnlocked,
    unlock,
  };
}
```

- [ ] **Step 2: `LockScreen.tsx` erstellen**

Erstelle `colitis-app/src/features/appLock/components/LockScreen.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { verifyPin } from '../pinAuth';
import { isBiometricsAvailable, authenticateWithBiometrics } from '../biometrics';
import { PIN_LENGTH, RESET_CONFIRMATION_PHRASE, isResetConfirmationValid } from '../pinFormLogic';
import { tokens } from '../../../styles/tokens';

interface LockScreenProps {
  onUnlock: () => void;
  onReset: () => Promise<void>;
}

export function LockScreen({ onUnlock, onReset }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let isActive = true;
    isBiometricsAvailable().then(async (available) => {
      if (!isActive) {
        return;
      }
      setBiometricsAvailable(available);
      if (available) {
        const success = await authenticateWithBiometrics('Colitis-App entsperren');
        if (success && isActive) {
          onUnlock();
        }
      }
    });
    return () => {
      isActive = false;
    };
  }, [onUnlock]);

  async function handleBiometricsRetry() {
    const success = await authenticateWithBiometrics('Colitis-App entsperren');
    if (success) {
      onUnlock();
    }
  }

  async function handlePinChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    setPin(digitsOnly);
    setError(null);
    if (digitsOnly.length === PIN_LENGTH) {
      const isValid = await verifyPin(digitsOnly);
      if (isValid) {
        onUnlock();
      } else {
        setError('Falscher PIN. Bitte erneut versuchen.');
        setPin('');
      }
    }
  }

  async function handleResetConfirm() {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
    }
  }

  if (isResetMode) {
    const canConfirmReset = isResetConfirmationValid(resetConfirmation) && !isResetting;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>PIN zurücksetzen</Text>
        <Text style={styles.warning}>
          Das Zurücksetzen löscht alle App-Daten unwiderruflich. Ein vorher erstelltes Backup ist danach der
          einzige Weg, die Daten wiederzubekommen.
        </Text>
        <Text style={styles.label}>Tippe zur Bestätigung "{RESET_CONFIRMATION_PHRASE}" ein:</Text>
        <TextInput
          style={styles.textInput}
          placeholderTextColor={tokens.colors.textSecondary}
          value={resetConfirmation}
          onChangeText={setResetConfirmation}
          autoCapitalize="characters"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Alle Daten endgültig löschen"
          accessibilityState={{ disabled: !canConfirmReset }}
          disabled={!canConfirmReset}
          style={[styles.dangerButton, !canConfirmReset && styles.buttonDisabled]}
          onPress={handleResetConfirm}
        >
          <Text style={styles.dangerButtonText}>Endgültig löschen</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abbrechen"
          style={styles.cancelButton}
          onPress={() => {
            setIsResetMode(false);
            setResetConfirmation('');
          }}
        >
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>App gesperrt</Text>
      <Text style={styles.label}>PIN eingeben</Text>
      <TextInput
        style={styles.pinInput}
        placeholderTextColor={tokens.colors.textSecondary}
        value={pin}
        onChangeText={handlePinChange}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {biometricsAvailable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mit Biometrie entsperren"
          style={styles.biometricsButton}
          onPress={handleBiometricsRetry}
        >
          <Text style={styles.biometricsButtonText}>Mit Biometrie entsperren</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="PIN vergessen"
        style={styles.forgotButton}
        onPress={() => setIsResetMode(true)}
      >
        <Text style={styles.forgotButtonText}>PIN vergessen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.lg,
  },
  label: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  warning: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    marginBottom: tokens.spacing.md,
    width: '100%',
    textAlign: 'center',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.md,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    marginBottom: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.xl,
    letterSpacing: 8,
    textAlign: 'center',
    width: '60%',
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.md,
  },
  biometricsButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: 8,
    backgroundColor: tokens.colors.primary,
    marginBottom: tokens.spacing.md,
  },
  biometricsButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  forgotButton: {
    marginTop: tokens.spacing.lg,
  },
  forgotButtonText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    textDecorationLine: 'underline',
  },
  dangerButton: {
    backgroundColor: tokens.colors.danger,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dangerButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  cancelButton: {
    paddingVertical: tokens.spacing.sm,
  },
  cancelButtonText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 3: `app/_layout.tsx` um das Sperr-Gate erweitern**

Ersetze den gesamten Inhalt von `colitis-app/app/_layout.tsx` mit:

```typescript
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { createEncryptedDb } from '../src/db/client';
import { resetAppData } from '../src/lib/appReset';
import { LockScreen } from '../src/features/appLock/components/LockScreen';
import { useAppLockGate } from '../src/features/appLock/useAppLockGate';
import * as schema from '../src/db/schema';
import { tokens } from '../src/styles/tokens';

export default function RootLayout() {
  const [db, setDb] = useState<ExpoSQLiteDatabase<typeof schema> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [dbGeneration, setDbGeneration] = useState(0);

  useEffect(() => {
    let isMounted = true;
    createEncryptedDb()
      .then((createdDb) => {
        if (isMounted) {
          setDb(createdDb);
          setInitError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('[DB] Initialisierung fehlgeschlagen:', error);
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Unbekannter Datenbankfehler');
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dbGeneration]);

  async function handleReset() {
    await resetAppData();
    setDb(null);
    setDbGeneration((generation) => generation + 1);
  }

  if (initError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Fehler beim Öffnen der Datenbank: {initError}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank wird geladen …</Text>
      </View>
    );
  }

  return <MigratedLayout db={db} onReset={handleReset} />;
}

function MigratedLayout({
  db,
  onReset,
}: {
  db: ExpoSQLiteDatabase<typeof schema>;
  onReset: () => Promise<void>;
}) {
  const { success, error } = useMigrations(db, migrations);
  const { isResolved, isLockRequired, unlock } = useAppLockGate();

  if (error) {
    console.error('[DB] Migration fehlgeschlagen:', error);
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank-Migration fehlgeschlagen: {error.message}</Text>
      </View>
    );
  }

  if (!success || !isResolved) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank wird vorbereitet …</Text>
      </View>
    );
  }

  if (isLockRequired) {
    return <LockScreen onUnlock={unlock} onReset={onReset} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  text: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

Hinweis zur Funktionsweise nach einem Reset: `resetAppData()` löscht die SQLite-Datei und den DB-Schlüssel und leert den DB-Client-Cache (`resetDbCache`, Task 4). `handleReset` setzt danach `db` auf `null` (RootLayout zeigt kurz den Lade-Zustand) und erhöht `dbGeneration`, was den Initialisierungs-Effect erneut auslöst — `createEncryptedDb()` legt dabei eine frische, leere, neu verschlüsselte Datenbank an. Da `MigratedLayout` beim Übergang von "kein `db`" zu "neues `db`" komplett neu gemountet wird, läuft `useAppLockGate()` ebenfalls frisch an und findet die (durch `resetAppLock()` bereits gelöschte) Sperre als deaktiviert vor — die App verhält sich danach wie eine Neuinstallation.

- [ ] **Step 4: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 5: Vollständige Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (keine Regression durch die Root-Layout-Änderung — dieser Task selbst fügt keine neuen Tests hinzu).

- [ ] **Step 6: Commit**

```bash
git add src/features/appLock/useAppLockGate.ts src/features/appLock/components/LockScreen.tsx app/_layout.tsx
git commit -m "feat: Sperr-Bildschirm und Root-Layout-Gate fuer die App-Sperre"
```

---

### Task 6: Backup-Repository (DB-Zeilen ↔ strukturiertes Objekt)

**Files:**
- Create: `colitis-app/src/features/backup/db/testDb.ts`
- Create: `colitis-app/src/features/backup/db/backupRepository.ts`
- Test: `colitis-app/src/features/backup/db/backupRepository.test.ts`

**Interfaces:**
- Consumes: `BackupData`, `BACKUP_FORMAT_VERSION` aus `../types` (Task 1); Drizzle-Schema-Tabellen aus `../../../db/schema`.
- Produces: `BackupDb`, `exportBackupData(db: BackupDb): Promise<BackupData>`, `importBackupData(db: BackupDb, data: BackupData): Promise<void>`. Wird von Task 8 (Einstellungen-Screen) verwendet.

- [ ] **Step 1: Feature-lokale Test-DB anlegen (mit aktivierter Fremdschlüssel-Prüfung)**

Erstelle `colitis-app/src/features/backup/db/testDb.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../../db/schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const migrationsDir = join(__dirname, '../../../../drizzle');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8');
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        sqlite.exec(trimmed);
      }
    }
  }

  return drizzle(sqlite, { schema });
}
```

Hinweis: Im Unterschied zu den `testDb.ts`-Dateien anderer Features aktiviert diese Version zusätzlich `PRAGMA foreign_keys = ON` (bewusste Abweichung vom sonst identischen Kopiermuster) — nur so prüft der Rundtrip-Test in Step 8, dass `importBackupData` Lösch-/Einfüge-Reihenfolge tatsächlich fremdschlüssel-sicher einhält, genau wie es die echte App-Datenbank (`PRAGMA foreign_keys = ON` in `src/db/client.ts`) zur Laufzeit erzwingt.

- [ ] **Step 2: Fehlschlagenden Test schreiben**

Erstelle `colitis-app/src/features/backup/db/backupRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { exportBackupData, importBackupData } from './backupRepository';
import { diaryEntries, triggers, medications, medicationLog } from '../../../db/schema';

describe('backup repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('exports an empty structure with all seven table keys when nothing exists yet', async () => {
    const data = await exportBackupData(db);
    expect(data.version).toBe(1);
    expect(data.tables).toEqual({
      diaryEntries: [],
      triggers: [],
      medications: [],
      medicationLog: [],
      medicationReminderTimes: [],
      savedPlaces: [],
      screeningReminders: [],
    });
  });

  it('exports rows that were inserted directly', async () => {
    const [entry] = await db
      .insert(diaryEntries)
      .values({
        occurredAt: '2026-07-14T08:00:00.000Z',
        stoolFrequency: 3,
        hasBlood: false,
        stoolConsistency: 'weich',
        painLevel: 4,
        symptoms: 'Bauchschmerzen',
        note: null,
      })
      .returning();

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual([entry]);
  });

  it('replaces all existing data with imported data in a single pass', async () => {
    await db.insert(diaryEntries).values({
      occurredAt: '2026-01-01T00:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 0,
      symptoms: '',
      note: null,
    });

    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [
          {
            id: 42,
            occurredAt: '2026-07-14T09:00:00.000Z',
            stoolFrequency: 5,
            hasBlood: true,
            stoolConsistency: 'wässrig',
            painLevel: 7,
            symptoms: 'Krämpfe',
            note: 'importiert',
          },
        ],
        triggers: [],
        medications: [],
        medicationLog: [],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual(importedData.tables.diaryEntries);
  });

  it('preserves foreign key relationships by keeping original ids', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [
          {
            id: 7,
            occurredAt: '2026-07-14T09:00:00.000Z',
            stoolFrequency: 2,
            hasBlood: false,
            stoolConsistency: 'normal',
            painLevel: 1,
            symptoms: '',
            note: null,
          },
        ],
        triggers: [{ id: 3, diaryEntryId: 7, category: 'stress' as const, note: null }],
        medications: [
          { id: 5, name: 'Salofalk', dose: '500mg', schedule: '1x taeglich', startDate: '2026-01-01', endDate: null },
        ],
        medicationLog: [{ id: 9, medicationId: 5, takenAt: '2026-07-14T08:00:00.000Z' }],
        medicationReminderTimes: [{ id: 2, medicationId: 5, time: '08:00', notificationId: null }],
        savedPlaces: [],
        screeningReminders: [],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.triggers[0].diaryEntryId).toBe(7);
    expect(data.tables.medicationLog[0].medicationId).toBe(5);
    expect(data.tables.medicationReminderTimes[0].medicationId).toBe(5);
  });

  it('clears all data when importing an empty backup', async () => {
    await db.insert(diaryEntries).values({
      occurredAt: '2026-01-01T00:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 0,
      symptoms: '',
      note: null,
    });

    await importBackupData(db, {
      version: 1,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [],
        triggers: [],
        medications: [],
        medicationLog: [],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
      },
    });

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual([]);
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/backup/db/backupRepository.test.ts`
Expected: FAIL mit "Cannot find module './backupRepository'"

- [ ] **Step 4: `backupRepository.ts` implementieren**

Erstelle `colitis-app/src/features/backup/db/backupRepository.ts`:

```typescript
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import {
  diaryEntries,
  medicationLog,
  medicationReminderTimes,
  medications,
  savedPlaces,
  screeningReminders,
  triggers,
} from '../../../db/schema';
import * as schema from '../../../db/schema';
import { BACKUP_FORMAT_VERSION, type BackupData } from '../types';

export type BackupDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function exportBackupData(db: BackupDb): Promise<BackupData> {
  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      diaryEntries: await db.select().from(diaryEntries),
      triggers: await db.select().from(triggers),
      medications: await db.select().from(medications),
      medicationLog: await db.select().from(medicationLog),
      medicationReminderTimes: await db.select().from(medicationReminderTimes),
      savedPlaces: await db.select().from(savedPlaces),
      screeningReminders: await db.select().from(screeningReminders),
    },
  };
}

export async function importBackupData(db: BackupDb, data: BackupData): Promise<void> {
  db.transaction((tx) => {
    // Kinder vor Eltern loeschen, damit PRAGMA foreign_keys=ON nicht blockiert.
    tx.delete(triggers).run();
    tx.delete(medicationLog).run();
    tx.delete(medicationReminderTimes).run();
    tx.delete(diaryEntries).run();
    tx.delete(medications).run();
    tx.delete(savedPlaces).run();
    tx.delete(screeningReminders).run();

    // Eltern vor Kindern einfuegen, mit den urspruenglichen IDs aus dem Backup.
    for (const row of data.tables.diaryEntries) {
      tx.insert(diaryEntries).values(row).run();
    }
    for (const row of data.tables.medications) {
      tx.insert(medications).values(row).run();
    }
    for (const row of data.tables.savedPlaces) {
      tx.insert(savedPlaces).values(row).run();
    }
    for (const row of data.tables.screeningReminders) {
      tx.insert(screeningReminders).values(row).run();
    }
    for (const row of data.tables.triggers) {
      tx.insert(triggers).values(row).run();
    }
    for (const row of data.tables.medicationLog) {
      tx.insert(medicationLog).values(row).run();
    }
    for (const row of data.tables.medicationReminderTimes) {
      tx.insert(medicationReminderTimes).values(row).run();
    }
  });
}
```

Wichtiger Hinweis (siehe auch Global Constraints): `db.transaction((tx) => {...})` ist beim `drizzle-orm/expo-sqlite`-Treiber synchron — der Callback ist bewusst **nicht** `async`, und jede Operation endet auf `.run()` statt auf `await`. Falls beim Ausführen der Tests (die den `better-sqlite3`-Treiber nutzen, der dasselbe synchrone Transaktions-Verhalten hat) ein anderes Verhalten auftritt als hier beschrieben, nicht raten — stoppen und eskalieren.

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/backup/db/backupRepository.test.ts`
Expected: PASS (5 Tests)

- [ ] **Step 6: Gesamte Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle bisherigen Tests plus die 5 neuen aus diesem Task)

- [ ] **Step 7: Commit**

```bash
git add src/features/backup/db/testDb.ts src/features/backup/db/backupRepository.ts src/features/backup/db/backupRepository.test.ts
git commit -m "feat: Backup-Repository fuer Export und fremdschluessel-sicheren Import"
```

---

### Task 7: Backup-Datei-Service + Formular-Komponente + Erinnerungen-Neuplanung

**Files:**
- Create: `colitis-app/src/features/backup/backupFileService.ts`
- Create: `colitis-app/src/features/backup/components/BackupPasswordForm.tsx`
- Create: `colitis-app/src/features/backup/rescheduleReminders.ts`

**Interfaces:**
- Consumes: `BackupData` aus `./types` (Task 1); `cancelScheduledReminder`, `scheduleDailyReminder`, `scheduleScreeningReminder`, `configureNotificationHandling`, `requestNotificationPermission` aus `../medications/notifications/notificationService` (bereits vorhanden); `setReminderTimeNotificationId` aus `../medications/db/medicationsRepository` (bereits vorhanden); `setScreeningReminderNotificationId` aus `../medications/db/screeningRepository` (bereits vorhanden); `tokens` aus `../../styles/tokens`.
- Produces: `writeAndShareBackup(envelopeJson: string): Promise<void>`, `pickBackupFileContent(): Promise<string | null>` (in `backupFileService.ts`); `BackupPasswordForm` (Props: `requireConfirmation: boolean`, `submitLabel: string`, `onSubmit: (password: string) => void | Promise<void>`, `onCancel: () => void`) (in `components/BackupPasswordForm.tsx`); `rescheduleAllReminders(db: BackupDb, data: BackupData): Promise<void>` (in `rescheduleReminders.ts`, `BackupDb` importiert aus `./db/backupRepository`). Werden von Task 8 (Einstellungen-Screen) verwendet.

Dieser Task hat keine neuen automatisierten Tests: `backupFileService.ts` ruft ausschließlich native Datei-/Teilen-/Auswahl-Dialoge auf (bestätigte projektweite Einschränkung), `BackupPasswordForm.tsx` ist eine React-Native-Komponente (dieselbe Einschränkung), und `rescheduleReminders.ts` kombiniert DB-Schreibzugriffe mit nativen Benachrichtigungs-Aufrufen in einer reinen Orchestrierungsfunktion — genau wie die bestehende, ebenfalls ungetestete Orchestrierung in `app/(tabs)/medikamente/index.tsx` (`handleSaveScreeningReminder`), die denselben Kombinations-Charakter hat. Verifikation über `tsc --noEmit` und sorgfältiges Lesen.

- [ ] **Step 1: Pakete installieren**

Run: `cd colitis-app && npx expo install expo-file-system expo-sharing expo-document-picker`
Expected: Alle drei Pakete erscheinen in `package.json` unter `dependencies` mit einer zu SDK 57 passenden Versionsangabe (Muster `~57.0.x`).

- [ ] **Step 2: `backupFileService.ts` erstellen**

Erstelle `colitis-app/src/features/backup/backupFileService.ts`:

```typescript
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const BACKUP_DIRECTORY_NAME = 'colitis-backups';

export async function writeAndShareBackup(envelopeJson: string): Promise<void> {
  const directory = new Directory(Paths.cache, BACKUP_DIRECTORY_NAME);
  directory.create({ idempotent: true });

  const fileName = `colitis-backup-${new Date().toISOString().slice(0, 10)}.colitisbackup`;
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(envelopeJson);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(file.uri);
}

export async function pickBackupFileContent(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) {
    return null;
  }
  const file = new File(result.assets[0].uri);
  return file.text();
}
```

Hinweis zur Ablage: Die Backup-Datei landet in `Paths.cache` (App-eigenes, vom System bereinigbares Cache-Verzeichnis) und wird nach dem Teilen nicht sofort explizit gelöscht — ein sofortiges Löschen direkt nach `Sharing.shareAsync()` wäre riskant, da auf manchen Android-Zielen der Dateizugriff der Ziel-App erst nach dem Auflösen dieses Promise vollständig abgeschlossen ist. Da die Datei ohnehin nur den bereits verschlüsselten Envelope enthält (nicht die Klartext-Daten), ist ein kurzes Verbleiben im App-eigenen Cache unkritisch.

- [ ] **Step 3: `BackupPasswordForm.tsx` erstellen**

Erstelle `colitis-app/src/features/backup/components/BackupPasswordForm.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';

const MIN_PASSWORD_LENGTH = 8;

interface BackupPasswordFormProps {
  requireConfirmation: boolean;
  submitLabel: string;
  onSubmit: (password: string) => void | Promise<void>;
  onCancel: () => void;
}

export function BackupPasswordForm({ requireConfirmation, submitLabel, onSubmit, onCancel }: BackupPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
      return;
    }
    if (requireConfirmation && password !== confirmPassword) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(password));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Backup-Passwort</Text>
      <TextInput
        style={styles.textInput}
        placeholderTextColor={tokens.colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {requireConfirmation && (
        <>
          <Text style={styles.label}>Passwort bestätigen</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={tokens.colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttonRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Abbrechen" style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  label: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.background,
    marginBottom: tokens.spacing.sm,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  submitButton: {
    flex: 1,
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: tokens.colors.border,
  },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 4: `rescheduleReminders.ts` erstellen**

Erstelle `colitis-app/src/features/backup/rescheduleReminders.ts`:

```typescript
import {
  cancelScheduledReminder,
  configureNotificationHandling,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
} from '../medications/notifications/notificationService';
import { setReminderTimeNotificationId } from '../medications/db/medicationsRepository';
import { setScreeningReminderNotificationId } from '../medications/db/screeningRepository';
import type { BackupDb } from './db/backupRepository';
import type { BackupData } from './types';

export async function rescheduleAllReminders(db: BackupDb, data: BackupData): Promise<void> {
  configureNotificationHandling();

  for (const reminderTime of data.tables.medicationReminderTimes) {
    if (reminderTime.notificationId) {
      await cancelScheduledReminder(reminderTime.notificationId);
    }
  }
  for (const screeningReminder of data.tables.screeningReminders) {
    if (screeningReminder.notificationId) {
      await cancelScheduledReminder(screeningReminder.notificationId);
    }
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }

  for (const reminderTime of data.tables.medicationReminderTimes) {
    const medication = data.tables.medications.find((candidate) => candidate.id === reminderTime.medicationId);
    const notificationId = await scheduleDailyReminder(reminderTime.time, {
      title: 'Medikamenten-Erinnerung',
      body: medication ? `Zeit für ${medication.name}` : 'Zeit für dein Medikament',
    });
    await setReminderTimeNotificationId(db, reminderTime.id, notificationId);
  }

  for (const screeningReminder of data.tables.screeningReminders) {
    const notificationId = await scheduleScreeningReminder(screeningReminder.nextDueDate, {
      title: 'Vorsorge-Koloskopie',
      body:
        screeningReminder.note && screeningReminder.note.length > 0
          ? screeningReminder.note
          : 'Deine Vorsorge-Koloskopie ist fällig.',
    });
    await setScreeningReminderNotificationId(db, screeningReminder.id, notificationId);
  }
}
```

- [ ] **Step 5: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 6: Vollständige Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (keine Regression, dieser Task fügt keine neuen Tests hinzu).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/backup/backupFileService.ts src/features/backup/components/BackupPasswordForm.tsx src/features/backup/rescheduleReminders.ts
git commit -m "feat: Backup-Datei-Service, Passwort-Formular und Erinnerungen-Neuplanung"
```

---

### Task 8: Einstellungen-Screen-Verdrahtung (App-Sperre + Backup Export/Import)

**Files:**
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: `createEncryptedDb` aus `../../../src/db/client`; `isAppLockEnabled`, `setPin`, `disableAppLock` aus `../../../src/features/appLock/pinAuth` (Task 3); `isValidPinFormat`, `PIN_LENGTH` aus `../../../src/features/appLock/pinFormLogic` (Task 1); `exportBackupData`, `importBackupData` aus `../../../src/features/backup/db/backupRepository` (Task 6); `serializeBackupData`, `parseBackupData` aus `../../../src/features/backup/backupSerializer` (Task 1); `deriveKeyFromPassword`, `encryptWithKey`, `decryptWithKey`, `bytesToHex`, `hexToBytes`, `PBKDF2_SALT_LENGTH_BYTES`, `GCM_NONCE_LENGTH_BYTES` aus `../../../src/features/backup/backupCrypto` (Task 2); `writeAndShareBackup`, `pickBackupFileContent` aus `../../../src/features/backup/backupFileService` (Task 7); `BackupPasswordForm` aus `../../../src/features/backup/components/BackupPasswordForm` (Task 7); `rescheduleAllReminders` aus `../../../src/features/backup/rescheduleReminders` (Task 7); `BACKUP_FORMAT_VERSION`, `BackupEnvelope` aus `../../../src/features/backup/types` (Task 1); `expo-crypto`'s `getRandomBytesAsync` (bereits vorhandene Abhängigkeit).
- Produces: Vollständig verdrahteter `EinstellungenScreen` — letzter Task dieses Plans, kein weiterer Konsument.

Dieser Task hat keine neuen automatisierten Tests (Screen, bestätigte projektweite Einschränkung). Verifikation über `tsc --noEmit` und sorgfältiges Lesen.

- [ ] **Step 1: `app/(tabs)/einstellungen/index.tsx` vollständig ersetzen**

Ersetze den gesamten Inhalt von `colitis-app/app/(tabs)/einstellungen/index.tsx` mit:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createEncryptedDb } from '../../../src/db/client';
import { isAppLockEnabled, setPin, disableAppLock } from '../../../src/features/appLock/pinAuth';
import { isValidPinFormat, PIN_LENGTH } from '../../../src/features/appLock/pinFormLogic';
import { exportBackupData, importBackupData } from '../../../src/features/backup/db/backupRepository';
import { serializeBackupData, parseBackupData } from '../../../src/features/backup/backupSerializer';
import {
  deriveKeyFromPassword,
  encryptWithKey,
  decryptWithKey,
  bytesToHex,
  hexToBytes,
  PBKDF2_SALT_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
} from '../../../src/features/backup/backupCrypto';
import { writeAndShareBackup, pickBackupFileContent } from '../../../src/features/backup/backupFileService';
import { BackupPasswordForm } from '../../../src/features/backup/components/BackupPasswordForm';
import { rescheduleAllReminders } from '../../../src/features/backup/rescheduleReminders';
import { BACKUP_FORMAT_VERSION, type BackupData, type BackupEnvelope } from '../../../src/features/backup/types';
import { tokens } from '../../../src/styles/tokens';

type BackupFormMode = 'export' | 'import' | null;

export default function EinstellungenScreen() {
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [backupFormMode, setBackupFormMode] = useState<BackupFormMode>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      isAppLockEnabled().then((enabled) => {
        if (isActive) {
          setIsLockEnabled(enabled);
        }
      });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleToggleLock(value: boolean) {
    if (value) {
      setIsSettingPin(true);
      return;
    }
    await disableAppLock();
    setIsLockEnabled(false);
  }

  async function handleSetPin() {
    if (!isValidPinFormat(newPin)) {
      setPinError(`Der PIN muss genau ${PIN_LENGTH} Ziffern haben.`);
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Die beiden PINs stimmen nicht überein.');
      return;
    }
    await setPin(newPin);
    setIsLockEnabled(true);
    setIsSettingPin(false);
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
  }

  async function handleExport(password: string) {
    try {
      const db = await createEncryptedDb();
      const data = await exportBackupData(db);
      const plaintext = serializeBackupData(data);
      const saltBytes = await Crypto.getRandomBytesAsync(PBKDF2_SALT_LENGTH_BYTES);
      const nonceBytes = await Crypto.getRandomBytesAsync(GCM_NONCE_LENGTH_BYTES);
      const key = deriveKeyFromPassword(password, saltBytes);
      const ciphertextBytes = encryptWithKey(new TextEncoder().encode(plaintext), key, nonceBytes);
      const envelope: BackupEnvelope = {
        version: BACKUP_FORMAT_VERSION,
        saltHex: bytesToHex(saltBytes),
        nonceHex: bytesToHex(nonceBytes),
        ciphertextHex: bytesToHex(ciphertextBytes),
      };
      await writeAndShareBackup(JSON.stringify(envelope));
      setBackupFormMode(null);
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Export fehlgeschlagen:', error);
      setBackupMessage('Backup konnte nicht erstellt werden.');
    }
  }

  async function handlePickImportFile() {
    try {
      const content = await pickBackupFileContent();
      if (content === null) {
        return;
      }
      setPendingImportContent(content);
      setBackupFormMode('import');
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sicherungsdatei konnte nicht gelesen werden:', error);
      setBackupMessage('Sicherungsdatei konnte nicht gelesen werden.');
    }
  }

  async function handleImport(password: string) {
    if (!pendingImportContent) {
      return;
    }

    let envelope: BackupEnvelope;
    try {
      envelope = JSON.parse(pendingImportContent) as BackupEnvelope;
    } catch {
      setBackupMessage('Sicherungsdatei ist kein gültiges Format.');
      return;
    }
    if (envelope.version !== BACKUP_FORMAT_VERSION) {
      setBackupMessage('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
      return;
    }

    let plaintextBytes: Uint8Array;
    try {
      const key = deriveKeyFromPassword(password, hexToBytes(envelope.saltHex));
      plaintextBytes = decryptWithKey(hexToBytes(envelope.ciphertextHex), key, hexToBytes(envelope.nonceHex));
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Entschlüsselung fehlgeschlagen:', error);
      setBackupMessage('Falsches Passwort oder beschädigte Sicherungsdatei.');
      return;
    }

    let data: BackupData;
    try {
      data = parseBackupData(new TextDecoder().decode(plaintextBytes));
    } catch (error: unknown) {
      setBackupMessage(error instanceof Error ? error.message : 'Sicherungsdatei ist kein gültiges Format.');
      return;
    }

    Alert.alert('Backup wiederherstellen?', 'Alle vorhandenen Daten werden unwiderruflich ersetzt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Wiederherstellen',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = await createEncryptedDb();
            await importBackupData(db, data);
            await rescheduleAllReminders(db, data);
            setBackupFormMode(null);
            setPendingImportContent(null);
            setBackupMessage('Backup erfolgreich wiederhergestellt.');
          } catch (error: unknown) {
            console.error('[Einstellungen] Backup-Import fehlgeschlagen:', error);
            setBackupMessage('Backup konnte nicht wiederhergestellt werden.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>App-Sperre</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>PIN-/Biometrie-Sperre aktivieren</Text>
        <Switch value={isLockEnabled} onValueChange={handleToggleLock} />
      </View>

      {isSettingPin && (
        <View style={styles.card}>
          <Text style={styles.label}>Neuer PIN ({PIN_LENGTH} Ziffern)</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={tokens.colors.textSecondary}
            value={newPin}
            onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
          />
          <Text style={styles.label}>PIN bestätigen</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={tokens.colors.textSecondary}
            value={confirmPin}
            onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
          />
          {pinError && <Text style={styles.error}>{pinError}</Text>}
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
              style={styles.cancelButton}
              onPress={() => {
                setIsSettingPin(false);
                setNewPin('');
                setConfirmPin('');
                setPinError(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="PIN speichern"
              style={styles.submitButton}
              onPress={handleSetPin}
            >
              <Text style={styles.submitButtonText}>PIN speichern</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Backup</Text>
      {backupMessage && <Text style={styles.backupMessage}>{backupMessage}</Text>}

      {backupFormMode === 'export' && (
        <BackupPasswordForm
          requireConfirmation
          submitLabel="Backup erstellen"
          onSubmit={handleExport}
          onCancel={() => setBackupFormMode(null)}
        />
      )}

      {backupFormMode === 'import' && (
        <BackupPasswordForm
          requireConfirmation={false}
          submitLabel="Wiederherstellen"
          onSubmit={handleImport}
          onCancel={() => {
            setBackupFormMode(null);
            setPendingImportContent(null);
          }}
        />
      )}

      {backupFormMode === null && (
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backup erstellen"
            style={styles.submitButton}
            onPress={() => {
              setBackupMessage(null);
              setBackupFormMode('export');
            }}
          >
            <Text style={styles.submitButtonText}>Backup erstellen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backup wiederherstellen"
            style={styles.cancelButton}
            onPress={handlePickImportFile}
          >
            <Text style={styles.cancelButtonText}>Backup wiederherstellen</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  sectionTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  rowLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  card: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginTop: tokens.spacing.sm,
  },
  label: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.background,
    marginBottom: tokens.spacing.sm,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  backupMessage: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  submitButton: {
    flex: 1,
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 2: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen (Regressionscheck, letzter Task)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle Tests aus allen bisherigen Schritten und diesem Plan).

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/einstellungen/index.tsx
git commit -m "feat: App-Sperre und Backup im Einstellungen-Tab verdrahten"
```

---

## Self-Review (durchgeführt beim Schreiben dieses Plans)

**Spec-Abdeckung:**
- Abschnitt 1 (App-Sperre: Opt-in, 6-stelliger PIN, gehashte Speicherung, Biometrie mit PIN-Fallback, Auslöser bei Start/Rückkehr aus Hintergrund, "PIN vergessen" mit mehrstufiger Bestätigung und Vollreset) → Tasks 1, 3, 4, 5, 8.
- Abschnitt 2 (Backup-Export: nur persönliche Tabellen, strukturiertes JSON, PBKDF2+AES-GCM, Teilen-Dialog) → Tasks 1, 2, 6, 7, 8.
- Abschnitt 3 (Backup-Import: Validierung, Bestätigung vor Ersatz, atomare Transaktion, Erinnerungen neu planen) → Tasks 1, 2, 6, 7, 8.
- Abschnitt 4 (Fehlerbehandlung: alle sechs Fälle) → abgedeckt in Task 8 (`handleExport`/`handleImport`/`handleToggleLock`-Fehlerpfade) und Task 5 (`LockScreen`s Falsch-PIN-Anzeige, PIN-vergessen-Fluss).
- Abschnitt 5 (Testing-Ansatz) → reine Logik (Tasks 1, 2) und native-Modul-Aufrufe (Tasks 3, 4) vollständig getestet, Repository-Rundtrip inkl. Fremdschlüssel-Reihenfolge (Task 6) vollständig getestet; native/Screen/UI-Teile bewusst ungetestet mit Verweis auf Schritt 8 (konsistent mit Global Constraints und etabliertem Projekt-Muster).
- "Explizit nicht Teil dieses Schritts" (PDF/CSV-Export, Merge-Import, automatische/Cloud-Backups, Mehrere Nutzerprofile, Backoff bei Fehlversuchen, Passwort-Stärke-Prüfung über Mindestlänge hinaus) → keiner dieser Punkte taucht in einem Task auf; bewusst ausgelassen.

**Platzhalter-Scan:** Keine "TBD"/"TODO" gefunden; jeder Schritt enthält vollständigen, direkt einsetzbaren Code oder einen exakten Befehl mit erwarteter Ausgabe.

**Typ-Konsistenz geprüft:**
- `BackupData`/`BackupEnvelope`-Feldnamen (`version`, `exportedAt`, `tables`, `saltHex`, `nonceHex`, `ciphertextHex`) sind über Task 1 (Typdefinition), Task 6 (Repository), Task 7 (Datei-Service, Neuplanung) und Task 8 (Screen) hinweg identisch verwendet.
- `backupCrypto.ts`-Funktionssignaturen (`deriveKeyFromPassword(password, salt)`, `encryptWithKey(plaintext, key, nonce)`, `decryptWithKey(ciphertext, key, nonce)`) stimmen zwischen Task 2 (Definition) und Task 8 (Verwendung im Export-/Import-Handler) exakt überein.
- `pinAuth.ts`-Funktionsnamen (`isAppLockEnabled`, `setPin`, `verifyPin`, `disableAppLock`, `resetAppLock`) sind zwischen Task 3 (Definition), Task 4 (`resetAppLock` in `appReset.ts`), Task 5 (`isAppLockEnabled`/`verifyPin` in `useAppLockGate`/`LockScreen`) und Task 8 (`isAppLockEnabled`/`setPin`/`disableAppLock` im Screen) konsistent.
- `DB_FILE_NAME` und `resetDbCache` (Task 4, aus `db/client.ts`) werden ausschließlich in `appReset.ts` konsumiert — keine Namensabweichung.
- `BackupDb`-Typ (Task 6) wird unverändert in `rescheduleReminders.ts` (Task 7) importiert und weitergereicht.

