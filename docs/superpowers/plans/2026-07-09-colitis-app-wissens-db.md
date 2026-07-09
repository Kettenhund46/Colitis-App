# Wissens-/Medikamentendatenbank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zeige Adrian im "Wissen"-Tab sechs strukturierte, durchsuchbare Wissensartikel zu Colitis Ulcerosa (inkl. eines allgemeinen Medikamenten-/Wirkstoffklassen-Artikels), destilliert aus `Colitis_Ulcerosa_Deepsearch.md`, jeweils mit Quellenangaben.

**Architecture:** Die Artikel sind als statische TypeScript-Konstante hinterlegt (kein Backend). Ein Repository seedet sie idempotent (Upsert per `slug`) in die bereits vorhandene `knowledge_content`-Tabelle und liest sie von dort. Eine reine, framework-freie Funktion filtert die geladenen Artikel client-seitig nach Suchbegriff. Ein Container-Screen (`wissen/index.tsx`) lädt/seedet/filtert und zeigt die Liste über eine presentationale Komponente; ein zweiter Container-Screen (`wissen/[slug].tsx`) zeigt die Detailansicht eines einzelnen Artikels inkl. anklickbarer Quellen.

**Tech Stack:** TypeScript, React Native/Expo Router, Drizzle ORM, Vitest, better-sqlite3 (Tests) (bestehendes Projekt-Setup, keine neuen Abhängigkeiten).

## Global Constraints

- Alle Daten bleiben 100% lokal (verschlüsselte SQLite-DB) – kein Netzwerkzugriff außer dem expliziten Öffnen einer Quellen-URL im externen Browser, wenn Adrian selbst darauf tippt.
- UI-Sprache: Deutsch, durchgehend.
- Design-Ton: ruhig/warm – ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts`, kein hartkodiertes Rot/Alarmfarben.
- Genau 6 statische Artikel (`ueberblick`, `ursachen`, `behandlung`, `folgen`, `forschung`, `medikamente`), destilliert aus den Kapiteln 1–5 der Deepsearch-Datei. Kapitel 6 (Kurzfazit), 7 (Adrians persönliches Profil) und 8 (Projekt-Entscheidungen) werden bewusst NICHT als Artikel übernommen (mit Adrian abgestimmt).
- Der Artikel `medikamente` bleibt allgemeines Nachschlagewissen zu Wirkstoffklassen, ohne Bezug zu Adrians persönlicher Medikamentenhistorie (mit Adrian abgestimmt – Verknüpfung zur eigenen Medikamentenliste ist Schritt 5 vorbehalten).
- Suche: einfacher, client-seitiger Substring-Filter über `title` + `body`, case-insensitive, kein Server, keine Volltextsuch-Engine (mit Adrian abgestimmt).
- Persistenz der `sources` (Liste von Quellen-URLs) in der `knowledge_content.sources`-Textspalte als JSON-Array (`JSON.stringify`/`JSON.parse`), nicht komma-getrennt wie z. B. `symptoms` in `diary_entries` – URLs können beliebige Zeichen enthalten, komma-getrennte Strings wären dafür unsicher.
- Seeding wird direkt im Wissen-Tab (Container-Screen `index.tsx`) aufgerufen, nicht im globalen `app/_layout.tsx`. Das hält das Feature-Modul in sich geschlossen (Prinzip aus Abschnitt 5 der Hauptspec) und verhindert, dass ein Seeding-Fehler den App-Start für andere Tabs blockiert. Die Seed-Funktion ist idempotent (Upsert per `slug`), wiederholtes Aufrufen bei jedem Tab-Fokus ist unschädlich.
- Testbarkeit: React Native lässt sich unter dem aktuellen Test-Runner (Vitest) nicht parsen/rendern (bestätigte Einschränkung aus Umsetzungsschritt 2/3). Nur framework-freie Logik (Content-Struktur, Repository, Suche) wird automatisiert getestet; Screens/Komponenten werden beim späteren manuellen Alltagstest mitgeprüft.
- Container/Presentational-Split beibehalten: nur Route-Dateien (`index.tsx`, `[slug].tsx`) rufen `createEncryptedDb()`/Repository-Funktionen auf; `KnowledgeArticleList`/`KnowledgeArticleDetail` bekommen fertige Daten per Props.

---

### Task 1: Wissensartikel-Inhalt (statische Content-Quelle)

**Files:**
- Create: `colitis-app/src/features/knowledge/types.ts`
- Create: `colitis-app/src/features/knowledge/content/articles.ts`
- Test: `colitis-app/src/features/knowledge/content/articles.test.ts`

**Interfaces:**
- Consumes: nichts (reine Content-Konstante).
- Produces: `KnowledgeArticle` Interface (`{slug: string, title: string, body: string, sources: string[]}`) in `colitis-app/src/features/knowledge/types.ts`; `KNOWLEDGE_ARTICLES: KnowledgeArticle[]` (genau 6 Einträge, Reihenfolge `ueberblick, ursachen, behandlung, folgen, forschung, medikamente`) in `colitis-app/src/features/knowledge/content/articles.ts`. Wird von Task 2 (Repository-Seeding) und indirekt von Task 4/5 (Screens) verwendet.

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/knowledge/content/articles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { KNOWLEDGE_ARTICLES } from './articles';

describe('KNOWLEDGE_ARTICLES', () => {
  it('contains exactly 6 articles', () => {
    expect(KNOWLEDGE_ARTICLES).toHaveLength(6);
  });

  it('has the expected slugs in the expected order', () => {
    expect(KNOWLEDGE_ARTICLES.map((article) => article.slug)).toEqual([
      'ueberblick',
      'ursachen',
      'behandlung',
      'folgen',
      'forschung',
      'medikamente',
    ]);
  });

  it('has unique slugs', () => {
    const slugs = KNOWLEDGE_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every article has a non-empty title, body and at least one https source', () => {
    for (const article of KNOWLEDGE_ARTICLES) {
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.body.length).toBeGreaterThan(0);
      expect(article.sources.length).toBeGreaterThan(0);
      for (const source of article.sources) {
        expect(source.startsWith('https://')).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/knowledge/content/articles.test.ts`
