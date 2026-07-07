interface MemoryKvEntry {
  value: string;
  expiration?: number;
}

export class MemoryKvNamespace implements KVNamespace {
  private readonly store = new Map<string, MemoryKvEntry>();

  async get(
    key: string,
    type?: "text" | "json" | "arrayBuffer" | "stream"
  ): Promise<string | object | ArrayBuffer | ReadableStream | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiration && entry.expiration <= Date.now() / 1000) {
      this.store.delete(key);
      return null;
    }
    if (type === "json") {
      return JSON.parse(entry.value) as object;
    }
    return entry.value;
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: KVNamespacePutOptions
  ): Promise<void> {
    const serialized =
      typeof value === "string"
        ? value
        : value instanceof ArrayBuffer
          ? new TextDecoder().decode(value)
          : ArrayBuffer.isView(value)
            ? new TextDecoder().decode(value)
            : "";
    this.store.set(key, {
      value: serialized,
      expiration: options?.expirationTtl
        ? Math.floor(Date.now() / 1000) + options.expirationTtl
        : options?.expiration,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult> {
    const prefix = options?.prefix ?? "";
    const keys = [...this.store.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((name) => ({ name }));
    return {
      keys,
      list_complete: true,
      cacheStatus: null,
    };
  }
}
