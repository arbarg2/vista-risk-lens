// Proxies public feeds that don't allow browser (CORS) access:
//  • CISA Known Exploited Vulnerabilities (KEV) catalog
//  • Vendor status pages (Atlassian Statuspage v2 JSON)
// Read-only, public data, no input parameters. Cached in memory for 10 minutes.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const CACHE_MS = 10 * 60 * 1000;

const VENDORS: Record<string, { name: string; host: string }> = {
  openai: { name: 'OpenAI', host: 'status.openai.com' },
  anthropic: { name: 'Anthropic', host: 'status.anthropic.com' },
  cohere: { name: 'Cohere', host: 'status.cohere.com' },
  mistral: { name: 'Mistral AI', host: 'status.mistral.ai' },
  github: { name: 'GitHub', host: 'www.githubstatus.com' },
  cursor: { name: 'Cursor', host: 'status.cursor.com' },
  elevenlabs: { name: 'ElevenLabs', host: 'status.elevenlabs.io' },
  perplexity: { name: 'Perplexity', host: 'status.perplexity.com' },
  replit: { name: 'Replit', host: 'status.replit.com' },
  lovable: { name: 'Lovable', host: 'status.lovable.dev' },
  stability: { name: 'Stability AI', host: 'status.stability.ai' },
  runway: { name: 'Runway', host: 'status.runwayml.com' },
  ideogram: { name: 'Ideogram', host: 'status.ideogram.ai' },
};

// AI / ML tooling keywords used to pick relevant KEV entries.
const AI_KEV = /langchain|langflow|pytorch|torchserve|\btorch\b|transformers|hugging ?face|vllm|ollama|tensorflow|\bray\b|anyscale|mlflow|triton inference|openai|anthropic|artificial intelligence|machine learning|\bllm\b|jupyter|gradio|comfyui|kubeflow/i;

let cache: { at: number; body: string } | null = null;

async function getJson(url: string, ms = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json', 'User-Agent': 'VigilAI/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadKev() {
  try {
    const d = await getJson(KEV_URL, 20000);
    const vulns: any[] = Array.isArray(d.vulnerabilities) ? d.vulnerabilities : [];
    const ai = vulns
      .filter((v) => AI_KEV.test([v.vendorProject, v.product, v.vulnerabilityName, v.shortDescription].join(' ')))
      .map((v) => ({
        cveID: String(v.cveID), vendorProject: String(v.vendorProject), product: String(v.product),
        name: String(v.vulnerabilityName), dateAdded: String(v.dateAdded), dueDate: String(v.dueDate ?? ''),
        description: String(v.shortDescription ?? ''), ransomware: String(v.knownRansomwareCampaignUse ?? 'Unknown'),
        requiredAction: String(v.requiredAction ?? ''),
      }))
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    return {
      ok: true, catalogVersion: String(d.catalogVersion ?? ''), dateReleased: String(d.dateReleased ?? ''),
      count: vulns.length, ids: vulns.map((v) => String(v.cveID)), ai,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'failed', count: 0, ids: [], ai: [] };
  }
}

async function loadStatus(key: string, v: { name: string; host: string }) {
  try {
    const d = await getJson(`https://${v.host}/api/v2/incidents.json`);
    const incidents = (Array.isArray(d.incidents) ? d.incidents : []).slice(0, 10).map((i: any) => ({
      id: String(i.id), name: String(i.name), status: String(i.status), impact: String(i.impact ?? 'none'),
      created_at: String(i.created_at), updated_at: String(i.updated_at ?? i.created_at),
      url: String(i.shortlink ?? `https://${v.host}`),
    }));
    return [key, { ok: true, name: v.name, url: `https://${v.host}`, incidents }] as const;
  } catch (e) {
    return [key, { ok: false, name: v.name, url: `https://${v.host}`, incidents: [], error: e instanceof Error ? e.message : 'failed' }] as const;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return new Response(cache.body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const [kev, ...statusEntries] = await Promise.all([
    loadKev(),
    ...Object.entries(VENDORS).map(([k, v]) => loadStatus(k, v)),
  ]);
  const body = JSON.stringify({ fetchedAt: new Date().toISOString(), kev, status: Object.fromEntries(statusEntries) });
  cache = { at: Date.now(), body };
  return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
