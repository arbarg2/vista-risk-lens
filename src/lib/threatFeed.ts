import type { DependencyPackage } from '@/data/enrichment';
import type { ThreatItem } from './posture';

// Live vulnerability ingestion from public, keyless, CORS-enabled APIs:
//  • NVD CVE API 2.0 — https://services.nvd.nist.gov/rest/json/cves/2.0
//  • OSV.dev        — https://api.osv.dev/v1/query

const NVD_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const OSV_URL = 'https://api.osv.dev/v1/query';
const CACHE_KEY = 'vigilance.threats.v2';
const CACHE_TTL_MS = 30 * 60 * 1000;
const NVD_WINDOW_DAYS = 119; // NVD max range is 120 days
const OSV_WINDOW_DAYS = 180;

export const NVD_KEYWORDS: { keyword: string; pkg: DependencyPackage }[] = [
  { keyword: 'langchain', pkg: 'langchain' },
  { keyword: 'transformers', pkg: 'transformers' },
  { keyword: 'pytorch', pkg: 'pytorch' },
  { keyword: 'torchserve', pkg: 'torchserve' },
  { keyword: 'vllm', pkg: 'vllm' },
  { keyword: 'ollama', pkg: 'ollama' },
];

const OSV_PACKAGES: { name: string; ecosystem: string; pkg: DependencyPackage }[] = [
  { name: 'langchain', ecosystem: 'PyPI', pkg: 'langchain' },
  { name: 'langchain-core', ecosystem: 'PyPI', pkg: 'langchain' },
  { name: 'transformers', ecosystem: 'PyPI', pkg: 'transformers' },
  { name: 'torch', ecosystem: 'PyPI', pkg: 'pytorch' },
  { name: 'torchserve', ecosystem: 'PyPI', pkg: 'torchserve' },
  { name: 'vllm', ecosystem: 'PyPI', pkg: 'vllm' },
  { name: 'github.com/ollama/ollama', ecosystem: 'Go', pkg: 'ollama' },
];

export type SourceState = 'idle' | 'loading' | 'live' | 'cached' | 'error';

// ─── CVSS v3.x base score calculator (FIRST spec) ───────
const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
};
const roundUp = (x: number) => {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
};

export function cvss3BaseScore(vector: string): number | null {
  const m: Record<string, string> = {};
  vector.split('/').forEach((p) => {
    const [k, v] = p.split(':');
    if (k && v) m[k] = v;
  });
  if (!m.AV || !m.AC || !m.PR || !m.UI || !m.S || !m.C || !m.I || !m.A) return null;
  const changed = m.S === 'C';
  const pr = m.PR === 'N' ? 0.85 : m.PR === 'L' ? (changed ? 0.68 : 0.62) : m.PR === 'H' ? (changed ? 0.5 : 0.27) : 0.85;
  const iss = 1 - (1 - W.CIA[m.C as 'H']) * (1 - W.CIA[m.I as 'H']) * (1 - W.CIA[m.A as 'H']);
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const expl = 8.22 * W.AV[m.AV as 'N'] * W.AC[m.AC as 'L'] * pr * W.UI[m.UI as 'N'];
  if (impact <= 0) return 0;
  return changed ? roundUp(Math.min(1.08 * (impact + expl), 10)) : roundUp(Math.min(impact + expl, 10));
}

export function severityFromScore(s: number): ThreatItem['severity'] {
  if (s >= 9) return 'CRITICAL';
  if (s >= 7) return 'HIGH';
  if (s >= 4) return 'MEDIUM';
  if (s > 0) return 'LOW';
  return 'NONE';
}

// ─── NVD ────────────────────────────────────────────────
interface NvdMetric { cvssData?: { baseScore?: number } }
interface NvdVuln {
  cve: {
    id: string;
    published: string;
    descriptions?: { lang: string; value: string }[];
    metrics?: Record<string, NvdMetric[]>;
  };
}

function nvdScore(metrics?: Record<string, NvdMetric[]>): number {
  if (!metrics) return 5;
  for (const key of ['cvssMetricV40', 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']) {
    const s = metrics[key]?.find((m) => typeof m.cvssData?.baseScore === 'number')?.cvssData?.baseScore;
    if (typeof s === 'number') return s;
  }
  return 5;
}

const nvdDate = (d: Date) => d.toISOString().replace('Z', '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchNvdKeyword(keyword: string, pkg: DependencyPackage, signal?: AbortSignal): Promise<ThreatItem[]> {
  const end = new Date();
  const start = new Date(end.getTime() - NVD_WINDOW_DAYS * 86_400_000);
  const url = `${NVD_URL}?keywordSearch=${encodeURIComponent(keyword)}&pubStartDate=${nvdDate(start)}&pubEndDate=${nvdDate(end)}&resultsPerPage=100`;
  let res = await fetch(url, { signal });
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    await sleep(7000); // public rate limit: 5 requests / 30s
    res = await fetch(url, { signal });
  }
  if (!res.ok) throw new Error(`NVD ${res.status}`);
  const json = (await res.json()) as { vulnerabilities?: NvdVuln[] };
  return (json.vulnerabilities ?? []).map(({ cve }) => {
    const score = nvdScore(cve.metrics);
    return {
      id: cve.id,
      aliases: [cve.id],
      pkg,
      score,
      severity: severityFromScore(score),
      published: cve.published.endsWith('Z') ? cve.published : `${cve.published}Z`,
      summary: (cve.descriptions?.find((d) => d.lang === 'en')?.value ?? '').slice(0, 220),
      source: 'NVD' as const,
      url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
    };
  });
}

