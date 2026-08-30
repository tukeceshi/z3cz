import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

import { concatVideoBuffers } from "./video-concat-buffers";

interface TrimWorkerRequest {
  readonly type: "trim";
  readonly sourceUrl: string;
  readonly startSec: number;
  readonly endSec: number;
}

interface ConcatWorkerRequest {
  readonly type: "concat";
  readonly buffers: ArrayBuffer[];
}

type WorkerRequest = TrimWorkerRequest | ConcatWorkerRequest;

interface WorkerSuccess {
  readonly ok: true;
  readonly buffer: ArrayBuffer;
}

interface WorkerFailure {
  readonly ok: false;
  readonly error: string;
}

interface MediaWorkerScope {
  addEventListener: typeof self.addEventListener;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as MediaWorkerScope;

workerScope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;

  void (async () => {
    try {
      if (payload.type === "concat") {
        const buffer = await concatVideoBuffers(payload.buffers);
        const success: WorkerSuccess = { ok: true, buffer };
        workerScope.postMessage(success, [buffer]);
        return;
      }

      if (payload.type !== "trim") {
        return;
      }

      const response = await fetch(payload.sourceUrl);
      if (!response.ok) {
        const failure: WorkerFailure = {
          ok: false,
          error: `trim_fetch_failed_${response.status}`,
        };
        workerScope.postMessage(failure);
        return;
      }

      const blob = await response.blob();
      const input = new Input({
        source: new BlobSource(blob),
        formats: ALL_FORMATS,
      });
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      });
      const conversion = await Conversion.init({
        input,
        output,
        tracks: "primary",
        trim: {
          start: payload.startSec,
          end: payload.endSec,
        },
        tags: {},
      });
      await conversion.execute();

      const buffer = output.target.buffer;
      if (!buffer) {
        const failure: WorkerFailure = {
          ok: false,
          error: "trim_empty_output",
        };
        workerScope.postMessage(failure);
        return;
      }

      const success: WorkerSuccess = { ok: true, buffer };
      workerScope.postMessage(success, [buffer]);
    } catch (error) {
      const failure: WorkerFailure = {
        ok: false,
        error: error instanceof Error ? error.message : "media_worker_failed",
      };
      workerScope.postMessage(failure);
    }
  })();
});

export {};
