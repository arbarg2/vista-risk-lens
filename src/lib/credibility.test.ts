import { describe, expect, it } from 'vitest';
import { tools } from '@/data/tools';
import { DEFAULT_WEIGHTS, confidenceFor, packageRisk, policyChecks, policyFit, scoreTool } from './posture';

const byId = (id: string) => tools.find((t) => t.id === id)!;
const fitFor = (id: string, profile: Parameters<typeof policyChecks>[1], cvePenalty = 0) => {
  const t = byId(id);
  return policyFit(policyChecks(t, profile, scoreTool(t, profile, DEFAULT_WEIGHTS[profile], cvePenalty)));
};
const check = (id: string, profile: Parameters<typeof policyChecks>[1], rule: string) =>
  policyChecks(byId(id), profile).find((c) => c.id === rule)!;

describe('confidence rating', () => {
  it('HIGH needs audited SOC 2 plus live CVE telemetry', () => {
    expect(confidenceFor(byId('gpt-5'), true).level).toBe('high');
  });
  it('drops to MEDIUM when CVE telemetry is not active', () => {
    expect(confidenceFor(byId('gpt-5'), false).level).toBe('medium');
  });
  it('MEDIUM for vendor self-reported data (no verified SOC 2)', () => {
    expect(confidenceFor(byId('llama-3.3'), true).level).toBe('medium');
  });
  it('LOW when retention or residency disclosures are missing', () => {
    expect(confidenceFor(byId('deepseek-v3'), true).level).toBe('low');
    expect(confidenceFor(byId('midjourney-v7'), true).level).toBe('low');
  });
});

describe('policy fit', () => {
  it('EU Enterprise: EU-hosted Mistral Large passes EU data residency and is Compliant', () => {
    expect(check('mistral-large', 'eu-enterprise', 'residency').outcome).toBe('pass');
    expect(fitFor('mistral-large', 'eu-enterprise')).toBe('compliant');
  });
  it('EU Enterprise: US-hosted, opt-out training GPT-5 is Conditional', () => {
    expect(fitFor('gpt-5', 'eu-enterprise')).toBe('conditional');
  });
  it('EU Enterprise: a tool that trains on your data is Non-Compliant', () => {
    expect(fitFor('deepseek-v3', 'eu-enterprise')).toBe('non-compliant');
  });
  it('US FedRAMP: EU residency fails the required US residency rule', () => {
    expect(check('mistral-large', 'us-fedramp', 'residency').outcome).toBe('fail');
    expect(fitFor('mistral-large', 'us-fedramp')).toBe('non-compliant');
  });
  it('US FedRAMP: zero-data retention is required — Azure OpenAI passes, GPT-5 (30d) is conditional', () => {
    expect(check('azure-openai', 'us-fedramp', 'zdr').outcome).toBe('pass');
    expect(check('gpt-5', 'us-fedramp', 'zdr').outcome).toBe('conditional');
    expect(fitFor('azure-openai', 'us-fedramp')).toBe('compliant');
  });
  it('severe live CVE exposure downgrades an otherwise compliant tool', () => {
    expect(fitFor('azure-openai', 'us-fedramp', 20)).toBe('conditional');
  });
});

describe('CISA KEV weighting', () => {
  it('an actively exploited CVE counts twice as much toward package risk', () => {
    const base = { id: 'CVE-1', aliases: [], pkg: 'langchain' as const, score: 9, severity: 'CRITICAL' as const, published: new Date().toISOString(), summary: '', source: 'NVD' as const, url: '' };
    const normal = packageRisk([base]).langchain!;
    const exploited = packageRisk([{ ...base, exploited: true }]).langchain!;
    expect(exploited).toBeCloseTo(normal * 2);
  });
});
