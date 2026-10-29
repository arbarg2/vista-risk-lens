import { describe, expect, it } from 'vitest';
import { tools } from '@/data/tools';
import {
  DEFAULT_WEIGHTS, approvedPosture, cvePenaltyFor, defaultStatus, gradeFor, packageRisk, scoreTool,
  type ApprovalStatus, type ThreatItem, type ToolScore,
} from './posture';
import { cvss3BaseScore } from './threatFeed';

const byId = (id: string) => tools.find((t) => t.id === id)!;
const fakeScore = (total: number): ToolScore => ({
  total, perfScore: 0, trustScore: 0, trustBase: 0, sovScore: 0, privScore: 0, secScore: 0, owaspScore: 0, cvePenalty: 0,
});

describe('letter grade bands', () => {
  it('A is 90-100', () => { expect(gradeFor(90)).toBe('A'); expect(gradeFor(100)).toBe('A'); });
  it('B is 80-89', () => { expect(gradeFor(80)).toBe('B'); expect(gradeFor(89)).toBe('B'); });
  it('C is 70-79', () => { expect(gradeFor(70)).toBe('C'); expect(gradeFor(79)).toBe('C'); });
  it('D is below 70', () => { expect(gradeFor(69)).toBe('D'); expect(gradeFor(10)).toBe('D'); });
});

describe('approved posture', () => {
  const sample = [byId('gpt-5'), byId('claude-4-opus'), byId('deepseek-r1')];
  const scores = { 'gpt-5': fakeScore(90), 'claude-4-opus': fakeScore(80), 'deepseek-r1': fakeScore(20) };

  it('averages only tools marked approved', () => {
    const statuses: Record<string, ApprovalStatus> = { 'gpt-5': 'approved', 'claude-4-opus': 'approved', 'deepseek-r1': 'banned' };
    expect(approvedPosture(sample, statuses, scores)).toEqual({ score: 85, grade: 'B', count: 2 });
  });

  it('ignores under-review tools', () => {
    const statuses: Record<string, ApprovalStatus> = { 'gpt-5': 'approved', 'claude-4-opus': 'review', 'deepseek-r1': 'review' };
    expect(approvedPosture(sample, statuses, scores)?.score).toBe(90);
  });

  it('is empty when nothing is approved', () => {
    const statuses: Record<string, ApprovalStatus> = { 'gpt-5': 'banned', 'claude-4-opus': 'review', 'deepseek-r1': 'banned' };
    expect(approvedPosture(sample, statuses, scores)).toBeNull();
  });
});

describe('default approval status', () => {
  it('approves verified enterprise tools with SOC2 + SSO', () => expect(defaultStatus(byId('gpt-5'))).toBe('approved'));
  it('bans DeepSeek and Qwen', () => {
    expect(defaultStatus(byId('deepseek-r1'))).toBe('banned');
    expect(defaultStatus(byId('qwen-3'))).toBe('banned');
  });
  it('puts unverified tools under review', () => expect(defaultStatus(byId('cursor-ai'))).toBe('review'));
});

describe('live CVE weighting', () => {
  const now = Date.now();
  const critical: ThreatItem = {
    id: 'CVE-2026-0001', aliases: [], pkg: 'vllm', score: 9.8, severity: 'CRITICAL',
    published: new Date(now - 2 * 86_400_000).toISOString(), summary: '', source: 'NVD', url: '',
  };

  it('reduces trust for a self-hosted model that runs on vllm', () => {
    const llama = byId('llama-3.3');
    const penalty = cvePenaltyFor(llama, packageRisk([critical], now));
    expect(penalty).toBeGreaterThan(0);
    const base = scoreTool(llama, 'eu-enterprise', DEFAULT_WEIGHTS['eu-enterprise'], 0);
    const hit = scoreTool(llama, 'eu-enterprise', DEFAULT_WEIGHTS['eu-enterprise'], penalty);
    expect(hit.trustScore).toBeLessThan(base.trustScore);
    expect(hit.total).toBeLessThan(base.total);
  });

  it('does not penalize a SaaS assistant that has no vllm exposure', () => {
    expect(cvePenaltyFor(byId('chatgpt-enterprise'), packageRisk([critical], now))).toBe(0);
  });

  it('caps the penalty at 25 trust points', () => {
    const flood = Array.from({ length: 200 }, (_, i) => ({ ...critical, id: `CVE-X-${i}` }));
    expect(cvePenaltyFor(byId('llama-3.3'), packageRisk(flood, now))).toBe(25);
  });
});

describe('policy weights', () => {
  it('raising the performance weight changes the total', () => {
    const t = byId('deepseek-r1');
    const a = scoreTool(t, 'eu-enterprise', DEFAULT_WEIGHTS['eu-enterprise']);
    const b = scoreTool(t, 'eu-enterprise', { ...DEFAULT_WEIGHTS['eu-enterprise'], performance: 100 });
    expect(b.total).toBeGreaterThan(a.total);
  });
});

describe('CVSS v3 calculator', () => {
  it('scores a network RCE vector as 9.8', () => expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(9.8));
  it('scores an availability-only vector as 7.5', () => expect(cvss3BaseScore('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H')).toBe(7.5));
});
