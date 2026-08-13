import type { PlatformVideoModelBaseline } from "@dafthunk/types";

import { buildPlatformVideoCapabilityBaseline } from "@dafthunk/types";



import type { Database } from "../db";

import {

  getVideoParameterRules,

  listPlatformAiModels,

} from "../db/platform-ai-model-queries";



export async function listPlatformVideoModelBaselines(

  db: Database

): Promise<readonly PlatformVideoModelBaseline[]> {

  const platformModels = await listPlatformAiModels(db, "video");



  return platformModels

    .filter((model) => model.platformEnabled)

    .map((model) => {

      const rules = getVideoParameterRules(model);

      const baseline = buildPlatformVideoCapabilityBaseline({ rules });

      return {

        canonicalId: model.canonicalId,

        ...baseline,

      };

    });

}

