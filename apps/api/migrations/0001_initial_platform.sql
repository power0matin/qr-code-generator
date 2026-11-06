CREATE SCHEMA IF NOT EXISTS moduqr;

CREATE TABLE IF NOT EXISTS moduqr.instance_metadata (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO moduqr.instance_metadata (singleton, schema_version)
VALUES (true, 1)
ON CONFLICT (singleton) DO NOTHING;
