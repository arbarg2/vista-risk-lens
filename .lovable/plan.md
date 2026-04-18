
The user said "yes" — confirming they want me to plan wiring real data sources (the next step I proposed in the previous message). I'll plan that now.

Goal: replace the three biggest sources of mock data with real, live feeds, while keeping the demo polish.

Three real data sources to wire:
1. **CVE feed** for the Terminal Ticker → NVD API (free, no key) filtered for AI/ML keywords
2. **Tool metadata enrichment** → use Lovable AI (Gemini via gateway) to refresh trust signals on demand
3. **Persistent incidents + remediation audit log** → Lovable Cloud (Supabase) so Shadow AI events survive reload and become a real audit trail

Keep simulated incident generator (it's a demo), but persist the output.

<lov-plan>

# Plan — Wire Vigilance AI to real data

Turn the three biggest mock sources into live feeds while keeping the polished demo feel.

## 1. Live CVE feed (Terminal Ticker)

- Source: **NVD REST API 2.0** (`services.nvd.nist.gov/rest/json/cves/2.0`) — free, no key, CORS-enabled
- Query for recent CVEs containing AI/ML keywords: `langchain`, `llamaindex`, `transformers`, `pytorch`, `tensorflow`, `ollama`, `vllm`
- New file `src/lib/cveFeed.ts` — fetches + caches in `localStorage` for 1 hour
- Update `TerminalTicker.tsx` to merge real CVEs with the existing policy alerts; each CVE shows ID, severity (CVSS color), affected library, link to NVD
- Loading + error fallback to current hardcoded alerts

## 2. Persistent incidents & audit log (Lovable Cloud)

Enable **Lovable Cloud** and create two tables:

```text
incidents
  id uuid pk · created_at · tool_id · tool_name
  user · action · severity · profile · resolved bool

remediation_actions
  id uuid pk · created_at · incident_id fk
  action ('block'|'justify'|'redirect') · operator · notes
```

- RLS: public read/insert for the demo (or auth-gated if you want a login later)
- New `src/lib/incidentStore.ts` wraps inserts/queries
- `Index.tsx` writes every generated incident to the table; sidebar reads from the table (realtime subscription so multiple tabs stay in sync)
- `RemediationModal.tsx` writes the chosen action → Board Report PDF gets a new "Audit Trail" page pulled from `remediation_actions`

## 3. AI-powered trust refresh (Lovable AI)

- New **"Refresh trust signals"** button in each expanded leaderboard row
- Calls a new edge function `refresh-tool-trust` that uses **Lovable AI gateway** (Gemini 2.5 Flash, free during promo) with web-search-style grounding via a structured prompt
- Returns updated: training opt-out policy, SOC2 status, latest policy URL, EU hosting availability
- Result is cached in the `tool_overrides` table (so it survives reload) and overlays the seed data
- Visible "Last refreshed: 2 min ago · via Gemini" stamp under the tool name

## 4. UI polish to reflect "live" status

- Replace the implicit "demo" feel with a **green "LIVE" pulse dot** in the header next to "Vigilance AI" once CVE feed + Cloud are connected
- Add a small **Data Sources** popover (info icon in header) listing: NVD (CVEs), Lovable Cloud (incidents), Lovable AI (trust refresh), Static seed (baseline scores)

## File changes

| File | Change |
|---|---|
| `src/lib/cveFeed.ts` | new — NVD fetcher + cache |
| `src/lib/incidentStore.ts` | new — Cloud read/write/subscribe |
| `src/components/TerminalTicker.tsx` | merge real CVEs |
| `src/components/IncidentSidebar.tsx` | read from Cloud + realtime |
| `src/components/RemediationModal.tsx` | persist action |
| `src/components/LeaderboardTable.tsx` | add "Refresh trust" button |
| `src/components/DataSourcesPopover.tsx` | new — header info chip |
| `src/pages/Index.tsx` | wire stores + LIVE indicator |
| `src/lib/pdfReport.ts` | append Audit Trail page |
| `supabase/functions/refresh-tool-trust/index.ts` | new — Lovable AI call |
| migrations | `incidents`, `remediation_actions`, `tool_overrides` tables |

## What stays mocked (intentionally)

- The simulated user names + actions in `generateIncident()` — needed for demo without a real CASB log
- Baseline tool scores in `tools.ts` — refreshed on demand, not fully replaced

## Result

After approval: CVE ticker scrolls real vulnerabilities, every Shadow AI incident is recorded in a real database, remediation actions form a real audit trail exportable to PDF, and tool trust signals can be refreshed against live policy pages via AI — all without losing the cyber-audit aesthetic.

