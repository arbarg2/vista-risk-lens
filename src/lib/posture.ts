import type { AITool, ComplianceProfile } from '@/data/tools';
import { getEnrichment, dependencyExposure, type DependencyPackage } from '@/data/enrichment';

// ─── Types ──────────────────────────────────────────────
export type ApprovalStatus = 'approved' | 'review' | 'banned';

export interface PolicyWeights {
  performance: number;
  sovereignty: number;
  privacy: number;
  security: number;
  owasp: number;
}

export interface ToolScore {
  total: number;
  perfScore: number;
  trustScore: number;
  /** Trust before live CVE penalty. */
  trustBase: number;
  sovScore: number;
  privScore: number;
  secScore: number;
  owaspScore: number;
  cvePenalty: number;
}

export interface ThreatItem {
  id: string;
  aliases: string[];
  pkg: DependencyPackage;
  /** CVSS base score 0-10. */
  score: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  published: string;
  summary: string;
  source: 'NVD' | 'OSV';
  url: string;
  /** Listed in CISA's Known Exploited Vulnerabilities catalog (actively exploited in the wild). */
  exploited?: boolean;
}

// ─── Profile presets ────────────────────────────────────
export const PROFILE_LABELS: Record<ComplianceProfile, string> = {
  'eu-enterprise': 'EU Enterprise',
  'us-fedramp': 'US FedRAMP',
  'global-startup': 'Global Startup',
  personal: 'Personal',
};

export const DEFAULT_WEIGHTS: Record<ComplianceProfile, PolicyWeights> = {
  'eu-enterprise': { performance: 40, sovereignty: 22, privacy: 18, security: 12, owasp: 8 },
  'us-fedramp': { performance: 40, sovereignty: 12, privacy: 13, security: 22, owasp: 13 },
  'global-startup': { performance: 50, sovereignty: 8, privacy: 14, security: 12, owasp: 16 },
  personal: { performance: 55, sovereignty: 5, privacy: 25, security: 5, owasp: 10 },
};

/** Minimum acceptable score per axis for each profile (drawn as the red threshold line). */
export const PROFILE_THRESHOLD: Record<ComplianceProfile, number> = {
  'eu-enterprise': 70,
  'us-fedramp': 75,
  'global-startup': 55,
  personal: 45,
};

const SUB_RULES: Record<ComplianceProfile, {
  sovereignty: Record<string, number>;
  privacy: Record<string, number>;
  sec: { sso: number; soc2: number; hipaa: number; enc: number };
}> = {
  'eu-enterprise': {
    sovereignty: { EU: 1, US: 0.3, Global: 0.5 },
    privacy: { Never: 1, 'Opt-out': 0.6, 'Opt-in': 0.2 },
    sec: { sso: 1, soc2: 1, hipaa: 0.5, enc: 1 },
  },
  'us-fedramp': {
    sovereignty: { EU: 0.5, US: 1, Global: 0.6 },
    privacy: { Never: 1, 'Opt-out': 0.7, 'Opt-in': 0.3 },
    sec: { sso: 1, soc2: 1, hipaa: 1, enc: 1 },
  },
  'global-startup': {
    sovereignty: { EU: 0.8, US: 0.8, Global: 1 },
    privacy: { Never: 0.8, 'Opt-out': 0.9, 'Opt-in': 0.7 },
    sec: { sso: 0.5, soc2: 0.6, hipaa: 0.3, enc: 1 },
  },
  personal: {
    sovereignty: { EU: 0.9, US: 0.9, Global: 1 },
    privacy: { Never: 1, 'Opt-out': 0.8, 'Opt-in': 0.5 },
    sec: { sso: 0.2, soc2: 0.3, hipaa: 0.1, enc: 1 },
  },
};

// ─── Scoring ────────────────────────────────────────────
export function scoreTool(tool: AITool, profile: ComplianceProfile, weights: PolicyWeights, cvePenalty = 0): ToolScore {
  const r = SUB_RULES[profile];
  const en = getEnrichment(tool.id);
  const perf =
    (tool.performance.accuracy * 0.5 +
      (1 - Math.min(tool.performance.latency, 2000) / 2000) * 0.3 +
      (Math.min(tool.performance.throughput, 100) / 100) * 0.2) * 100;
  const sov = (r.sovereignty[tool.trust.dataSovereignty] ?? 0.5) * 100;
  const priv = (r.privacy[tool.trust.trainingPrivacy] ?? 0.5) * 100;
  const s = r.sec;
  const sec =
    ((tool.trust.sso ? s.sso : 0) + (tool.trust.soc2 ? s.soc2 : 0) + (tool.trust.hipaa ? s.hipaa : 0) + (tool.trust.encryptionAtRest ? s.enc : 0)) /
    (s.sso + s.soc2 + s.hipaa + s.enc) * 100;
  const owasp = (en.owasp.promptInjection + en.owasp.overreliance + en.owasp.provenance) / 3;

  const tw = weights.sovereignty + weights.privacy + weights.security + weights.owasp;
  const trustBase = tw > 0 ? (sov * weights.sovereignty + priv * weights.privacy + sec * weights.security + owasp * weights.owasp) / tw : 0;
  const penalty = Math.max(0, cvePenalty);
  const trust = Math.max(0, trustBase - penalty);
  const all = weights.performance + tw;
  const total = all > 0 ? (perf * weights.performance + trust * tw) / all : 0;

  return {
    total: Math.round(total),
    perfScore: Math.round(perf),
    trustScore: Math.round(trust),
    trustBase: Math.round(trustBase),
    sovScore: Math.round(sov),
    privScore: Math.round(priv),
    secScore: Math.round(sec),
    owaspScore: Math.round(owasp),
    cvePenalty: Math.round(penalty),
  };
}

