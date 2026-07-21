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
