# Legacy workflow nodes (archived)

The ~480 historical workflow nodes lived in `@dafthunk/runtime-legacy` and are **not part of the mainline product**.

## Location

```
archive/runtime-legacy/
```

This is a frozen copy for reference or for a future **independent branch**. Mainline does not depend on it, load it, or expose feature flags to enable it.

## Mainline scope

Mainline supports only these workflow node implementations:

- `ai-text`
- `ai-image`
- `ai-video`

Registry: `apps/api/src/runtime/cloudflare-node-registry.ts`  
Widgets: `apps/app/src/components/workflow/widgets/register-core-widgets.ts`

## Restoring legacy on a branch

1. Copy or checkout `archive/runtime-legacy` back to `packages/runtime-legacy`.
2. Re-add the workspace package and wire registration (see git history before legacy removal).
3. Do **not** merge legacy registration into mainline unless the product scope changes.

## Data

Development databases may contain old workflows with removed node types. Clear workflow data rather than migrating (`pnpm --filter @dafthunk/api db:reset` in dev).

## Verification

```bash
pnpm check:mainline-core-only
```

## Hidden UI features (mainline product)

These modules served archived workflow nodes. They are **removed from product navigation** but may still exist in the codebase (pages, API routes, DB tables).

### Console (org sidebar)

| Feature | Status |
|---------|--------|
| Playground | Removed |
| Feedback | Removed |
| Executions | Removed |
| Templates | Menu hidden; routes still work |
| Schema, Database, Datasets | Hidden |
| Integrations, Secrets, Emails, Queues, Bots | Hidden |
| AI Interfaces | **Visible** (mainline) |
| API Keys | Hidden |

### Admin

| Feature | Status |
|---------|--------|
| Organizations | Removed; org info merged into user detail |
| Datasets, Databases | Hidden |
| Relay accounts | Hidden |
| Feature settings | Hidden |
| Emails, Queues | Hidden |
| Workflow Schemes（工作流方案） | Removed（菜单隐藏；路由/API/DB 保留） |
| Workflow scheme “omnipotent” (全能方案) | Hidden |

Mainline admin focus: users (primary accounts), workflows, executions, AI models, site settings.

## Legacy node → product module

| Legacy node | Product module | Mainline status |
|-------------|----------------|-----------------|
| `create-feedback-form` | Feedback menu, public feedback page, evaluation criteria | Removed |

Feedback depended on `create-feedback-form` in `archive/runtime-legacy`. Mainline routes and navigation are removed; API routes, DB tables, and page files may remain for legacy branch reference.

## Workflow create & run (mainline)

Mainline simplifies workflow creation and moves runtime/trigger choice to the **Run** action.

| Area | Mainline behavior |
|------|-------------------|
| Create workflow | Name + description only; fixed `basic-canvas` scheme, `manual` trigger, `workflow` runtime, empty canvas |
| Run button | Opens run-config dialog: execution mode (`workflow` / `worker`) and run-as (`manual` / `http_request`) |
| Runtime persistence | Runtime is saved to the workflow when changed in the run-config dialog |
| Workflow settings | No trigger or runtime selectors (name, description, billing only) |
| Trigger nodes on create | Not auto-inserted (`manual` and `http_request` map to no nodes) |

### Legacy workflow triggers (removed from mainline product UI)

These trigger types remain in types/API/DB for archived workflows and webhooks, but are **not offered** in create, settings, or run-config UI:

- `scheduled`
- `http_webhook`
- `form_webhook`, `form_request`
- `email_message`
- `queue_message`
- `discord_event`, `telegram_event`, `whatsapp_event`, `slack_event`

Related product modules (Integrations, Secrets, Emails, Queues, Bots) are hidden from mainline navigation. Webhook routes and trigger node mappings remain in the codebase for legacy branch reference.

### Workflows list (mainline)

The org workflows page is a LibTV-style library grid: adaptive columns (2–5), cover images, one-level folders, and strict folder deletion (folder + all workflows inside). Cover uploads require configured cloud storage.
