# Vigilance AI — Risk-Adjusted GenAI Leaderboard

**Vigilance AI** helps teams decide which AI tools they can safely use. It ranks popular AI models and apps on both **how well they perform** and **how risky they are** for privacy, security and compliance.

> Live app: https://vista-risk-lens.lovable.app

---

## The problem it solves

Employees want to use ChatGPT, Claude, Cursor, Midjourney and dozens of other AI tools. Security and legal teams have to answer:

> *"If we approve this tool, are we leaking confidential data or breaking regulations?"*

Today that answer lives in stale spreadsheets, 40-page Terms of Service and slow procurement reviews. Vigilance AI puts it in one visual dashboard.

---

## Who it's for

| Role | What they get |
|---|---|
| **CISO / Security** | One objective risk score per tool: certifications, encryption, SSO, training-data use |
| **Legal / Compliance (DPO, GRC)** | Scores recalculated for their jurisdiction (EU, US federal, etc.) |
| **Engineering leads** | Side-by-side comparison to justify picking one model over another |
| **Procurement** | Cost-to-risk ratio: is the performance worth the compliance effort? |
| **Executives / Board** | A simple A–F letter grade and a printable summary |

---

## Key features

- **Leaderboard of 36 AI tools** across LLMs, code assistants, image, video, audio, search, embeddings, workplace assistants and cloud platforms.
- **Compliance profiles** — switch between *EU Enterprise*, *US FedRAMP*, *Global Startup* and *Personal*. All scores recalculate instantly with weights that match that context.
- **Trust Score ring** — color-coded circular score (green = safe, amber = caution, red = high risk).
- **Radar chart per tool** — the "shape" of a tool across Quality, Privacy, Security and Sovereignty.
- **Sparklines** — performance trend at a glance.
- **Expandable rows** — quick risk stats, data location, training-data policy and certifications.
- **VS comparison** — pick two tools and see a side-by-side risk gap analysis.
- **Red Flag ticker** — scrolling alerts about policy changes and risk events.
- **Source of truth** — each tool links to the vendor policy / trust page the data came from.

---

## How scoring works

Each tool gets a score from 0–100:

```text
Overall = Performance (40%) + Trust & Safety (60%)
```

**Performance (40%)** — quality/accuracy, latency, throughput.

**Trust & Safety (60%)**
- **Data sovereignty** — where data is stored (EU, US, global)
- **Training privacy** — is your data used to train models? (Never / Opt-out / Opt-in)
- **Security layer** — SSO/SAML, SOC 2, HIPAA, encryption at rest

The selected **compliance profile** changes how much each trust factor counts. For example, *EU Enterprise* weighs data sovereignty heavily; *Personal* weighs performance and cost more.

---

## How to use it

1. **Pick your profile** in the header (e.g. EU Enterprise).
2. **Scan the leaderboard** — sorted by risk-adjusted score.
3. **Expand a row** to see why a tool scored the way it did.
4. **Select two tools** and open the VS comparison to see the gap.
5. **Check the source links** before making a final decision.

---

## About the data

> ⚠️ **The data is a curated snapshot, not a live feed.**

- Tools, certifications and policies are based on **publicly available vendor disclosures**, entered by hand.
- Performance numbers are **benchmark estimates**.
- Alerts in the ticker are **illustrative examples**.
- The scoring math is real and runs live in your browser.

Always confirm against the vendor's current documentation before approving a tool.

---

## Roadmap

- [ ] Live vulnerability (CVE) feed for AI libraries
- [ ] Automatic vendor policy change tracking
- [ ] Tool detail pages and shareable comparisons
- [ ] Custom company policy builder ("approved AI catalog")
- [ ] Shadow AI detection and Slack/Teams alerts
- [ ] Board-ready PDF export with letter grade
- [ ] EU AI Act and healthcare (HIPAA) profiles

---

## Tech stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion · Recharts · Lucide icons · Lovable Cloud

### Run locally

```bash
npm install
npm run dev
```

Tool data lives in `src/data/tools.ts` — add or update a tool there to change the leaderboard.

---

## Disclaimer

Vigilance AI is a decision-support tool, not legal advice. Scores reflect public information at the time of entry and may be out of date.
