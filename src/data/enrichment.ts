// AI Bill of Materials (AIBOM) + OWASP LLM Top 10 posture data per tool.
// Curated from public vendor documentation; numbers are analyst estimates (0-100, higher = safer).

export type HostingProvider = 'Azure' | 'AWS' | 'GCP' | 'Self-hosted' | 'Proprietary' | 'Multi-cloud';
export type DependencyPackage = 'langchain' | 'transformers' | 'pytorch' | 'torchserve' | 'vllm' | 'ollama';

export const DEPENDENCY_PACKAGES: DependencyPackage[] = ['langchain', 'transformers', 'pytorch', 'torchserve', 'vllm', 'ollama'];

export interface ToolEnrichment {
  baseModel: string;
  hosting: HostingProvider;
  /** Default prompt/output retention window in days (0 = zero data retention available). */
  retentionDays: number;
  ipIndemnification: boolean;
  openWeights: boolean;
  license: string;
  /** Vendor marks AI-generated content / discloses AI interaction (EU AI Act Art. 50). */
  transparency: boolean;
  owasp: {
    /** LLM01 – resistance to prompt injection. */
    promptInjection: number;
    /** LLM09 – safeguards against overreliance / hallucination. */
    overreliance: number;
    /** LLM03/LLM05 – supply-chain & model provenance documentation. */
    provenance: number;
  };
}

const e = (
  baseModel: string,
  hosting: HostingProvider,
  retentionDays: number,
  ipIndemnification: boolean,
  openWeights: boolean,
  license: string,
  transparency: boolean,
  promptInjection: number,
  overreliance: number,
  provenance: number,
): ToolEnrichment => ({
  baseModel, hosting, retentionDays, ipIndemnification, openWeights, license, transparency,
  owasp: { promptInjection, overreliance, provenance },
});

