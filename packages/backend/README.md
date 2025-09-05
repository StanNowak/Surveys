# Backend (Postgres + PostgREST)

## Dev quickstart
1) cp postgrest/.env.example postgrest/.env
2) docker compose up
3) RPC endpoints:
   - POST http://localhost:8787/rpc/assign_pair
   - POST http://localhost:8787/rpc/submit_response
   - POST http://localhost:8787/rpc/delete_by_uuid
   - GET  http://localhost:8787/rpc/export_ndjson

## Smoke tests
curl -s http://localhost:8787/rpc/assign_pair -H 'Content-Type: application/json' \
  -d '{"p_uuid":"U1","p_stratum":"novice","p_ap_list":["storm","wind","persistent","cornice"]}'

curl -s http://localhost:8787/rpc/submit_response -H 'Content-Type: application/json' \
  -d '{"uuid":"U1","survey_id":"ap_v1","pair":["persistent","wind"],"stratum":"novice","answers":{},"timings":{},"panel_member":true}'