export type Grade = 'A' | 'B' | 'C' | 'D';

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
}

export function getScoreTone(score: number): 'safe' | 'warning' | 'danger' {
  if (score >= 75) return 'safe';
  if (score >= 50) return 'warning';
  return 'danger';
}

/** Average total score of ONLY the tools marked approved. Null when nothing is approved. */
export function approvedPosture(
  tools: AITool[],
  statuses: Record<string, ApprovalStatus>,
  scores: Record<string, ToolScore>,
): { score: number; grade: Grade; count: number } | null {
  const approved = tools.filter((t) => statuses[t.id] === 'approved' && scores[t.id]);
  if (approved.length === 0) return null;
  const avg = approved.reduce((sum, t) => sum + scores[t.id].total, 0) / approved.length;
  const score = Math.round(avg);
  return { score, grade: gradeFor(score), count: approved.length };
}

// ─── Approval defaults ──────────────────────────────────
const DEFAULT_BANNED_PROVIDERS = ['DeepSeek', 'Alibaba Cloud'];
/** Synthetic-media tools start in review (copyright + EU AI Act Art. 50 labelling checks). */
const REVIEW_FIRST_CATEGORIES = ['Image Gen', 'Video Gen'];

export function defaultStatus(tool: AITool): ApprovalStatus {
  if (DEFAULT_BANNED_PROVIDERS.includes(tool.provider)) return 'banned';
  if (REVIEW_FIRST_CATEGORIES.includes(tool.category)) return 'review';
  if (tool.verified && tool.trust.soc2 && tool.trust.sso) return 'approved';
  return 'review';
}

// ─── Live CVE weighting ─────────────────────────────────
function recencyFactor(published: string, now: number): number {
  const ageDays = (now - new Date(published).getTime()) / 86_400_000;
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.6;
  if (ageDays <= 180) return 0.3;
  return 0.1;
}

export const MAX_CVE_PENALTY = 25;
/** CVEs on CISA's Known Exploited Vulnerabilities list weigh this many times more. */
export const KEV_MULTIPLIER = 2;

/** Risk mass per dependency package, from CVSS scores weighted by severity² and recency. */
export function packageRisk(threats: ThreatItem[], now = Date.now()): Partial<Record<DependencyPackage, number>> {
  const out: Partial<Record<DependencyPackage, number>> = {};
  for (const t of threats) {
    const w = Math.pow(t.score / 10, 2) * recencyFactor(t.published, now) * (t.exploited ? KEV_MULTIPLIER : 1);
    out[t.pkg] = (out[t.pkg] ?? 0) + w;
  }
  return out;
}

/** Trust-point penalty (0..MAX_CVE_PENALTY) applied to a tool from live CVEs in its dependency stack. */
export function cvePenaltyFor(tool: AITool, risk: Partial<Record<DependencyPackage, number>>): number {
  const exposure = dependencyExposure(tool);
  let raw = 0;
  for (const [pkg, ex] of Object.entries(exposure) as [DependencyPackage, number][]) {
    raw += ex * (risk[pkg] ?? 0);
  }
  return Math.round(MAX_CVE_PENALTY * (1 - Math.exp(-raw / 6)));
}

// ─── Regulatory readiness (heuristic) ───────────────────
const GENERATIVE = ['LLM', 'Reasoning', 'Image Gen', 'Video Gen', 'Audio', 'Assistant', 'Search', 'Code'];

export interface Readiness {
  euAiActArt50: number;
  nist: { govern: number; map: number; measure: number; manage: number; overall: number };
}

