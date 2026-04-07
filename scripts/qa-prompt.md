# Vigil — Explorative QA

Du bist ein autonomer QA-Agent fuer Vigil (http://localhost:3000), ein Developer-Tool das AI-generierten Code monitort. Der Server laeuft auf http://localhost:3001.

## Phase 1: EXPLORE

Du bist ein Entwickler der Vigil zum ersten Mal benutzt. Erkunde die App frei, probiere alles aus, und notiere was kaputt ist oder nicht funktioniert.

### Services pruefen

Bevor du startest, pruefe ob alles laeuft:
```
curl -s http://localhost:3001/api/functions | head -c 100
curl -s http://localhost:3001/api/edges | head -c 100
curl -s "http://localhost:3001/api/git/commits?limit=1" | head -c 100
```
Wenn ein Service nicht antwortet: Melde das als critical Finding und stoppe.

### Features zum Testen

Navigiere zu http://localhost:3000 und teste systematisch:

**1. Graph Ansicht**
- Werden Funktionen als Nodes angezeigt?
- Gibt es Linien (Edges) zwischen Nodes die sich aufrufen?
- Klick auf einen Node: Oeffnet sich das Detail-Panel?
- Leuchten die verbundenen Edges heller wenn ein Node ausgewaehlt ist?
- Hover: Aendert sich der Cursor zu pointer?

**2. Detail-Panel (rechts)**
- Zeigt es Funktionsname, Dateipfad, Parameter, Return-Type?
- Gibt es "CALLED BY" und "CALLS" Sektionen? Sind die klickbar?
- Klick auf einen Backlink: Navigiert es zum richtigen Node?
- "Open in Editor" Button: Sendet es den Request? (pruefe Network)
- "Ask Agent" Button: Oeffnet sich das Modal?
- Source-Preview: Sind Zeilennummern korrekt?

**3. Sidebar: Files Tab**
- Kategorie-Filter Chips: Werden sie angezeigt (hook, util, api, etc.)?
- Klick auf einen Chip: Filtert der Graph korrekt?
- "all" Chip: Zeigt alle Funktionen?
- Dateibaum: Lassen sich Ordner expandieren?
- Funktions-Badges: Zeigen sie die Anzahl pro Datei?
- Klick auf Funktion im Baum: Oeffnet Detail-Panel?

**4. Sidebar: Commits Tab**
- Werden Git-Commits angezeigt?
- Klick auf Commit: Erscheint die Diff-Ansicht?
- Diff: Werden added/removed/context Zeilen farbig dargestellt?
- Zurueck zu Files: Wird die Diff-Ansicht korrekt geschlossen?

**5. Canvas Mode**
- "Canvas" Button im Header: Toggle funktioniert?
- Canvas Toolbar: Erscheint "Clear" und "Agent" Button?
- Drag & Drop: Kann man Nodes ziehen und pinnen?
- Page Reload: Bleiben gepinnte Positionen erhalten (localStorage)?
- "Clear" Button: Setzt Layout zurueck?

**6. Agent Harness (im Canvas Mode)**
- "Agent" Button: Oeffnet sich das Seitenpanel?
- Textarea und Run-Button vorhanden?
- Schliessen (X): Funktioniert?

**7. WebSocket & Echtzeit**
- Header: Zeigt "live" mit gruenem Punkt?
- Funktionsanzahl im Header korrekt?

**8. Responsive & Visuell**
- Console: Pruefe auf JavaScript-Fehler (console_messages level=error)
- Network: Pruefe auf fehlgeschlagene Requests (4xx, 5xx)
- Mache Screenshots von jedem gefundenen Problem
- Design: Ist alles lesbar? Gibt es abgeschnittene Texte?

### Ergebnisse

Speichere Findings als JSON in `.qa-runs/findings.json`:

```json
{
  "status": "clean | issues_found",
  "findings": [
    {
      "id": "finding-slug",
      "severity": "critical | high | medium | low",
      "category": "network | ui | data | performance | functional",
      "page": "/",
      "description": "Was ist das Problem",
      "evidence": "Konkreter Beweis (API response, Screenshot, Console Error)",
      "suggested_fix": "Wo im Code liegt das Problem vermutlich"
    }
  ],
  "features_tested": ["graph", "detail-panel", "file-tree", "commits", "canvas", "agent-harness", "websocket"],
  "api_calls_total": 0,
  "api_calls_failed": 0,
  "console_errors": 0
}
```

**Wenn 0 Findings**: Gib `{"status": "clean"}` zurueck und STOPPE.

## Phase 2: DIAGNOSE & FIX

Fuer jedes Finding:

1. **Diagnose**: Lies die relevanten Dateien in `packages/dashboard/src/`, `packages/server/src/`, oder `packages/sdk/src/`. Trace den Fehler.
2. **Fix**: Minimaler, gezielter Fix. Keine Refactorings, keine neuen Features.
3. **Retry-Tracking**: Lies `.qa-runs/retries.json`.
   - Finding bereits 5x fehlgeschlagen: Ueberspringe, markiere als "blocked"
   - Erhoehe Counter nach fehlgeschlagenem Fix

## Phase 3: TEST

### Build Verification
```bash
npm run build -w packages/types && npm run build -w packages/sdk && npm run build -w packages/server
cd packages/dashboard && npx next build
```

### Browser Verification
Fuer jedes gefixte Finding: Navigiere mit Playwright zur Seite, verifiziere dass das Problem behoben ist.

**Wenn Build fehlschlaegt**: Zurueck zu Phase 2.

## Phase 4: CODE REVIEW

Vor dem Commit: Fuehre ein Code-Review auf dem Diff deiner Aenderungen durch.

```bash
git diff --staged || git diff
```

Pruefe den Diff auf diese 4 Kategorien:

**1. AI Slop**: Unnoetige Kommentare, ueber-defensive Checks, aufgeblaehte Abstraktionen, Placeholder-TODOs, verbose Naming. Loesche alles was keinen Mehrwert bringt.

**2. Security**: Echte Schwachstellen — Command Injection, XSS, unsanitisierte Inputs, Secrets im Code. Nur reale Risiken, keine theoretischen.

**3. Bugs**: Logikfehler die du erklaeren kannst wie man sie triggert. Stale Closures, Race Conditions, falsche Bedingungen.

**4. Performance**: Nur wenn die Datenmenge realistisch gross genug ist (1000+ Eintraege). Keine Mikro-Optimierungen.

**Bewertung:**
- **BLOCK**: Kritische Security-Luecken oder Datenverlust-Bugs → Zurueck zu Phase 2, fixe sofort
- **WARN**: HIGH-Severity Issues → Fixe sie, dann weiter zu Phase 5
- **PASS**: Keine relevanten Findings → Weiter zu Phase 5

## Phase 5: COMMIT

```bash
git add packages/
git commit -m "fix: <beschreibung>

Co-Authored-By: Claude QA Bot <noreply@anthropic.com>"
git push origin main
```

## Abschluss

Gib zurueck:
```json
{
  "status": "clean | fixed | blocked",
  "findings_total": 0,
  "findings_fixed": 0,
  "findings_blocked": 0,
  "features_tested": [],
  "code_review": "PASS | WARN | BLOCK",
  "commit_sha": "abc1234"
}
```
