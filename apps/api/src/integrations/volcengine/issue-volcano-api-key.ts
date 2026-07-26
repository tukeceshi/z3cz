import type { AiModelCatalogEntry } from "@dafthunk/types";



import type { VolcengineCredentials } from "./client";

import { canDeferVolcanoArkApiKey } from "./can-defer-volcano-ark-api-key";

import { isVolcanoArkNotOpenedError } from "./errors";

import {

  getVolcanoArkApiKey,

  type GetApiKeyResult,

} from "./get-api-key";



/**

 * Issues an Ark API key when possible. Returns null when models are provisioned

 * via billing packages but no API key can be minted yet (defer to ensureVolcanoApiKey).

 */

export async function issueVolcanoArkApiKeyForInterface(params: {

  credentials: VolcengineCredentials;

  catalogEntries: readonly AiModelCatalogEntry[];

}): Promise<GetApiKeyResult | null> {

  try {

    return await getVolcanoArkApiKey(params.credentials);

  } catch (error) {

    if (!isVolcanoArkNotOpenedError(error)) {

      throw error;

    }



    const canDefer = await canDeferVolcanoArkApiKey({

      credentials: params.credentials,

      catalog: params.catalogEntries,

    });



    if (canDefer) {

      return null;

    }



    throw error;

  }

}

