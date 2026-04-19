
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  incident_code TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  user_label TEXT NOT NULL,
  department TEXT,
  action TEXT NOT NULL,
  severity TEXT NOT NULL,
  profile TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_incidents_created_at ON public.incidents(created_at DESC);

CREATE TABLE public.remediation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'demo-operator',
  notes TEXT
);

CREATE INDEX idx_remediation_incident ON public.remediation_actions(incident_id);

CREATE TABLE public.tool_overrides (
  tool_id TEXT NOT NULL PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'lovable-ai'
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_overrides ENABLE ROW LEVEL SECURITY;

-- Public demo policies (no auth)
CREATE POLICY "Public read incidents" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Public insert incidents" ON public.incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update incidents" ON public.incidents FOR UPDATE USING (true);

CREATE POLICY "Public read remediation" ON public.remediation_actions FOR SELECT USING (true);
CREATE POLICY "Public insert remediation" ON public.remediation_actions FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read overrides" ON public.tool_overrides FOR SELECT USING (true);
CREATE POLICY "Public upsert overrides" ON public.tool_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update overrides" ON public.tool_overrides FOR UPDATE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.remediation_actions;
