up:
	docker compose -f ../../packages/backend/docker-compose.yml up -d
down:
	docker compose -f ../../packages/backend/docker-compose.yml down
smoke:
	curl -s http://localhost:8787/rpc/assign_pair -H 'Content-Type: application/json' \
	  -d '{"p_uuid":"U1","p_stratum":"novice","p_ap_list":["storm","wind","persistent","cornice"]}' && echo
	curl -s http://localhost:8787/rpc/submit_response -H 'Content-Type: application/json' \
	  -d '{"p_payload":{"uuid":"U1","survey_id":"ap_v1","pair":["persistent","wind"],"stratum":"novice","answers":{},"timings":{},"panel_member":true}}' && echo
