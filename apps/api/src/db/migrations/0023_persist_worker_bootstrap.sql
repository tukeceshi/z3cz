ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS host text;

ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS ssh_port integer NOT NULL DEFAULT 22;

ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS ssh_username text;

ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS deploy_status text NOT NULL DEFAULT 'manual';

ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS deploy_error text;

ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS last_deploy_at timestamptz;

ALTER TABLE persist_workers
ADD COLUMN IF NOT EXISTS initialized_at timestamptz;
