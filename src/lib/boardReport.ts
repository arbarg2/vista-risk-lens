import { jsPDF } from 'jspdf';
import type { AITool, ComplianceProfile } from '@/data/tools';
import { PROFILE_LABELS, readinessLabel, type ApprovalStatus, type Readiness, type ThreatItem, type ToolScore } from './posture';

export interface BoardReportInput {
  tools: AITool[];
  statuses: Record<string, ApprovalStatus>;
  scores: Record<string, ToolScore>;
  profile: ComplianceProfile;
  posture: { score: number; grade: string; count: number } | null;
  readiness: Readiness;
  threats: ThreatItem[];
  openIncidents: number;
  totalIncidents: number;
  customWeights: boolean;
}

// PDF palette (RGB) mirrors the app's design tokens
type RGB = [number, number, number];
const C: Record<'bg' | 'ink' | 'muted' | 'safe' | 'warn' | 'danger' | 'dark', RGB> = {
  bg: [12, 18, 32],
  ink: [226, 232, 240],
  muted: [120, 135, 160],
  safe: [16, 185, 129],
  warn: [245, 158, 11],
  danger: [220, 38, 38],
  dark: [30, 41, 59],
};

const toneFor = (n: number): RGB => (n >= 80 ? C.safe : n >= 50 ? C.warn : C.danger);

export function buildExecutiveSummary(i: BoardReportInput): string {
  const approved = i.tools.filter((t) => i.statuses[t.id] === 'approved');
  const review = i.tools.filter((t) => i.statuses[t.id] === 'review');
  const banned = i.tools.filter((t) => i.statuses[t.id] === 'banned');
  const top = [...approved].sort((a, b) => i.scores[b.id].total - i.scores[a.id].total).slice(0, 5);
  const crit = i.threats.filter((t) => t.score >= 9).length;
  return [
    `# VigilAI — Board AI Risk Posture`,
    `Generated ${new Date().toLocaleString()} · Profile: ${PROFILE_LABELS[i.profile]}${i.customWeights ? ' (custom policy weights)' : ''}`,
    ``,
    `## Approved Posture: ${i.posture ? `${i.posture.grade} (${i.posture.score}/100)` : 'N/A — no approved tools'}`,
    `- Monitored tools: ${i.tools.length}`,
    `- Approved: ${approved.length} · Under review: ${review.length} · Banned: ${banned.length}`,
    `- Live advisories ingested (NVD + OSV): ${i.threats.length} (${crit} critical)`,
    `- Shadow-AI incidents: ${i.totalIncidents} (${i.openIncidents} open)`,
    ``,
    `## Regulatory readiness (heuristic)`,
    `- EU AI Act Art. 50 transparency: ${i.readiness.euAiActArt50}% — ${readinessLabel(i.readiness.euAiActArt50)}`,
    `- NIST AI RMF overall: ${i.readiness.nist.overall}% (Govern ${i.readiness.nist.govern}%, Map ${i.readiness.nist.map}%, Measure ${i.readiness.nist.measure}%, Manage ${i.readiness.nist.manage}%)`,
    ``,
    `## Top approved tools`,
    ...top.map((t) => `- ${t.name} (${t.provider}) — ${i.scores[t.id].total}/100`),
    ``,
    `## Banned`,
    ...(banned.length ? banned.map((t) => `- ${t.name} (${t.provider})`) : ['- None']),
    ``,
    `_Readiness figures are directional heuristics, not legal advice._`,
  ].join('\n');
}

