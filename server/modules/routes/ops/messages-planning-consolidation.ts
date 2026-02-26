// @ts-nocheck

import { buildProjectReviewConsolidation } from "./messages-project-consolidation.ts";
import { buildReviewRoundConsolidation } from "./messages-round-consolidation.ts";

export function buildPlanningConsolidationHelpers(ctx: {
  db: any;
  nowMs: () => number;
  findTeamLeader: (dept: string) => any;
  getAgentDisplayName: (agent: any, lang: string) => string;
  runAgentOneShot: (agent: any, prompt: string, opts: any) => Promise<any>;
  chooseSafeReply: (run: any, lang: string, kind: string, agent: any) => string;
  l: (...args: any[]) => any;
  pickL: (val: any, lang: string) => string;
  stateHelpers: {
    getProjectReviewDecisionState: (id: string) => any;
    upsertProjectReviewDecisionState: (...args: any[]) => void;
    getReviewRoundDecisionState: (id: string) => any;
    upsertReviewRoundDecisionState: (...args: any[]) => void;
    recordProjectReviewDecisionEvent: (input: any) => void;
    getProjectReviewRoundDecisionContext: (id: string, lang: string, limit?: number) => string[];
    formatPlannerSummaryForDisplay: (input: string) => string;
  };
  inFlightSets: {
    projectReviewDecisionConsolidationInFlight: Set<string>;
    reviewRoundDecisionConsolidationInFlight: Set<string>;
  };
}) {
  const { db, nowMs, findTeamLeader, getAgentDisplayName, runAgentOneShot, chooseSafeReply, l, pickL, stateHelpers, inFlightSets } = ctx;
  const { projectReviewDecisionConsolidationInFlight, reviewRoundDecisionConsolidationInFlight } = inFlightSets;

  const projectConsolidation = buildProjectReviewConsolidation({
    db, nowMs, findTeamLeader, getAgentDisplayName, runAgentOneShot, chooseSafeReply, l, pickL,
    stateHelpers: {
      getProjectReviewDecisionState: stateHelpers.getProjectReviewDecisionState,
      upsertProjectReviewDecisionState: stateHelpers.upsertProjectReviewDecisionState,
      recordProjectReviewDecisionEvent: stateHelpers.recordProjectReviewDecisionEvent,
      getProjectReviewRoundDecisionContext: stateHelpers.getProjectReviewRoundDecisionContext,
      formatPlannerSummaryForDisplay: stateHelpers.formatPlannerSummaryForDisplay,
    },
    projectReviewDecisionConsolidationInFlight,
  });

  const roundConsolidation = buildReviewRoundConsolidation({
    db, nowMs, findTeamLeader, getAgentDisplayName, runAgentOneShot, chooseSafeReply, l, pickL,
    stateHelpers: {
      getProjectReviewDecisionState: stateHelpers.getProjectReviewDecisionState,
      getReviewRoundDecisionState: stateHelpers.getReviewRoundDecisionState,
      upsertReviewRoundDecisionState: stateHelpers.upsertReviewRoundDecisionState,
      recordProjectReviewDecisionEvent: stateHelpers.recordProjectReviewDecisionEvent,
      formatPlannerSummaryForDisplay: stateHelpers.formatPlannerSummaryForDisplay,
    },
    reviewRoundDecisionConsolidationInFlight,
  });

  return {
    buildProjectReviewPlanningFallbackSummary: projectConsolidation.buildProjectReviewPlanningFallbackSummary,
    buildReviewRoundPlanningFallbackSummary: roundConsolidation.buildReviewRoundPlanningFallbackSummary,
    queueProjectReviewPlanningConsolidation: projectConsolidation.queueProjectReviewPlanningConsolidation,
    queueReviewRoundPlanningConsolidation: roundConsolidation.queueReviewRoundPlanningConsolidation,
  };
}
