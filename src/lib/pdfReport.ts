import jsPDF from 'jspdf';
import { AITool, ComplianceProfile, calcScore, getLetterGrade, calcOwaspScore } from '@/data/tools';

export function generateBoardReport(tools: AITool[], profile: ComplianceProfile) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  // Org-wide score = avg of top 10 most-used (here, top 10 by score)
  const sorted = [...tools].sort((a, b) => calcScore(b, profile).total - calcScore(a, profile).total);
  const orgScore = Math.round(sorted.slice(0, 10).reduce((s, t) => s + calcScore(t, profile).total, 0) / Math.min(10, sorted.length));
  const grade = getLetterGrade(orgScore);

  // ── Cover ─────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // bg-background
  doc.rect(0, 0, W, H, 'F');

  // Top accent bar
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 6, 'F');

  // Brand
  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VIGILANCE AI · AI-SPM PLATFORM', M, 64);

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(28);
  doc.text('AI Risk Posture Report', M, 110);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text(`Compliance Profile: ${profile.replace('-', ' ').toUpperCase()}`, M, 132);
  doc.text(`Generated: ${new Date().toLocaleString()}`, M, 148);
  doc.text(`Models evaluated: ${tools.length}`, M, 164);

  // Letter grade box
  const gradeColor: Record<string, [number, number, number]> = {
    safe: [16, 185, 129],
    warning: [245, 158, 11],
    danger: [239, 68, 68],
  };
  const [r, g, b] = gradeColor[grade.color] ?? [16, 185, 129];
  doc.setFillColor(r, g, b);
  doc.roundedRect(W - M - 200, 90, 200, 130, 12, 12, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.text(grade.grade, W - M - 100, 175, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`SCORE: ${orgScore}/100`, W - M - 100, 200, { align: 'center' });

  // Executive summary
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Executive Summary', M, 260);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  const safe = sorted.filter((t) => calcScore(t, profile).total >= 75).length;
  const risky = sorted.filter((t) => calcScore(t, profile).total < 50).length;
  const summary = [
    `Your organization's AI portfolio scores ${orgScore}/100 (Grade ${grade.grade}) under the ${profile.replace('-', ' ')} compliance profile.`,
    `${safe} of ${tools.length} models meet the safe-zone threshold (>=75).`,
    `${risky} models fall into the high-risk band (<50) and require immediate review.`,
    `Top OWASP exposures: prompt injection in unverified models; supply-chain risk in open-weight deployments.`,
  ];
  let y = 280;
  summary.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, W - M * 2);
    doc.text(wrapped, M, y);
    y += wrapped.length * 14 + 4;
  });

  // ── Top risks table ───────────────────────────────────
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(226, 232, 240);
  doc.text('Top 10 Risk-Adjusted Models', M, y);
  y += 18;

  // Header row
  doc.setFillColor(30, 41, 59);
  doc.rect(M, y - 12, W - M * 2, 18, 'F');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.text('#', M + 6, y);
  doc.text('MODEL', M + 28, y);
  doc.text('PROVIDER', M + 180, y);
  doc.text('SCORE', M + 280, y, { align: 'center' });
  doc.text('PERF', M + 330, y, { align: 'center' });
  doc.text('TRUST', M + 380, y, { align: 'center' });
  doc.text('OWASP', M + 430, y, { align: 'center' });
  doc.text('SOV', M + 475, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  sorted.slice(0, 10).forEach((t, i) => {
    y += 18;
    if (i % 2 === 0) {
      doc.setFillColor(22, 32, 52);
      doc.rect(M, y - 12, W - M * 2, 18, 'F');
    }
    const s = calcScore(t, profile);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text(String(i + 1), M + 6, y);
    doc.setTextColor(226, 232, 240);
    doc.text(t.name.substring(0, 28), M + 28, y);
    doc.setTextColor(148, 163, 184);
    doc.text(t.provider.substring(0, 18), M + 180, y);

    // Score colored
    const sc = s.total >= 75 ? [16, 185, 129] : s.total >= 50 ? [245, 158, 11] : [239, 68, 68];
    doc.setTextColor(sc[0], sc[1], sc[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(String(s.total), M + 280, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(String(s.perfScore), M + 330, y, { align: 'center' });
    doc.text(String(s.trustScore), M + 380, y, { align: 'center' });
    doc.text(String(s.owaspScore), M + 430, y, { align: 'center' });
    doc.text(t.trust.dataSovereignty, M + 475, y, { align: 'center' });
  });

  // ── Risk breakdown page ───────────────────────────────
  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 6, 'F');

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('High-Risk Models — Action Required', M, 60);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Models scoring below 50 under ${profile} profile.`, M, 80);

  const high = sorted.filter((t) => calcScore(t, profile).total < 50);
  y = 110;
  if (high.length === 0) {
    doc.setTextColor(16, 185, 129);
    doc.text('✓ No high-risk models detected. Posture is strong.', M, y);
  } else {
    high.slice(0, 12).forEach((t) => {
      const s = calcScore(t, profile);
      const owasp = calcOwaspScore(t.owasp);
      doc.setFillColor(40, 20, 24);
      doc.roundedRect(M, y - 14, W - M * 2, 56, 6, 6, 'F');
      doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${t.name}  ·  ${t.provider}`, M + 12, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`Score: ${s.total}  ·  OWASP: ${owasp}  ·  Sovereignty: ${t.trust.dataSovereignty}  ·  Training: ${t.trust.trainingPrivacy}`, M + 12, y + 14);
      doc.setTextColor(148, 163, 184);
      doc.text(`AIBOM: ${t.aibom.baseModel} on ${t.aibom.hostingProvider} (${t.aibom.region}) · Retention ${t.aibom.dataRetentionDays}d · IP indemnity: ${t.aibom.ipIndemnification ? 'yes' : 'no'}`, M + 12, y + 28);
      y += 64;
      if (y > H - 80) {
        doc.addPage();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, W, H, 'F');
        y = 60;
      }
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Vigilance AI — Confidential · Board-Ready Risk Report`, M, H - 24);
    doc.text(`Page ${i} / ${pageCount}`, W - M, H - 24, { align: 'right' });
  }

  doc.save(`vigilance-ai-risk-report-${profile}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
