/**
 * Widget Registry bootstrap — core generative widgets only.
 */

import { registry } from "./registry";
import { registerCoreWidgets } from "./register-core-widgets";

registerCoreWidgets(registry);

export { registry };