Expected: FAIL – `Cannot find module './articles'` (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `colitis-app/src/features/knowledge/types.ts`:

```typescript
export interface KnowledgeArticle {
  slug: string;
  title: string;
  body: string;
  sources: string[];
}
```

Create `colitis-app/src/features/knowledge/content/articles.ts`:

```typescript
import type { KnowledgeArticle } from '../types';

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: 'ueberblick',
    title: 'Was ist Colitis Ulcerosa',
    body: `Colitis Ulcerosa (CU) ist neben Morbus Crohn die zweite große Form der chronisch-entzündlichen Darmerkrankungen (CED). Es handelt sich um eine chronische, in Schüben verlaufende Entzündung der Dickdarmschleimhaut (Kolon und Rektum). Anders als Morbus Crohn beschränkt sich die Colitis Ulcerosa auf die oberste Schleimhautschicht des Dickdarms und breitet sich kontinuierlich vom Rektum aus nach oben aus, ohne die für Morbus Crohn typischen „Skip-Läsionen".

Nach der Ausdehnung wird zwischen Proktitis (nur der Enddarm, günstigste Prognose), Linksseitenkolitis (bis zur linken Kolonflexur) und ausgedehnter Kolitis bzw. Pankolitis (gesamter Dickdarm) unterschieden. Der Schweregrad reicht von leicht (meist auf das Rektosigmoid begrenzt, geringe Systemzeichen) über moderat (6–10 Stuhlgänge täglich) bis schwer (mehr als 10 blutige Stuhlgänge täglich, Tachykardie, hohes Fieber, meist stationär zu behandeln).

Typische Symptome sind blutig-schleimige Durchfälle als Leitsymptom, Bauchkrämpfe meist im linken Unterbauch, ständiger Stuhldrang (Tenesmus) sowie bei ausgedehntem Befall Fieber, Gewichtsverlust, Anämie und Erschöpfung. Der Verlauf wechselt typischerweise zwischen akuten Schüben und Remissionsphasen.

Die Diagnose erfolgt endoskopisch (Koloskopie/Sigmoidoskopie mit Biopsie), ergänzt durch Stuhluntersuchungen (u. a. Calprotectin als Entzündungsmarker) und Bluttests (u. a. pANCA-Antikörper, CRP).`,
    sources: [
      'https://www.dgvs.de/leitlinien/unterer-gi-trakt/colitis-ulcerosa/',
      'https://www.msdmanuals.com/de/profi/gastrointestinale-erkrankungen/entz%C3%BCndliche-darmerkrankheiten-ibd/colitis-ulcerosa',
      'https://amboss.miamed.de/wissen/Colitis_ulcerosa',
      'https://www.ncbi.nlm.nih.gov/books/NBK459282/',
    ],
  },
  {
    slug: 'ursachen',
    title: 'Ursachen und Auslöser',
    body: `Die genaue Ursache der Colitis Ulcerosa ist bis heute nicht abschließend geklärt. Fachgesellschaften und aktuelle Forschung gehen von einem multifaktoriellen Geschehen aus, bei dem mehrere Faktoren zusammenwirken.

Ein Großteil der Betroffenen weist eine genetische Prädisposition auf; Verwandte ersten Grades haben ein erhöhtes Erkrankungsrisiko. Genetik allein erklärt die Erkrankung aber nicht – sie schafft eine Anfälligkeit, keine Gewissheit. Hinzu kommt ein fehlgesteuertes Immunsystem: Colitis Ulcerosa beruht auf einer gestörten Immunbarriere, bei der die durchlässigere Darmschleimhaut („Leaky Gut") beim genetisch vorbelasteten Immunsystem eine überschießende, chronische Entzündungsreaktion auslöst.

Bei CU-Patienten zeigt sich zudem häufig eine Dysbiose – ein Ungleichgewicht zwischen entzündungsfördernden und entzündungshemmenden Darmbakterien mit reduzierter bakterieller Vielfalt. Ob sie Ursache oder Folge der Entzündung ist, wird weiter erforscht.

Umwelt- und Lebensstilfaktoren spielen ebenfalls eine Rolle: die Hygiene-Hypothese, frühe Darminfektionen, häufiger Antibiotikaeinsatz im Kindesalter sowie stark verarbeitete, zucker- und fettreiche Ernährung werden diskutiert. Eine Besonderheit bei Colitis Ulcerosa (anders als bei Morbus Crohn): Nichtraucher und Ex-Raucher erkranken statistisch tendenziell häufiger – das ist ausdrücklich keine Rauch-Empfehlung, sondern ein bislang nicht vollständig verstandenes epidemiologisches Phänomen. Auch Blinddarmentfernung, frühes Abstillen und bestimmte Rheuma-Medikamente (NSAR) werden als Risikofaktoren diskutiert.

Davon zu unterscheiden sind Auslöser für akute Schübe bei bereits Erkrankten – sie verursachen die Krankheit nicht, können aber einen Schub triggern: Stress und psychische Belastung (gut belegt über die Darm-Hirn-Achse), NSAR wie Ibuprofen oder Diclofenac, Antibiotika-Einnahme, Magen-Darm-Infekte, individuell unverträgliche Ernährung während eines Schubs, Schlafmangel sowie das Absetzen der Medikation.`,
    sources: [
      'https://www.dccv.de/betroffene-angehoerige/medizinische-grundlagen/basiswissen/krankheitsursachen/',
      'https://www.ced-trotzdem-ich.de/die-diagnose-verstehen/colitis-ulcerosa/ursachen',
      'https://www.crohnscolitisfoundation.org/blog/foundation-research-sheds-light-stress-induced-ulcerative-colitis-flares',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6821654/',
      'https://www.mayoclinic.org/diseases-conditions/ulcerative-colitis/in-depth/seasonal-life-changes-trigger-ulcerative-colitis-flare-up/art-80010160',
    ],
  },
  {
    slug: 'behandlung',
    title: 'Behandlungsmöglichkeiten',
    body: `Die Therapie der Colitis Ulcerosa richtet sich nach Schweregrad, Ausdehnung und Verlauf und folgt einem Stufenschema, ergänzt um das Konzept „Treat-to-Target" – das Ziel ist nicht nur Symptomfreiheit, sondern auch die endoskopische bzw. histologische Abheilung der Schleimhaut.

Basistherapie bei leichten bis moderaten Verläufen sind 5-Aminosalicylate (5-ASA, z. B. Mesalazin) als Tabletten, Granulat, Klysmen oder Zäpfchen, besonders bei Proktitis/Linksseitenkolitis lokal sehr wirksam. Bei akuten Schüben kommen Kortikosteroide zum Einsatz (z. B. Prednisolon, Budesonid MMX), die aber nicht zur Dauertherapie geeignet sind. Als steroidsparende Erhaltungstherapie bei chronisch-aktivem Verlauf dienen Immunsuppressiva wie Azathioprin, 6-Mercaptopurin oder Methotrexat.

Das Arsenal an Biologika und „Advanced Therapies" hat sich seit 2023–2026 deutlich erweitert: TNF-alpha-Blocker (Infliximab, Adalimumab, Golimumab) als etablierter Standard, der darmselektive Integrin-Antagonist Vedolizumab, IL-12/23- bzw. IL-23-Inhibitoren (Ustekinumab, seit Ende 2025 auch Mirikizumab und Guselkumab), orale JAK-Inhibitoren (Tofacitinib, Filgotinib, Upadacitinib mit erweiterter Zulassung seit Oktober 2025) sowie orale S1P-Rezeptor-Modulatoren (Ozanimod, Etrasimod). Für Ustekinumab wurden 2024/2025 zudem mehrere Biosimilars zugelassen, relevant für Therapiekosten und Verfügbarkeit.

Bei schwerem, therapierefraktärem Verlauf oder Komplikationen kann eine Kolektomie (Entfernung des Dickdarms) notwendig werden – häufigste Technik ist die ileoanale Pouch-Operation (IPAA), die meist ohne dauerhaftes Stoma auskommt. Anders als bei Morbus Crohn gilt die vollständige Kolektomie bezüglich der Darmentzündung selbst als kurativ.

Fäkale Mikrobiota-Transplantation (FMT) ist ein zunehmend beforschter Ansatz mit noch uneinheitlichen Ergebnissen; sie ist kein Standardverfahren, aber Gegenstand aktiver klinischer Studien. Bei der Ernährung gibt es keine allgemeingültige „Colitis-Ulcerosa-Diät": Die Low-FODMAP-Diät kann Blähungen und Schmerzen lindern, wirkt aber primär gegen Reizdarm-ähnliche Symptome, nicht gegen die Entzündung selbst. In akuten Schüben wird häufig eine ballaststoffarme, leicht verdauliche Kost empfohlen, in Remission möglichst normale, ausgewogene Ernährung – eine aktualisierte S3-Leitlinie „Klinische Ernährung bei CED" bündelt seit Februar 2025 die aktuellen Empfehlungen.

Die deutsche S3-Leitlinie Colitis ulcerosa der DGVS wurde 2025 grundlegend aktualisiert (Version 6.2 im Februar, Version 7.0 im November) – mit aktualisierten Treat-to-Target-Zielen, überarbeiteten Impfempfehlungen für immunsupprimierte Patienten, einer Betonung individualisierter statt standardisierter Therapiestrategien und der Positionierung neuerer Wirkstoffe wie Upadacitinib im Therapiealgorithmus nach Versagen von 5-ASA/Steroiden.`,
    sources: [
      'https://register.awmf.org/assets/guidelines/021-009l_S3_Colitis-ulcerosa_2025-11.pdf',
      'https://www.dgvs.de/leitlinien/unterer-gi-trakt/colitis-ulcerosa/',
      'https://www.medical-tribune.de/medizin/gastroenterologie/neue-colitis-ulcerosa-leitlinie-erschienen',
      'https://www.medcentral.com/gastroenterology/ibd/fdas-2025-gi-approvals-bolster-ibd-care',
      'https://ubiehealth.com/doctors-note/still-flaring-new-ibd-medications-2026-step-tip-4732e1',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12687017/',
      'https://www.mdpi.com/2077-0383/14/10/3475',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12966540/',
      'https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2025.1673867/full',
      'https://register.awmf.org/assets/guidelines/073-027l_S3_Klinische-Ernaehrung-bei-chronisch-entzuendlichen-Darmerkrankungen_2025-02.pdf',
    ],
  },
  {
    slug: 'folgen',
    title: 'Folgen und Komplikationen',
    body: `Zu den akuten Komplikationen der Colitis Ulcerosa zählt das toxische Megakolon – ein lebensbedrohlicher Notfall mit massiver Dickdarmerweiterung und Perforationsgefahr, der sofortige intensivmedizinische bzw. chirurgische Behandlung erfordert. Weitere akute Gefahren sind starke Blutungen mit Anämie und Darmperforation.

Ein wichtiges Langzeitrisiko ist das kolorektale Karzinom: Das Darmkrebsrisiko ist gegenüber der Normalbevölkerung erhöht und steigt mit der Erkrankungsdauer (deutlich erhöht meist ab 8–10 Jahren), der Ausdehnung der Entzündung (Pankolitis > Linksseitenkolitis > Proktitis) sowie zusätzlichen Risikofaktoren wie einer begleitenden primär sklerosierenden Cholangitis (PSC). Deshalb werden ab einer bestimmten Krankheitsdauer regelmäßige Vorsorge-Koloskopien empfohlen, mit Überwachungsintervallen je nach individuellem Risikoprofil.

Colitis Ulcerosa ist keine reine Darmerkrankung: Bei einem relevanten Anteil der Betroffenen treten extraintestinale Manifestationen auf, u. a. an den Gelenken (periphere Arthritis, Spondylitis ankylosans), der Haut (Erythema nodosum, Pyoderma gangraenosum), den Augen (Uveitis, Episkleritis) sowie Leber und Gallenwegen (primär sklerosierende Cholangitis) – letztere ist besonders bedeutsam, da sie selbst das Krebsrisiko weiter erhöht. Auch das Osteoporose-Risiko ist erhöht, u. a. durch Kortison-Langzeittherapie und die chronische Entzündung selbst.

Die psychischen Folgen sind erheblich: Studien zeigen, dass etwa jeder dritte CED-Patient Angstsymptome und etwa jeder vierte Symptome einer Depression zeigt. Die Darm-Hirn-Achse wirkt dabei in beide Richtungen – psychische Belastung kann Schübe begünstigen, aktive Entzündung wiederum die Psyche belasten. Häufige Themen sind Unsicherheit durch unvorhersehbare Schübe, Einschränkungen im Berufs- und Sozialleben, Toilettenabhängigkeit und Erschöpfung (Fatigue). Psychosomatische Begleitung wird zunehmend als fester Bestandteil der Behandlung empfohlen, nicht nur als Zusatzangebot.

Bei guter Krankheitskontrolle sind meist unauffällige Schwangerschaftsverläufe möglich, wobei aktive Entzündung zum Zeitpunkt der Empfängnis die Risiken erhöht. Bei gut kontrollierter, insbesondere lokal begrenzter Erkrankung ist die Lebenserwartung meist normal; das Gesamtrisiko hängt stark von Komplikationen wie Karzinom, PSC oder Operationsfolgen ab. Fehltage, Einschränkungen bei der Berufswahl und Krankheitskosten – v. a. durch Biologika – sind zudem relevante, gut dokumentierte Belastungsfaktoren.`,
    sources: [
      'https://www.msdmanuals.com/de/profi/gastrointestinale-erkrankungen/entz%C3%BCndliche-darmerkrankheiten-ibd/colitis-ulcerosa',
      'https://www.crohnscolitisfoundation.org/patientsandcaregivers/what-is-ibd/colorectal-cancer',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC9053498/',
      'https://www.ncbi.nlm.nih.gov/books/NBK568797/',
      'https://www.aerzteblatt.de/archiv/chronisch-entzuendliche-darmerkrankungen-symptome-von-angst-bei-jedem-dritten-patienten-depressionen-bei-jedem-vierten-8d35002d-330a-4a35-9c99-ecd18d7fe8ee',
      'https://www.deutschesgesundheitsportal.de/2022/11/01/psychische-erkrankungen-bei-chronischen-darmentzuendungen/',
      'https://www.leben-mit-ced.de/magazin/psyche.html',
    ],
  },
  {
    slug: 'forschung',
    title: 'Aktuelle Forschung 2025/2026',
    body: `Der Trend in der Wirkstoffentwicklung geht klar zu oralen, selektiveren Substanzen mit besserem Sicherheitsprofil gegenüber Infusionstherapien: Neben der Weiterentwicklung selektiver IL-23-Inhibitoren wie Mirikizumab und Guselkumab gewinnen orale Small Molecules – JAK-Inhibitoren der nächsten Generation und S1P-Modulatoren – an Bedeutung, da ihre kurze Halbwertszeit eine schnelle Steuerbarkeit bei Nebenwirkungen erlaubt. Weitere neue Wirkmechanismen, u. a. TL1A-Inhibitoren und zusätzliche Zytokin-Ziele, befinden sich 2025/2026 in der klinischen Pipeline.

Ein zentrales Forschungsfeld ist der Wandel vom „Trial-and-Error"-Ansatz hin zu datengetriebener, individualisierter Therapieauswahl: Biomarker, therapeutisches Drug-Monitoring und Immunprofiling sollen vorhersagen, welcher Patient auf welches Medikament anspricht. Multi-Omics-Ansätze – die Integration von Genetik-, Mikrobiom-, Metabolom- und Immunsystem-Daten – sollen Krankheitsmechanismen aufklären und neue Biomarker entdecken, mit dem Ziel, weg von reiner Symptomkontrolle hin zu nachhaltiger endoskopischer/histologischer Abheilung zu kommen.

Die Mikrobiom-Forschung bleibt aktiv: Bei der fäkalen Mikrobiota-Transplantation deuten neue Erkenntnisse darauf hin, dass die Wahl bestimmter, „atypischer" Spender die Erfolgsrate deutlich verbessern kann. Auch Probiotika-Forschung, etwa zu bestimmten Lactobacillus-Stämmen, wird als ergänzender Ansatz zur Mikrobiom-Modulation untersucht.

In der Grundlagenforschung identifizieren aktuelle Übersichtsarbeiten zahlreiche neue therapeutische Zielstrukturen – u. a. die NF-κB-, PI3K/AKT-, Wnt/β-Catenin- und JAK/STAT-Signalwege sowie epigenetische Regulatoren (lncRNAs, miRNAs) – und erforschen Ansätze wie mesenchymale Stammzelltherapie und gezielte Makrophagen-Umpolarisierung.

Auch digital: In Deutschland existiert bereits ein Markt für Digitale Gesundheitsanwendungen (DiGA, „auf Rezept") sowie freie Gesundheits-Apps für CED-Patienten, etwa Cara Care oder digo Health, die u. a. Symptom-Tagebücher, Ernährungstracking und Wissensinhalte bieten. Das offizielle DiGA-Verzeichnis (gesund.bund.de/BfArM) listet zugelassene, von Ärzten verschreibbare und von Krankenkassen erstattungsfähige Anwendungen.`,
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12420776/',
      'https://www.nature.com/articles/s41392-025-02345-1',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12897911/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11274502/',
      'https://faseb.onlinelibrary.wiley.com/doi/abs/10.1096/fj.202601379R',
      'https://pubmed.ncbi.nlm.nih.gov/41598696/',
      'https://www.frontiersin.org/journals/gastroenterology/articles/10.3389/fgstr.2026.1747118/full',
      'https://charlielees.substack.com/p/2025-year-in-review-the-great-remodelling',
      'https://www.diga-verzeichnis.de/en',
      'https://gesund.bund.de/en/digitale-gesundheitsanwendungen-diga',
    ],
  },
  {
    slug: 'medikamente',
    title: 'Medikamente & Wirkstoffklassen',
    body: `Dieser Artikel fasst die wichtigsten Wirkstoffklassen zur Behandlung der Colitis Ulcerosa zusammen – als allgemeines Nachschlagewissen, unabhängig von einer individuellen Medikation.

5-Aminosalicylate (5-ASA, z. B. Mesalazin) sind die Basistherapie bei leichten bis moderaten Verläufen, verfügbar als Tabletten, Granulat, Klysmen oder Zäpfchen, und besonders bei Proktitis oder Linksseitenkolitis lokal wirksam.

Kortikosteroide (z. B. Prednisolon, Budesonid MMX) werden bei akuten Schüben eingesetzt, um die Entzündung schnell einzudämmen, sind aber wegen ihrer Nebenwirkungen nicht zur Dauertherapie geeignet.

Immunsuppressiva (Azathioprin, 6-Mercaptopurin, Methotrexat) dienen als steroidsparende Erhaltungstherapie bei chronisch-aktivem Verlauf und wirken auf das Immunsystem als Ganzes, nicht gezielt auf einzelne Botenstoffe.

Biologika greifen gezielter in die Entzündungskaskade ein: TNF-alpha-Blocker (Infliximab, Adalimumab, Golimumab) sind seit Jahren etablierter Standard. Der Integrin-Antagonist Vedolizumab wirkt darmselektiv und blockiert die Einwanderung von Entzündungszellen in die Darmschleimhaut, was ihn besonders nebenwirkungsarm macht. IL-12/23- bzw. IL-23-Inhibitoren wie Ustekinumab, Mirikizumab und Guselkumab hemmen gezielt bestimmte Entzündungsbotenstoffe.

JAK-Inhibitoren (Tofacitinib, Filgotinib, Upadacitinib) sind orale „Small Molecules", die intrazellulär in die Signalübertragung von Entzündungsprozessen eingreifen und zu den wirksamsten verfügbaren Optionen zählen, wenn 5-ASA oder Steroide nicht ausreichen. S1P-Rezeptor-Modulatoren (Ozanimod, Etrasimod) sind eine neuere orale Wirkstoffklasse, die die Auswanderung von Lymphozyten aus den Lymphknoten hemmt und dadurch die Entzündung im Darm reduziert.

Für einzelne Biologika wie Ustekinumab existieren inzwischen zugelassene Biosimilars – wirkstoffgleiche Nachfolgepräparate, die für Therapiekosten und Verfügbarkeit relevant sind.

Welche Wirkstoffklasse im Einzelfall geeignet ist, hängt von Schweregrad, Ausdehnung, Verlauf und individuellem Ansprechen ab und wird ärztlich festgelegt – dieser Artikel ersetzt keine ärztliche Beratung.`,
    sources: [
      'https://register.awmf.org/assets/guidelines/021-009l_S3_Colitis-ulcerosa_2025-11.pdf',
      'https://www.dgvs.de/leitlinien/unterer-gi-trakt/colitis-ulcerosa/',
      'https://www.medcentral.com/gastroenterology/ibd/fdas-2025-gi-approvals-bolster-ibd-care',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12687017/',
      'https://www.mdpi.com/2077-0383/14/10/3475',
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/knowledge/content/articles.test.ts`
Expected: PASS (4/4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/knowledge/types.ts src/features/knowledge/content/articles.ts src/features/knowledge/content/articles.test.ts
git commit -m "feat: 6 statische Wissensartikel aus der Deepsearch-Datei destilliert"
```

---

### Task 2: Knowledge-Repository (Seeding, Lesen)

**Files:**
- Create: `colitis-app/src/features/knowledge/db/knowledgeRepository.ts`
- Test: `colitis-app/src/features/knowledge/db/knowledgeRepository.test.ts`

**Interfaces:**
- Consumes: `KNOWLEDGE_ARTICLES` (Task 1, `colitis-app/src/features/knowledge/content/articles.ts`), `KnowledgeArticle` Typ (Task 1, `colitis-app/src/features/knowledge/types.ts`), `knowledgeContent` Tabelle (`colitis-app/src/db/schema.ts`, Felder: `id`, `slug` (unique), `title`, `body`, `sources`).
- Produces: `KnowledgeDb` Typ-Alias (`BaseSQLiteDatabase<'sync', any, typeof schema>`), `seedKnowledgeArticles(db: KnowledgeDb): Promise<void>`, `listKnowledgeArticles(db: KnowledgeDb): Promise<KnowledgeArticle[]>`, `getKnowledgeArticleBySlug(db: KnowledgeDb, slug: string): Promise<KnowledgeArticle | null>` – alle drei werden von Task 4 (Listen-Screen) bzw. Task 5 (Detail-Screen) aufgerufen.

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/knowledge/db/knowledgeRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import { knowledgeContent } from '../../../db/schema';
import { seedKnowledgeArticles, listKnowledgeArticles, getKnowledgeArticleBySlug } from './knowledgeRepository';
import { KNOWLEDGE_ARTICLES } from '../content/articles';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const migrationSql = readFileSync(
    join(__dirname, '../../../../drizzle/0000_remarkable_junta.sql'),
    'utf-8'
  );
  for (const statement of migrationSql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      sqlite.exec(trimmed);
    }
  }
  return drizzle(sqlite, { schema });
}

describe('knowledge repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('seeds all articles into an empty database', async () => {
    await seedKnowledgeArticles(db);
    const articles = await listKnowledgeArticles(db);

    expect(articles).toHaveLength(KNOWLEDGE_ARTICLES.length);
    expect(articles.map((article) => article.slug)).toEqual(
      KNOWLEDGE_ARTICLES.map((article) => article.slug)
    );
  });

  it('does not duplicate rows when seeded twice', async () => {
    await seedKnowledgeArticles(db);
    await seedKnowledgeArticles(db);
    const articles = await listKnowledgeArticles(db);

    expect(articles).toHaveLength(KNOWLEDGE_ARTICLES.length);
  });

  it('updates existing article content instead of duplicating when it changes', async () => {
    await seedKnowledgeArticles(db);
    await db
      .update(knowledgeContent)
      .set({ title: 'Veralteter Titel', body: 'Veralteter Text' })
      .where(eq(knowledgeContent.slug, 'ueberblick'));

    await seedKnowledgeArticles(db);

    const canonical = KNOWLEDGE_ARTICLES.find((entry) => entry.slug === 'ueberblick')!;
    const article = await getKnowledgeArticleBySlug(db, 'ueberblick');

    expect(article?.title).toBe(canonical.title);
    expect(article?.body).toBe(canonical.body);

    const allArticles = await listKnowledgeArticles(db);
    expect(allArticles).toHaveLength(KNOWLEDGE_ARTICLES.length);
  });

  it('round-trips sources as an array', async () => {
    await seedKnowledgeArticles(db);
    const canonical = KNOWLEDGE_ARTICLES.find((entry) => entry.slug === 'ueberblick')!;
    const article = await getKnowledgeArticleBySlug(db, 'ueberblick');

    expect(article?.sources).toEqual(canonical.sources);
  });

  it('returns null for an unknown slug', async () => {
    await seedKnowledgeArticles(db);
    const article = await getKnowledgeArticleBySlug(db, 'nicht-vorhanden');

    expect(article).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/knowledge/db/knowledgeRepository.test.ts`
Expected: FAIL – `Cannot find module './knowledgeRepository'` (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `colitis-app/src/features/knowledge/db/knowledgeRepository.ts`:

```typescript
import { asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { knowledgeContent } from '../../../db/schema';
import * as schema from '../../../db/schema';
import { KNOWLEDGE_ARTICLES } from '../content/articles';
import type { KnowledgeArticle } from '../types';

export type KnowledgeDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function seedKnowledgeArticles(db: KnowledgeDb): Promise<void> {
  for (const article of KNOWLEDGE_ARTICLES) {
    await db
      .insert(knowledgeContent)
      .values({
        slug: article.slug,
        title: article.title,
        body: article.body,
        sources: JSON.stringify(article.sources),
      })
      .onConflictDoUpdate({
        target: knowledgeContent.slug,
        set: {
          title: article.title,
          body: article.body,
          sources: JSON.stringify(article.sources),
        },
      });
  }
}

export async function listKnowledgeArticles(db: KnowledgeDb): Promise<KnowledgeArticle[]> {
  const rows = await db.select().from(knowledgeContent).orderBy(asc(knowledgeContent.id));
  return rows.map(rowToArticle);
}

export async function getKnowledgeArticleBySlug(
  db: KnowledgeDb,
  slug: string
): Promise<KnowledgeArticle | null> {
  const rows = await db.select().from(knowledgeContent).where(eq(knowledgeContent.slug, slug));
  return rows.length > 0 ? rowToArticle(rows[0]) : null;
}

function rowToArticle(row: typeof knowledgeContent.$inferSelect): KnowledgeArticle {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    sources: JSON.parse(row.sources) as string[],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/knowledge/db/knowledgeRepository.test.ts`
Expected: PASS (5/5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/knowledge/db/knowledgeRepository.ts src/features/knowledge/db/knowledgeRepository.test.ts
git commit -m "feat: Knowledge-Repository mit idempotentem Seeding (Upsert per slug)"
```

---

### Task 3: Such-/Filterlogik

**Files:**
- Create: `colitis-app/src/features/knowledge/search.ts`
- Test: `colitis-app/src/features/knowledge/search.test.ts`

**Interfaces:**
- Consumes: `KnowledgeArticle` Typ (Task 1, `colitis-app/src/features/knowledge/types.ts`).
- Produces: `filterKnowledgeArticles(articles: KnowledgeArticle[], query: string): KnowledgeArticle[]` – wird von Task 4 (Listen-Screen) aufgerufen.

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/knowledge/search.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterKnowledgeArticles } from './search';
import type { KnowledgeArticle } from './types';

const articles: KnowledgeArticle[] = [
  {
    slug: 'a',
    title: 'Ursachen und Auslöser',
    body: 'Genetik und Immunsystem spielen eine Rolle.',
    sources: ['https://example.com/a'],
  },
  {
    slug: 'b',
    title: 'Behandlungsmöglichkeiten',
    body: 'Mesalazin ist die Basistherapie.',
    sources: ['https://example.com/b'],
  },
];

describe('filterKnowledgeArticles', () => {
  it('returns all articles for an empty query', () => {
    expect(filterKnowledgeArticles(articles, '')).toEqual(articles);
  });

  it('returns all articles for a whitespace-only query', () => {
    expect(filterKnowledgeArticles(articles, '   ')).toEqual(articles);
  });

  it('matches case-insensitively in the title', () => {
    expect(filterKnowledgeArticles(articles, 'URSACHEN')).toEqual([articles[0]]);
  });

  it('matches case-insensitively in the body', () => {
    expect(filterKnowledgeArticles(articles, 'mesalazin')).toEqual([articles[1]]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterKnowledgeArticles(articles, 'zzzzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/knowledge/search.test.ts`
Expected: FAIL – `Cannot find module './search'` (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `colitis-app/src/features/knowledge/search.ts`:

```typescript
import type { KnowledgeArticle } from './types';

export function filterKnowledgeArticles(articles: KnowledgeArticle[], query: string): KnowledgeArticle[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return articles;
  }

  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(normalizedQuery) ||
      article.body.toLowerCase().includes(normalizedQuery)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/knowledge/search.test.ts`
Expected: PASS (5/5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/knowledge/search.ts src/features/knowledge/search.test.ts
git commit -m "feat: Client-seitige Such-/Filterlogik fuer Wissensartikel"
```

---

### Task 4: Artikel-Liste (Screen + Komponente)

**Files:**
- Create: `colitis-app/src/features/knowledge/components/KnowledgeArticleList.tsx`
- Create: `colitis-app/app/(tabs)/wissen/_layout.tsx`
- Modify: `colitis-app/app/(tabs)/wissen/index.tsx`

**Interfaces:**
- Consumes: `createEncryptedDb` (`colitis-app/src/db/client.ts`), `seedKnowledgeArticles`/`listKnowledgeArticles` (Task 2), `filterKnowledgeArticles` (Task 3), `KnowledgeArticle` Typ (Task 1), `tokens` (`colitis-app/src/styles/tokens.ts`).
- Produces: `KnowledgeArticleList({articles, onSelect}: {articles: KnowledgeArticle[], onSelect: (slug: string) => void})` – rein präsentational, keine DB-/Hook-Zugriffe. Route `/wissen` (Liste) und `/wissen/[slug]` als navigierbares Ziel (Ziel-Screen folgt in Task 5).

Kein automatisierter Test für `KnowledgeArticleList.tsx`/`index.tsx` (React Native kann unter Vitest nicht geparst werden – siehe Global Constraints). Verifikation über den vollen Testlauf + TypeScript-Check (Regressionsschutz) sowie den späteren Alltagstest.

- [ ] **Step 1: Implement the presentational list component**

Create `colitis-app/src/features/knowledge/components/KnowledgeArticleList.tsx`:

```typescript
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';

interface KnowledgeArticleListProps {
  articles: KnowledgeArticle[];
  onSelect: (slug: string) => void;
}

function teaserFor(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

export function KnowledgeArticleList({ articles, onSelect }: KnowledgeArticleListProps) {
  if (articles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Keine Artikel gefunden.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={articles}
      keyExtractor={(article) => article.slug}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Artikel: ${item.title}`}
          style={styles.card}
          onPress={() => onSelect(item.slug)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardTeaser}>{teaserFor(item.body)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  listContent: {
    padding: tokens.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardTeaser: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
});
```

- [ ] **Step 2: Add a Stack layout for the Wissen tab**

Create `colitis-app/app/(tabs)/wissen/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function WissenLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Wissen' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Artikel' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Replace the Wissen placeholder screen with the article list**

Modify `colitis-app/app/(tabs)/wissen/index.tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { filterKnowledgeArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';

export default function WissenScreen() {
  const router = useRouter();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then(async (db) => {
          await seedKnowledgeArticles(db);
          return listKnowledgeArticles(db);
        })
        .then((loadedArticles) => {
          if (isActive) {
            setArticles(loadedArticles);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden der Artikel fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Inhalte konnten nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const visibleArticles = filterKnowledgeArticles(articles, query);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Wissensartikel durchsuchen"
      />
      <KnowledgeArticleList
        articles={visibleArticles}
        onSelect={(slug) => router.push(`/wissen/${slug}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    margin: tokens.spacing.md,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 4: Run the full test suite and TypeScript check**

Run: `npx vitest run`
Expected: PASS (all existing tests + the new tests from Tasks 1–3, no failures)

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/features/knowledge/components/KnowledgeArticleList.tsx "app/(tabs)/wissen/_layout.tsx" "app/(tabs)/wissen/index.tsx"
git commit -m "feat: Wissen-Tab zeigt durchsuchbare Artikel-Liste"
```

---

### Task 5: Artikel-Detailansicht (Screen + Komponente)

**Files:**
- Create: `colitis-app/src/features/knowledge/components/KnowledgeArticleDetail.tsx`
- Create: `colitis-app/app/(tabs)/wissen/[slug].tsx`

**Interfaces:**
- Consumes: `createEncryptedDb` (`colitis-app/src/db/client.ts`), `getKnowledgeArticleBySlug` (Task 2), `KnowledgeArticle` Typ (Task 1), `tokens` (`colitis-app/src/styles/tokens.ts`); Route-Parameter `slug` aus der in Task 4 registrierten `[slug]`-Route.
- Produces: `KnowledgeArticleDetail({article}: {article: KnowledgeArticle})` – rein präsentational. Vervollständigt die in Task 4 verlinkte Navigation `/wissen/[slug]`.

Kein automatisierter Test (React Native kann unter Vitest nicht geparst werden – siehe Global Constraints). Verifikation über den vollen Testlauf + TypeScript-Check sowie den späteren Alltagstest.

- [ ] **Step 1: Implement the presentational detail component**

Create `colitis-app/src/features/knowledge/components/KnowledgeArticleDetail.tsx`:

```typescript
import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';

interface KnowledgeArticleDetailProps {
  article: KnowledgeArticle;
}

export function KnowledgeArticleDetail({ article }: KnowledgeArticleDetailProps) {
  const paragraphs = article.body.split('\n\n');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{article.title}</Text>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
      <View style={styles.sourcesSection}>
        <Text style={styles.sourcesHeading}>Quellen</Text>
        {article.sources.map((source) => (
          <Pressable
            key={source}
            accessibilityRole="link"
            accessibilityLabel={`Quelle öffnen: ${source}`}
            onPress={() => Linking.openURL(source)}
          >
            <Text style={styles.sourceLink}>{source}</Text>
          </Pressable>
        ))}
      </View>
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
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.md,
  },
  paragraph: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    marginBottom: tokens.spacing.md,
    lineHeight: 24,
  },
  sourcesSection: {
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sourcesHeading: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.sm,
  },
  sourceLink: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
});
```

- [ ] **Step 2: Create the Artikel detail screen**

Create `colitis-app/app/(tabs)/wissen/[slug].tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { getKnowledgeArticleBySlug } from '../../../src/features/knowledge/db/knowledgeRepository';
import { KnowledgeArticleDetail } from '../../../src/features/knowledge/components/KnowledgeArticleDetail';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';

export default function ArtikelScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => getKnowledgeArticleBySlug(db, slug))
        .then((loadedArticle) => {
          if (isActive) {
            setArticle(loadedArticle);
            setError(loadedArticle ? null : 'Artikel wurde nicht gefunden.');
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden des Artikels fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Artikel konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [slug])
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Artikel wird geladen …</Text>
      </View>
    );
  }

  return <KnowledgeArticleDetail article={article} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 3: Run the full test suite and TypeScript check**

Run: `npx vitest run`
Expected: PASS (all tests, no failures)

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/knowledge/components/KnowledgeArticleDetail.tsx "app/(tabs)/wissen/[slug].tsx"
git commit -m "feat: Artikel-Detailansicht mit anklickbaren Quellen"
```
