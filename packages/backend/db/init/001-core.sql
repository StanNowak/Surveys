CREATE ROLE web_anon NOLOGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS s_ap_v1;
GRANT USAGE ON SCHEMA s_ap_v1 TO web_anon;

CREATE TABLE IF NOT EXISTS s_ap_v1.pair_counts(
  stratum    text NOT NULL DEFAULT 'global',
  ap_a       text NOT NULL,
  ap_b       text NOT NULL,
  count      int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stratum, ap_a, ap_b)
);

CREATE TABLE IF NOT EXISTS s_ap_v1.allocations(
  uuid       text PRIMARY KEY,
  stratum    text NOT NULL DEFAULT 'global',
  assignment jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS s_ap_v1.responses(
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid           text NOT NULL,
  survey_id      text NOT NULL,
  payload        jsonb NOT NULL,
  panel_member   boolean,
  bank_version   text,
  config_version text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA s_ap_v1 TO web_anon;
