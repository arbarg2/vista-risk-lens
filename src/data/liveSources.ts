// Mapping of catalog tools to their live public data sources.

/** Tool → vendor status page key (served by the live-feeds backend function). */
export const TOOL_STATUS_PAGE: Record<string, string> = {
  'gpt-5': 'openai', 'gpt-4o': 'openai', 'dall-e-4': 'openai', 'sora-2': 'openai', 'whisper-v4': 'openai',
  'openai-embed-3': 'openai', 'chatgpt-enterprise': 'openai',
  'claude-4-opus': 'anthropic', 'claude-3.5-sonnet': 'anthropic', 'claude-teams': 'anthropic',
  'cohere-command': 'cohere', 'cohere-embed-v4': 'cohere',
  'mistral-large': 'mistral', 'mistral-codestral': 'mistral',
  'github-copilot': 'github',
  'cursor-ai': 'cursor',
  'elevenlabs-v3': 'elevenlabs',
  'perplexity-sonar': 'perplexity',
  'replit-agent': 'replit',
  lovable: 'lovable',
  'stable-diffusion-4': 'stability',
  'runway-gen4': 'runway',
  'ideogram-3': 'ideogram',
};

/** Open-weights tools → exact Hugging Face repository. */
export const TOOL_HF_REPO: Record<string, string> = {
  'llama-4-maverick': 'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
  'llama-3.3': 'meta-llama/Llama-3.3-70B-Instruct',
  'deepseek-v3': 'deepseek-ai/DeepSeek-V3',
  'deepseek-r1': 'deepseek-ai/DeepSeek-R1',
  'qwen-3': 'Qwen/Qwen3-235B-A22B',
};
