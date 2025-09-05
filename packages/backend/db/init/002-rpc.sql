-- Assign least-used pair, stratified by p_stratum (experience band)
CREATE OR REPLACE FUNCTION s_ap_v1.assign_pair(
  p_uuid text,
  p_stratum text,
  p_ap_list text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r record; best record; s text;
BEGIN
  s := COALESCE(p_stratum,'global');

  SELECT assignment INTO r FROM s_ap_v1.allocations
   WHERE uuid=p_uuid AND stratum=s;
  IF FOUND THEN RETURN r.assignment; END IF;

  WITH pairs AS (
    SELECT LEAST(a,b) ap_a, GREATEST(a,b) ap_b
    FROM unnest(p_ap_list) a CROSS JOIN unnest(p_ap_list) b
    WHERE a < b
  ), counts AS (
    SELECT p.ap_a, p.ap_b, COALESCE(c.count,0) ct
    FROM pairs p
    LEFT JOIN s_ap_v1.pair_counts c
      ON c.stratum=s AND c.ap_a=p.ap_a AND c.ap_b=p.ap_b
  )
  SELECT ap_a, ap_b, ct INTO best
  FROM counts
  ORDER BY ct ASC, random() LIMIT 1;

  INSERT INTO s_ap_v1.allocations(uuid, stratum, assignment)
  VALUES (p_uuid, s,
    jsonb_build_object('pair', jsonb_build_array(best.ap_a, best.ap_b), 'stratum', s))
  ON CONFLICT (uuid) DO NOTHING;

  RETURN jsonb_build_object('pair', jsonb_build_array(best.ap_a, best.ap_b), 'stratum', s);
END $$;

-- Save response and increment counts (increment-on-submit)
CREATE OR REPLACE FUNCTION s_ap_v1.submit_response(p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a text; b text; s text;
BEGIN
  a := (p_payload->'pair'->>0);
  b := (p_payload->'pair'->>1);
  s := COALESCE(p_payload->>'stratum','global');

  INSERT INTO s_ap_v1.pair_counts(stratum, ap_a, ap_b, count)
  VALUES (s, LEAST(a,b), GREATEST(a,b), 1)
  ON CONFLICT (stratum, ap_a, ap_b)
  DO UPDATE SET count = s_ap_v1.pair_counts.count + 1, updated_at=now();

  INSERT INTO s_ap_v1.responses(
    uuid, survey_id, payload, panel_member, bank_version, config_version
  ) VALUES (
    p_payload->>'uuid',
    p_payload->>'survey_id',
    p_payload,
    (p_payload->>'panel_member')::boolean,
    p_payload->>'bank_version',
    p_payload->>'config_version'
  );

  RETURN true;
END $$;

-- GDPR helpers
CREATE OR REPLACE FUNCTION s_ap_v1.delete_by_uuid(p_uuid text)
RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$
  WITH del AS (DELETE FROM s_ap_v1.responses WHERE uuid = p_uuid RETURNING 1)
  SELECT COALESCE((SELECT count(*) FROM del), 0);
$$;

CREATE OR REPLACE FUNCTION s_ap_v1.export_ndjson()
RETURNS SETOF text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT payload::text FROM s_ap_v1.responses ORDER BY created_at;
$$;

GRANT EXECUTE ON FUNCTION s_ap_v1.assign_pair(text,text,text[]) TO web_anon;
GRANT EXECUTE ON FUNCTION s_ap_v1.submit_response(jsonb)          TO web_anon;
GRANT EXECUTE ON FUNCTION s_ap_v1.delete_by_uuid(text)            TO web_anon;
GRANT EXECUTE ON FUNCTION s_ap_v1.export_ndjson()                 TO web_anon;