// ─── OSV ────────────────────────────────────────────────
interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  published?: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: string };
}

const GHSA_SEVERITY: Record<string, number> = { LOW: 3, MODERATE: 5.5, MEDIUM: 5.5, HIGH: 7.5, CRITICAL: 9.3 };

function osvScore(v: OsvVuln): number {
  const v3 = v.severity?.find((s) => s.type === 'CVSS_V3');
  if (v3) {
    const s = cvss3BaseScore(v3.score);
    if (s !== null) return s;
  }
  const ds = v.database_specific?.severity?.toUpperCase();
  if (ds && GHSA_SEVERITY[ds]) return GHSA_SEVERITY[ds];
  return 5;
}

async function fetchOsvPackage(name: string, ecosystem: string, pkg: DependencyPackage, signal?: AbortSignal): Promise<ThreatItem[]> {
  const res = await fetch(OSV_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: { name, ecosystem } }),
    signal,
  });
  if (!res.ok) throw new Error(`OSV ${res.status}`);
  const json = (await res.json()) as { vulns?: OsvVuln[] };
  const cutoff = Date.now() - OSV_WINDOW_DAYS * 86_400_000;
  return (json.vulns ?? [])
    .filter((v) => v.published && new Date(v.published).getTime() >= cutoff)
    .map((v) => {
      const score = osvScore(v);
      const cve = v.aliases?.find((a) => a.startsWith('CVE-'));
      return {
        id: cve ?? v.id,
        aliases: [v.id, ...(v.aliases ?? [])],
        pkg,
        score,
        severity: severityFromScore(score),
        published: v.published!,
        summary: (v.summary || v.details || '').slice(0, 220),
        source: 'OSV' as const,
        url: `https://osv.dev/vulnerability/${v.id}`,
      };
    });
}

// ─── Merge / cache ──────────────────────────────────────
export function mergeThreats(items: ThreatItem[]): ThreatItem[] {
  const byKey = new Map<string, ThreatItem>();
  for (const it of items) {
    const key = `${it.pkg}:${it.id}`;
    const prev = byKey.get(key);
    // NVD's CVSS wins over OSV estimates
    if (!prev || (prev.source === 'OSV' && it.source === 'NVD')) byKey.set(key, it);
  }
  return [...byKey.values()].sort((a, b) => b.published.localeCompare(a.published));
}

interface CachePayload { fetchedAt: number; items: ThreatItem[] }

export function readThreatCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeThreatCache(items: ThreatItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), items }));
  } catch {
    /* quota — ignore */
  }
}

export interface FeedCallbacks {
  onBatch: (source: 'NVD' | 'OSV', label: string, items: ThreatItem[]) => void;
  onSourceState: (source: 'NVD' | 'OSV', state: SourceState, detail?: string) => void;
}

/** Streams results source-by-source so the UI can update live. Returns merged list. */
export async function syncThreats(cb: FeedCallbacks, signal?: AbortSignal): Promise<ThreatItem[]> {
  const all: ThreatItem[] = [];

  const osvTask = (async () => {
    cb.onSourceState('OSV', 'loading');
    const results = await Promise.allSettled(
      OSV_PACKAGES.map(async (p) => {
        const items = await fetchOsvPackage(p.name, p.ecosystem, p.pkg, signal);
        all.push(...items);
        cb.onBatch('OSV', p.name, items);
      }),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    cb.onSourceState('OSV', failed === results.length ? 'error' : 'live', failed ? `${failed} package queries failed` : undefined);
  })();

  const nvdTask = (async () => {
    cb.onSourceState('NVD', 'loading');
    let failed = 0;
    for (let i = 0; i < NVD_KEYWORDS.length; i++) {
      if (signal?.aborted) return;
      const { keyword, pkg } = NVD_KEYWORDS[i];
      try {
        const items = await fetchNvdKeyword(keyword, pkg, signal);
        all.push(...items);
        cb.onBatch('NVD', keyword, items);
      } catch {
        failed++;
      }
      if (i < NVD_KEYWORDS.length - 1) await sleep(6500);
    }
    cb.onSourceState('NVD', failed === NVD_KEYWORDS.length ? 'error' : 'live', failed ? `${failed} keyword queries failed` : undefined);
  })();

  await Promise.allSettled([osvTask, nvdTask]);
  const merged = mergeThreats(all);
  if (merged.length > 0) writeThreatCache(merged);
  return merged;
}
