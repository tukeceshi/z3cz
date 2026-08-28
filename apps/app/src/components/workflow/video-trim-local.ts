import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

export interface TrimVideoLocallyParams {
  readonly sourceUrl: string;
  readonly startSec: number;
  readonly endSec: number;
}

export interface TrimVideoLocallyResult {
  readonly blob: Blob;
}

interface TrimWorkerRequest {
  readonly type: "trim";
  readonly sourceUrl: string;
  readonly startSec: number;
  readonly endSec: number;
}

interface TrimWorkerSuccess {
  readonly ok: true;
  readonly buffer: ArrayBuffer;
}

interface TrimWorkerFailure {
  readonly ok: false;
  readonly error: string;
}

type TrimWorkerResponse = TrimWorkerSuccess | TrimWorkerFailure;

let workerInstance: Worker | null = null;

function getTrimWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("./video-trim.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return workerInstance;
}

function trimVideoInWorker(
  params: TrimVideoLocallyParams
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = getTrimWorker();

    const handleMessage = (event: MessageEvent<TrimWorkerResponse>) => {
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
      reject(new Error("trim_worker_failed"));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const request: TrimWorkerRequest = {
      type: "trim",
      sourceUrl: params.sourceUrl,
      startSec: params.startSec,
      endSec: params.endSec,
    };
    worker.postMessage(request);
  });
}

async function trimVideoOnMainThread(
  params: TrimVideoLocallyParams
): Promise<ArrayBuffer> {
  const response = await fetch(params.sourceUrl);
  if (!response.ok) {
    throw new Error(`trim_fetch_failed_${response.status}`);
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
      start: params.startSec,
      end: params.endSec,
    },
    tags: {},
  });
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer) {
    throw new Error("trim_empty_output");
  }
  return buffer;
}

export async function trimVideoLocally(
  params: TrimVideoLocallyParams
): Promise<TrimVideoLocallyResult> {
  const buffer =
    typeof Worker !== "undefined"
      ? await trimVideoInWorker(params)
      : await trimVideoOnMainThread(params);
  return {
    blob: new Blob([buffer], { type: "video/mp4" }),
  };
}
