CREATE TABLE IF NOT EXISTS workflow_folders (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cover_object_id TEXT,
  cover_mime_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS workflow_folders_organization_id_idx ON workflow_folders (organization_id);
CREATE INDEX IF NOT EXISTS workflow_folders_updated_at_idx ON workflow_folders (updated_at);

ALTER TABLE workflows ADD COLUMN folder_id TEXT REFERENCES workflow_folders(id) ON DELETE SET NULL;
ALTER TABLE workflows ADD COLUMN cover_object_id TEXT;
ALTER TABLE workflows ADD COLUMN cover_mime_type TEXT;

CREATE INDEX IF NOT EXISTS workflows_folder_id_idx ON workflows (folder_id);
