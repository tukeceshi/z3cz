const activeGenerativeJobResumes = new Set<string>();
const finalizedGenerativeJobs = new Set<string>();

export function tryClaimGenerativeJobResume(jobId: string): boolean {
  if (activeGenerativeJobResumes.has(jobId)) {
    return false;
  }
  activeGenerativeJobResumes.add(jobId);
  return true;
}

export function releaseGenerativeJobResume(jobId: string): void {
  activeGenerativeJobResumes.delete(jobId);
}

/**
 * Session-scoped lock: only one writer may append history for a cloud job.
 * Claims are permanent for the page lifetime (not released).
 */
export function tryClaimGenerativeJobFinalize(jobId: string): boolean {
  const normalized = jobId.trim();
  if (!normalized) {
    return true;
  }
  if (finalizedGenerativeJobs.has(normalized)) {
    return false;
  }
  finalizedGenerativeJobs.add(normalized);
  return true;
}

/** @internal test helper */
export function resetGenerativeJobFinalizeClaimsForTests(): void {
  finalizedGenerativeJobs.clear();
}

/** @internal test helper */
export function resetGenerativeJobResumeClaimsForTests(): void {
  activeGenerativeJobResumes.clear();
}
