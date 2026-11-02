export type UserRole = 'admin' | 'tech_lead' | 'developer' | 'viewer';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id?: number;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
}

export interface Project {
  id: number;
  organization_id: number;
  name: string;
  key: string;
  description?: string;
  repo_url?: string;
}

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export interface Incident {
  id: number;
  project_id: number;
  incident_number: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected_module: string;
  affected_component?: string;
  reported_by?: string;
  resolution_notes?: string;
  resolution_effort_hours: number;
  reported_at: string;
  resolved_at?: string;
}

export interface FiveWhysStep {
  step: number;
  question: string;
  cause: string;
  category?: string;
}

export interface CauseNode {
  id: number;
  project_id: number;
  description: string;
  normalized_text: string;
  category: string;
  degree_centrality: number;
  betweenness_centrality: number;
  created_at: string;
  incident_count: number;
}

export interface CausalGraphData {
  nodes: {
    data: {
      id: string;
      node_id: number;
      label: string;
      category: string;
      degree_centrality: number;
      betweenness_centrality: number;
      incident_count: number;
    }
  }[];
  edges: {
    data: {
      id: string;
      source: string;
      target: string;
      relation: string;
      weight: number;
    }
  }[];
  systemic_causes: CauseNode[];
}

export type DebtCategory = 'ARCHITECTURAL' | 'CODE_SMELL' | 'TEST_DEBT' | 'INFRASTRUCTURE' | 'SECURITY_DEBT' | 'DOCUMENTATION';
export type DebtStatus = 'IDENTIFIED' | 'PRIORITIZED' | 'IN_PROGRESS' | 'REMEDIATED';

export interface DebtItem {
  id: number;
  project_id: number;
  debt_key: string;
  title: string;
  description: string;
  category: DebtCategory;
  module_name: string;
  file_path?: string;
  effort_principal: number;
  accrued_interest: number;
  break_even_status: boolean;
  risk_score: number;
  status: DebtStatus;
  assignee?: string;
  root_cause_id?: number;
  created_at: string;
  updated_at: string;
  prerequisite_ids: number[];
  linked_incident_count: number;
  age_days: number;
}

export interface RemediationPlanItem {
  id: number;
  debt_key: string;
  title: string;
  category: string;
  module_name: string;
  effort_principal: number;
  accrued_interest: number;
  risk_score: number;
  break_even_status: boolean;
  prerequisite_keys: string[];
}

export interface RemediationPlan {
  sprint_budget: number;
  total_effort_allocated: number;
  budget_utilization_pct: number;
  total_risk_reduced: number;
  accumulated_interest_saved: number;
  selected_items: RemediationPlanItem[];
  deferred_items: RemediationPlanItem[];
  remediation_order: string[];
}

export interface WhatIfScenario {
  budget: number;
  effort_used: number;
  items_count: number;
  risk_reduction: number;
  interest_saved: number;
  roi_ratio: number;
}

export interface SimilarIncidentMatch {
  incident_id: number;
  incident_number: string;
  title: string;
  severity: string;
  status: string;
  affected_module: string;
  similarity_score: number;
  lexical_score: number;
  semantic_score: number;
}

export interface RootCauseCluster {
  cluster_id: number;
  cause_count: number;
  theme_title: string;
  causes: string[];
  is_noise: boolean;
}

export interface RegressionItem {
  new_incident_id: number;
  new_incident_number: string;
  new_incident_title: string;
  resolved_incident_id: number;
  resolved_incident_number: string;
  resolved_incident_title: string;
  affected_module: string;
  similarity: number;
  resolved_at: string;
  reported_at: string;
  days_to_recurrence: number;
}

export interface HotspotItem {
  id: number;
  file_path: string;
  module_name: string;
  churn_count: number;
  cyclomatic_complexity: number;
  risk_score: number;
  blast_radius: number;
}

export interface SelfAdmittedDebtItem {
  id: number;
  file_path: string;
  module_name: string;
  line_number: number;
  marker_type: string;
  comment_text: string;
  status: string;
}

export interface ExecutiveDashboardSummary {
  total_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  total_debt_items: number;
  past_breakeven_count: number;
  total_principal_effort: number;
  total_accrued_interest: number;
  net_economic_drag: number;
  high_risk_modules: {
    module: string;
    debt_count: number;
    interest: number;
    blast_radius: number;
  }[];
  top_systemic_causes: {
    id: number;
    description: string;
    category: string;
    betweenness_centrality: number;
    degree_centrality: number;
  }[];
  regressions_detected: number;
  satd_count: number;
}
