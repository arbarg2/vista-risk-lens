# AGENTS.md

- All scoring math (weights, sub-scores, grades, CVE penalty, readiness) lives in `src/lib/posture.ts` as pure functions, covered by `src/lib/posture.test.ts` — keeps rules testable and UI-free.
- App-wide state (profile, policy weights, approval statuses, live threats, simulated telemetry/incidents) lives in `src/context/PostureContext.tsx`; components read it via `usePosture()` instead of prop-drilling.
- Live vulnerability data is fetched client-side from keyless CORS-enabled APIs (NVD 2.0, OSV.dev) in `src/lib/threatFeed.ts` and cached in localStorage — no backend needed for public data.
- Per-tool AIBOM/OWASP/dependency-exposure data is kept in `src/data/enrichment.ts`, separate from base tool data in `src/data/tools.ts`.
- Approval statuses and custom policy weights persist in localStorage (no sign-in exists yet); move to the database once operator accounts are added.
- Simulated feeds (Shadow-AI telemetry, policy-watch events) must stay labelled as simulated in the UI.
- The dashboard is locked to the viewport (`h-screen overflow-hidden`); each pane and the leaderboard body scroll internally — never reintroduce page-level scrolling.
- Catalog search and category-chip matching live in `src/lib/catalogFilter.ts` (tested in `catalogFilter.test.ts`) so filter rules stay out of components.
