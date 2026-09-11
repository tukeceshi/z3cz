import { z } from "zod";

export const persistWorkerIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const persistWorkerPoolSettingsSchema = z.object({
  enabled: z.boolean(),
});

export const persistWorkerBootstrapSchema = z.object({
  id: persistWorkerIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  host: z.string().trim().min(1).max(255),
  sshPort: z.number().int().min(1).max(65535).optional(),
  sshUsername: z.string().trim().min(1).max(120),
  sshPassword: z.string().min(1).max(256),
  maxConcurrentJobs: z.number().int().min(1).max(32).optional(),
});

export const persistWorkerRedeploySchema = z.object({
  sshPassword: z.string().min(1).max(256),
});
