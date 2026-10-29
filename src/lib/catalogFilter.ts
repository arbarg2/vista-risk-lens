import type { AITool } from '@/data/tools';
import { getEnrichment } from '@/data/enrichment';

/** Quick-filter groups shown as chips; each maps to one or more tool categories. */
export type CategoryGroup = 'all' | 'llm' | 'code' | 'multimodal' | 'audio' | 'assistant' | 'infra';

export const CATEGORY_GROUPS: { id: CategoryGroup; label: string; categories: string[] }[] = [
  { id: 'all', label: 'All', categories: [] },
  { id: 'llm', label: 'LLM', categories: ['LLM', 'Reasoning'] },
  { id: 'code', label: 'Code', categories: ['Code'] },
  { id: 'multimodal', label: 'Multimodal', categories: ['Image Gen', 'Video Gen'] },
  { id: 'audio', label: 'Audio', categories: ['Audio'] },
  { id: 'assistant', label: 'Assistants', categories: ['Assistant'] },
  { id: 'infra', label: 'Platform & Search', categories: ['Platform', 'Embedding', 'Search'] },
];

/** Capability words searchable per category (so "vision" or "coding" finds the right tools). */
const CAPABILITIES: Record<string, string[]> = {
  LLM: ['chat', 'text', 'reasoning', 'llm', 'language'],
  Reasoning: ['reasoning', 'chain of thought', 'math', 'llm'],
  Code: ['code', 'coding', 'completion', 'agent', 'developer'],
  'Image Gen': ['image', 'vision', 'multimodal', 'art', 'design'],
  'Video Gen': ['video', 'multimodal', 'animation'],
  Audio: ['audio', 'speech', 'voice', 'tts', 'transcription'],
  Assistant: ['assistant', 'copilot', 'workspace', 'productivity'],
  Platform: ['platform', 'hosting', 'api', 'cloud'],
  Embedding: ['embedding', 'vector', 'rag', 'retrieval'],
  Search: ['search', 'retrieval', 'web'],
};

export function inCategoryGroup(tool: AITool, group: CategoryGroup): boolean {
  if (group === 'all') return true;
  const g = CATEGORY_GROUPS.find((c) => c.id === group);
  return !!g && g.categories.includes(tool.category);
}

export function matchesSearch(tool: AITool, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const e = getEnrichment(tool.id);
  const haystack = [
    tool.name, tool.provider, tool.category, e.baseModel, e.hosting, e.license,
    ...(CAPABILITIES[tool.category] ?? []),
  ].join(' ').toLowerCase();
  // Every word in the query must appear somewhere.
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export function filterCatalog(tools: AITool[], query: string, group: CategoryGroup): AITool[] {
  return tools.filter((t) => inCategoryGroup(t, group) && matchesSearch(t, query));
}
