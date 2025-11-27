-- Migration: Add AP type balancing
-- This ensures individual AP types are balanced within each stratum

-- Table already created in 001-core.sql, but adding here for reference
-- CREATE TABLE IF NOT EXISTS s_ap_v1.ap_type_counts(
--   stratum    text NOT NULL DEFAULT 'global',
--   ap_type    text NOT NULL,
--   count      int  NOT NULL DEFAULT 0,
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   PRIMARY KEY (stratum, ap_type)
-- );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON s_ap_v1.ap_type_counts TO web_anon;

-- Optional: Create view to see balance per stratum
CREATE OR REPLACE VIEW s_ap_v1.balance_report AS
SELECT 
    stratum,
    ap_type,
    count,
    ROUND(100.0 * count / NULLIF(SUM(count) OVER (PARTITION BY stratum), 0), 2) as pct_of_total
FROM s_ap_v1.ap_type_counts
ORDER BY stratum, count DESC;

GRANT SELECT ON s_ap_v1.balance_report TO web_anon;