export function downloadBoardPdf(i: BoardReportInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const paintBg = () => { doc.setFillColor(...C.bg); doc.rect(0, 0, W, H, 'F'); };
  paintBg();

  // Header
  doc.setTextColor(...C.safe); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('VigilAI', M, 56);
  doc.setTextColor(...C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Board-Ready AI Risk Posture · ${PROFILE_LABELS[i.profile]}${i.customWeights ? ' (custom weights)' : ''} · ${new Date().toLocaleDateString()}`, M, 74);

  // Grade card
  const g = i.posture;
  const tone: RGB = g ? toneFor(g.score) : C.muted;
  doc.setFillColor(...C.dark); doc.roundedRect(M, 96, W - M * 2, 120, 10, 10, 'F');
  doc.setDrawColor(...tone); doc.setLineWidth(2); doc.roundedRect(M + 18, 114, 84, 84, 10, 10, 'S');
  doc.setTextColor(...tone); doc.setFont('helvetica', 'bold'); doc.setFontSize(48);
  doc.text(g ? g.grade : '–', M + 60, 172, { align: 'center' });
  doc.setTextColor(...C.ink); doc.setFontSize(16);
  doc.text(`Approved Posture ${g ? `${g.score}/100` : 'N/A'}`, M + 124, 136);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C.muted);
  const approved = i.tools.filter((t) => i.statuses[t.id] === 'approved');
  const review = i.tools.filter((t) => i.statuses[t.id] === 'review');
  const banned = i.tools.filter((t) => i.statuses[t.id] === 'banned');
  doc.text(`${i.tools.length} monitored · ${approved.length} approved · ${review.length} under review · ${banned.length} banned`, M + 124, 156);
  doc.text(`${i.threats.length} live advisories (NVD + OSV) · ${i.openIncidents} open Shadow-AI incidents`, M + 124, 172);
  doc.text('Average of approved catalog only. A 90+ · B 80-89 · C 70-79 · D <70', M + 124, 188);

  // Readiness
  let y = 248;
  doc.setTextColor(...C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Regulatory Readiness', M, y); y += 16;
  const bars: [string, number][] = [
    ['EU AI Act Art. 50 — Transparency', i.readiness.euAiActArt50],
    ['NIST AI RMF — Govern', i.readiness.nist.govern],
    ['NIST AI RMF — Map', i.readiness.nist.map],
    ['NIST AI RMF — Measure', i.readiness.nist.measure],
    ['NIST AI RMF — Manage', i.readiness.nist.manage],
  ];
  doc.setFontSize(9);
  for (const [label, v] of bars) {
    y += 18;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted); doc.text(label, M, y);
    doc.setFillColor(...C.dark); doc.roundedRect(M + 200, y - 7, 240, 8, 4, 4, 'F');
    doc.setFillColor(...toneFor(v)); doc.roundedRect(M + 200, y - 7, Math.max(4, 2.4 * v), 8, 4, 4, 'F');
    doc.setTextColor(...C.ink); doc.text(`${v}%  ${readinessLabel(v)}`, M + 452, y);
  }

  // Approved catalog table
  y += 34;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.ink);
  doc.text('Approved Catalog', M, y); y += 8;
  const cols = [M, M + 200, M + 300, M + 350, M + 400, M + 450];
  const header = ['Tool', 'Provider', 'Score', 'Trust', 'CVE −', 'Grade'];
  y += 16; doc.setFontSize(8); doc.setTextColor(...C.muted);
  header.forEach((h, k) => doc.text(h.toUpperCase(), cols[k], y));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const rows = [...approved].sort((a, b) => i.scores[b.id].total - i.scores[a.id].total);
  for (const t of rows) {
    y += 15;
    if (y > H - 60) { doc.addPage(); paintBg(); y = 60; }
    const s = i.scores[t.id];
    doc.setTextColor(...C.ink); doc.text(t.name.slice(0, 34), cols[0], y);
    doc.setTextColor(...C.muted); doc.text(t.provider.slice(0, 18), cols[1], y);
    doc.setTextColor(...toneFor(s.total)); doc.text(String(s.total), cols[2], y);
    doc.setTextColor(...C.ink); doc.text(String(s.trustScore), cols[3], y);
    doc.setTextColor(...(s.cvePenalty > 0 ? C.danger : C.muted)); doc.text(s.cvePenalty ? `-${s.cvePenalty}` : '0', cols[4], y);
    doc.setTextColor(...C.ink); doc.text(s.total >= 90 ? 'A' : s.total >= 80 ? 'B' : s.total >= 70 ? 'C' : 'D', cols[5], y);
  }

  // Banned + critical CVEs
  y += 30;
  if (y > H - 120) { doc.addPage(); paintBg(); y = 60; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.danger);
  doc.text('Banned Tools', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.ink);
  y += 16; doc.text(banned.length ? banned.map((t) => t.name).join(', ') : 'None', M, y, { maxWidth: W - M * 2 });

  const crit = [...i.threats].sort((a, b) => b.score - a.score).slice(0, 8);
  if (crit.length) {
    y += 30;
    if (y > H - 160) { doc.addPage(); paintBg(); y = 60; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.warn);
    doc.text('Highest-Severity Live Advisories', M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const t of crit) {
      y += 14;
      if (y > H - 50) { doc.addPage(); paintBg(); y = 60; }
      doc.setTextColor(...toneFor(100 - t.score * 10));
      doc.text(`${t.id}  CVSS ${t.score.toFixed(1)}  [${t.pkg}]`, M, y);
      doc.setTextColor(...C.muted);
      doc.text(t.summary.slice(0, 70), M + 210, y);
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text('VigilAI · Readiness figures are directional heuristics, not legal advice · Sources: vendor policies, NVD, OSV.dev', M, H - 24);
    doc.text(`${p}/${pages}`, W - M, H - 24, { align: 'right' });
  }

  doc.save(`vigilance-board-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
