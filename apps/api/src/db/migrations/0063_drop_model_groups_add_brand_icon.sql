ALTER TABLE "platform_ai_models"
  ADD COLUMN IF NOT EXISTS "brand_icon" text;

UPDATE "platform_ai_models" AS m
SET "brand_icon" = g."icon"
FROM "platform_ai_model_groups" AS g
WHERE m."group_id" = g."id";

WITH "ordered_models" AS (
  SELECT
    m."canonical_id",
    ROW_NUMBER() OVER (
      ORDER BY
        COALESCE(g."sort_order", 999999),
        g."id" NULLS LAST,
        m."display_name"
    ) AS "row_num"
  FROM "platform_ai_models" AS m
  LEFT JOIN "platform_ai_model_groups" AS g
    ON m."group_id" = g."id"
)
UPDATE "platform_ai_models" AS m
SET "sort_order" = o."row_num" * 10
FROM "ordered_models" AS o
WHERE m."canonical_id" = o."canonical_id";

ALTER TABLE "platform_ai_models" DROP COLUMN IF EXISTS "group_id";

UPDATE "platform_ai_models"
SET "brand_icon" = 'sparkles'
WHERE "brand_icon" IS NULL;

DROP TABLE IF EXISTS "platform_ai_model_groups";
