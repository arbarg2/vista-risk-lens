export type ComplianceProfile = 'eu-enterprise' | 'us-fedramp' | 'global-startup' | 'personal';

export type HostingProvider = 'Azure' | 'AWS' | 'GCP' | 'Self-Hosted' | 'Proprietary' | 'Multi-Cloud';

export interface AIBOM {
  baseModel: string;
  hostingProvider: HostingProvider;
  dataRetentionDays: number; // 0 = zero retention
  ipIndemnification: boolean;
  region: string;
  parameterCount?: string;
  trainingCutoff: string;
  openWeights: boolean;
}

export interface OWASPRisk {
  promptInjectionResistance: number; // 0-100, higher is better
  overrelianceRisk: number;          // 0-100, higher = more risky (worse)
  modelProvenance: number;           // 0-100, transparency of training data/lineage
  insecureOutputHandling: number;    // 0-100, higher is better
  supplyChainRisk: number;           // 0-100, higher = more risky (worse)
}

export interface AITool {
  id: string;
  name: string;
  provider: string;
  logo: string;
  category: string;
  verified: boolean;
  performance: {
    accuracy: number;
    latency: number; // ms
    throughput: number;
  };
  trust: {
    dataSovereignty: 'EU' | 'US' | 'Global';
    trainingPrivacy: 'Never' | 'Opt-out' | 'Opt-in';
    sso: boolean;
    soc2: boolean;
    hipaa: boolean;
    encryptionAtRest: boolean;
  };
  owasp: OWASPRisk;
  aibom: AIBOM;
  costPerMToken: number;
  trendData: number[];
  policyUrl: string;
  lastUpdated: string;
}

export const profileWeights: Record<ComplianceProfile, { dataSovereignty: Record<string, number>; trainingPrivacy: Record<string, number>; ssoWeight: number; soc2Weight: number; hipaaWeight: number; owaspWeight: number }> = {
  'eu-enterprise': {
    dataSovereignty: { EU: 1, US: 0.3, Global: 0.5 },
    trainingPrivacy: { Never: 1, 'Opt-out': 0.6, 'Opt-in': 0.2 },
    ssoWeight: 1, soc2Weight: 1, hipaaWeight: 0.5, owaspWeight: 1,
  },
  'us-fedramp': {
    dataSovereignty: { EU: 0.5, US: 1, Global: 0.6 },
    trainingPrivacy: { Never: 1, 'Opt-out': 0.7, 'Opt-in': 0.3 },
    ssoWeight: 1, soc2Weight: 1, hipaaWeight: 1, owaspWeight: 1,
  },
  'global-startup': {
    dataSovereignty: { EU: 0.8, US: 0.8, Global: 1 },
    trainingPrivacy: { Never: 0.8, 'Opt-out': 0.9, 'Opt-in': 0.7 },
    ssoWeight: 0.5, soc2Weight: 0.6, hipaaWeight: 0.3, owaspWeight: 0.6,
  },
  personal: {
    dataSovereignty: { EU: 0.9, US: 0.9, Global: 1 },
    trainingPrivacy: { Never: 1, 'Opt-out': 0.8, 'Opt-in': 0.5 },
    ssoWeight: 0.2, soc2Weight: 0.3, hipaaWeight: 0.1, owaspWeight: 0.4,
  },
};

export function calcOwaspScore(o: OWASPRisk): number {
  // Invert risk-style metrics so higher = safer
  const inverted = {
    pi: o.promptInjectionResistance,
    over: 100 - o.overrelianceRisk,
    prov: o.modelProvenance,
    out: o.insecureOutputHandling,
    sc: 100 - o.supplyChainRisk,
  };
  return Math.round((inverted.pi + inverted.over + inverted.prov + inverted.out + inverted.sc) / 5);
}

export function calcScore(tool: AITool, profile: ComplianceProfile) {
  const w = profileWeights[profile];
  const perfScore = (tool.performance.accuracy * 0.5 + (1 - Math.min(tool.performance.latency, 2000) / 2000) * 0.3 + Math.min(tool.performance.throughput, 100) / 100 * 0.2) * 100;
  const sovScore = (w.dataSovereignty[tool.trust.dataSovereignty] ?? 0.5) * 100;
  const privScore = (w.trainingPrivacy[tool.trust.trainingPrivacy] ?? 0.5) * 100;
  const secScore = (
    (tool.trust.sso ? w.ssoWeight : 0) +
    (tool.trust.soc2 ? w.soc2Weight : 0) +
    (tool.trust.hipaa ? w.hipaaWeight : 0) +
    (tool.trust.encryptionAtRest ? 1 : 0)
  ) / (w.ssoWeight + w.soc2Weight + w.hipaaWeight + 1) * 100;
  const owaspScore = calcOwaspScore(tool.owasp);
  // Trust = sovereignty + privacy + security + OWASP weighted by profile
  const trustScore = (sovScore * 0.28 + privScore * 0.28 + secScore * 0.22 + owaspScore * 0.22 * w.owaspWeight);
  const total = perfScore * 0.35 + trustScore * 0.65;
  return {
    total: Math.round(total),
    perfScore: Math.round(perfScore),
    trustScore: Math.round(trustScore),
    sovScore: Math.round(sovScore),
    privScore: Math.round(privScore),
    secScore: Math.round(secScore),
    owaspScore: Math.round(owaspScore),
  };
}

