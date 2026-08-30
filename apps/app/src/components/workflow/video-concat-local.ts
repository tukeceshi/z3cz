import { concatVideoBuffers } from "./video-concat-buffers";

export interface ConcatVideoLocallyParams {
  readonly blobs: readonly Blob[];
}

export interface ConcatVideoLocallyResult {
  readonly blob: Blob;
}

interface ConcatWorkerRequest {
  readonly type: "concat";
  readonly buffers: ArrayBuffer[];
}

interface ConcatWorkerSuccess {
  readonly ok: true;
  readonly buffer: ArrayBuffer;
}

interface ConcatWorkerFailure {
  readonly ok: false;
  readonly error: string;
}

type ConcatWorkerResponse = ConcatWorkerSuccess | ConcatWorkerFailure;

let workerInstance: Worker | null = null;

function getConcatWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("./video-trim.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return workerInstance;
}

function concatVideoInWorker(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = getConcatWorker();

    const handleMessage = (event: MessageEvent<ConcatWorkerResponse>) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      const payload = event.data;
      if (!payload.ok) {
        reject(new Error(payload.error));
        return;
      }
      resolve(payload.buffer);
    };

    const handleError = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      reject(new Error("concat_worker_failed"));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const request: ConcatWorkerRequest = {
      type: "concat",
      buffers,
    };
    worker.postMessage(request, buffers);
  });
}

export async function concatVideoLocally(
  params: ConcatVideoLocallyParams
): Promise<ConcatVideoLocallyResult> {
  if (params.blobs.length === 0) {
    throw new Error("concat_empty_input");
  }
  if (params.blobs.length === 1) {
    return { blob: params.blobs[0]! };
  }

  const buffers = await Promise.all(
    params.blobs.map(async (blob) => blob.arrayBuffer())
  );
  const buffer =
    typeof Worker !== "undefined"
      ? await concatVideoInWorker(buffers)
      : await concatVideoBuffers(buffers);
  return {
    blob: new Blob([buffer], { type: "video/mp4" }),
  };
}
