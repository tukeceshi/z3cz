import type { ListStage, OnboardingStage } from "@/services/admin-service";

import type { TranslateFn } from "../index";

const STAGE_KEY_MAP: Record<ListStage, `admin.stages.${ListStage}`> = {
  signed_up: "admin.stages.signed_up",
  tour_completed: "admin.stages.tour_completed",
  workflow_created: "admin.stages.workflow_created",
  workflow_executed: "admin.stages.workflow_executed",
  workflow_executed_ok: "admin.stages.workflow_executed_ok",
  dormant: "admin.stages.dormant",
};

export function getListStageLabel(
  t: TranslateFn,
  stage: ListStage
): string {
  return t(STAGE_KEY_MAP[stage]);
}

export function getOnboardingStageLabel(
  t: TranslateFn,
  stage: OnboardingStage
): string {
  return t(STAGE_KEY_MAP[stage]);
}
