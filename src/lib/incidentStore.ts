import { supabase } from '@/integrations/supabase/client';
import { Incident } from '@/data/tools';

export interface RemediationRecord {
  id: string;
  created_at: string;
  incident_id: string;
  action: string;
  operator: string;
  notes: string | null;
}

interface IncidentRow {
  id: string;
  created_at: string;
  incident_code: string;
  tool_id: string;
  tool_name: string;
  user_label: string;
  department: string | null;
  action: string;
  severity: string;
  profile: string;
  resolved: boolean;
}

function rowToIncident(r: IncidentRow): Incident & { dbId: string } {
  return {
    id: r.incident_code,
    dbId: r.id,
    timestamp: new Date(r.created_at).getTime(),
    toolId: r.tool_id,
    toolName: r.tool_name,
    user: r.user_label,
    department: r.department ?? '',
    action: r.action,
    severity: r.severity as Incident['severity'],
  };
}

export async function persistIncident(inc: Incident, profile: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      incident_code: inc.id,
      tool_id: inc.toolId,
      tool_name: inc.toolName,
      user_label: inc.user,
      department: inc.department,
      action: inc.action,
      severity: inc.severity,
      profile,
    })
    .select('id')
    .single();
  if (error) {
    console.warn('[incidentStore] insert failed', error);
    return null;
  }
  return data?.id ?? null;
}

export async function fetchRecentIncidents(limit = 50): Promise<(Incident & { dbId: string })[]> {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[incidentStore] fetch failed', error);
    return [];
  }
  return (data as IncidentRow[]).map(rowToIncident);
}

export function subscribeIncidents(onInsert: (inc: Incident & { dbId: string }) => void) {
  const channel = supabase
    .channel('incidents-stream')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'incidents' },
      (payload) => onInsert(rowToIncident(payload.new as IncidentRow))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function logRemediation(
  incidentDbId: string,
  action: 'block' | 'justify' | 'redirect',
  notes: string
): Promise<void> {
  const { error } = await supabase.from('remediation_actions').insert({
    incident_id: incidentDbId,
    action,
    notes,
  });
  if (error) console.warn('[incidentStore] remediation insert failed', error);
  await supabase.from('incidents').update({ resolved: true }).eq('id', incidentDbId);
}

export async function fetchAuditTrail(limit = 100): Promise<RemediationRecord[]> {
  const { data, error } = await supabase
    .from('remediation_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[incidentStore] audit fetch failed', error);
    return [];
  }
  return data as RemediationRecord[];
}
