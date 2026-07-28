const activeGenerativeJobResumes = new Set<string>();

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
