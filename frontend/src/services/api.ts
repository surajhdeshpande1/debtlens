import axios from 'axios';
import {
  Incident,
  CauseNode,
  CausalGraphData,
  DebtItem,
  RemediationPlan,
  WhatIfScenario,
  SimilarIncidentMatch,
  RootCauseCluster,
  RegressionItem,
  HotspotItem,
  SelfAdmittedDebtItem,
  ExecutiveDashboardSummary,
  Project,
  Organization
} from '../types';
import { mockEngine } from './mockEngine';
import { supabase, isSupabaseConfigured } from './supabase';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 1500, // Fast failover to Supabase or client-side engine if local backend is offline
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('debtlens_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper for safe execution with automatic fallback chain:
// 1. Supabase (if configured) -> 2. Local FastAPI -> 3. Client-Side Mock Engine
async function withFallback<T>(
  apiCall: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  supabaseCall?: () => Promise<T | null>
): Promise<T> {
  // If Supabase is configured and a Supabase handler is supplied, prioritize Supabase!
  if (isSupabaseConfigured && supabase && supabaseCall) {
    try {
      const supaResult = await supabaseCall();
      if (supaResult !== null && supaResult !== undefined) {
        return supaResult;
      }
    } catch (err) {
      console.warn('Supabase request failed, trying next provider:', err);
    }
  }

  // Next try local/remote FastAPI backend
  try {
    return await apiCall();
  } catch (err) {
    // Graceful fallback to client-side FinTech engine
    return await fallbackFn();
  }
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/auth/login', { email, password });
        return res.data;
      },
      async () => ({
        access_token: 'demo-jwt-token-sample',
        token_type: 'bearer',
        role: email.includes('admin') ? 'admin' : email.includes('lead') ? 'tech_lead' : 'developer',
        full_name: 'Suraj Deshpande (Demo)',
        email,
        organization_id: 1,
        project_id: 1
      })
    );
  },
  getMe: async () => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/auth/me');
        return res.data;
      },
      async () => ({
        id: 1,
        email: 'admin@debtlens.io',
        full_name: 'Suraj Deshpande (Admin)',
        role: 'admin',
        organization_id: 1,
        created_at: new Date().toISOString()
      })
    );
  },
  getUsers: async () => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/auth/users');
        return res.data;
      },
      async () => [
        { id: 1, email: 'admin@debtlens.io', full_name: 'Suraj Deshpande (Admin)', role: 'admin' },
        { id: 2, email: 'lead@debtlens.io', full_name: 'Sushma Hiremath (Tech Lead)', role: 'tech_lead' },
        { id: 3, email: 'dev@debtlens.io', full_name: 'Sushma Patil (Developer)', role: 'developer' },
        { id: 4, email: 'viewer@debtlens.io', full_name: 'Sushma Mathapati (Viewer)', role: 'viewer' }
      ]
    );
  },

  // Workspace
  getOrganizations: async (): Promise<Organization[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/workspace/organizations');
        return res.data;
      },
      () => mockEngine.getOrganizations(),
      async () => {
        if (!supabase) return null;
        const { data, error } = await supabase.from('organizations').select('*');
        if (!error && data && data.length > 0) return data as Organization[];
        return null;
      }
    );
  },
  getProjects: async (orgId?: number): Promise<Project[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/workspace/projects', { params: { org_id: orgId } });
        return res.data;
      },
      () => mockEngine.getProjects(),
      async () => {
        if (!supabase) return null;
        let q = supabase.from('projects').select('*');
        if (orgId) q = q.eq('organization_id', orgId);
        const { data, error } = await q;
        if (!error && data && data.length > 0) return data as Project[];
        return null;
      }
    );
  },
  getProjectMembers: async (projectId: number) => {
    return withFallback(
      async () => {
        const res = await apiClient.get(`/workspace/projects/${projectId}/members`);
        return res.data;
      },
      async () => [
        { user_id: 1, full_name: 'Suraj Deshpande', role: 'admin' },
        { user_id: 2, full_name: 'Sushma Hiremath', role: 'tech_lead' },
        { user_id: 3, full_name: 'Sushma Patil', role: 'developer' },
        { user_id: 4, full_name: 'Sushma Mathapati', role: 'viewer' }
      ]
    );
  },

  // Incidents
  getIncidents: async (projectId: number, params?: { status?: string; severity?: string; module?: string; search?: string }): Promise<Incident[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/incidents', { params: { project_id: projectId, ...params } });
        return res.data;
      },
      () => mockEngine.getIncidents(projectId, params),
      async () => {
        if (!supabase) return null;
        let query = supabase.from('incidents').select('*').eq('project_id', projectId);
        if (params?.status && params.status !== 'ALL') query = query.eq('status', params.status.toUpperCase());
        if (params?.severity && params.severity !== 'ALL') query = query.eq('severity', params.severity.toUpperCase());
        if (params?.module && params.module !== 'ALL') query = query.eq('affected_module', params.module.toLowerCase());
        const { data, error } = await query.order('reported_at', { ascending: false });
        if (!error && data && data.length > 0) return data as Incident[];
        return null;
      }
    );
  },
  getIncidentDetail: async (incidentId: number) => {
    return withFallback(
      async () => {
        const res = await apiClient.get(`/incidents/${incidentId}`);
        return res.data;
      },
      () => mockEngine.getIncidentDetail(incidentId),
      async () => {
        if (!supabase) return null;
        const { data, error } = await supabase.from('incidents').select('*').eq('id', incidentId).single();
        if (!error && data) {
          const linksRes = await supabase.from('incident_causal_links').select('step_number, cause_node_id').eq('incident_id', incidentId);
          return {
            ...data,
            linked_causes: linksRes.data || [],
            linked_debt_ids: [1, 2],
            is_regression: data.incident_number === 'INC-105',
            regressed_from_id: data.incident_number === 'INC-105' ? 1 : null
          };
        }
        return null;
      }
    );
  },
  createIncident: async (data: any): Promise<Incident> => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/incidents', data);
        return res.data;
      },
      () => mockEngine.createIncident(data),
      async () => {
        if (!supabase) return null;
        const { count } = await supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('project_id', data.project_id || 1);
        const incNum = `INC-${101 + (count || 0)}`;
        const newInc = {
          project_id: data.project_id || 1,
          incident_number: incNum,
          title: data.title,
          description: data.description,
          severity: (data.severity || 'MEDIUM').toUpperCase(),
          status: 'OPEN',
          affected_module: (data.affected_module || 'payments').toLowerCase(),
          affected_component: data.affected_component || 'Core Engine',
          reported_by: data.reported_by || 'SRE Engineer',
          resolution_effort_hours: data.resolution_effort_hours || 4.0,
          reported_at: new Date().toISOString()
        };
        const { data: inserted, error } = await supabase.from('incidents').insert([newInc]).select().single();
        if (!error && inserted) return inserted as Incident;
        return null;
      }
    );
  },
  updateIncident: async (incidentId: number, data: Partial<Incident>): Promise<Incident> => {
    return withFallback(
      async () => {
        const res = await apiClient.patch(`/incidents/${incidentId}`, data);
        return res.data;
      },
      () => mockEngine.updateIncident(incidentId, data),
      async () => {
        if (!supabase) return null;
        const payload = {
          ...data,
          resolved_at: data.status === 'RESOLVED' ? new Date().toISOString() : undefined
        };
        const { data: updated, error } = await supabase.from('incidents').update(payload).eq('id', incidentId).select().single();
        if (!error && updated) return updated as Incident;
        return null;
      }
    );
  },
  downloadIncidentsCsv: async (projectId: number) => {
    try {
      const res = await apiClient.get('/incidents/export/csv', {
        params: { project_id: projectId },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DebtLens_Incidents_Project_${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      const list = await mockEngine.getIncidents(projectId);
      const rows = [
        ['Incident ID', 'Title', 'Severity', 'Status', 'Module', 'Component', 'Effort (hrs)', 'Reported At'].join(',')
      ];
      list.forEach(i => {
        rows.push([i.incident_number, `"${i.title}"`, i.severity, i.status, i.affected_module, `"${i.affected_component || ''}"`, i.resolution_effort_hours, i.reported_at].join(','));
      });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DebtLens_Incidents_Project_${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  },

  // Causal
  getCausalGraph: async (projectId: number): Promise<CausalGraphData> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/causal/graph', { params: { project_id: projectId } });
        return res.data;
      },
      () => mockEngine.getCausalGraph(projectId),
      async () => {
        if (!supabase) return null;
        const [nRes, eRes] = await Promise.all([
          supabase.from('cause_nodes').select('*').eq('project_id', projectId),
          supabase.from('causal_edges').select('*').eq('project_id', projectId)
        ]);
        if (!nRes.error && nRes.data && nRes.data.length > 0) {
          const nodes = nRes.data.map((c: any) => ({
            data: {
              id: c.id.toString(),
              node_id: c.id,
              label: c.description,
              category: c.category,
              degree_centrality: c.degree_centrality,
              betweenness_centrality: c.betweenness_centrality,
              incident_count: c.incident_count || 1
            }
          }));
          const edges = (eRes.data || []).map((e: any) => ({
            data: {
              id: `e${e.id}`,
              source: e.source_cause_id.toString(),
              target: e.target_cause_id.toString(),
              relation: e.relation_type || 'caused_by',
              weight: e.frequency || 1
            }
          }));
          const systemic = [...nRes.data].sort((a: any, b: any) => b.betweenness_centrality - a.betweenness_centrality);
          return { nodes, edges, systemic_causes: systemic as CauseNode[] };
        }
        return null;
      }
    );
  },
  getCauseNodes: async (projectId: number): Promise<CauseNode[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/causal/nodes', { params: { project_id: projectId } });
        return res.data;
      },
      () => mockEngine.getCauseNodes(projectId),
      async () => {
        if (!supabase) return null;
        const { data, error } = await supabase.from('cause_nodes').select('*').eq('project_id', projectId);
        if (!error && data && data.length > 0) return data as CauseNode[];
        return null;
      }
    );
  },
  createCauseNode: async (projectId: number, description: string, category: string): Promise<CauseNode> => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/causal/nodes', { project_id: projectId, description, category });
        return res.data;
      },
      async () => ({
        id: Math.floor(Math.random() * 1000) + 10,
        project_id: projectId,
        description,
        normalized_text: description.toLowerCase(),
        category,
        degree_centrality: 0.1,
        betweenness_centrality: 0.05,
        created_at: new Date().toISOString(),
        incident_count: 1
      }),
      async () => {
        if (!supabase) return null;
        const node = {
          project_id: projectId,
          description,
          normalized_text: description.toLowerCase().trim(),
          category: category.toUpperCase(),
          degree_centrality: 0.1,
          betweenness_centrality: 0.05,
          incident_count: 1
        };
        const { data, error } = await supabase.from('cause_nodes').insert([node]).select().single();
        if (!error && data) return data as CauseNode;
        return null;
      }
    );
  },

  // Debt
  getDebtItems: async (projectId: number, params?: { status?: string; category?: string; break_even_only?: boolean }): Promise<DebtItem[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/debt', { params: { project_id: projectId, ...params } });
        return res.data;
      },
      () => mockEngine.getDebtItems(projectId, params),
      async () => {
        if (!supabase) return null;
        let query = supabase.from('debt_items').select('*').eq('project_id', projectId);
        if (params?.status && params.status !== 'ALL') query = query.eq('status', params.status.toUpperCase());
        if (params?.category && params.category !== 'ALL') query = query.eq('category', params.category.toUpperCase());
        if (params?.break_even_only) query = query.eq('break_even_status', true);
        const { data, error } = await query.order('risk_score', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            ...d,
            prerequisite_ids: d.prerequisite_ids || [],
            linked_incident_count: d.linked_incident_count || 1,
            age_days: Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000)
          })) as DebtItem[];
        }
        return null;
      }
    );
  },
  createDebtItem: async (data: any): Promise<DebtItem> => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/debt', data);
        return res.data;
      },
      () => mockEngine.createDebtItem(data),
      async () => {
        if (!supabase) return null;
        const { count } = await supabase.from('debt_items').select('*', { count: 'exact', head: true }).eq('project_id', data.project_id || 1);
        const debtKey = `DEBT-${101 + (count || 0)}`;
        const newDebt = {
          project_id: data.project_id || 1,
          debt_key: debtKey,
          title: data.title,
          description: data.description,
          category: (data.category || 'CODE_SMELL').toUpperCase(),
          module_name: (data.module_name || 'general').toLowerCase(),
          file_path: data.file_path,
          effort_principal: data.effort_principal || 8.0,
          accrued_interest: 0.0,
          break_even_status: false,
          risk_score: 5.5,
          status: 'IDENTIFIED',
          assignee: data.assignee || 'Unassigned',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data: inserted, error } = await supabase.from('debt_items').insert([newDebt]).select().single();
        if (!error && inserted) {
          return {
            ...inserted,
            prerequisite_ids: [],
            linked_incident_count: 0,
            age_days: 0
          } as DebtItem;
        }
        return null;
      }
    );
  },
  updateDebtItem: async (debtId: number, data: any): Promise<DebtItem> => {
    return withFallback(
      async () => {
        const res = await apiClient.patch(`/debt/${debtId}`, data);
        return res.data;
      },
      () => mockEngine.updateDebtItem(debtId, data),
      async () => {
        if (!supabase) return null;
        const { data: updated, error } = await supabase.from('debt_items').update(data).eq('id', debtId).select().single();
        if (!error && updated) {
          return {
            ...updated,
            prerequisite_ids: updated.prerequisite_ids || [],
            linked_incident_count: 1,
            age_days: Math.floor((Date.now() - new Date(updated.created_at).getTime()) / 86400000)
          } as DebtItem;
        }
        return null;
      }
    );
  },
  linkIncidentToDebt: async (debtId: number, incidentId: number) => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/debt/link-incident', null, { params: { debt_id: debtId, incident_id: incidentId } });
        return res.data;
      },
      async () => ({ message: 'Linked successfully', debt_id: debtId, incident_id: incidentId }),
      async () => {
        if (!supabase) return null;
        await supabase.from('debt_incident_links').insert([{ debt_id: debtId, incident_id: incidentId }]);
        return { message: 'Linked successfully in Supabase', debt_id: debtId, incident_id: incidentId };
      }
    );
  },
  downloadDebtCsv: async (projectId: number) => {
    try {
      const res = await apiClient.get('/debt/export/csv', {
        params: { project_id: projectId },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DebtLens_Debt_Ledger_Project_${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      const list = await mockEngine.getDebtItems(projectId);
      const rows = [
        ['Debt Key', 'Title', 'Category', 'Module', 'Principal Effort (hrs)', 'Accrued Interest (hrs)', 'Break-Even', 'Risk Score', 'Status'].join(',')
      ];
      list.forEach(d => {
        rows.push([d.debt_key, `"${d.title}"`, d.category, d.module_name, d.effort_principal, d.accrued_interest, d.break_even_status ? 'YES' : 'NO', d.risk_score, d.status].join(','));
      });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DebtLens_Debt_Ledger_Project_${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  },

  // Repository Evidence
  getHotspots: async (projectId: number): Promise<HotspotItem[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/repo/hotspots', { params: { project_id: projectId } });
        return res.data;
      },
      () => mockEngine.getHotspots(projectId),
      async () => {
        if (!supabase) return null;
        const { data, error } = await supabase.from('file_hotspots').select('*').eq('project_id', projectId).order('risk_score', { ascending: false });
        if (!error && data && data.length > 0) return data as HotspotItem[];
        return null;
      }
    );
  },
  getDependencies: async (projectId: number) => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/repo/dependencies', { params: { project_id: projectId } });
        return res.data;
      },
      () => mockEngine.getDependencies(projectId)
    );
  },
  getSATD: async (projectId: number, marker?: string): Promise<SelfAdmittedDebtItem[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/repo/satd', { params: { project_id: projectId, marker } });
        return res.data;
      },
      () => mockEngine.getSATD(projectId, marker),
      async () => {
        if (!supabase) return null;
        let q = supabase.from('self_admitted_debt').select('*').eq('project_id', projectId);
        if (marker && marker !== 'ALL') q = q.eq('marker_type', marker.toUpperCase());
        const { data, error } = await q;
        if (!error && data && data.length > 0) return data as SelfAdmittedDebtItem[];
        return null;
      }
    );
  },
  scanWorkspace: async (projectId: number, workspacePath?: string) => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/repo/scan-workspace', null, { params: { project_id: projectId, workspace_path: workspacePath } });
        return res.data;
      },
      async () => ({ message: 'Workspace scanned successfully', path: workspacePath || 'root' })
    );
  },
  analyzeSnippet: async (code: string, language: string = 'python') => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/repo/analyze-snippet', { code, language });
        return res.data;
      },
      () => mockEngine.analyzeSnippet(code, language)
    );
  },

  // Intelligence
  getSimilarIncidents: async (incidentId: number, threshold?: number, topK?: number): Promise<SimilarIncidentMatch[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/intelligence/similar-incidents', { params: { incident_id: incidentId, threshold, top_k: topK } });
        return res.data;
      },
      () => mockEngine.getSimilarIncidents(incidentId)
    );
  },
  comparePairwise: async (incidentAId: number, incidentBId: number, alpha: number = 0.55) => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/intelligence/compare-pairwise', {
          params: { incident_a_id: incidentAId, incident_b_id: incidentBId, alpha }
        });
        return res.data;
      },
      () => mockEngine.comparePairwise(incidentAId, incidentBId, alpha)
    );
  },
  getRootCauseClusters: async (projectId: number, eps?: number): Promise<RootCauseCluster[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/intelligence/clusters', { params: { project_id: projectId, eps } });
        return res.data;
      },
      () => mockEngine.getRootCauseClusters(projectId)
    );
  },
  getRegressions: async (projectId: number, tau?: number): Promise<RegressionItem[]> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/intelligence/regressions', { params: { project_id: projectId, tau } });
        return res.data;
      },
      () => mockEngine.getRegressions(projectId)
    );
  },

  // Optimiser & Ledger
  getOptimalPlan: async (projectId: number, sprintBudgetHours: number, allowedCategories?: string[], forceIncludeDebtIds?: number[]): Promise<RemediationPlan> => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/optimiser/plan', {
          project_id: projectId,
          sprint_budget_hours: sprintBudgetHours,
          allowed_categories: allowedCategories,
          force_include_debt_ids: forceIncludeDebtIds
        });
        return res.data;
      },
      () => mockEngine.getOptimalPlan(projectId, sprintBudgetHours, allowedCategories, forceIncludeDebtIds)
    );
  },
  simulateWhatIf: async (projectId: number, budgetScenarios?: number[]): Promise<{ scenarios: WhatIfScenario[] }> => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/optimiser/what-if', {
          project_id: projectId,
          budget_scenarios: budgetScenarios || [10, 20, 30, 40, 60, 80, 100, 120]
        });
        return res.data;
      },
      () => mockEngine.simulateWhatIf(projectId, budgetScenarios)
    );
  },
  getLedgerSummary: async (projectId: number) => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/optimiser/ledger-summary', { params: { project_id: projectId } });
        return res.data;
      },
      async () => {
        const sum = await mockEngine.getDashboardSummary(projectId);
        return {
          total_principal: sum.total_principal_effort,
          total_interest: sum.total_accrued_interest,
          break_even_count: sum.past_breakeven_count
        };
      }
    );
  },

  // Reporting
  getDashboardSummary: async (projectId: number): Promise<ExecutiveDashboardSummary> => {
    return withFallback(
      async () => {
        const res = await apiClient.get('/reporting/dashboard-summary', { params: { project_id: projectId } });
        return res.data;
      },
      () => mockEngine.getDashboardSummary(projectId)
    );
  },
  downloadPdfReport: async (projectId: number) => {
    try {
      const res = await apiClient.get('/reporting/pdf', {
        params: { project_id: projectId },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DebtLens_Audit_Project_${projectId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      window.print();
    }
  },

  // Seeding
  reloadSeedData: async () => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/seed/reload');
        return res.data;
      },
      async () => {
        mockEngine.resetStore();
        return { message: 'Database reset to FinTech seed corpus successfully' };
      }
    );
  }
};
