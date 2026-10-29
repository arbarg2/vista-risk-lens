import type { AITool } from '@/data/tools';
import { dependencyExposure, getEnrichment } from '@/data/enrichment';
import type { ApprovalStatus, ThreatItem, ToolScore } from './posture';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

interface Ctx { score: ToolScore; status: ApprovalStatus; profile: string; threats: ThreatItem[] }

/** CycloneDX 1.6 JSON with a machine-learning-model component + modelCard. */
export function buildCycloneDX(tool: AITool, ctx: Ctx) {
  const en = getEnrichment(tool.id);
  const exposure = dependencyExposure(tool);
  const deps = Object.entries(exposure).filter(([, v]) => (v ?? 0) >= 0.2).map(([pkg]) => pkg);
  const ref = `model-${slug(tool.id)}`;
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: `urn:uuid:${uuid()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: { components: [{ type: 'application', name: 'Vigilance AI', version: '2.4' }] },
      component: { type: 'machine-learning-model', 'bom-ref': ref, name: tool.name },
      properties: [
        { name: 'vigilance:complianceProfile', value: ctx.profile },
        { name: 'vigilance:approvalStatus', value: ctx.status },
        { name: 'vigilance:postureScore', value: String(ctx.score.total) },
        { name: 'vigilance:trustScore', value: String(ctx.score.trustScore) },
        { name: 'vigilance:liveCvePenalty', value: String(ctx.score.cvePenalty) },
      ],
    },
    components: [
      {
        type: 'machine-learning-model',
        'bom-ref': ref,
        name: tool.name,
        supplier: { name: tool.provider },
        publisher: tool.provider,
        description: `${tool.category} — base model ${en.baseModel}`,
        licenses: [{ license: { name: en.license } }],
        externalReferences: [{ type: 'documentation', url: tool.policyUrl, comment: 'Vendor privacy / data-usage policy (source of truth)' }],
        modelCard: {
          modelParameters: { task: tool.category, architectureFamily: en.baseModel },
          quantitativeAnalysis: {
            performanceMetrics: [
              { type: 'accuracy', value: String(tool.performance.accuracy) },
              { type: 'latency_ms', value: String(tool.performance.latency) },
              { type: 'throughput_tps', value: String(tool.performance.throughput) },
            ],
          },
          considerations: {
            ethicalConsiderations: [
              { name: 'Training on customer data', mitigationStrategy: tool.trust.trainingPrivacy },
              { name: 'Data sovereignty', mitigationStrategy: tool.trust.dataSovereignty },
            ],
          },
        },
        properties: [
          { name: 'aibom:hostingProvider', value: en.hosting },
          { name: 'aibom:dataRetentionDays', value: String(en.retentionDays) },
          { name: 'aibom:ipIndemnification', value: String(en.ipIndemnification) },
          { name: 'aibom:openWeights', value: String(en.openWeights) },
          { name: 'aibom:aiContentTransparency', value: String(en.transparency) },
          { name: 'security:sso', value: String(tool.trust.sso) },
          { name: 'security:soc2', value: String(tool.trust.soc2) },
          { name: 'security:hipaa', value: String(tool.trust.hipaa) },
          { name: 'security:encryptionAtRest', value: String(tool.trust.encryptionAtRest) },
          { name: 'owasp-llm:LLM01-promptInjectionResistance', value: String(en.owasp.promptInjection) },
          { name: 'owasp-llm:LLM09-overrelianceSafeguards', value: String(en.owasp.overreliance) },
          { name: 'owasp-llm:LLM03-modelProvenance', value: String(en.owasp.provenance) },
        ],
      },
      ...deps.map((pkg) => ({ type: 'library', 'bom-ref': `lib-${pkg}`, name: pkg, purl: pkg === 'ollama' ? 'pkg:golang/github.com/ollama/ollama' : `pkg:pypi/${pkg === 'pytorch' ? 'torch' : pkg}` })),
    ],
    dependencies: [{ ref, dependsOn: deps.map((p) => `lib-${p}`) }],
    vulnerabilities: ctx.threats.slice(0, 25).map((t) => ({
      id: t.id,
      source: { name: t.source, url: t.url },
      ratings: [{ score: t.score, severity: t.severity.toLowerCase(), method: 'CVSSv3' }],
      description: t.summary,
      published: t.published,
      affects: [{ ref: `lib-${t.pkg}` }],
    })),
  };
}

/** SPDX 2.3 JSON document describing the model package. */
export function buildSPDX(tool: AITool, ctx: Ctx) {
  const en = getEnrichment(tool.id);
  const deps = Object.entries(dependencyExposure(tool)).filter(([, v]) => (v ?? 0) >= 0.2).map(([pkg]) => pkg);
  const modelId = `SPDXRef-Model-${slug(tool.id)}`;
  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `AIBOM-${tool.name}`,
    documentNamespace: `https://vigilance.ai/spdx/${slug(tool.id)}-${uuid()}`,
    creationInfo: { created: new Date().toISOString(), creators: ['Tool: Vigilance AI-2.4', `Organization: ${tool.provider}`] },
    packages: [
      {
        SPDXID: modelId,
        name: tool.name,
        supplier: `Organization: ${tool.provider}`,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: 'NOASSERTION',
        licenseDeclared: 'NOASSERTION',
        licenseComments: en.license,
        primaryPackagePurpose: 'OTHER',
        homepage: tool.policyUrl,
        description: `${tool.category} model/service. Base model: ${en.baseModel}. Hosting: ${en.hosting}. Retention: ${en.retentionDays}d. IP indemnification: ${en.ipIndemnification ? 'yes' : 'no'}. Open weights: ${en.openWeights ? 'yes' : 'no'}.`,
        annotations: [
          {
            annotationType: 'REVIEW',
            annotator: 'Tool: Vigilance AI',
            annotationDate: new Date().toISOString(),
            comment: `profile=${ctx.profile}; status=${ctx.status}; posture=${ctx.score.total}; trust=${ctx.score.trustScore}; cvePenalty=${ctx.score.cvePenalty}; owasp=${ctx.score.owaspScore}`,
          },
        ],
      },
      ...deps.map((pkg) => ({
        SPDXID: `SPDXRef-Lib-${pkg}`,
        name: pkg,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        externalRefs: [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: pkg === 'ollama' ? 'pkg:golang/github.com/ollama/ollama' : `pkg:pypi/${pkg === 'pytorch' ? 'torch' : pkg}` }],
      })),
    ],
    relationships: [
      { spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: modelId },
      ...deps.map((pkg) => ({ spdxElementId: modelId, relationshipType: 'DEPENDS_ON', relatedSpdxElement: `SPDXRef-Lib-${pkg}` })),
    ],
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAIBOM(format: 'cyclonedx' | 'spdx', tool: AITool, ctx: Ctx) {
  const data = format === 'cyclonedx' ? buildCycloneDX(tool, ctx) : buildSPDX(tool, ctx);
  downloadJson(`${slug(tool.id)}.${format === 'cyclonedx' ? 'cdx' : 'spdx'}.json`, data);
}
