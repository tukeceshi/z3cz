let activeWorkCount = 0;

const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function isGenerativeMediaWorkActive(): boolean {
  return activeWorkCount > 0;
}

export function beginGenerativeMediaWork(): () => void {
  activeWorkCount += 1;
  notifyListeners();
  return () => {
    activeWorkCount = Math.max(0, activeWorkCount - 1);
    notifyListeners();
  };
}

export function subscribeGenerativeMediaWork(
  listener: () => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
