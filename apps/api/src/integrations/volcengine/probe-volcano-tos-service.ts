import type {
  VolcanoProbeTosBucketsResponse,
} from "@dafthunk/types";

import {
  TOS_ACCOUNT_DISABLE_CODE,
  TosRequestError,
  VOLCANO_TOS_NOT_OPENED_CODE,
  isTosBucketAlreadyExistsCode,
  isTosRequestError,
} from "./tos-errors";
import { VolcengineTosClient } from "./tos-client";

async function buildTosServiceProbeBucketName(
  accessKeyId: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessKeyId.trim())
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
  return `dafthunk-tos-probe-${hash}`;
}

/**
 * ListBuckets alone can return 200 with an empty list before TOS is opened.
 * A create-bucket probe reliably surfaces AccountDisable when the service is off.
 */
export async function verifyVolcanoTosServiceOpened(
  client: VolcengineTosClient,
  accessKeyId: string
): Promise<void> {
  const probeBucket = await buildTosServiceProbeBucketName(accessKeyId);

  try {
    await client.createBucket(probeBucket);
    return;
  } catch (error) {
    if (!isTosRequestError(error)) {
      throw error;
    }

    if (error.tosCode === TOS_ACCOUNT_DISABLE_CODE) {
      throw error;
    }

    if (isTosBucketAlreadyExistsCode(error.tosCode)) {
      return;
    }

    throw error;
  }
}

function classifyTosFailure(params: {
  readonly httpStatus: number;
  readonly tosCode: string | null;
  readonly message: string;
}): Pick<VolcanoProbeTosBucketsResponse, "status" | "code" | "message"> {
  if (params.tosCode === TOS_ACCOUNT_DISABLE_CODE) {
    return {
      status: "not_opened",
      code: VOLCANO_TOS_NOT_OPENED_CODE,
      message: params.message,
    };
  }

  if (params.httpStatus === 401 || params.httpStatus === 403) {
    return {
      status: "auth_error",
      message: params.message,
    };
  }

  return {
    status: "transient_error",
    message: params.message,
  };
}

export async function probeVolcanoTosServiceStatus(params: {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
}): Promise<VolcanoProbeTosBucketsResponse> {
  const client = VolcengineTosClient.forRegion({
    accessKeyId: params.accessKeyId,
    secretAccessKey: params.secretAccessKey,
    region: params.region,
  });

  try {
    await verifyVolcanoTosServiceOpened(client, params.accessKeyId);
    const buckets = await client.listBuckets();
    return {
      status: "opened",
      buckets: [...buckets],
    };
  } catch (error) {
    if (isTosRequestError(error)) {
      const classified = classifyTosFailure({
        httpStatus: error.httpStatus,
        tosCode: error.tosCode,
        message: error.message,
      });
      return {
        buckets: [],
        ...classified,
      };
    }

    const message =
      error instanceof Error ? error.message : "Failed to list TOS buckets";
    return {
      status: "transient_error",
      buckets: [],
      message,
    };
  }
}

export function classifyTosRequestError(
  error: unknown
): Pick<VolcanoProbeTosBucketsResponse, "status" | "code" | "message"> {
  if (isTosRequestError(error)) {
    return classifyTosFailure({
      httpStatus: error.httpStatus,
      tosCode: error.tosCode,
      message: error.message,
    });
  }

  const message =
    error instanceof Error ? error.message : "TOS request failed";
  return {
    status: "transient_error",
    message,
  };
}
