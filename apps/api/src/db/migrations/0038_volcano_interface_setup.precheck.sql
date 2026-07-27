-- Precheck for 0038_volcano_interface_setup
-- Fails if any organization already has more than one doubao_volcano interface
-- (unique index in 0038 would otherwise fail mid-migrate).

DO $$
DECLARE
  conflict_rows text;
BEGIN
  IF to_regclass('public.organization_ai_interfaces') IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(organization_id || ' (' || cnt || ')', ', ' ORDER BY organization_id)
  INTO conflict_rows
  FROM (
    SELECT organization_id, COUNT(*)::text AS cnt
    FROM organization_ai_interfaces
    WHERE provider = 'doubao_volcano'
    GROUP BY organization_id
    HAVING COUNT(*) >= 2
  ) t;

  IF conflict_rows IS NOT NULL THEN
    RAISE EXCEPTION
      'Precheck failed for 0038_volcano_interface_setup: duplicate volcano interfaces — %',
      conflict_rows;
  END IF;
END $$;
