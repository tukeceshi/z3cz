import {

  SEEDANCE_2_0_T2V_OFFICIAL_V1,

  type NodeExecution,

  type NodeType,

} from "@dafthunk/types";



import type { NodeContext } from "../../node-types";

import { ExecutableNode } from "../../node-types";

import {

  buildRelayPollContinuation,

  resolveRelayProfile,

  submitNewApiRelayTask,

} from "../../upstream/newapi-relay-upstream";

import {

  buildRelayRequestBody,

  profileFieldsToNodeInputs,

  SEEDANCE_2_0_T2V_PROFILE,

} from "../../upstream/upstream-param-profiles";



const CONFIG_INPUTS = new Set([

  "profile_id",

  "relay_account_id",

  "timeout",

  "poll_interval",

]);



/**

 * Platform relay AI node — submits async upstream jobs through NewAPI and

 * relies on the workflow heartbeat to poll until completion.

 *

 * Billing is enforced by the upstream API (402/403). This node only displays

 * a reference price label in metadata for editors.

 */

export class RelayAiNode extends ExecutableNode {

  public static readonly nodeType: NodeType = {

    id: "relay-ai",

    name: "Relay AI",

    type: "relay-ai",

    description:

      "Run upstream AI models through a NewAPI relay. Seedance 2.0 text-to-video is available via the official parameter profile.",

    documentation: `Submit async generation jobs to a configured NewAPI relay account.



### Seedance 2.0 Text to Video



Uses profile \`${SEEDANCE_2_0_T2V_OFFICIAL_V1}\` with official T2V parameters (\`prompt\`, \`resolution\`, \`duration\`, \`aspect_ratio\`, \`generate_audio\`, etc.).



### Billing



Reference pricing is shown in the editor only. Execution billing and quota enforcement come from the upstream relay API response.



### Relay accounts



Configure platform relay accounts in Admin, or set \`NEWAPI_BASE_URL\` / \`NEWAPI_API_KEY\` on the API worker as a fallback. Leave \`relay_account_id\` empty to use the default account.`,

    tags: ["AI", "Video", "Relay", "Seedance"],

    icon: "film",

    inlinable: false,

    usage: 0,

    metadata: {

      referencePrice: SEEDANCE_2_0_T2V_PROFILE.referencePriceLabel,

      defaultProfileId: SEEDANCE_2_0_T2V_OFFICIAL_V1,

    },

    inputs: [

      {

        name: "profile_id",

        type: "string",

        description: "Upstream parameter profile",

        default: SEEDANCE_2_0_T2V_OFFICIAL_V1,

        hidden: true,

      },

      {

        name: "relay_account_id",

        type: "string",

        description: "Platform relay account (empty = default)",

        default: "",

        hidden: true,

      },

      ...profileFieldsToNodeInputs(SEEDANCE_2_0_T2V_PROFILE),

      {

        name: "timeout",

        type: "number",

        description: "Maximum time to wait for completion (minutes)",

        default: SEEDANCE_2_0_T2V_PROFILE.defaultTimeoutMinutes,

        minimum: 1,

        maximum: 120,

        hidden: true,

      },

      {

        name: "poll_interval",

        type: "number",

        description: "Time between upstream status checks (seconds)",

        default: SEEDANCE_2_0_T2V_PROFILE.defaultPollIntervalSec,

        minimum: 1,

        maximum: 60,

        hidden: true,

      },

    ],

    outputs: [

      {

        name: SEEDANCE_2_0_T2V_PROFILE.outputName,

        type: "video",

        description: "Generated video",

      },

    ],

  };



  async execute(context: NodeContext): Promise<NodeExecution> {

    try {

      const profileInput = context.inputs.profile_id;

      const profileResult = resolveRelayProfile(

        typeof profileInput === "string" ? profileInput : undefined

      );

      if ("error" in profileResult) {

        return this.createErrorResult(profileResult.error);

      }

      const profile = profileResult;



      const relayAccountIdInput = context.inputs.relay_account_id;

      const relayAccountId =

        typeof relayAccountIdInput === "string" &&

        relayAccountIdInput.trim().length > 0

          ? relayAccountIdInput.trim()

          : undefined;



      const account = context.resolveRelayAccount

        ? await context.resolveRelayAccount(relayAccountId, "newapi")

        : undefined;



      if (!account) {

        return this.createErrorResult(

          "No NewAPI relay account is configured. Add a platform relay account in Admin or set NEWAPI_BASE_URL and NEWAPI_API_KEY."

        );

      }



      if (!context.objectStore) {

        return this.createErrorResult("ObjectStore is not available");

      }



      const relayInputs = Object.fromEntries(

        Object.entries(context.inputs).filter(

          ([key]) => !CONFIG_INPUTS.has(key)

        )

      );



      const bodyResult = buildRelayRequestBody(profile, relayInputs);

      if ("error" in bodyResult && typeof bodyResult.error === "string") {
        return this.createErrorResult(bodyResult.error);
      }



      const timeoutMinutes = Math.max(

        1,

        Number(context.inputs.timeout) || profile.defaultTimeoutMinutes

      );

      const pollIntervalSec = Math.max(

        1,

        Number(context.inputs.poll_interval) || profile.defaultPollIntervalSec

      );



      const submitResult = await submitNewApiRelayTask({

        profile,

        body: bodyResult,

        baseUrl: account.baseUrl,

        apiKey: account.apiKey,

      });



      if ("error" in submitResult) {

        return this.createErrorResult(

          submitResult.error,

          submitResult.usage ?? 0

        );

      }



      const continuation = buildRelayPollContinuation({

        nodeId: this.node.id,

        profile,

        taskId: submitResult.taskId,

        pollUrl: submitResult.pollUrl,

        pollIntervalSec,

        timeoutMinutes,

        relayAccountId:

          account.id !== "env-fallback" ? account.id : relayAccountId,

      });



      return {

        nodeId: this.node.id,

        status: "pending",

        usage: 0,

        pendingEvent: {

          type: `upstream-poll-${submitResult.taskId}`,

          timeout: `${timeoutMinutes} minutes`,

        },

        pendingContinuation: continuation,

      };

    } catch (error) {

      return this.createErrorResult(

        error instanceof Error ? error.message : "Unknown error"

      );

    }

  }

}


