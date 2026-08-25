import { useSyncExternalStore } from "react";

import { GenerativeCloudAccelerationOffer } from "@/components/workflow/generative-cloud-acceleration-offer";
import {
  getGenerativeCloudAccelerationCardSession,
  subscribeGenerativeCloudAccelerationCardSession,
} from "@/services/generative-cloud-acceleration-session";

interface GenerativeCloudAccelerationCardOfferProps {
  readonly nodeId: string;
  readonly className?: string;
}

export function GenerativeCloudAccelerationCardOffer({
  nodeId,
  className,
}: GenerativeCloudAccelerationCardOfferProps) {
  const session = useSyncExternalStore(
    (listener) => subscribeGenerativeCloudAccelerationCardSession(nodeId, listener),
    () => getGenerativeCloudAccelerationCardSession(nodeId),
    () => undefined
  );

  if (!session) {
    return null;
  }

  return (
    <GenerativeCloudAccelerationOffer
      offerVisible={session.offerVisible}
      dialogOpen={session.dialogOpen}
      onDialogOpenChange={session.setDialogOpen}
      onSingleAccelerate={session.triggerSingle}
      onAlwaysAccelerate={session.triggerAlways}
      className={className}
    />
  );
}
