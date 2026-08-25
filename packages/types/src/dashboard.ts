/**
 * Workflow summary shown on the organization dashboard.
 */
export interface DashboardRecentWorkflow {
  readonly id: string;
  readonly name: string;
  readonly coverObjectId?: string | null;
  readonly coverMimeType?: string | null;
  readonly updatedAt: Date | string;
}

/**
 * Dashboard data for the organization home page.
 */
export interface DashboardStats {
  readonly recentWorkflows: readonly DashboardRecentWorkflow[];
}

/**
 * Response for dashboard statistics
 */
export interface DashboardStatsResponse {
  stats: DashboardStats;
}
