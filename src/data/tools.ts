export type ComplianceProfile = 'eu-enterprise' | 'us-fedramp' | 'global-startup' | 'personal';

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
  costPerMToken: number;
  trendData: number[];
  policyUrl: string;
  lastUpdated: string;
}

export const profileWeights: Record<ComplianceProfile, { dataSovereignty: Record<string, number>; trainingPrivacy: Record<string, number>; ssoWeight: number; soc2Weight: number; hipaaWeight: number }> = {
  'eu-enterprise': {
    dataSovereignty: { EU: 1, US: 0.3, Global: 0.5 },
    trainingPrivacy: { Never: 1, 'Opt-out': 0.6, 'Opt-in': 0.2 },
    ssoWeight: 1, soc2Weight: 1, hipaaWeight: 0.5,
  },
  'us-fedramp': {
    dataSovereignty: { EU: 0.5, US: 1, Global: 0.6 },
    trainingPrivacy: { Never: 1, 'Opt-out': 0.7, 'Opt-in': 0.3 },
    ssoWeight: 1, soc2Weight: 1, hipaaWeight: 1,
  },
  'global-startup': {
    dataSovereignty: { EU: 0.8, US: 0.8, Global: 1 },
    trainingPrivacy: { Never: 0.8, 'Opt-out': 0.9, 'Opt-in': 0.7 },
    ssoWeight: 0.5, soc2Weight: 0.6, hipaaWeight: 0.3,
  },
  personal: {
    dataSovereignty: { EU: 0.9, US: 0.9, Global: 1 },
    trainingPrivacy: { Never: 1, 'Opt-out': 0.8, 'Opt-in': 0.5 },
    ssoWeight: 0.2, soc2Weight: 0.3, hipaaWeight: 0.1,
  },
};

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
  const trustScore = (sovScore * 0.35 + privScore * 0.35 + secScore * 0.3);
  const total = perfScore * 0.4 + trustScore * 0.6;
  return { total: Math.round(total), perfScore: Math.round(perfScore), trustScore: Math.round(trustScore), sovScore: Math.round(sovScore), privScore: Math.round(privScore), secScore: Math.round(secScore) };
}

export function getScoreColor(score: number): string {
  if (score >= 75) return 'safe';
  if (score >= 50) return 'warning';
  return 'danger';
}

export function costToRiskRatio(tool: AITool, profile: ComplianceProfile): string {
  const { total } = calcScore(tool, profile);
  if (total === 0) return '∞';
  return (tool.costPerMToken / total * 100).toFixed(2);
}

export const tools: AITool[] = [
  {
    id: 'claude-3.5',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    logo: '🟣',
    category: 'LLM',
    verified: true,
    performance: { accuracy: 0.92, latency: 450, throughput: 85 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    costPerMToken: 3.0,
    trendData: [82, 84, 85, 87, 88, 90, 91, 92],
    policyUrl: 'https://www.anthropic.com/policies',
    lastUpdated: '2026-03-15',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    logo: '🟢',
    category: 'LLM',
    verified: true,
    performance: { accuracy: 0.91, latency: 380, throughput: 90 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: true, encryptionAtRest: true },
    costPerMToken: 2.5,
    trendData: [80, 82, 83, 84, 86, 88, 89, 91],
    policyUrl: 'https://openai.com/policies',
    lastUpdated: '2026-03-20',
  },
  {
    id: 'gemini-2',
    name: 'Gemini 2.0 Pro',
    provider: 'Google',
    logo: '🔵',
    category: 'LLM',
    verified: true,
    performance: { accuracy: 0.89, latency: 520, throughput: 75 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Opt-in', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    costPerMToken: 1.25,
    trendData: [70, 73, 75, 78, 80, 83, 86, 89],
    policyUrl: 'https://policies.google.com/privacy',
    lastUpdated: '2026-03-18',
  },
  {
    id: 'llama-3.3',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    logo: '🦙',
    category: 'LLM',
    verified: false,
    performance: { accuracy: 0.86, latency: 600, throughput: 65 },
    trust: { dataSovereignty: 'Global', trainingPrivacy: 'Never', sso: false, soc2: false, hipaa: false, encryptionAtRest: false },
    costPerMToken: 0.59,
    trendData: [65, 68, 72, 74, 76, 80, 83, 86],
    policyUrl: 'https://llama.meta.com/use-policy/',
    lastUpdated: '2026-02-28',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large 2',
    provider: 'Mistral AI',
    logo: '🌀',
    category: 'LLM',
    verified: true,
    performance: { accuracy: 0.88, latency: 480, throughput: 78 },
    trust: { dataSovereignty: 'EU', trainingPrivacy: 'Never', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    costPerMToken: 2.0,
    trendData: [72, 75, 77, 80, 82, 84, 86, 88],
    policyUrl: 'https://mistral.ai/terms/',
    lastUpdated: '2026-03-10',
  },
  {
    id: 'cohere-command',
    name: 'Command R+',
    provider: 'Cohere',
    logo: '🔶',
    category: 'LLM',
    verified: true,
    performance: { accuracy: 0.84, latency: 550, throughput: 70 },
    trust: { dataSovereignty: 'US', trainingPrivacy: 'Opt-out', sso: true, soc2: true, hipaa: false, encryptionAtRest: true },
    costPerMToken: 1.5,
    trendData: [68, 70, 72, 75, 78, 80, 82, 84],
    policyUrl: 'https://cohere.com/privacy',
    lastUpdated: '2026-03-05',
  },
];

export const alerts = [
  { id: 1, type: 'warning' as const, message: '⚠️ OpenAI updated Privacy Policy — Score dropping for EU Profiles', time: '2h ago' },
  { id: 2, type: 'danger' as const, message: '🔴 Gemini data processing moved to US region — Sovereignty impact', time: '5h ago' },
  { id: 3, type: 'safe' as const, message: '✅ Mistral AI achieved EU Data Residency certification', time: '1d ago' },
  { id: 4, type: 'warning' as const, message: '⚠️ Meta Llama license terms updated — Review required', time: '2d ago' },
  { id: 5, type: 'safe' as const, message: '✅ Anthropic passed SOC2 Type II annual audit', time: '3d ago' },
];
