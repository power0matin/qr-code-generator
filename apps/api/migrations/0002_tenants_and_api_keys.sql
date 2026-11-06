CREATE TABLE IF NOT EXISTS moduqr.tenants (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  is_bootstrap_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_bootstrap_owner_idx
  ON moduqr.tenants (is_bootstrap_owner)
  WHERE is_bootstrap_owner = true;

CREATE TABLE IF NOT EXISTS moduqr.api_keys (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES moduqr.tenants(id) ON DELETE CASCADE,
  prefix varchar(12) NOT NULL UNIQUE CHECK (prefix ~ '^[A-Za-z0-9_-]{12}$'),
  secret_hash varchar(64) NOT NULL CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] NOT NULL CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY[
      'links:read',
      'links:write',
      'links:delete',
      'analytics:read',
      'keys:manage'
    ]::text[]
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX IF NOT EXISTS api_keys_tenant_created_idx
  ON moduqr.api_keys (tenant_id, created_at DESC, id);

CREATE TABLE IF NOT EXISTS moduqr.api_rate_limit_windows (
  api_key_id uuid NOT NULL REFERENCES moduqr.api_keys(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (api_key_id, window_started_at)
);

CREATE TABLE IF NOT EXISTS moduqr.idempotency_records (
  tenant_id uuid NOT NULL REFERENCES moduqr.tenants(id) ON DELETE CASCADE,
  idempotency_key varchar(128) NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
  operation varchar(80) NOT NULL CHECK (length(operation) BETWEEN 1 AND 80),
  request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  resource_id uuid,
  response_status integer CHECK (response_status BETWEEN 100 AND 599),
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(response_metadata) <= 8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  PRIMARY KEY (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idempotency_records_expiry_idx
  ON moduqr.idempotency_records (expires_at);

UPDATE moduqr.instance_metadata
SET schema_version = 2,
    updated_at = now()
WHERE singleton = true
  AND schema_version < 2;
