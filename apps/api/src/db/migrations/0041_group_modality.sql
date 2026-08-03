-- Scope model groups by modality (text / image / video / audio).
ALTER TABLE "platform_ai_model_groups"
  ADD COLUMN IF NOT EXISTS "modality" text NOT NULL DEFAULT 'text';

-- Prefer the most common linked model modality; otherwise keep text.
UPDATE "platform_ai_model_groups" AS g
SET "modality" = COALESCE(
  (
    SELECT m."modality"
    FROM "platform_ai_models" AS m
    WHERE m."group_id" = g."id"
    GROUP BY m."modality"
    ORDER BY COUNT(*) DESC, m."modality" ASC
    LIMIT 1
  ),
  'text'
);

-- For models whose modality differs from the group's primary modality,
-- create a sibling group and reassign them.
INSERT INTO "platform_ai_model_groups" (
  "id",
  "name",
  "description",
  "icon",
  "modality",
  "sort_order"
)
SELECT
  g."id" || '-' || m."modality",
  g."name",
  g."description",
  g."icon",
  m."modality",
  g."sort_order"
FROM "platform_ai_model_groups" AS g
INNER JOIN "platform_ai_models" AS m
  ON m."group_id" = g."id"
WHERE m."modality" <> g."modality"
GROUP BY
  g."id",
  g."name",
  g."description",
  g."icon",
  g."sort_order",
  m."modality"
ON CONFLICT ("id") DO NOTHING;

UPDATE "platform_ai_models" AS m
SET "group_id" = m."group_id" || '-' || m."modality"
FROM "platform_ai_model_groups" AS g
WHERE m."group_id" = g."id"
  AND m."modality" <> g."modality"
  AND EXISTS (
    SELECT 1
    FROM "platform_ai_model_groups" AS sibling
    WHERE sibling."id" = m."group_id" || '-' || m."modality"
  );
