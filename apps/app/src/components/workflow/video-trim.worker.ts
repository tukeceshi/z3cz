import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

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

self.addEventListener("message", (event: MessageEvent<TrimWorkerRequest>) => {
  const payload = event.data;
  if (payload.type !== "trim") {
    return;
  }

  void (async () => {
    try {
      const response = await fetch(payload.sourceUrl);
      if (!response.ok) {
        const failure: TrimWorkerFailure = {
          ok: false,
          error: `trim_fetch_failed_${response.status}`,
        };
        self.postMessage(failure);
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
        const failure: TrimWorkerFailure = {
          ok: false,
          error: "trim_empty_output",
        };
        self.postMessage(failure);
        return;
      }

      const success: TrimWorkerSuccess = { ok: true, buffer };
      self.postMessage(success, [buffer]);
    } catch (error) {
      const failure: TrimWorkerFailure = {
        ok: false,
        error: error instanceof Error ? error.message : "trim_failed",
      };
      self.postMessage(failure);
    }
  })();
});

export {};
