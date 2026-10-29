import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { tools, type AITool, type ComplianceProfile } from '@/data/tools';
import {
  DEFAULT_WEIGHTS, approvedPosture, confidenceFor, cvePenaltyFor, defaultStatus, packageRisk, policyChecks, policyFit, scoreTool,
  type ApprovalStatus, type ConfidenceResult, type PolicyCheck, type PolicyFit, type PolicyWeights, type ThreatItem, type ToolScore,
} from '@/lib/posture';
import { dependencyExposure } from '@/data/enrichment';
import { readThreatCache, syncThreats, type SourceState } from '@/lib/threatFeed';
import { feedsCacheFresh, fetchHFModels, fetchLiveFeeds, isOngoing, readFeedsCache, type HFModel, type LiveFeeds, type VendorStatus } from '@/lib/liveFeeds';
import { TOOL_HF_REPO } from '@/data/liveSources';

// ─── Types ──────────────────────────────────────────────
export type FeedTag = 'CVE' | 'KEV' | 'STATUS' | 'SYS';
export interface FeedLine {
  id: string;
  ts: number;
  tag: FeedTag;
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  text: string;
  source?: string;
  url?: string;
}

export type TelemetryAction = 'ALLOW' | 'FLAG' | 'BLOCK';
export interface TelemetryEvent {
  id: string;
  ts: number;
  user: string;
  dept: string;
  toolId: string;
  toolName: string;
  action: TelemetryAction;
}

export interface Incident {
  id: string;
  ts: number;
  user: string;
  dept: string;
  toolId: string;
  toolName: string;
  severity: 'critical' | 'high' | 'medium';
  resolved: boolean;
  resolution?: string;
}

export type SourceKey = 'NVD' | 'OSV' | 'KEV' | 'STATUS' | 'HF';
interface SourceStatus { state: SourceState; detail?: string; count: number }

interface PostureState {
  profile: ComplianceProfile;
  setProfile: (p: ComplianceProfile) => void;
  weights: PolicyWeights;
  isCustomWeights: boolean;
  setWeights: (w: PolicyWeights) => void;
  resetWeights: () => void;
  statuses: Record<string, ApprovalStatus>;
  setStatus: (id: string, s: ApprovalStatus) => void;
  scores: Record<string, ToolScore>;
  posture: ReturnType<typeof approvedPosture>;
  /** True when NVD or OSV.dev data is live/cached and synced within the last 24h. */
  telemetryActive: boolean;
  confidence: Record<string, ConfidenceResult>;
  policy: Record<string, { checks: PolicyCheck[]; fit: PolicyFit }>;
  threats: ThreatItem[];
  threatsByTool: Record<string, ThreatItem[]>;
  sources: Record<SourceKey, SourceStatus>;
  kev: LiveFeeds['kev'] | null;
  vendorStatus: Record<string, VendorStatus>;
  liveFeedsAt: number | null;
  hfModels: Record<string, HFModel>;
  hfAt: number | null;
  /** Demo Shadow-AI stream (synthetic). Off by default; real proxy logs are not connected yet. */
  demoTelemetry: boolean;
  setDemoTelemetry: (on: boolean) => void;
  lastSync: number | null;
  syncing: boolean;
  resync: () => void;
  feed: FeedLine[];
  telemetry: TelemetryEvent[];
  incidents: Incident[];
  resolveIncident: (id: string, resolution: string) => void;
  resolveAll: () => void;
  bestApprovedAlternative: (tool: AITool) => AITool | null;
}

const Ctx = createContext<PostureState | null>(null);

const STATUS_KEY = 'vigilance.statuses.v1';
const WEIGHTS_KEY = 'vigilance.weights.v1';
const DEMO_KEY = 'vigilance.demoTelemetry.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const DEPTS = ['Engineering', 'Finance', 'Legal', 'Marketing', 'Sales', 'HR', 'Product', 'Support', 'Data Science'];

function levelFromScore(s: number): FeedLine['level'] {
  if (s >= 9) return 'critical';
  if (s >= 7) return 'high';
  if (s >= 4) return 'medium';
  return 'low';
}

