import type { TranslateFn } from "@/i18n";

export interface TourStep {
  id: string;
  title: string;
  content: string;
  targetSelector: string;
  spotlightPadding?: number;
}

export function getTourSteps(t: TranslateFn): TourStep[] {
  return [
    {
      id: "organization",
      title: t("tour.steps.organization.title"),
      content: t("tour.steps.organization.content"),
      targetSelector: '[data-tour="organization-switcher"]',
      spotlightPadding: 2,
    },
    {
      id: "workflows",
      title: t("tour.steps.workflows.title"),
      content: t("tour.steps.workflows.content"),
      targetSelector: '[data-tour="workflows-nav-group"]',
      spotlightPadding: 4,
    },
    {
      id: "resources",
      title: t("tour.steps.resources.title"),
      content: t("tour.steps.resources.content"),
      targetSelector: '[data-tour="resources-nav-group"]',
      spotlightPadding: 4,
    },
    {
      id: "settings",
      title: t("tour.steps.settings.title"),
      content: t("tour.steps.settings.content"),
      targetSelector: '[data-tour="settings-nav-group"]',
      spotlightPadding: 4,
    },
    {
      id: "documentation",
      title: t("tour.steps.documentation.title"),
      content: t("tour.steps.documentation.content"),
      targetSelector: '[data-tour="documentation-link"]',
      spotlightPadding: 2,
    },
  ];
}
