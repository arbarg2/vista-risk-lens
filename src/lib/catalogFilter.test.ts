import { describe, expect, it } from 'vitest';
import { tools } from '@/data/tools';
import { filterCatalog } from './catalogFilter';

describe('catalog search & category filters', () => {
  it('Code chip shows only code assistants', () => {
    const res = filterCatalog(tools, '', 'code');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((t) => t.category === 'Code')).toBe(true);
  });

  it('Multimodal chip covers image and video tools', () => {
    const cats = new Set(filterCatalog(tools, '', 'multimodal').map((t) => t.category));
    expect(cats).toEqual(new Set(['Image Gen', 'Video Gen']));
  });

  it('search matches vendor names case-insensitively', () => {
    const res = filterCatalog(tools, 'anthropic', 'all');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((t) => t.provider.toLowerCase().includes('anthropic'))).toBe(true);
  });

  it('search matches capabilities, e.g. "voice" finds audio tools', () => {
    const res = filterCatalog(tools, 'voice', 'all');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((t) => t.category === 'Audio')).toBe(true);
  });

  it('search and category combine', () => {
    expect(filterCatalog(tools, 'openai', 'audio').every((t) => t.category === 'Audio' && t.provider === 'OpenAI')).toBe(true);
    expect(filterCatalog(tools, 'midjourney', 'code')).toHaveLength(0);
  });
});
