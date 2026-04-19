import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  toolId: string;
  toolName: string;
  provider: string;
  policyUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { toolId, toolName, provider, policyUrl } = (await req.json()) as Body;
    if (!toolId || !toolName) {
      return new Response(JSON.stringify({ error: "toolId and toolName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are an AI compliance auditor. Given an AI tool name and provider, return your best estimate of its current trust signals based on publicly known information as of your training data. Be conservative — if unsure, mark unknown rather than guess.`;

    const userPrompt = `Tool: ${toolName}
Provider: ${provider}
Policy URL: ${policyUrl ?? "unknown"}

Return updated trust signals for this AI tool.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_trust_signals",
              description: "Report current trust signals for an AI tool",
              parameters: {
                type: "object",
                properties: {
                  trainingPrivacy: { type: "string", enum: ["Never", "Opt-out", "Opt-in", "Unknown"] },
                  soc2: { type: "boolean", description: "Has SOC2 Type II attestation" },
                  euHosting: { type: "boolean", description: "Offers EU data residency" },
                  ipIndemnification: { type: "boolean", description: "Provides IP indemnity for outputs" },
                  dataRetentionDays: { type: "number", description: "Default data retention in days, 0 = none" },
                  summary: { type: "string", description: "1-sentence summary of recent policy changes" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["trainingPrivacy", "soc2", "euHosting", "ipIndemnification", "dataRetentionDays", "summary", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_trust_signals" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Lovable AI credits exhausted. Add funds in Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No structured response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(toolCall.function.arguments);

    // Persist to tool_overrides
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    await supabase.from("tool_overrides").upsert({
      tool_id: toolId,
      data,
      updated_at: new Date().toISOString(),
      source: "lovable-ai-gemini-2.5-flash",
    });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("refresh-tool-trust error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
