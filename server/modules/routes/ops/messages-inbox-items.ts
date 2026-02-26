// @ts-nocheck

import type { DecisionInboxRouteItem } from "./messages-types.ts";
import { buildProjectAndTimeoutInboxItems } from "./messages-inbox-project-items.ts";
import { buildRoundAndAggregatedInboxItems } from "./messages-inbox-round-items.ts";

export function buildInboxItemHelpers(ctx: {
  db: any;
  nowMs: () => number;
  getPreferredLanguage: () => string;
  l: (...args: any[]) => any;
  pickL: (val: any, lang: string) => string;
  PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX: string;
  stateHelpers: {
    buildProjectReviewSnapshotHash: (id: string, choices: Array<{ id: string; updated_at: number }>) => string;
    buildReviewRoundSnapshotHash: (meetingId: string, round: number, notes: string[]) => string;
    getProjectReviewDecisionState: (id: string) => any;
    upsertProjectReviewDecisionState: (...args: any[]) => void;
    getReviewRoundDecisionState: (id: string) => any;
    upsertReviewRoundDecisionState: (...args: any[]) => void;
    formatPlannerSummaryForDisplay: (input: string) => string;
    resolvePlanningLeadMeta: (lang: string, state?: any) => any;
  };
  consolidationHelpers: {
    queueProjectReviewPlanningConsolidation: (...args: any[]) => void;
    queueReviewRoundPlanningConsolidation: (input: any) => void;
  };
}) {
  const { db, nowMs, getPreferredLanguage, l, pickL, PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX, stateHelpers, consolidationHelpers } = ctx;

  // Project review items + timeout resume items
  const projectItemHelpers = buildProjectAndTimeoutInboxItems({
    db, nowMs, getPreferredLanguage, l, pickL,
    PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX,
    stateHelpers: {
      buildProjectReviewSnapshotHash: stateHelpers.buildProjectReviewSnapshotHash,
      getProjectReviewDecisionState: stateHelpers.getProjectReviewDecisionState,
      upsertProjectReviewDecisionState: stateHelpers.upsertProjectReviewDecisionState,
      formatPlannerSummaryForDisplay: stateHelpers.formatPlannerSummaryForDisplay,
      resolvePlanningLeadMeta: stateHelpers.resolvePlanningLeadMeta,
    },
    consolidationHelpers: {
      queueProjectReviewPlanningConsolidation: consolidationHelpers.queueProjectReviewPlanningConsolidation,
    },
  });

  // Review round items + aggregated getDecisionInboxItems
  const roundItemHelpers = buildRoundAndAggregatedInboxItems({
    db, nowMs, getPreferredLanguage, l, pickL,
    stateHelpers: {
      buildReviewRoundSnapshotHash: stateHelpers.buildReviewRoundSnapshotHash,
      getReviewRoundDecisionState: stateHelpers.getReviewRoundDecisionState,
      upsertReviewRoundDecisionState: stateHelpers.upsertReviewRoundDecisionState,
      formatPlannerSummaryForDisplay: stateHelpers.formatPlannerSummaryForDisplay,
      resolvePlanningLeadMeta: stateHelpers.resolvePlanningLeadMeta,
    },
    consolidationHelpers: {
      queueReviewRoundPlanningConsolidation: consolidationHelpers.queueReviewRoundPlanningConsolidation,
    },
    projectItemHelpers: {
      buildProjectReviewDecisionItems: projectItemHelpers.buildProjectReviewDecisionItems,
      buildTimeoutResumeDecisionItems: projectItemHelpers.buildTimeoutResumeDecisionItems,
    },
  });

  return {
    getProjectReviewTaskChoices: projectItemHelpers.getProjectReviewTaskChoices,
    getReviewDecisionFallbackLabel: roundItemHelpers.getReviewDecisionFallbackLabel,
    getReviewDecisionNotes: roundItemHelpers.getReviewDecisionNotes,
    buildProjectReviewDecisionItems: projectItemHelpers.buildProjectReviewDecisionItems,
    buildTimeoutResumeDecisionItems: projectItemHelpers.buildTimeoutResumeDecisionItems,
    buildReviewRoundDecisionItems: roundItemHelpers.buildReviewRoundDecisionItems,
    getDecisionInboxItems: roundItemHelpers.getDecisionInboxItems,
  };
}
