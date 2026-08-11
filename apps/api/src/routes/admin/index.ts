import { Hono } from "hono";

import { jwtMiddleware } from "../../auth";
import { ApiContext } from "../../context";
import { adminMiddleware } from "../../middleware/admin";
import adminDatabasesRoutes from "./databases";
import adminEmailsRoutes from "./emails";
import adminExecutionsRoutes from "./executions";
import adminObjectsRoutes from "./objects";
import adminOnboardingRoutes from "./onboarding";
import adminOnboardingMessageRoutes from "./onboarding-message";
import adminOrganizationsRoutes from "./organizations";
import adminPersistWorkerRoutes from "./persist-workers";
import adminLegalDocumentsRoutes from "./legal-documents";
import adminAiModelsRoutes from "./ai-models";
import adminAuthConfigRoutes from "./auth-config";
import adminModelInvocationsRoutes from "./model-invocations";
import adminQueuesRoutes from "./queues";
import adminSettingsRoutes from "./settings";
import adminFeatureConfigRoutes from "./feature-config";
import adminStatsRoutes from "./stats";
import adminSupportRoutes from "./support";
import adminUsersRoutes from "./users";
import adminWorkflowSchemesRoutes from "./workflow-schemes";
import adminWorkflowsRoutes from "./workflows";

const adminRoutes = new Hono<ApiContext>();

// Apply authentication middleware to all admin routes
adminRoutes.use("*", jwtMiddleware);

// Apply admin role check to all admin routes
adminRoutes.use("*", adminMiddleware);

// Mount admin sub-routes
adminRoutes.route("/stats", adminStatsRoutes);
adminRoutes.route("/settings", adminSettingsRoutes);
adminRoutes.route("/legal-documents", adminLegalDocumentsRoutes);
adminRoutes.route("/auth-config", adminAuthConfigRoutes);
adminRoutes.route("/feature-config", adminFeatureConfigRoutes);
adminRoutes.route("/workflow-schemes", adminWorkflowSchemesRoutes);
adminRoutes.route("/persist-workers", adminPersistWorkerRoutes);
adminRoutes.route("/ai-models", adminAiModelsRoutes);
adminRoutes.route("/model-invocations", adminModelInvocationsRoutes);
adminRoutes.route("/onboarding", adminOnboardingRoutes);
adminRoutes.route("/onboarding", adminOnboardingMessageRoutes);
adminRoutes.route("/users", adminUsersRoutes);
adminRoutes.route("/organizations", adminOrganizationsRoutes);
adminRoutes.route("/workflows", adminWorkflowsRoutes);
adminRoutes.route("/executions", adminExecutionsRoutes);
adminRoutes.route("/objects", adminObjectsRoutes);
adminRoutes.route("/emails", adminEmailsRoutes);
adminRoutes.route("/support", adminSupportRoutes);
adminRoutes.route("/queues", adminQueuesRoutes);
adminRoutes.route("/databases", adminDatabasesRoutes);

export default adminRoutes;