export const enrichment: Record<string, ToolEnrichment> = {
  'gpt-5': e('GPT-5', 'Azure', 30, true, false, 'Proprietary', true, 82, 78, 80),
  'gpt-4o': e('GPT-4o', 'Azure', 30, true, false, 'Proprietary', true, 76, 72, 78),
  'claude-4-opus': e('Claude 4 Opus', 'Multi-cloud', 30, true, false, 'Proprietary', true, 88, 84, 85),
  'claude-3.5-sonnet': e('Claude 3.5 Sonnet', 'Multi-cloud', 30, true, false, 'Proprietary', true, 84, 80, 83),
  'gemini-2.5-pro': e('Gemini 2.5 Pro', 'GCP', 55, true, false, 'Proprietary', true, 78, 74, 76),
  'gemini-2.5-flash': e('Gemini 2.5 Flash', 'GCP', 55, true, false, 'Proprietary', true, 72, 68, 74),
  'llama-4-maverick': e('Llama 4 Maverick (MoE)', 'Self-hosted', 0, false, true, 'Llama 4 Community', false, 58, 55, 70),
  'llama-3.3': e('Llama 3.3 70B', 'Self-hosted', 0, false, true, 'Llama 3.3 Community', false, 55, 52, 72),
  'mistral-large': e('Mistral Large 2', 'Multi-cloud', 30, false, false, 'Mistral Research / Commercial', true, 70, 66, 74),
  'mistral-codestral': e('Codestral 25.01', 'Multi-cloud', 30, false, false, 'Mistral Non-Production', false, 66, 62, 70),
  'cohere-command': e('Command R+', 'Multi-cloud', 30, true, false, 'Proprietary', true, 74, 76, 75),
  'deepseek-v3': e('DeepSeek V3 (671B MoE)', 'Proprietary', 365, false, true, 'DeepSeek License', false, 38, 45, 35),
  'deepseek-r1': e('DeepSeek R1', 'Proprietary', 365, false, true, 'MIT', false, 32, 40, 38),
  'qwen-3': e('Qwen3-235B-A22B', 'Proprietary', 180, false, true, 'Apache 2.0', false, 48, 50, 45),
  'grok-3': e('Grok 3', 'Proprietary', 30, false, false, 'Proprietary', false, 52, 48, 42),
  'github-copilot': e('GPT-4o / Claude (routed)', 'Azure', 0, true, false, 'Proprietary', true, 74, 70, 78),
  'cursor-ai': e('Multi-model router', 'AWS', 0, false, false, 'Proprietary', false, 60, 58, 52),
  lovable: e('Multi-model (Gemini / GPT / Claude)', 'Multi-cloud', 30, false, false, 'Proprietary', true, 70, 68, 68),
  'replit-agent': e('Claude (routed)', 'GCP', 90, false, false, 'Proprietary', false, 58, 55, 55),
  'dall-e-4': e('DALL·E 4', 'Azure', 30, true, false, 'Proprietary', true, 75, 70, 76),
  'midjourney-v7': e('Midjourney v7', 'Proprietary', 365, false, false, 'Proprietary', false, 55, 50, 35),
  'stable-diffusion-4': e('Stable Diffusion 4', 'Self-hosted', 0, false, true, 'Stability Community', false, 50, 48, 55),
  'flux-pro': e('FLUX 1.1 Pro', 'Proprietary', 30, false, false, 'Proprietary API', false, 55, 52, 58),
  'ideogram-3': e('Ideogram 3.0', 'GCP', 90, false, false, 'Proprietary', false, 55, 52, 45),
  'sora-2': e('Sora 2', 'Azure', 30, true, false, 'Proprietary', true, 70, 62, 72),
  'runway-gen4': e('Gen-4', 'AWS', 90, false, false, 'Proprietary', true, 56, 52, 50),
  'veo-2': e('Veo 2', 'GCP', 55, true, false, 'Proprietary', true, 72, 66, 74),
  'elevenlabs-v3': e('Eleven v3', 'GCP', 30, false, false, 'Proprietary', true, 66, 62, 64),
  'whisper-v4': e('Whisper large-v4', 'Azure', 30, true, true, 'MIT (weights) / API terms', false, 78, 70, 80),
  'perplexity-sonar': e('Sonar Pro (Llama-based)', 'AWS', 30, false, false, 'Proprietary', true, 60, 72, 50),
  'openai-embed-3': e('text-embedding-3-large', 'Azure', 30, true, false, 'Proprietary', false, 85, 80, 80),
  'cohere-embed-v4': e('Embed v4', 'Multi-cloud', 30, true, false, 'Proprietary', false, 84, 80, 78),
  'chatgpt-enterprise': e('GPT-5 / GPT-4o', 'Azure', 0, true, false, 'Proprietary', true, 82, 76, 80),
  'claude-teams': e('Claude 4 family', 'Multi-cloud', 0, true, false, 'Proprietary', true, 86, 82, 84),
  'microsoft-copilot-365': e('GPT-4o (Azure-hosted)', 'Azure', 0, true, false, 'Proprietary', true, 78, 74, 82),
  'gemini-workspace': e('Gemini 2.5 family', 'GCP', 0, true, false, 'Proprietary', true, 76, 72, 78),
  'amazon-bedrock': e('Multi-provider (Claude, Llama, Titan…)', 'AWS', 0, true, false, 'Per-model', true, 80, 74, 84),
  'azure-openai': e('GPT-5 / GPT-4o', 'Azure', 0, true, false, 'Proprietary', true, 82, 76, 84),
};

const fallback = e('Undisclosed', 'Proprietary', 365, false, false, 'Unknown', false, 50, 50, 40);

export function getEnrichment(toolId: string): ToolEnrichment {
  return enrichment[toolId] ?? fallback;
}

/** How exposed each tool's typical deployment is to vulnerabilities in common AI libraries (0-1). */
export function dependencyExposure(tool: { id: string; category: string }): Partial<Record<DependencyPackage, number>> {
  const en = getEnrichment(tool.id);
  const selfHostable = en.openWeights;
  if (selfHostable && ['LLM', 'Reasoning', 'Code'].includes(tool.category)) {
    return { vllm: 1, transformers: 0.8, pytorch: 0.8, ollama: 0.7, langchain: 0.5, torchserve: 0.2 };
  }
  if (selfHostable && tool.category === 'Image Gen') return { pytorch: 1, transformers: 0.6, torchserve: 0.4 };
  if (selfHostable && tool.category === 'Audio') return { pytorch: 0.6, transformers: 0.5 };
  switch (tool.category) {
    case 'Platform': return { langchain: 0.5, torchserve: 0.4, transformers: 0.3, vllm: 0.25 };
    case 'LLM':
    case 'Reasoning':
    case 'Embedding':
    case 'Search': return { langchain: 0.12, transformers: 0.05 };
    case 'Code': return { langchain: 0.08 };
    case 'Assistant': return { langchain: 0.05 };
    default: return { pytorch: 0.1 };
  }
}
