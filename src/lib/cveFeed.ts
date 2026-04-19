// Live CVE feed from NVD (National Vulnerability Database) REST API 2.0
// Filters for AI/ML libraries. Free, no key required, CORS-enabled.

export interface CVEEntry {
  id: string;
  package: string;
  cvss: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  published: string;
  url: string;
  patched: boolean;
}

const KEYWORDS = ['langchain', 'llamaindex', 'transformers', 'pytorch', 'tensorflow', 'ollama', 'vllm'];
const CACHE_KEY = 'vigilance:cve-cache:v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface Cache {
  ts: number;
  data: CVEEntry[];
}

function readCache(): CVEEntry[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: CVEEntry[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data } satisfies Cache));
  } catch {
    /* ignore quota errors */
  }
}

function severityFromCvss(score: number): CVEEntry['severity'] {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function detectPackage(text: string): string {
  const lower = text.toLowerCase();
  for (const k of KEYWORDS) if (lower.includes(k)) return k;
  return 'ai-ml';
}

async function fetchKeyword(keyword: string, signal: AbortSignal): Promise<CVEEntry[]> {
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=10`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`NVD ${r.status}`);
  const j = await r.json();
  const items = j?.vulnerabilities ?? [];
  return items.map((it: any): CVEEntry | null => {
    const cve = it.cve;
    if (!cve) return null;
    const id = cve.id as string;
    const desc = (cve.descriptions ?? []).find((d: any) => d.lang === 'en')?.value ?? 'No description';
    const metric =
      cve.metrics?.cvssMetricV31?.[0]?.cvssData ??
      cve.metrics?.cvssMetricV30?.[0]?.cvssData ??
      cve.metrics?.cvssMetricV2?.[0]?.cvssData;
    const score = typeof metric?.baseScore === 'number' ? metric.baseScore : 0;
    return {
      id,
      package: detectPackage(desc + ' ' + keyword),
      cvss: score,
      severity: severityFromCvss(score),
      description: desc.length > 140 ? desc.slice(0, 137) + '…' : desc,
      published: cve.published ?? '',
      url: `https://nvd.nist.gov/vuln/detail/${id}`,
      patched: cve.vulnStatus === 'Analyzed' || cve.vulnStatus === 'Modified',
    };
  }).filter(Boolean) as CVEEntry[];
}

export async function fetchLiveCVEs(): Promise<{ data: CVEEntry[]; fromCache: boolean }> {
  const cached = readCache();
  if (cached && cached.length > 0) {
    // Refresh in background
    refreshInBackground();
    return { data: cached, fromCache: true };
  }
  const fresh = await refreshInBackground();
  return { data: fresh, fromCache: false };
}

let inflight: Promise<CVEEntry[]> | null = null;

function refreshInBackground(): Promise<CVEEntry[]> {
  if (inflight) return inflight;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  inflight = (async () => {
    try {
      // Fetch a couple of keywords in parallel (rate-limit friendly: NVD allows 5 req / 30s anonymous)
      const results = await Promise.allSettled(
        ['langchain', 'pytorch', 'tensorflow'].map((k) => fetchKeyword(k, ctrl.signal))
      );
      const merged: CVEEntry[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const e of r.value) {
            if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
          }
        }
      }
      // Sort: highest severity + most recent first
      merged.sort((a, b) => b.cvss - a.cvss || (b.published > a.published ? 1 : -1));
      const top = merged.slice(0, 12);
      if (top.length > 0) writeCache(top);
      return top;
    } catch (e) {
      console.warn('[cveFeed] fetch failed', e);
      return [];
    } finally {
      clearTimeout(timeout);
      inflight = null;
    }
  })();
  return inflight;
}
