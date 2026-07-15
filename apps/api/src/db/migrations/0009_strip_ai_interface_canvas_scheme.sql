-- Strip legacy canvas "ai-interface" force-include from workflow schemes.
-- Organization AI/Resource APIs and template execution plumbing are unchanged.

UPDATE "workflow_schemes"
SET "always_include_node_types" = '[]'
WHERE "always_include_node_types" IS NOT NULL
  AND "always_include_node_types" LIKE '%ai-interface%';
