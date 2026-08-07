import type {
  MediaReference,
  ReferenceImageInline,
} from "@dafthunk/types";

export interface ResolvedReferencesForGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
}

export interface ResolvedMediaReferencesForTextGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
  readonly referenceVideoUrls: readonly string[];
}

export interface ResolvedMediaReferencesForVideoGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
  readonly referenceVideoUrls: readonly string[];
  readonly referenceAudioUrls: readonly string[];
}

export interface ResolveReferencesParams {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly cloudConfigured?: boolean;
  readonly references: readonly MediaReference[];
}