export function getScoreColor(score: number): string {
  if (score >= 75) return 'safe';
  if (score >= 50) return 'warning';
  return 'danger';
}

export function getLetterGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'A', color: 'safe' };
  if (score >= 80) return { grade: 'B', color: 'safe' };
  if (score >= 70) return { grade: 'C', color: 'warning' };
  if (score >= 60) return { grade: 'D', color: 'warning' };
  return { grade: 'F', color: 'danger' };
}

export function costToRiskRatio(tool: AITool, profile: ComplianceProfile): string {
  const { total } = calcScore(tool, profile);
  if (total === 0) return '∞';
  return (tool.costPerMToken / total * 100).toFixed(2);
}

// Default OWASP/AIBOM helpers to keep this file maintainable
const owaspHigh: OWASPRisk = { promptInjectionResistance: 88, overrelianceRisk: 25, modelProvenance: 85, insecureOutputHandling: 90, supplyChainRisk: 15 };
const owaspMid: OWASPRisk  = { promptInjectionResistance: 72, overrelianceRisk: 40, modelProvenance: 65, insecureOutputHandling: 75, supplyChainRisk: 30 };
const owaspLow: OWASPRisk  = { promptInjectionResistance: 50, overrelianceRisk: 60, modelProvenance: 35, insecureOutputHandling: 55, supplyChainRisk: 60 };

const bom = (
  baseModel: string,
  hostingProvider: HostingProvider,
  dataRetentionDays: number,
  ipIndemnification: boolean,
  region: string,
  trainingCutoff: string,
  openWeights = false,
  parameterCount?: string,
): AIBOM => ({ baseModel, hostingProvider, dataRetentionDays, ipIndemnification, region, trainingCutoff, openWeights, parameterCount });

