export function parseJsonColumn<T>(raw: string | T): T {
  if (typeof raw === "string") {
    return JSON.parse(raw) as T;
  }
  return raw;
}
