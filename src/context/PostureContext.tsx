import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { tools, type AITool, type ComplianceProfile } from '@/data/tools';
import {
  DEFAULT_WEIGHTS, approvedPosture, cvePenaltyFor, defaultStatus, packageRisk, scoreTool,
  type ApprovalStatus, type PolicyWeights, type ThreatItem, type ToolScore,
} from '@/lib/posture';
import { dependencyExposure } from '@/data/enrichment';
import { readThreatCache, syncThreats, type SourceState } from '@/lib/threatFeed';

// ─── Types ──────────────────────────────────────────────
export type FeedTag = 'CVE' | 'POLICY UPDATE' | 'SYS';
export interface FeedLine {
  id: string;
  ts: number;
  tag: FeedTag;
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  text: string;
  source?: string;
  url?: string;
  simulated?: boolean;
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
  threats: ThreatItem[];
  threatsByTool: Record<string, ThreatItem[]>;
  sources: Record<'NVD' | 'OSV', SourceStatus>;
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
const REGIONS = ['eu-central-1 (Frankfurt)', 'eu-west-3 (Paris)', 'us-gov-west-1', 'ap-southeast-1', 'me-central-1'];

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

function policyLine(): FeedLine {
  const tool = pick(tools);
  const templates = [
    () => `${tool.provider} revised privacy policy §${Math.ceil(Math.random() * 12)} — ${tool.name} training-data clause changed`,
    () => {
      const a = pick([0, 30, 30, 55, 90]);
      const b = pick([30, 60, 90, 180, 365].filter((x) => x !== a));
      return `${tool.name}: data retention window shifted ${a}d → ${b}d`;
    },
    () => `${tool.name}: data residency update — new processing region ${pick(REGIONS)}`,
    () => `${tool.provider} DPA amended — sub-processor list updated (+1 vendor)`,
    () => `${tool.name}: zero-data-retention option ${Math.random() > 0.5 ? 'expanded to API tier' : 'restricted to enterprise tier'}`,
  ];
  return {
    id: `pol-${uid()}`,
    ts: Date.now(),
    tag: 'POLICY UPDATE',
    level: Math.random() > 0.7 ? 'high' : 'medium',
    text: pick(templates)(),
    source: 'policy-watch',
    simulated: true,
  };
}

const sysLine = (text: string, level: FeedLine['level'] = 'info'): FeedLine => ({ id: `sys-${uid()}`, ts: Date.now(), tag: 'SYS', level, text });

// ─── Provider ───────────────────────────────────────────
export function PostureProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ComplianceProfile>('eu-enterprise');
  const [customWeights, setCustomWeights] = useState<Partial<Record<ComplianceProfile, PolicyWeights>>>(() => load(WEIGHTS_KEY, {}));
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ApprovalStatus>>(() => load(STATUS_KEY, {}));
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [sources, setSources] = useState<Record<'NVD' | 'OSV', SourceStatus>>({
    NVD: { state: 'idle', count: 0 },
    OSV: { state: 'idle', count: 0 },
  });
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

  // CVE → per-tool penalties
  const risk = useMemo(() => packageRisk(threats), [threats]);
  const scores = useMemo(() => {
    const out: Record<string, ToolScore> = {};
    for (const t of tools) out[t.id] = scoreTool(t, profile, weights, cvePenaltyFor(t, risk));
    return out;
  }, [profile, weights, risk]);
  const threatsByTool = useMemo(() => {
    const out: Record<string, ThreatItem[]> = {};
    for (const t of tools) {
      const exp = dependencyExposure(t);
      out[t.id] = threats
        .filter((th) => (exp[th.pkg] ?? 0) >= 0.2)
        .sort((a, b) => b.score * (exp[b.pkg] ?? 0) - a.score * (exp[a.pkg] ?? 0));
    }
    return out;
  }, [threats]);
  const posture = useMemo(() => approvedPosture(tools, statuses, scores), [statuses, scores]);

  // ─── Live threat sync ────────────────────────────────
  const runSync = useCallback((force: boolean) => {
    if (!force) {
      const cached = readThreatCache();
      if (cached && cached.items.length) {
        setThreats(cached.items);
        setLastSync(cached.fetchedAt);
        const nvd = cached.items.filter((i) => i.source === 'NVD').length;
        setSources({ NVD: { state: 'cached', count: nvd }, OSV: { state: 'cached', count: cached.items.length - nvd } });
        queue.current.push(sysLine(`restored ${cached.items.length} advisories from local cache (synced ${new Date(cached.fetchedAt).toLocaleTimeString()})`));
        [...cached.items].sort((a, b) => b.score - a.score).slice(0, 12).reverse().forEach((t) => queue.current.push(cveLine(t, true)));
        return;
      }
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSyncing(true);
    setSources({ NVD: { state: 'loading', count: 0 }, OSV: { state: 'loading', count: 0 } });
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
      const next = queue.current.shift();
      if (next) setFeed((f) => [...f.slice(-150), { ...next, ts: Date.now() }]);
    }, 380);
    return () => clearInterval(iv);
  }, []);

  // Simulated policy-watch events
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => { queue.current.push(policyLine()); loop(); }, 9000 + Math.random() * 7000);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // Simulated Shadow-AI telemetry (enforced against the live approval catalog)
  useEffect(() => {
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
  }, []);

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
    statuses, setStatus, scores, posture, threats, threatsByTool, sources, lastSync, syncing,
    resync: () => runSync(true), feed, telemetry, incidents, resolveIncident, resolveAll, bestApprovedAlternative,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePosture() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePosture must be used inside PostureProvider');
  return c;
}
