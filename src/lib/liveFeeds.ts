import { supabase } from '@/integrations/supabase/client';

// ─── CISA KEV + vendor status (via backend proxy: these feeds block browser access) ───
export interface KevEntry {
  cveID: string; vendorProject: string; product: string; name: string;
  dateAdded: string; dueDate: string; description: string; ransomware: string; requiredAction: string;
}
export interface VendorIncident { id: string; name: string; status: string; impact: string; created_at: string; updated_at: string; url: string }
export interface VendorStatus { ok: boolean; name: string; url: string; incidents: VendorIncident[]; error?: string }
export interface LiveFeeds {
  fetchedAt: string;
  kev: { ok: boolean; catalogVersion?: string; dateReleased?: string; count: number; ids: string[]; ai: KevEntry[]; error?: string };
  status: Record<string, VendorStatus>;
}

const FEEDS_KEY = 'vigilance.livefeeds.v1';
const FEEDS_TTL_MS = 15 * 60 * 1000;

export function readFeedsCache(): LiveFeeds | null {
  try {
    const raw = localStorage.getItem(FEEDS_KEY);
    return raw ? (JSON.parse(raw) as LiveFeeds) : null;
  } catch { return null; }
}

export function feedsCacheFresh(f: LiveFeeds | null): boolean {
  return !!f && Date.now() - new Date(f.fetchedAt).getTime() < FEEDS_TTL_MS;
}

export async function fetchLiveFeeds(): Promise<LiveFeeds> {
  const { data, error } = await supabase.functions.invoke<LiveFeeds>('live-feeds', { method: 'GET' });
  if (error || !data) throw error ?? new Error('No data');
  try { localStorage.setItem(FEEDS_KEY, JSON.stringify(data)); } catch { /* quota */ }
  return data;
}

/** An incident is ongoing until the vendor marks it resolved / completed. */
export const isOngoing = (i: VendorIncident) => !['resolved', 'completed', 'postmortem'].includes(i.status);

// ─── Hugging Face Hub (browser-accessible) ──────────────
export interface HFModel {
  repo: string; license: string; lastModified: string; downloads: number; likes: number;
  gated: boolean | string; sha: string; pipeline?: string; url: string;
}

const HF_KEY = 'vigilance.hf.v1';
const HF_TTL_MS = 6 * 60 * 60 * 1000;

export async function fetchHFModels(repos: Record<string, string>): Promise<{ models: Record<string, HFModel>; fetchedAt: number; failed: number }> {
  try {
    const raw = localStorage.getItem(HF_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { models: Record<string, HFModel>; fetchedAt: number };
      if (Date.now() - c.fetchedAt < HF_TTL_MS && Object.keys(c.models).length) return { ...c, failed: 0 };
    }
  } catch { /* ignore */ }
  const entries = await Promise.all(Object.entries(repos).map(async ([toolId, repo]) => {
    try {
      const r = await fetch(`https://huggingface.co/api/models/${repo}`);
      if (!r.ok) return null;
      const d = await r.json();
      const tagLicense = (d.tags as string[] | undefined)?.find((t) => t.startsWith('license:'))?.slice(8);
      const license = d.cardData?.license_name ?? d.cardData?.license ?? tagLicense ?? 'unspecified';
      const m: HFModel = {
        repo, license: String(license), lastModified: String(d.lastModified ?? ''), downloads: Number(d.downloads ?? 0),
        likes: Number(d.likes ?? 0), gated: d.gated ?? false, sha: String(d.sha ?? ''), pipeline: d.pipeline_tag,
        url: `https://huggingface.co/${repo}`,
      };
      return [toolId, m] as const;
    } catch { return null; }
  }));
  const ok = entries.filter(Boolean) as (readonly [string, HFModel])[];
  const out = { models: Object.fromEntries(ok), fetchedAt: Date.now() };
  if (ok.length) try { localStorage.setItem(HF_KEY, JSON.stringify(out)); } catch { /* quota */ }
  return { ...out, failed: entries.length - ok.length };
}
