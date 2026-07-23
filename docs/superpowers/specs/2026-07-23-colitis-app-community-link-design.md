# Colitis2Go – Design: Community-Einstiegspunkt (externer Discord-Link)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-23*
*Grundlage: Nutzerwunsch nach Austausch mit Mitmenschen; nach gemeinsamer Scope-Entscheidung auf einen Link zu einer bestehenden externen Plattform reduziert statt eigenem Forum/Chat/Accounts*

## Kontext & Ziel

Der Nutzer möchte eine Möglichkeit für Austausch mit anderen Betroffenen (sowohl praktischer Erfahrungsaustausch als auch emotionale Unterstützung) in der App anbieten. Statt eines eigenen Forums mit Accounts und privaten Chats (deutlich größerer Aufwand: eigenes Backend, Nutzerverwaltung, Moderationswerkzeuge, laufende rechtliche/Datenschutz-Verantwortung bei einem Gesundheitsthema) wurde gemeinsam entschieden, für eine kleine, überschaubare Nutzergruppe zunächst auf eine bestehende, moderierbare externe Plattform zu setzen: einen Discord-Server.

**Wichtige Abgrenzung:** Der Discord-Server selbst muss vom Nutzer (Adrian) eigenständig angelegt und moderiert werden – das liegt außerhalb der App und ist nicht Teil dieser Umsetzung. Diese Spec deckt ausschließlich die App-Seite ab: einen Einstiegspunkt im Wissen-Tab, der zu diesem Server verlinkt.

## 1. Einladungslink

Der Discord-Einladungslink wird als fester Konstanten-Wert im Code hinterlegt, analog zu anderen festen externen URLs in der App (z. B. der Overpass-API-Endpunkt für die Toiletten-Suche). Keine Einstellungs-UI zum Ändern des Links – YAGNI, da es nur einen Link gibt und Änderungen selten sind.

Neue Datei `src/features/community/constants.ts`:

```typescript
export const COMMUNITY_INVITE_URL = 'https://discord.gg/PLATZHALTER';
```

*(Der tatsächliche Einladungslink muss vom Nutzer eingetragen werden, sobald der Discord-Server existiert – bis dahin bleibt dies ein Platzhalter-Wert im Code.)*

## 2. Persistenz des Hinweis-Status

Neue Funktionen in `src/features/settings/settingsStorage.ts`, nach dem etablierten `get.../set...`-Muster mit `AsyncStorage`:

```typescript
export async function getCommunityDisclaimerSeen(): Promise<boolean>
export async function setCommunityDisclaimerSeen(seen: boolean): Promise<void>
```

Speicher-Key: `colitis2go.settings.communityDisclaimerSeen` (Format: `'true'`/`'false'`-String, wie bei den bestehenden Boolean-Einstellungen in derselben Datei). Standardwert (nichts gespeichert): `false`.

## 3. UI & Verhalten

Im Wissen-Tab (`app/(tabs)/wissen/index.tsx`) wird unterhalb des bestehenden "Neuigkeiten ansehen →"-Links ein neuer Link "Community beitreten →" ergänzt, gleicher `newsLink`-Stil (gleiche Hintergrundfarbe, Border, Textfarbe/-gewicht).

Tap-Verhalten:
- `getCommunityDisclaimerSeen()` liefert `false` (Hinweis noch nie gesehen): Es erscheint `Alert.alert('Du verlässt die App', '<Hinweistext>', [{Abbrechen}, {Verstanden, weiter}])`. Der Hinweistext erklärt kurz, dass Discord eine externe Plattform mit eigenen Datenschutzbestimmungen ist und Inhalte dort nicht von der App moderiert werden. Bei "Abbrechen" passiert nichts weiter. Bei "Verstanden, weiter" wird `setCommunityDisclaimerSeen(true)` gespeichert und anschließend `Linking.openURL(COMMUNITY_INVITE_URL)` aufgerufen.
- `getCommunityDisclaimerSeen()` liefert `true` (Hinweis bereits bestätigt): Tap öffnet `Linking.openURL(COMMUNITY_INVITE_URL)` direkt, ohne erneuten Dialog.

## 4. Fehlerbehandlung

Schlägt `Linking.openURL` fehl (z. B. keine Discord-App und kein Browser verfügbar), wird das über das bestehende Error-Banner-Muster der Wissen-Seite angezeigt: "Community-Link konnte nicht geöffnet werden." – analog zu den PDF-Export-Fehlermeldungen an anderen Stellen der App.

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `getCommunityDisclaimerSeen`/`setCommunityDisclaimerSeen`: Standardwert `false` ohne gespeicherten Wert, Speichern und erneutes Lesen liefert `true`.
- UI-Änderung (neuer Link im Wissen-Tab, Dialog-Logik, `Linking.openURL`-Aufruf) wie bei bisherigen Features in diesem Projekt nicht automatisiert testbar (native Module nicht gemockt). Verifikation über `tsc --noEmit` und manuellen Test:
  - Erster Tap auf "Community beitreten →" → Hinweis-Dialog erscheint.
  - "Abbrechen" → kein Link wird geöffnet, Dialog erscheint beim nächsten Tap erneut.
  - "Verstanden, weiter" → Discord-Einladungslink öffnet sich (Browser oder Discord-App).
  - Erneuter Tap auf "Community beitreten →" → Link öffnet sich direkt, kein Dialog mehr.

## Explizit nicht Teil dieses Schritts

- Keine Erstellung, Konfiguration oder Moderation des Discord-Servers selbst – das liegt vollständig beim Nutzer außerhalb dieser App-Umsetzung.
- Kein eigenes Forum, kein eigener Chat, keine Nutzer-Accounts innerhalb der App.
- Keine Einstellungs-UI zum nachträglichen Ändern des Einladungslinks (fester Code-Wert, manuell im Quellcode zu aktualisieren).
- Keine globale/öffentliche Skalierung – ausgelegt für eine kleine, überschaubare Nutzergruppe.

---

*Hinweis: Diese Spec betrifft ausschließlich einen technischen Verweis auf eine externe, vom Nutzer selbst betriebene Plattform – keine medizinische Bewertung oder Empfehlung. Inhalte auf der externen Plattform unterliegen nicht der Kontrolle dieser App.*
