import { describe, expect, it } from "vitest";



import {

  appendPackageListRefreshLog,

  canClientTriggerRealPackageRefresh,

  evaluatePackageListRefreshRateLimit,

  isPackageListCacheFresh,

  prunePackageListRefreshLog,

  readPackageListRefreshLog,

  shouldAutoRefreshPackageListOnExpand,

  VOLCANO_PACKAGE_LIST_CACHE_TTL_MS,

  VOLCANO_PACKAGE_LIST_EXPAND_AUTO_REFRESH_MS,

  VOLCANO_PACKAGE_LIST_REFRESH_MAX_PER_WINDOW,

  VOLCANO_PACKAGE_LIST_REFRESH_MIN_INTERVAL_MS,

  VOLCANO_PACKAGE_LIST_REFRESH_WINDOW_MS,

} from "./volcano-package-list-cache";

import type {

  VolcanoInterfaceMetadata,

  VolcanoPackageListCache,

} from "./volcano-snapshot";



function buildCache(fetchedAt: string): VolcanoPackageListCache {

  return {

    fetchedAt,

    mode: "metering",

    rows: [],

    statusCounts: {},

  };

}



const baseMetadata: VolcanoInterfaceMetadata = {

  credentialMode: "volcengine_iam",

  accessKeyId: "ak",

  secretAccessKeyEncrypted: "enc",

  arkApiKeyDurationSeconds: 3600,

  region: "cn-beijing",

  models: {},

};



describe("shouldAutoRefreshPackageListOnExpand", () => {

  it("does not auto-refresh when cache is within 30 minutes", () => {

    const now = Date.parse("2026-07-22T12:00:00.000Z");

    const cache = buildCache("2026-07-22T11:40:00.000Z");



    expect(shouldAutoRefreshPackageListOnExpand(cache, now)).toBe(false);

  });



  it("auto-refreshes when cache is 30 minutes or older", () => {

    const now = Date.parse("2026-07-22T12:00:00.000Z");

    const cache = buildCache(

      new Date(now - VOLCANO_PACKAGE_LIST_EXPAND_AUTO_REFRESH_MS).toISOString()

    );



    expect(shouldAutoRefreshPackageListOnExpand(cache, now)).toBe(true);

  });



  it("auto-refreshes when fetchedAt is invalid", () => {

    expect(

      shouldAutoRefreshPackageListOnExpand(buildCache("not-a-date"))

    ).toBe(true);

  });

});



describe("isPackageListCacheFresh", () => {

  it("remains independent from expand auto-refresh threshold", () => {

    const now = Date.parse("2026-07-22T12:00:00.000Z");

    const cache = buildCache("2026-07-22T11:40:00.000Z");



    expect(isPackageListCacheFresh(cache, now)).toBe(false);

    expect(now - Date.parse(cache.fetchedAt)).toBeGreaterThan(

      VOLCANO_PACKAGE_LIST_CACHE_TTL_MS

    );

    expect(shouldAutoRefreshPackageListOnExpand(cache, now)).toBe(false);

  });

});



describe("evaluatePackageListRefreshRateLimit", () => {

  const now = Date.parse("2026-07-22T12:00:00.000Z");



  it("allows refresh when log is empty", () => {

    expect(evaluatePackageListRefreshRateLimit(baseMetadata, now).allowed).toBe(

      true

    );

  });



  it("blocks refresh within one minute of the last fetch", () => {

    const metadata = appendPackageListRefreshLog(

      baseMetadata,

      "2026-07-22T11:59:30.000Z"

    );



    const result = evaluatePackageListRefreshRateLimit(metadata, now);

    expect(result.allowed).toBe(false);

    expect(result.reason).toBe("min_interval");

    expect(result.nextAllowedAt).toBe("2026-07-22T12:00:30.000Z");

  });



  it("allows refresh after one minute", () => {

    const metadata = appendPackageListRefreshLog(

      baseMetadata,

      "2026-07-22T11:58:59.000Z"

    );



    expect(evaluatePackageListRefreshRateLimit(metadata, now).allowed).toBe(

      true

    );

  });



  it("blocks refresh after three fetches in ten minutes", () => {

    let metadata = baseMetadata;

    for (const offsetMinutes of [9, 7, 5]) {

      metadata = appendPackageListRefreshLog(

        metadata,

        new Date(now - offsetMinutes * 60_000).toISOString()

      );

    }



    const result = evaluatePackageListRefreshRateLimit(metadata, now);

    expect(result.allowed).toBe(false);

    expect(result.reason).toBe("window_exhausted");

  });



  it("prunes entries outside the ten minute window", () => {

    const log = [

      new Date(now - VOLCANO_PACKAGE_LIST_REFRESH_WINDOW_MS - 1).toISOString(),

      new Date(now - 2 * 60_000).toISOString(),

    ];



    expect(prunePackageListRefreshLog(log, now)).toHaveLength(1);

  });

});



describe("canClientTriggerRealPackageRefresh", () => {

  const now = Date.parse("2026-07-22T12:00:00.000Z");



  it("allows the first refresh", () => {

    expect(canClientTriggerRealPackageRefresh(null, now)).toBe(true);

  });



  it("blocks refresh within one minute on the client", () => {

    expect(

      canClientTriggerRealPackageRefresh(now - 30_000, now)

    ).toBe(false);

  });



  it("allows refresh after one minute on the client", () => {

    expect(

      canClientTriggerRealPackageRefresh(

        now - VOLCANO_PACKAGE_LIST_REFRESH_MIN_INTERVAL_MS,

        now

      )

    ).toBe(true);

  });

});



describe("appendPackageListRefreshLog", () => {

  it("keeps at most windowed entries plus the new one", () => {

    const now = Date.parse("2026-07-22T12:00:00.000Z");

    let metadata = baseMetadata;



    for (let index = 0; index < VOLCANO_PACKAGE_LIST_REFRESH_MAX_PER_WINDOW; index += 1) {

      metadata = appendPackageListRefreshLog(

        metadata,

        new Date(now - index * 60_000).toISOString()

      );

    }



    expect(readPackageListRefreshLog(metadata)).toHaveLength(

      VOLCANO_PACKAGE_LIST_REFRESH_MAX_PER_WINDOW

    );

  });

});