function cveLine(t: ThreatItem, cached = false): FeedLine {
  return {
    id: `${t.source}-${t.id}-${uid()}`,
    ts: Date.now(),
    tag: 'CVE',
    level: levelFromScore(t.score),
    text: `${t.id} [${t.pkg}] CVSS ${t.score.toFixed(1)} ${t.severity} — ${t.summary || 'No description'}`,
    source: cached ? `${t.source}·cache` : t.source,
    url: t.url,
  };
}

const sysLine = (text: string, level: FeedLine['level'] = 'info'): FeedLine => ({ id: `sys-${uid()}`, ts: Date.now(), tag: 'SYS', level, text });

// ─── Provider ───────────────────────────────────────────
export function PostureProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ComplianceProfile>('eu-enterprise');
  const [customWeights, setCustomWeights] = useState<Partial<Record<ComplianceProfile, PolicyWeights>>>(() => load(WEIGHTS_KEY, {}));
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ApprovalStatus>>(() => load(STATUS_KEY, {}));
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [sources, setSources] = useState<Record<SourceKey, SourceStatus>>({
    NVD: { state: 'idle', count: 0 },
    OSV: { state: 'idle', count: 0 },
    KEV: { state: 'idle', count: 0 },
    STATUS: { state: 'idle', count: 0 },
    HF: { state: 'idle', count: 0 },
  });
  const [liveFeeds, setLiveFeeds] = useState<LiveFeeds | null>(null);
  const [hfModels, setHfModels] = useState<Record<string, HFModel>>({});
  const [hfAt, setHfAt] = useState<number | null>(null);
  const [demoTelemetry, setDemoTelemetryState] = useState<boolean>(() => load(DEMO_KEY, false));
  const seenFeedIds = useRef(new Set<string>());
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const queue = useRef<FeedLine[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const lastToast = useRef(0);

  useEffect(() => { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(customWeights)); }, [customWeights]);
  useEffect(() => { localStorage.setItem(STATUS_KEY, JSON.stringify(statusOverrides)); }, [statusOverrides]);
  useEffect(() => { localStorage.setItem(DEMO_KEY, JSON.stringify(demoTelemetry)); }, [demoTelemetry]);
  const setDemoTelemetry = useCallback((on: boolean) => {
    setDemoTelemetryState(on);
    if (!on) { setTelemetry([]); setIncidents([]); }
  }, []);

  const weights = customWeights[profile] ?? DEFAULT_WEIGHTS[profile];
  const isCustomWeights = !!customWeights[profile];
  const setWeights = useCallback((w: PolicyWeights) => setCustomWeights((p) => ({ ...p, [profile]: w })), [profile]);
  const resetWeights = useCallback(() => setCustomWeights((p) => { const n = { ...p }; delete n[profile]; return n; }), [profile]);

  const statuses = useMemo(() => {
    const out: Record<string, ApprovalStatus> = {};
    for (const t of tools) out[t.id] = statusOverrides[t.id] ?? defaultStatus(t);
    return out;
  }, [statusOverrides]);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  const setStatus = useCallback((id: string, s: ApprovalStatus) => {
    setStatusOverrides((p) => ({ ...p, [id]: s }));
    const t = tools.find((x) => x.id === id);
    if (t) queue.current.push(sysLine(`catalog: ${t.name} → ${s === 'approved' ? 'APPROVED' : s === 'banned' ? 'BANNED' : 'UNDER REVIEW'}`, s === 'banned' ? 'high' : 'info'));
  }, []);

  // Mark CVEs listed in CISA KEV as actively exploited
  const kevIds = useMemo(() => new Set(liveFeeds?.kev.ids ?? []), [liveFeeds]);
  const liveThreats = useMemo(
    () => threats.map((t) => ({ ...t, exploited: kevIds.has(t.id) || t.aliases.some((a) => kevIds.has(a)) })),
    [threats, kevIds],
  );

  // CVE → per-tool penalties
  const risk = useMemo(() => packageRisk(liveThreats), [liveThreats]);
  const scores = useMemo(() => {
    const out: Record<string, ToolScore> = {};
    for (const t of tools) out[t.id] = scoreTool(t, profile, weights, cvePenaltyFor(t, risk));
    return out;
  }, [profile, weights, risk]);
  const threatsByTool = useMemo(() => {
    const out: Record<string, ThreatItem[]> = {};
    for (const t of tools) {
      const exp = dependencyExposure(t);
      out[t.id] = liveThreats
        .filter((th) => (exp[th.pkg] ?? 0) >= 0.1)
        .sort((a, b) => b.score * (exp[b.pkg] ?? 0) - a.score * (exp[a.pkg] ?? 0));
    }
    return out;
  }, [liveThreats]);
  const posture = useMemo(() => approvedPosture(tools, statuses, scores), [statuses, scores]);

  const telemetryActive = useMemo(() => {
    const ok = (st: SourceState) => st === 'live' || st === 'cached';
    return (ok(sources.NVD.state) || ok(sources.OSV.state)) && (lastSync === null || Date.now() - lastSync < 86_400_000);
  }, [sources, lastSync]);
  const confidence = useMemo(() => {
    const out: Record<string, ConfidenceResult> = {};
    for (const t of tools) out[t.id] = confidenceFor(t, telemetryActive);
    return out;
  }, [telemetryActive]);
  const policy = useMemo(() => {
    const out: Record<string, { checks: PolicyCheck[]; fit: PolicyFit }> = {};
    for (const t of tools) {
      const checks = policyChecks(t, profile, scores[t.id]);
      out[t.id] = { checks, fit: policyFit(checks) };
    }
    return out;
  }, [profile, scores]);

  // ─── Live threat sync ────────────────────────────────
  const runSync = useCallback((force: boolean) => {
    if (!force) {
      const cached = readThreatCache();
      if (cached && cached.items.length) {
        setThreats(cached.items);
        setLastSync(cached.fetchedAt);
        const nvd = cached.items.filter((i) => i.source === 'NVD').length;
        setSources((s) => ({ ...s, NVD: { state: 'cached', count: nvd }, OSV: { state: 'cached', count: cached.items.length - nvd } }));
        queue.current.push(sysLine(`restored ${cached.items.length} advisories from local cache (synced ${new Date(cached.fetchedAt).toLocaleTimeString()})`));
        [...cached.items].sort((a, b) => b.score - a.score).slice(0, 12).reverse().forEach((t) => queue.current.push(cveLine(t, true)));
        return;
      }
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSyncing(true);
    setSources((s) => ({ ...s, NVD: { state: 'loading', count: 0 }, OSV: { state: 'loading', count: 0 } }));
    queue.current.push(sysLine('connecting → services.nvd.nist.gov /rest/json/cves/2.0'));
    queue.current.push(sysLine('connecting → api.osv.dev /v1/query'));
    const collected: ThreatItem[] = [];
    syncThreats({
      onBatch: (source, label, items) => {
        collected.push(...items);
        setThreats((prev) => {
          const seen = new Set(prev.map((p) => `${p.pkg}:${p.id}`));
          const add = items.filter((i) => !seen.has(`${i.pkg}:${i.id}`));
          return [...prev, ...add].sort((a, b) => b.published.localeCompare(a.published));
        });
        setSources((s) => ({ ...s, [source]: { ...s[source], count: s[source].count + items.length } }));
        queue.current.push(sysLine(`[${source}] ${label} → ${items.length} advisories`));
        [...items].sort((a, b) => b.published.localeCompare(a.published)).slice(0, 3).forEach((t) => queue.current.push(cveLine(t)));
      },
      onSourceState: (source, state, detail) => {
        setSources((s) => ({ ...s, [source]: { ...s[source], state, detail } }));
        if (state === 'error') queue.current.push(sysLine(`[${source}] unreachable — ${detail ?? 'request failed'}`, 'high'));
        if (state === 'live') queue.current.push(sysLine(`[${source}] sync complete${detail ? ` (${detail})` : ''}`));
      },
    }, ac.signal).then(() => {
      setLastSync(Date.now());
      setSyncing(false);
      queue.current.push(sysLine('trust & safety scores re-weighted from live CVSS data'));
    });
  }, []);

  useEffect(() => {
    queue.current.push(sysLine('vigilance-ai threat pipeline v2.4 — boot'));
    runSync(false);
    return () => abortRef.current?.abort();
  }, [runSync]);

  // Drain the line queue for a streaming terminal effect
  useEffect(() => {
    const iv = setInterval(() => {
      // Stream one line at a time, but catch up quickly when a sync floods the queue
      const n = Math.max(1, Math.ceil(queue.current.length / 8));
      const batch = queue.current.splice(0, n);
      if (batch.length) setFeed((f) => [...f, ...batch.map((l) => ({ ...l, ts: Date.now() }))].slice(-200));
    }, 380);
    return () => clearInterval(iv);
  }, []);

  // ─── CISA KEV + vendor status pages (real, via backend proxy) ───
  const applyLiveFeeds = useCallback((f: LiveFeeds, cached: boolean) => {
    setLiveFeeds(f);
    const statuses = Object.values(f.status);
    const okStatus = statuses.filter((v) => v.ok).length;
    setSources((s) => ({
      ...s,
      KEV: f.kev.ok ? { state: cached ? 'cached' : 'live', count: f.kev.ai.length, detail: `${f.kev.count} total · catalog v${f.kev.catalogVersion}` } : { state: 'error', count: 0, detail: f.kev.error },
      STATUS: okStatus ? { state: cached ? 'cached' : 'live', count: okStatus, detail: `${okStatus}/${statuses.length} vendor pages reachable` } : { state: 'error', count: 0, detail: 'No vendor status pages reachable' },
    }));
    const lines: FeedLine[] = [];
    for (const k of [...f.kev.ai].slice(0, 8).reverse()) {
      const id = `kev-${k.cveID}`;
      if (seenFeedIds.current.has(id)) continue;
      seenFeedIds.current.add(id);
      lines.push({
        id, ts: Date.now(), tag: 'KEV', level: 'critical',
        text: `${k.cveID} [${k.product}] ACTIVELY EXPLOITED — ${k.name} · added ${k.dateAdded}${k.ransomware === 'Known' ? ' · ransomware use' : ''}`,
        source: 'CISA KEV', url: `https://nvd.nist.gov/vuln/detail/${k.cveID}`,
      });
    }
    const cutoff = Date.now() - 14 * 86_400_000;
    const recent = statuses.flatMap((v) => v.incidents.map((i) => ({ v, i })))
      .filter(({ i }) => new Date(i.created_at).getTime() >= cutoff)
      .sort((a, b) => a.i.created_at.localeCompare(b.i.created_at));
    for (const { v, i } of recent.slice(-12)) {
      const id = `st-${i.id}-${i.status}`;
      if (seenFeedIds.current.has(id)) continue;
      seenFeedIds.current.add(id);
      const ongoing = isOngoing(i);
      lines.push({
        id, ts: Date.now(), tag: 'STATUS',
        level: ongoing ? (['major', 'critical'].includes(i.impact) ? 'high' : 'medium') : 'low',
        text: `${v.name}: ${i.name} — ${i.status}${ongoing ? '' : ` (${new Date(i.created_at).toLocaleDateString()})`}`,
        source: new URL(v.url).host, url: i.url,
      });
    }
    lines.forEach((l) => queue.current.push(l));
  }, []);

  const loadLiveFeeds = useCallback((force: boolean) => {
    const cached = readFeedsCache();
    if (!force && cached && feedsCacheFresh(cached)) { applyLiveFeeds(cached, true); return; }
    setSources((s) => ({ ...s, KEV: { ...s.KEV, state: 'loading' }, STATUS: { ...s.STATUS, state: 'loading' } }));
    queue.current.push(sysLine('connecting → cisa.gov KEV catalog · vendor status pages'));
    fetchLiveFeeds()
      .then((f) => { applyLiveFeeds(f, false); queue.current.push(sysLine(`[KEV] ${f.kev.count} known-exploited CVEs · ${f.kev.ai.length} in AI/ML tooling`)); })
      .catch((e) => {
        if (cached) { applyLiveFeeds(cached, true); return; }
        const detail = e instanceof Error ? e.message : 'request failed';
        setSources((s) => ({ ...s, KEV: { state: 'error', count: 0, detail }, STATUS: { state: 'error', count: 0, detail } }));
        queue.current.push(sysLine(`[KEV/STATUS] unreachable — ${detail}`, 'high'));
      });
  }, [applyLiveFeeds]);

  useEffect(() => {
    loadLiveFeeds(false);
    const iv = setInterval(() => loadLiveFeeds(true), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadLiveFeeds]);

  // ─── Hugging Face Hub model metadata (real) ───
  const loadHF = useCallback(() => {
    setSources((s) => ({ ...s, HF: { ...s.HF, state: 'loading' } }));
    fetchHFModels(TOOL_HF_REPO).then(({ models, fetchedAt, failed }) => {
      setHfModels(models);
      setHfAt(fetchedAt);
      const n = Object.keys(models).length;
      setSources((s) => ({ ...s, HF: n ? { state: 'live', count: n, detail: failed ? `${failed} repos unreachable` : undefined } : { state: 'error', count: 0, detail: 'Hugging Face unreachable' } }));
      if (n) queue.current.push(sysLine(`[HF] model cards & licenses refreshed for ${n} open-weights models`));
    });
  }, []);
  useEffect(() => { loadHF(); }, [loadHF]);

  // DEMO Shadow-AI telemetry — synthetic, off by default (enforced against the live approval catalog)
  useEffect(() => {
    if (!demoTelemetry) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        const tool = pick(tools);
        const st = statusesRef.current[tool.id];
        const action: TelemetryAction = st === 'approved' ? 'ALLOW' : st === 'banned' ? 'BLOCK' : 'FLAG';
        const ev: TelemetryEvent = {
          id: uid(), ts: Date.now(), user: `u-${100 + Math.floor(Math.random() * 900)}`, dept: pick(DEPTS),
          toolId: tool.id, toolName: tool.name, action,
        };
        setTelemetry((p) => [ev, ...p].slice(0, 60));
        if (action !== 'ALLOW') {
          const severity: Incident['severity'] = action === 'BLOCK' ? 'critical' : Math.random() > 0.5 ? 'high' : 'medium';
          setIncidents((p) => [{ id: ev.id, ts: ev.ts, user: ev.user, dept: ev.dept, toolId: tool.id, toolName: tool.name, severity, resolved: false }, ...p].slice(0, 100));
          if (severity === 'critical' && Date.now() - lastToast.current > 45_000) {
            lastToast.current = Date.now();
            toast.error(`Banned tool access blocked: ${tool.name}`, { description: `${ev.user} (${ev.dept}) attempted to use a banned tool.` });
          }
        }
        loop();
      }, 2500 + Math.random() * 2500);
    };
    loop();
    return () => clearTimeout(t);
  }, [demoTelemetry]);

  const resolveIncident = useCallback((id: string, resolution: string) => {
    setIncidents((p) => p.map((i) => (i.id === id ? { ...i, resolved: true, resolution } : i)));
  }, []);
  const resolveAll = useCallback(() => {
    setIncidents((p) => p.map((i) => (i.resolved ? i : { ...i, resolved: true, resolution: 'Bulk acknowledged' })));
  }, []);

  const bestApprovedAlternative = useCallback((tool: AITool) => {
    const candidates = tools.filter((t) => t.id !== tool.id && statuses[t.id] === 'approved');
    const same = candidates.filter((t) => t.category === tool.category);
    const pool = same.length ? same : candidates;
    return pool.sort((a, b) => scores[b.id].total - scores[a.id].total)[0] ?? null;
  }, [statuses, scores]);

  const value: PostureState = {
    profile, setProfile, weights, isCustomWeights, setWeights, resetWeights,
    statuses, setStatus, scores, posture, telemetryActive, confidence, policy, threats: liveThreats, threatsByTool, sources, lastSync, syncing,
    kev: liveFeeds?.kev ?? null, vendorStatus: liveFeeds?.status ?? {}, liveFeedsAt: liveFeeds ? new Date(liveFeeds.fetchedAt).getTime() : null,
    hfModels, hfAt, demoTelemetry, setDemoTelemetry,
    resync: () => { runSync(true); loadLiveFeeds(true); }, feed, telemetry, incidents, resolveIncident, resolveAll, bestApprovedAlternative,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePosture() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePosture must be used inside PostureProvider');
  return c;
}
