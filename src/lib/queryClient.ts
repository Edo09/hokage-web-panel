import { QueryClient } from '@tanstack/react-query';

/**
 * Single app-wide query client. Reads are cached and shared across screens —
 * the three list views (Dashboard, Clients, Memberships) all read the same
 * ['client-summaries'] query, so navigating between them no longer refetches.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Coach data changes slowly and only from this panel; keep it fresh for
      // a minute so tab-hopping is instant, and don't refetch on window focus.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Query keys — one place so invalidation and reads can't drift apart. */
export const qk = {
  clientSummaries: ['client-summaries'] as const,
  exercises: ['exercises'] as const,
  bodyParts: ['bodyparts'] as const,
  programTemplates: ['program-templates'] as const,
  templateAssignments: ['template-assignments'] as const,
  client: (id: string) => ['client', id] as const,
  clientTrend: ['client-trend'] as const,
  programs: (clientId: string) => ['programs', clientId] as const,
  nutritionTemplates: ['nutrition-templates'] as const,
  supplementTemplates: ['supplement-templates'] as const,
  nutritionAssignments: ['nutrition-assignments'] as const,
  supplementAssignments: ['supplement-assignments'] as const,
  programCompletions: (clientId: string) => ['program-completions', clientId] as const,
  setLogs: (clientId: string) => ['set-logs', clientId] as const,
  completions: (clientId: string) => ['completions', clientId] as const,
  recentActivity: ['recent-activity'] as const,
};
