import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  abortPreparation,
  ABORT_MESSAGE,
  ABORT_NOT_ALLOWED_MESSAGE,
  createPreparationStore,
  prepareSystemUpdate,
  prepareUploadedUpdate,
  receiveUploadedAsset,
  releaseAssetUrls,
} from "./system-update-preparer-node";

describe("releaseAssetUrls", () => {
  it("uses GitHub only", () => {
    const urls = releaseAssetUrls(
      "owner/repo",
      "v1.2.3",
      "z3cz-v1.2.3-deploy.tar.gz"
    );
    expect(urls[0]).toBe(
      "https://github.com/owner/repo/releases/download/v1.2.3/z3cz-v1.2.3-deploy.tar.gz"
    );
    expect(urls).toHaveLength(1);
  });

  it("rejects untrusted versions and asset paths", () => {
    expect(() =>
      releaseAssetUrls("owner/repo", "main", "../../payload")
    ).toThrow("无效");
  });
});

describe("browser update upload", () => {
  it("accepts matching assets and rejects a changed archive", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-update-test-"));
    try {
      const version = "v1.2.3";
      const asset = `z3cz-${version}-deploy.tar.gz`;
      const archive = Buffer.from("test archive");
      const checksum = crypto
        .createHash("sha256")
        .update(archive)
        .digest("hex");
      const store = createPreparationStore(root);
      store.write({
        phase: "downloading",
        downloadMethod: "browser",
        targetVersion: version,
        automaticRollback: false,
        logs: [],
        files: [
          { name: "SHA256SUMS", downloadedBytes: 0, status: "pending" },
          { name: asset, downloadedBytes: 0, status: "pending" },
        ],
      });
      const upload = async (name: string, bytes: Buffer) =>
        receiveUploadedAsset({
          version,
          name,
          root,
          store,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
        });
      await upload("SHA256SUMS", Buffer.from(`${checksum}  ${asset}\n`));
      await upload(asset, archive);
      await expect(
        prepareUploadedUpdate({ version, root, store })
      ).resolves.toMatchObject({ checksum, version });
      store.write({ ...store.read()!, phase: "downloading" });
      await upload(asset, Buffer.from("changed archive"));
      await expect(
        prepareUploadedUpdate({ version, root, store })
      ).rejects.toThrow("SHA-256");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("abortPreparation", () => {
  it("marks download failed and removes files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-update-abort-"));
    try {
      const store = createPreparationStore(root);
      const version = "v1.2.3";
      const directory = path.join(root, "downloads", version);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "SHA256SUMS"), "x");
      store.write({
        phase: "downloading",
        downloadMethod: "service",
        targetVersion: version,
        automaticRollback: false,
        logs: [],
        files: [
          { name: "SHA256SUMS", downloadedBytes: 1, status: "complete" },
          {
            name: "z3cz-v1.2.3-deploy.tar.gz",
            downloadedBytes: 0,
            status: "downloading",
          },
        ],
      });
      const next = abortPreparation(store, root);
      expect(next.phase).toBe("failed");
      expect(next.error).toBe(ABORT_MESSAGE);
      expect(fs.existsSync(directory)).toBe(false);
      expect(abortPreparation(store, root).error).toBe(ABORT_MESSAGE);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects abort after download", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-update-abort-"));
    try {
      const store = createPreparationStore(root);
      store.write({
        phase: "preparing",
        automaticRollback: false,
        logs: [],
      });
      expect(() => abortPreparation(store, root)).toThrow(
        ABORT_NOT_ALLOWED_MESSAGE
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("prepareSystemUpdate abort signal", () => {
  it("does not start when already aborted", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-update-abort-"));
    try {
      const store = createPreparationStore(root);
      const controller = new AbortController();
      controller.abort();
      await expect(
        prepareSystemUpdate({
          repository: "tukeceshi/z3cz",
          version: "v1.2.3",
          root,
          store,
          signal: controller.signal,
        })
      ).rejects.toThrow(ABORT_MESSAGE);
      expect(store.read()).toBeUndefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
