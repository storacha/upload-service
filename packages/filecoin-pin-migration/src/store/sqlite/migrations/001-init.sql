-- Schema version handled via PRAGMA user_version (no table).

CREATE TABLE migration_state (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  phase  TEXT NOT NULL CHECK (phase IN (
    'reading', 'planning', 'approved', 'funded', 'migrating', 'complete', 'incomplete'
  ))
);

CREATE TABLE spaces (
  did                    TEXT PRIMARY KEY,
  name                   TEXT,
  phase                  TEXT NOT NULL CHECK (phase IN (
    'pending', 'migrating', 'complete', 'incomplete', 'failed'
  )),
  total_bytes            INTEGER NOT NULL,
  total_size_to_migrate  INTEGER NOT NULL,
  reader_cursor          TEXT
);

CREATE TABLE uploads (
  space_did  TEXT NOT NULL,
  root_cid   TEXT NOT NULL,
  skipped    INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1)),
  PRIMARY KEY (space_did, root_cid),
  FOREIGN KEY (space_did) REFERENCES spaces(did)
);

CREATE TABLE shards (
  space_did   TEXT NOT NULL,
  shard_cid   TEXT NOT NULL,
  root_cid    TEXT NOT NULL,
  piece_cid   TEXT,
  source_url  TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('pull','store')),
  PRIMARY KEY (space_did, shard_cid, root_cid),
  FOREIGN KEY (space_did, root_cid) REFERENCES uploads(space_did, root_cid)
);

CREATE INDEX idx_shards_kind ON shards(space_did, kind);
CREATE INDEX idx_shards_root ON shards(space_did, root_cid);

CREATE TABLE space_copies (
  space_did         TEXT NOT NULL,
  copy_index        INTEGER NOT NULL,
  provider_id       TEXT NOT NULL,
  service_provider  TEXT NOT NULL,
  provider_url      TEXT,
  data_set_id       TEXT,
  PRIMARY KEY (space_did, copy_index),
  FOREIGN KEY (space_did) REFERENCES spaces(did)
);

CREATE TABLE shard_progress (
  space_did     TEXT NOT NULL,
  copy_index    INTEGER NOT NULL,
  shard_cid     TEXT NOT NULL,
  pulled        INTEGER NOT NULL DEFAULT 0 CHECK (pulled IN (0, 1)),
  stored_piece  TEXT,
  PRIMARY KEY (space_did, copy_index, shard_cid),
  CHECK (stored_piece IS NULL OR copy_index = 0),
  FOREIGN KEY (space_did, copy_index) REFERENCES space_copies(space_did, copy_index)
);

CREATE INDEX idx_shard_progress_pulled ON shard_progress(space_did, copy_index, shard_cid)
  WHERE pulled = 1;

CREATE TABLE commit_progress (
  space_did   TEXT NOT NULL,
  copy_index  INTEGER NOT NULL,
  shard_cid   TEXT NOT NULL,
  root_cid    TEXT NOT NULL,
  PRIMARY KEY (space_did, copy_index, shard_cid, root_cid),
  FOREIGN KEY (space_did, copy_index) REFERENCES space_copies(space_did, copy_index),
  FOREIGN KEY (space_did, shard_cid, root_cid) REFERENCES shards(space_did, shard_cid, root_cid)
);

CREATE TABLE failed_uploads (
  space_did   TEXT NOT NULL,
  copy_index  INTEGER NOT NULL,
  root_cid    TEXT NOT NULL,
  PRIMARY KEY (space_did, copy_index, root_cid),
  FOREIGN KEY (space_did, copy_index) REFERENCES space_copies(space_did, copy_index),
  FOREIGN KEY (space_did, root_cid) REFERENCES uploads(space_did, root_cid)
);
