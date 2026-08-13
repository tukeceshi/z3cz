ALTER TABLE api_format_forwarding_rules
  ADD COLUMN IF NOT EXISTS upstream_url TEXT;

UPDATE api_format_forwarding_rules
SET upstream_url = rtrim(upstream_base_url, '/')
  || CASE
    WHEN upstream_submit_path IS NULL OR upstream_submit_path = '' THEN ''
    WHEN upstream_submit_path LIKE '/%' THEN upstream_submit_path
    ELSE '/' || upstream_submit_path
  END
WHERE upstream_url IS NULL;

ALTER TABLE api_format_forwarding_rules
  ALTER COLUMN upstream_url SET NOT NULL;

ALTER TABLE api_format_forwarding_rules
  DROP COLUMN upstream_base_url;

ALTER TABLE api_format_forwarding_rules
  DROP COLUMN upstream_submit_path;