export function regulatoryReadiness(
  tools: AITool[],
  statuses: Record<string, ApprovalStatus>,
  scores: Record<string, ToolScore>,
  profile: ComplianceProfile,
  incidents: { resolved: boolean }[],
): Readiness {
  const approved = tools.filter((t) => statuses[t.id] === 'approved');
  const gen = approved.filter((t) => GENERATIVE.includes(t.category));
  const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));

  const art50 = pct(gen.filter((t) => getEnrichment(t.id).transparency).length, gen.length);
  const govern = pct(tools.filter((t) => statuses[t.id] !== 'review').length, tools.length);
  const map = pct(approved.filter((t) => getEnrichment(t.id).owasp.provenance >= 60).length, approved.length);
  const threshold = PROFILE_THRESHOLD[profile];
  const measure = pct(approved.filter((t) => (scores[t.id]?.trustScore ?? 0) >= threshold).length, approved.length);
  const manage = pct(incidents.filter((i) => i.resolved).length, incidents.length);
  const overall = Math.round((govern + map + measure + manage) / 4);
  return { euAiActArt50: art50, nist: { govern, map, measure, manage, overall } };
}

export function readinessLabel(pct: number): 'Ready' | 'Partial' | 'Gap' {
  if (pct >= 80) return 'Ready';
  if (pct >= 50) return 'Partial';
  return 'Gap';
}

/** Dollars per million tokens per posture point (lower = better value for the compliance risk taken). */
export function costToRisk(tool: AITool, score: ToolScore): string {
  if (tool.costPerMToken === 0) return 'seat-based';
  if (score.total === 0) return '∞';
  return `$${((tool.costPerMToken / score.total) * 100).toFixed(2)}`;
}

// ─── Confidence rating ──────────────────────────────────
export type Confidence = 'high' | 'medium' | 'low';
export interface ConfidenceResult { level: Confidence; reasons: string[] }

/** Retention windows at or above this are treated as "no bounded window published". */
export const UNBOUNDED_RETENTION_DAYS = 365;

/** Missing explicit retention / data-residency disclosures for a tool. */
export function disclosureGaps(tool: AITool): string[] {
  const en = getEnrichment(tool.id);
  const gaps: string[] = [];
  if (en.retentionDays >= UNBOUNDED_RETENTION_DAYS) gaps.push('No bounded data-retention window published');
  if (tool.trust.dataSovereignty === 'Global' && en.hosting === 'Proprietary') gaps.push('No named hosting cloud or processing region');
  return gaps;
}

/**
 * HIGH   — audited SOC 2 documentation on file AND live CVE telemetry (NVD/OSV) active.
 * MEDIUM — relies on vendor self-reported trust-center data (or CVE telemetry not active).
 * LOW    — explicit retention or residency disclosures are missing.
 */
export function confidenceFor(tool: AITool, telemetryActive: boolean): ConfidenceResult {
  const gaps = disclosureGaps(tool);
  if (gaps.length) return { level: 'low', reasons: gaps };
  const audited = tool.verified && tool.trust.soc2;
  if (audited && telemetryActive) {
    return { level: 'high', reasons: ['Audited SOC 2 documentation on file', 'Live CVE telemetry active (NVD / OSV.dev)'] };
  }
  const reasons: string[] = [];
  if (!audited) reasons.push(tool.trust.soc2 ? 'SOC 2 claimed by vendor, report not verified' : 'Based on vendor self-reported trust-center data');
  if (!telemetryActive) reasons.push('Live CVE telemetry not active');
  return { level: 'medium', reasons };
}

// ─── Policy fit (mandatory rules per profile) ───────────
export type RuleOutcome = 'pass' | 'conditional' | 'fail';
export type RuleLevel = 'required' | 'recommended';
export type PolicyFit = 'compliant' | 'conditional' | 'non-compliant';
export interface PolicyCheck { id: string; label: string; level: RuleLevel; outcome: RuleOutcome; detail: string }

type Rule = (tool: AITool, score?: ToolScore) => Omit<PolicyCheck, 'level'>;

const residencyRule = (want: 'EU' | 'US', otherFails: boolean): Rule => (tool) => {
  const sov = tool.trust.dataSovereignty;
  const id = 'residency';
  const label = `${want} data residency`;
  if (sov === want) return { id, label, outcome: 'pass', detail: `Data processed in ${want}` };
  if (sov === 'Global') return { id, label, outcome: 'conditional', detail: `Global routing — contract a ${want}-only region` };
  return otherFails
    ? { id, label, outcome: 'fail', detail: `Data processed in ${sov}` }
    : { id, label, outcome: 'conditional', detail: `Processed in ${sov} — needs a lawful transfer basis (SCCs / DPF)` };
};

const trainingRule = (optOutOk: boolean): Rule => (tool) => {
  const p = tool.trust.trainingPrivacy;
  const id = 'training';
  const label = 'No training on your data';
  if (p === 'Never') return { id, label, outcome: 'pass', detail: 'Vendor never trains on customer data' };
  if (p === 'Opt-out') return { id, label, outcome: optOutOk ? 'pass' : 'conditional', detail: 'Trains by default — opt-out must be enabled' };
  return { id, label, outcome: 'fail', detail: 'Customer data is used for training' };
};