export const tools: AITool[] = [
  // ── LLMs ──────────────────────────────────────────────
  {
    id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', logo: '🟢', category: 'LLM', verified: true,
    performance: { accuracy: 0.96, latency: 320, throughput: 95 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 90, overrelianceRisk: 28, modelProvenance: 70, insecureOutputHandling: 92, supplyChainRisk: 20 },
    aibom: bom('GPT-5 (proprietary)', 'Azure', 30, true, 'US-East', '2025-08', false, '~1.8T MoE'),
    costPerMToken: 5.0, trendData: [88, 89, 91, 92, 93, 94, 95, 96],
    policyUrl: 'https://openai.com/policies', lastUpdated: '2026-03-28',
  },
  {
    id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', logo: '🟢', category: 'LLM', verified: true,
    performance: { accuracy: 0.91, latency: 380, throughput: 90 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 85, overrelianceRisk: 32, modelProvenance: 70, insecureOutputHandling: 88, supplyChainRisk: 22 },
    aibom: bom('GPT-4o', 'Azure', 30, true, 'US-East', '2024-10', false, '~200B MoE'),
    costPerMToken: 2.5, trendData: [80, 82, 83, 84, 86, 88, 89, 91],
    policyUrl: 'https://openai.com/policies', lastUpdated: '2026-03-20',
  },
  {
    id: 'claude-4-opus', name: 'Claude 4 Opus', provider: 'Anthropic', logo: '🟣', category: 'LLM', verified: true,
    performance: { accuracy: 0.95, latency: 500, throughput: 80 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 94, overrelianceRisk: 22, modelProvenance: 80, insecureOutputHandling: 95, supplyChainRisk: 12 },
    aibom: bom('Claude 4 Opus', 'AWS', 0, true, 'US-West', '2025-04', false, 'Undisclosed'),
    costPerMToken: 15.0, trendData: [85, 87, 89, 90, 92, 93, 94, 95],
    policyUrl: 'https://www.anthropic.com/policies', lastUpdated: '2026-03-25',
  },
  {
    id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', logo: '🟣', category: 'LLM', verified: true,
    performance: { accuracy: 0.92, latency: 450, throughput: 85 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 90, overrelianceRisk: 25, modelProvenance: 78, insecureOutputHandling: 92, supplyChainRisk: 14 },
    aibom: bom('Claude 3.5 Sonnet', 'AWS', 0, true, 'US-West', '2024-04', false),
    costPerMToken: 3.0, trendData: [82, 84, 85, 87, 88, 90, 91, 92],
    policyUrl: 'https://www.anthropic.com/policies', lastUpdated: '2026-03-15',
  },
  {
    id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google DeepMind', logo: '🔵', category: 'LLM', verified: true,
    performance: { accuracy: 0.93, latency: 400, throughput: 88 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 82, overrelianceRisk: 38, modelProvenance: 60, insecureOutputHandling: 85, supplyChainRisk: 28 },
    aibom: bom('Gemini 2.5 Pro', 'GCP', 55, true, 'Multi-Region', '2025-01', false, '~1T'),
    costPerMToken: 1.25, trendData: [75, 78, 81, 84, 87, 89, 91, 93],
    policyUrl: 'https://policies.google.com/privacy', lastUpdated: '2026-03-22',
  },
  {
    id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google DeepMind', logo: '🔵', category: 'LLM', verified: true,
    performance: { accuracy: 0.87, latency: 180, throughput: 120 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 75, overrelianceRisk: 42, modelProvenance: 60, insecureOutputHandling: 80, supplyChainRisk: 30 },
    aibom: bom('Gemini 2.5 Flash', 'GCP', 55, true, 'Multi-Region', '2025-01'),
    costPerMToken: 0.15, trendData: [70, 73, 76, 79, 82, 84, 86, 87],
    policyUrl: 'https://policies.google.com/privacy', lastUpdated: '2026-03-22',
  },
  {
    id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', logo: '🦙', category: 'LLM', verified: false,
    performance: { accuracy: 0.91, latency: 350, throughput: 92 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Never', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 60, overrelianceRisk: 50, modelProvenance: 88, insecureOutputHandling: 65, supplyChainRisk: 45 },
    aibom: bom('Llama 4 Maverick', 'Self-Hosted', 0, false, 'On-prem', '2025-02', true, '400B MoE'),
    costPerMToken: 0.27, trendData: [72, 76, 80, 83, 86, 88, 90, 91],
    policyUrl: 'https://llama.meta.com/use-policy/', lastUpdated: '2026-03-18',
  },
  {
    id: 'llama-3.3', name: 'Llama 3.3 70B', provider: 'Meta', logo: '🦙', category: 'LLM', verified: false,
    performance: { accuracy: 0.86, latency: 600, throughput: 65 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Never', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 58, overrelianceRisk: 52, modelProvenance: 85, insecureOutputHandling: 62, supplyChainRisk: 45 },
    aibom: bom('Llama 3.3 70B', 'Self-Hosted', 0, false, 'On-prem', '2024-12', true, '70B'),
    costPerMToken: 0.59, trendData: [65, 68, 72, 74, 76, 80, 83, 86],
    policyUrl: 'https://llama.meta.com/use-policy/', lastUpdated: '2026-02-28',
  },
  {
    id: 'mistral-large', name: 'Mistral Large 2', provider: 'Mistral AI', logo: '🌀', category: 'LLM', verified: true,
    performance: { accuracy: 0.88, latency: 480, throughput: 78 },
    trust: { dataSovereignty: 'EU', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 80, overrelianceRisk: 30, modelProvenance: 78, insecureOutputHandling: 82, supplyChainRisk: 18 },
    aibom: bom('Mistral Large 2', 'Multi-Cloud', 30, true, 'EU-Paris', '2024-07', false, '123B'),
    costPerMToken: 2.0, trendData: [72, 75, 77, 80, 82, 84, 86, 88],
    policyUrl: 'https://mistral.ai/terms/', lastUpdated: '2026-03-10',
  },
  {
    id: 'mistral-codestral', name: 'Codestral', provider: 'Mistral AI', logo: '🌀', category: 'Code', verified: true,
    performance: { accuracy: 0.89, latency: 300, throughput: 95 },
    trust: { dataSovereignty: 'EU', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 78, overrelianceRisk: 35, modelProvenance: 80, insecureOutputHandling: 80, supplyChainRisk: 18 },
    aibom: bom('Codestral 22B', 'Multi-Cloud', 30, true, 'EU-Paris', '2024-05', true, '22B'),
    costPerMToken: 0.30, trendData: [74, 77, 80, 82, 84, 86, 88, 89],
    policyUrl: 'https://mistral.ai/terms/', lastUpdated: '2026-03-12',
  },
  {
    id: 'cohere-command', name: 'Command R+', provider: 'Cohere', logo: '🔶', category: 'LLM', verified: true,
    performance: { accuracy: 0.84, latency: 550, throughput: 70 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspMid, promptInjectionResistance: 76, modelProvenance: 70 },
    aibom: bom('Command R+ 104B', 'Multi-Cloud', 30, true, 'US/EU', '2024-04', true, '104B'),
    costPerMToken: 1.5, trendData: [68, 70, 72, 75, 78, 80, 82, 84],
    policyUrl: 'https://cohere.com/privacy', lastUpdated: '2026-03-05',
  },
  {
    id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', logo: '🐋', category: 'LLM', verified: false,
    performance: { accuracy: 0.90, latency: 420, throughput: 82 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 45, overrelianceRisk: 65, modelProvenance: 50, insecureOutputHandling: 50, supplyChainRisk: 75 },
    aibom: bom('DeepSeek V3', 'Self-Hosted', 365, false, 'CN-Beijing', '2024-12', true, '671B MoE'),
    costPerMToken: 0.14, trendData: [68, 72, 76, 80, 83, 86, 88, 90],
    policyUrl: 'https://www.deepseek.com/privacy', lastUpdated: '2026-03-20',
  },
  {
    id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', logo: '🐋', category: 'Reasoning', verified: false,
    performance: { accuracy: 0.93, latency: 1200, throughput: 40 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 42, overrelianceRisk: 70, modelProvenance: 48, insecureOutputHandling: 48, supplyChainRisk: 80 },
    aibom: bom('DeepSeek R1', 'Self-Hosted', 365, false, 'CN-Beijing', '2024-12', true, '671B MoE'),
    costPerMToken: 0.55, trendData: [70, 74, 78, 82, 85, 88, 91, 93],
    policyUrl: 'https://www.deepseek.com/privacy', lastUpdated: '2026-03-20',
  },
  {
    id: 'qwen-3', name: 'Qwen 3 235B', provider: 'Alibaba Cloud', logo: '☁️', category: 'LLM', verified: false,
    performance: { accuracy: 0.89, latency: 500, throughput: 72 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: false, soc2: false, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 55, overrelianceRisk: 55, modelProvenance: 55, insecureOutputHandling: 60, supplyChainRisk: 65 },
    aibom: bom('Qwen 3 235B', 'Self-Hosted', 180, false, 'CN-Hangzhou', '2025-01', true, '235B MoE'),
    costPerMToken: 0.30, trendData: [65, 69, 73, 77, 80, 84, 87, 89],
    policyUrl: 'https://www.alibabacloud.com/privacy-policy', lastUpdated: '2026-03-15',
  },
  {
    id: 'grok-3', name: 'Grok 3', provider: 'xAI', logo: '✖️', category: 'LLM', verified: false,
    performance: { accuracy: 0.90, latency: 350, throughput: 88 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-in', sso: false, soc2: false, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 58, overrelianceRisk: 55, modelProvenance: 45, insecureOutputHandling: 60, supplyChainRisk: 40 },
    aibom: bom('Grok 3', 'Proprietary', 90, false, 'US-Texas', '2025-02', false, '~314B'),
    costPerMToken: 3.0, trendData: [72, 75, 78, 81, 84, 86, 88, 90],
    policyUrl: 'https://x.ai/legal/privacy-policy', lastUpdated: '2026-03-22',
  },

  // ── Code Assistants ────────────────────────────────────
  {
    id: 'github-copilot', name: 'GitHub Copilot', provider: 'Microsoft', logo: '🤖', category: 'Code', verified: true,
    performance: { accuracy: 0.88, latency: 250, throughput: 110 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 78, overrelianceRisk: 55, modelProvenance: 65, insecureOutputHandling: 75, supplyChainRisk: 22 },
    aibom: bom('GPT-4o + Codex', 'Azure', 0, true, 'US-East', '2024-10', false),
    costPerMToken: 0.0, trendData: [78, 80, 82, 84, 85, 86, 87, 88],
    policyUrl: 'https://github.com/features/copilot/trust', lastUpdated: '2026-03-18',
  },
  {
    id: 'cursor-ai', name: 'Cursor', provider: 'Anysphere', logo: '⚡', category: 'Code', verified: false,
    performance: { accuracy: 0.90, latency: 280, throughput: 100 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: false, soc2: false, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 70, overrelianceRisk: 60, modelProvenance: 55, insecureOutputHandling: 70, supplyChainRisk: 30 },
    aibom: bom('Claude 3.5 + GPT-4o', 'AWS', 30, false, 'US-East', '2024-10'),
    costPerMToken: 0.0, trendData: [70, 74, 78, 82, 85, 87, 89, 90],
    policyUrl: 'https://www.cursor.com/privacy', lastUpdated: '2026-03-20',
  },
  {
    id: 'lovable', name: 'Lovable', provider: 'Lovable', logo: '💜', category: 'Code', verified: true,
    performance: { accuracy: 0.89, latency: 350, throughput: 85 },
    trust: { dataSovereignty: 'EU', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 85, overrelianceRisk: 35, modelProvenance: 80, insecureOutputHandling: 88, supplyChainRisk: 18 },
    aibom: bom('Claude 4 + GPT-5', 'Multi-Cloud', 0, true, 'EU-Stockholm', '2025-04', false),
    costPerMToken: 0.0, trendData: [65, 70, 75, 79, 83, 86, 88, 89],
    policyUrl: 'https://lovable.dev/privacy', lastUpdated: '2026-03-25',
  },
  {
    id: 'replit-agent', name: 'Replit Agent', provider: 'Replit', logo: '🔁', category: 'Code', verified: false,
    performance: { accuracy: 0.82, latency: 400, throughput: 70 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-in', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspMid, promptInjectionResistance: 65, modelProvenance: 60 },
    aibom: bom('Claude 3.5 Sonnet', 'GCP', 90, false, 'US-Central', '2024-04'),
    costPerMToken: 0.0, trendData: [58, 62, 66, 70, 74, 77, 80, 82],
    policyUrl: 'https://replit.com/site/privacy', lastUpdated: '2026-03-10',
  },

  // ── Image Generation ───────────────────────────────────
  {
    id: 'dall-e-4', name: 'DALL·E 4', provider: 'OpenAI', logo: '🎨', category: 'Image Gen', verified: true,
    performance: { accuracy: 0.88, latency: 8000, throughput: 5 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 80, overrelianceRisk: 40, modelProvenance: 60, insecureOutputHandling: 80, supplyChainRisk: 22 },
    aibom: bom('DALL·E 4 (Diffusion)', 'Azure', 30, true, 'US-East', '2025-06', false),
    costPerMToken: 40.0, trendData: [75, 78, 80, 82, 84, 85, 87, 88],
    policyUrl: 'https://openai.com/policies', lastUpdated: '2026-03-15',
  },
  {
    id: 'midjourney-v7', name: 'Midjourney v7', provider: 'Midjourney', logo: '🖼️', category: 'Image Gen', verified: false,
    performance: { accuracy: 0.92, latency: 12000, throughput: 3 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-in', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 60, overrelianceRisk: 50, modelProvenance: 30, insecureOutputHandling: 65, supplyChainRisk: 55 },
    aibom: bom('Midjourney v7', 'Proprietary', 365, false, 'US-West', '2025-03', false),
    costPerMToken: 0.0, trendData: [80, 83, 85, 87, 88, 90, 91, 92],
    policyUrl: 'https://docs.midjourney.com/terms-of-service', lastUpdated: '2026-03-10',
  },
  {
    id: 'stable-diffusion-4', name: 'Stable Diffusion 4', provider: 'Stability AI', logo: '🌊', category: 'Image Gen', verified: false,
    performance: { accuracy: 0.85, latency: 5000, throughput: 8 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Never', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 65, overrelianceRisk: 45, modelProvenance: 88, insecureOutputHandling: 65, supplyChainRisk: 50 },
    aibom: bom('SD4 (Diffusion)', 'Self-Hosted', 0, false, 'On-prem', '2024-11', true, '8B'),
    costPerMToken: 0.0, trendData: [70, 72, 74, 77, 79, 81, 83, 85],
    policyUrl: 'https://stability.ai/privacy-policy', lastUpdated: '2026-02-20',
  },
  {
    id: 'flux-pro', name: 'FLUX 1.1 Pro', provider: 'Black Forest Labs', logo: '🔥', category: 'Image Gen', verified: false,
    performance: { accuracy: 0.90, latency: 6000, throughput: 6 },
    trust: { dataSovereignty: 'EU', trainingPrivacy: 'Never', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    owasp: { promptInjectionResistance: 70, overrelianceRisk: 42, modelProvenance: 80, insecureOutputHandling: 72, supplyChainRisk: 35 },
    aibom: bom('FLUX 1.1 Pro', 'Multi-Cloud', 30, false, 'EU-Frankfurt', '2024-09', true, '12B'),
    costPerMToken: 0.0, trendData: [72, 76, 80, 83, 85, 87, 89, 90],
    policyUrl: 'https://blackforestlabs.ai/privacy/', lastUpdated: '2026-03-08',
  },
  {
    id: 'ideogram-3', name: 'Ideogram 3', provider: 'Ideogram', logo: '💡', category: 'Image Gen', verified: false,
    performance: { accuracy: 0.87, latency: 7000, throughput: 5 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: false, soc2: false, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspMid, modelProvenance: 50 },
    aibom: bom('Ideogram 3', 'Proprietary', 90, false, 'US-West', '2024-10'),
    costPerMToken: 0.0, trendData: [65, 70, 74, 78, 81, 83, 85, 87],
    policyUrl: 'https://ideogram.ai/privacy', lastUpdated: '2026-03-12',
  },

  // ── Video Generation ───────────────────────────────────
  {
    id: 'sora-2', name: 'Sora 2', provider: 'OpenAI', logo: '🎬', category: 'Video Gen', verified: true,
    performance: { accuracy: 0.85, latency: 45000, throughput: 1 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 75, overrelianceRisk: 45, modelProvenance: 55, insecureOutputHandling: 78, supplyChainRisk: 25 },
    aibom: bom('Sora 2 (Diffusion Transformer)', 'Azure', 30, true, 'US-East', '2025-09', false),
    costPerMToken: 100.0, trendData: [60, 65, 70, 74, 78, 80, 83, 85],
    policyUrl: 'https://openai.com/policies', lastUpdated: '2026-03-20',
  },
  {
    id: 'runway-gen4', name: 'Runway Gen-4', provider: 'Runway', logo: '🎥', category: 'Video Gen', verified: false,
    performance: { accuracy: 0.82, latency: 30000, throughput: 2 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-in', sso: false, soc2: false, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspMid, modelProvenance: 45 },
    aibom: bom('Gen-4', 'AWS', 90, false, 'US-East', '2025-01'),
    costPerMToken: 0.0, trendData: [55, 60, 65, 69, 73, 76, 79, 82],
    policyUrl: 'https://runwayml.com/privacy-policy/', lastUpdated: '2026-03-14',
  },
  {
    id: 'veo-2', name: 'Veo 2', provider: 'Google DeepMind', logo: '🔵', category: 'Video Gen', verified: true,
    performance: { accuracy: 0.84, latency: 35000, throughput: 2 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 78, overrelianceRisk: 42, modelProvenance: 60, insecureOutputHandling: 80, supplyChainRisk: 28 },
    aibom: bom('Veo 2', 'GCP', 55, true, 'Multi-Region', '2024-12', false),
    costPerMToken: 0.0, trendData: [58, 63, 67, 72, 76, 79, 82, 84],
    policyUrl: 'https://policies.google.com/privacy', lastUpdated: '2026-03-18',
  },

  // ── Audio / Voice ──────────────────────────────────────
  {
    id: 'elevenlabs-v3', name: 'ElevenLabs v3', provider: 'ElevenLabs', logo: '🔊', category: 'Audio', verified: true,
    performance: { accuracy: 0.91, latency: 800, throughput: 50 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspMid, promptInjectionResistance: 75, modelProvenance: 55 },
    aibom: bom('ElevenLabs v3', 'AWS', 30, true, 'US-East', '2025-02'),
    costPerMToken: 30.0, trendData: [75, 78, 81, 83, 86, 88, 90, 91],
    policyUrl: 'https://elevenlabs.io/privacy-policy', lastUpdated: '2026-03-16',
  },
  {
    id: 'whisper-v4', name: 'Whisper V4', provider: 'OpenAI', logo: '🎙️', category: 'Audio', verified: true,
    performance: { accuracy: 0.95, latency: 600, throughput: 60 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { ...owaspHigh, modelProvenance: 75 },
    aibom: bom('Whisper V4', 'Azure', 30, true, 'US-East', '2025-03', true, '1.5B'),
    costPerMToken: 6.0, trendData: [82, 85, 87, 89, 91, 92, 94, 95],
    policyUrl: 'https://openai.com/policies', lastUpdated: '2026-03-18',
  },

  // ── Search / RAG ───────────────────────────────────────
  {
    id: 'perplexity-sonar', name: 'Perplexity Sonar Pro', provider: 'Perplexity', logo: '🔍', category: 'Search', verified: false,
    performance: { accuracy: 0.87, latency: 600, throughput: 65 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: false, soc2: false, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspMid, promptInjectionResistance: 68 },
    aibom: bom('Sonar (Llama-based)', 'AWS', 30, false, 'US-East', '2025-01'),
    costPerMToken: 5.0, trendData: [68, 72, 75, 78, 81, 83, 85, 87],
    policyUrl: 'https://www.perplexity.ai/privacy', lastUpdated: '2026-03-22',
  },

  // ── Embedding / Retrieval ──────────────────────────────
  {
    id: 'openai-embed-3', name: 'text-embedding-3-large', provider: 'OpenAI', logo: '🟢', category: 'Embedding', verified: true,
    performance: { accuracy: 0.93, latency: 80, throughput: 500 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { ...owaspHigh, promptInjectionResistance: 85 },
    aibom: bom('text-embedding-3-large', 'Azure', 30, true, 'US-East', '2024-01'),
    costPerMToken: 0.13, trendData: [85, 87, 88, 89, 90, 91, 92, 93],
    policyUrl: 'https://openai.com/policies', lastUpdated: '2026-03-10',
  },
  {
    id: 'cohere-embed-v4', name: 'Embed v4', provider: 'Cohere', logo: '🔶', category: 'Embedding', verified: true,
    performance: { accuracy: 0.91, latency: 60, throughput: 600 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    owasp: { ...owaspHigh, promptInjectionResistance: 82 },
    aibom: bom('Embed v4', 'Multi-Cloud', 30, true, 'US/EU', '2024-06'),
    costPerMToken: 0.10, trendData: [80, 82, 84, 86, 87, 89, 90, 91],
    policyUrl: 'https://cohere.com/privacy', lastUpdated: '2026-03-08',
  },

  // ── AI Agents / Assistants ─────────────────────────────
  {
    id: 'chatgpt-enterprise', name: 'ChatGPT Enterprise', provider: 'OpenAI', logo: '🟢', category: 'Assistant', verified: true,
    performance: { accuracy: 0.91, latency: 400, throughput: 85 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 88, overrelianceRisk: 28, modelProvenance: 72, insecureOutputHandling: 90, supplyChainRisk: 18 },
    aibom: bom('GPT-4o / GPT-5', 'Azure', 0, true, 'US-East', '2025-08', false),
    costPerMToken: 0.0, trendData: [80, 82, 84, 86, 87, 88, 89, 91],
    policyUrl: 'https://openai.com/enterprise-privacy', lastUpdated: '2026-03-20',
  },
  {
    id: 'claude-teams', name: 'Claude for Teams', provider: 'Anthropic', logo: '🟣', category: 'Assistant', verified: true,
    performance: { accuracy: 0.92, latency: 460, throughput: 82 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { promptInjectionResistance: 92, overrelianceRisk: 24, modelProvenance: 80, insecureOutputHandling: 92, supplyChainRisk: 12 },
    aibom: bom('Claude 4 / 3.5', 'AWS', 0, true, 'US-West', '2025-04', false),
    costPerMToken: 0.0, trendData: [78, 81, 84, 86, 88, 89, 91, 92],
    policyUrl: 'https://www.anthropic.com/policies', lastUpdated: '2026-03-22',
  },
  {
    id: 'microsoft-copilot-365', name: 'Microsoft 365 Copilot', provider: 'Microsoft', logo: '🪟', category: 'Assistant', verified: true,
    performance: { accuracy: 0.86, latency: 500, throughput: 70 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { ...owaspHigh, promptInjectionResistance: 85, modelProvenance: 70 },
    aibom: bom('GPT-4o + Graph', 'Azure', 0, true, 'US/EU', '2024-10'),
    costPerMToken: 0.0, trendData: [72, 75, 77, 79, 81, 83, 85, 86],
    policyUrl: 'https://privacy.microsoft.com/', lastUpdated: '2026-03-18',
  },
  {
    id: 'gemini-workspace', name: 'Gemini for Workspace', provider: 'Google', logo: '🔵', category: 'Assistant', verified: true,
    performance: { accuracy: 0.85, latency: 450, throughput: 75 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { ...owaspMid, promptInjectionResistance: 80, modelProvenance: 60 },
    aibom: bom('Gemini 2.5 Pro', 'GCP', 30, true, 'Multi-Region', '2025-01'),
    costPerMToken: 0.0, trendData: [70, 73, 76, 78, 80, 82, 84, 85],
    policyUrl: 'https://policies.google.com/privacy', lastUpdated: '2026-03-16',
  },

  // ── Specialized ────────────────────────────────────────
  {
    id: 'amazon-bedrock', name: 'Amazon Bedrock', provider: 'AWS', logo: '🟧', category: 'Platform', verified: true,
    performance: { accuracy: 0.87, latency: 450, throughput: 80 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { ...owaspHigh, modelProvenance: 75 },
    aibom: bom('Multi-model gateway', 'AWS', 0, true, 'US/EU/APAC', '2025-01'),
    costPerMToken: 0.0, trendData: [75, 77, 79, 81, 83, 84, 86, 87],
    policyUrl: 'https://aws.amazon.com/privacy/', lastUpdated: '2026-03-14',
  },
  {
    id: 'azure-openai', name: 'Azure OpenAI Service', provider: 'Microsoft', logo: '🪟', category: 'Platform', verified: true,
    performance: { accuracy: 0.91, latency: 400, throughput: 88 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    owasp: { ...owaspHigh, modelProvenance: 70 },
    aibom: bom('GPT-4o / GPT-5 (Azure)', 'Azure', 0, true, 'US/EU/APAC', '2025-08'),
    costPerMToken: 2.5, trendData: [80, 82, 84, 86, 87, 88, 90, 91],
    policyUrl: 'https://privacy.microsoft.com/', lastUpdated: '2026-03-18',
  },
];

export const alerts = [
  { id: 1, type: 'warning' as const, message: 'OpenAI updated Privacy Policy — Score dropping for EU Profiles', time: '2h ago' },
  { id: 2, type: 'danger' as const, message: 'Gemini data processing moved to US region — Sovereignty impact', time: '5h ago' },
  { id: 3, type: 'safe' as const, message: 'Mistral AI achieved EU Data Residency certification', time: '1d ago' },
  { id: 4, type: 'warning' as const, message: 'Meta Llama 4 license terms updated — Review required', time: '2d ago' },
  { id: 5, type: 'safe' as const, message: 'Anthropic passed SOC2 Type II annual audit', time: '3d ago' },
  { id: 6, type: 'danger' as const, message: 'DeepSeek R1 flagged for unverified data handling in EU', time: '6h ago' },
];

// ── Live CVE feed (simulated) ──────────────────────────
export interface CVE {
  id: string;
  package: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  cvss: number;
  patched: boolean;
}

export const cves: CVE[] = [
  { id: 'CVE-2026-1234', package: 'langchain', severity: 'critical', description: 'Server-side request forgery via SerpAPI tool', cvss: 9.6, patched: false },
  { id: 'CVE-2026-1198', package: 'llama-index', severity: 'high', description: 'Prompt injection bypasses output guardrails', cvss: 8.1, patched: true },
  { id: 'CVE-2026-1102', package: 'transformers', severity: 'medium', description: 'Pickle deserialization in trust_remote_code=True', cvss: 6.5, patched: true },
  { id: 'CVE-2026-1056', package: 'pgvector', severity: 'high', description: 'Memory exhaustion via crafted ivfflat queries', cvss: 7.5, patched: false },
  { id: 'CVE-2026-0987', package: 'open-webui', severity: 'critical', description: 'Auth bypass on shared chat endpoints', cvss: 9.8, patched: false },
  { id: 'CVE-2026-0941', package: 'autogen', severity: 'medium', description: 'Code-execution agent escapes sandbox', cvss: 6.1, patched: true },
  { id: 'CVE-2026-0823', package: 'crewai', severity: 'high', description: 'Tool-use injection escalates privileges', cvss: 8.4, patched: false },
];

// ── Shadow AI incident generator ───────────────────────
export interface Incident {
  id: string;
  timestamp: number;
  user: string;
  toolName: string;
  toolId?: string;
  action: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  department: string;
}

const departments = ['Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Legal', 'Product', 'Support'];
const actions = ['accessed unvetted tool', 'uploaded customer PII to', 'pasted source code into', 'connected via API to', 'shared internal doc with', 'authenticated personal account on'];

export function generateIncident(): Incident {
  // Bias toward risky tools
  const riskyTools = tools.filter((t) => calcOwaspScore(t.owasp) < 60 || !t.trust.soc2);
  const pool = Math.random() < 0.7 ? riskyTools : tools;
  const tool = pool[Math.floor(Math.random() * pool.length)];
  const owasp = calcOwaspScore(tool.owasp);
  const severity: Incident['severity'] = owasp < 45 ? 'critical' : owasp < 60 ? 'high' : owasp < 75 ? 'medium' : 'low';
  return {
    id: `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    user: `user.${Math.floor(Math.random() * 999)}@corp`,
    toolName: tool.name,
    toolId: tool.id,
    action: actions[Math.floor(Math.random() * actions.length)],
    severity,
    department: departments[Math.floor(Math.random() * departments.length)],
  };
}