const retentionRule = (maxDays: number): Rule => (tool) => {
  const d = getEnrichment(tool.id).retentionDays;
  const id = 'retention';
  const label = `Retention ≤ ${maxDays} days`;
  const shown = d >= UNBOUNDED_RETENTION_DAYS ? 'no bounded window' : `${d}d default`;
  if (d <= maxDays) return { id, label, outcome: 'pass', detail: d === 0 ? 'Zero-retention option available' : `${d}d default` };
  if (d <= maxDays * 3 && d < UNBOUNDED_RETENTION_DAYS) return { id, label, outcome: 'conditional', detail: `${shown} — negotiate a shorter window` };
  return { id, label, outcome: 'fail', detail: shown };
};

const zdrRule: Rule = (tool) => {
  const d = getEnrichment(tool.id).retentionDays;
  const id = 'zdr';
  const label = 'Zero-data retention';
  if (d === 0) return { id, label, outcome: 'pass', detail: 'Zero-retention option available' };
  if (d <= 30) return { id, label, outcome: 'conditional', detail: `${d}d default — ZDR needs an enterprise agreement` };
  return { id, label, outcome: 'fail', detail: d >= UNBOUNDED_RETENTION_DAYS ? 'No bounded window published' : `${d}d retention` };
};

const boolRule = (id: string, label: string, get: (t: AITool) => boolean, yes: string, no: string): Rule => (tool) =>
  get(tool) ? { id, label, outcome: 'pass', detail: yes } : { id, label, outcome: 'fail', detail: no };

const ssoRule = boolRule('sso', 'SSO / SAML', (t) => t.trust.sso, 'SSO supported', 'No SSO / SAML');
const soc2Rule = boolRule('soc2', 'SOC 2 Type II', (t) => t.trust.soc2, 'SOC 2 report available', 'No SOC 2 report');
const encRule = boolRule('enc', 'Encryption at rest', (t) => t.trust.encryptionAtRest, 'Encrypted at rest', 'No encryption-at-rest claim');
const hipaaRule = boolRule('hipaa', 'HIPAA BAA', (t) => t.trust.hipaa, 'BAA available', 'No BAA');
const ipRule = boolRule('ip', 'IP indemnification', (t) => getEnrichment(t.id).ipIndemnification, 'Indemnity offered', 'No indemnity');
const art50Rule = boolRule('art50', 'AI content disclosure (EU AI Act Art. 50)', (t) => getEnrichment(t.id).transparency, 'Disclosed', 'Not disclosed');

const cveRule: Rule = (_tool, score) => {
  const p = score?.cvePenalty ?? 0;
  const id = 'cve';
  const label = 'No severe live CVE exposure';
  if (p < 5) return { id, label, outcome: 'pass', detail: p ? `Minor exposure (−${p} trust)` : 'No matching advisories' };
  if (p < 15) return { id, label, outcome: 'conditional', detail: `−${p} trust — patch dependency stack` };
  return { id, label, outcome: 'fail', detail: `−${p} trust — critical exposure` };
};

const PROFILE_RULES: Record<ComplianceProfile, [RuleLevel, Rule][]> = {
  'eu-enterprise': [
    ['required', residencyRule('EU', false)],
    ['required', trainingRule(false)],
    ['required', retentionRule(30)],
    ['required', ssoRule],
    ['recommended', soc2Rule],
    ['recommended', art50Rule],
    ['recommended', cveRule],
  ],
  'us-fedramp': [
    ['required', residencyRule('US', true)],
    ['required', zdrRule],
    ['required', trainingRule(false)],
    ['required', soc2Rule],
    ['required', ssoRule],
    ['required', encRule],
    ['recommended', hipaaRule],
    ['recommended', cveRule],
  ],
  'global-startup': [
    ['required', encRule],
    ['required', trainingRule(true)],
    ['recommended', soc2Rule],
    ['recommended', ipRule],
    ['recommended', retentionRule(90)],
    ['recommended', cveRule],
  ],
  personal: [
    ['required', encRule],
    ['recommended', trainingRule(true)],
    ['recommended', retentionRule(30)],
    ['recommended', cveRule],
  ],
};

export function policyChecks(tool: AITool, profile: ComplianceProfile, score?: ToolScore): PolicyCheck[] {
  return PROFILE_RULES[profile].map(([level, rule]) => ({ ...rule(tool, score), level }));
}

/** Any failed required rule → non-compliant; any other gap → conditional; otherwise compliant. */
export function policyFit(checks: PolicyCheck[]): PolicyFit {
  if (checks.some((c) => c.level === 'required' && c.outcome === 'fail')) return 'non-compliant';
  if (checks.some((c) => c.outcome !== 'pass')) return 'conditional';
  return 'compliant';
}
