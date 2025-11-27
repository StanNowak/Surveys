#!/bin/bash
# Quick test script for assignment balancing

echo "🧪 Testing Assignment Balancing"
echo ""

# Test 10 assignments
echo "Making 10 assignments in 'novice' stratum..."
for i in {1..10}; do
  UUID="test_$(date +%s)_$i"
  RESULT=$(curl -s -X POST http://localhost:8000/api/studies/avalanche_2025/assign \
    -H "Content-Type: application/json" \
    -d "{\"p_uuid\":\"$UUID\",\"p_stratum\":\"novice\",\"p_ap_list\":[\"storm_slab\",\"wind_slab\",\"persistent_slab\",\"deep_persistent_slab\"]}")
  
  PAIR=$(echo $RESULT | python3 -c "import sys, json; d=json.load(sys.stdin); print(','.join(d['pair']))" 2>/dev/null)
  echo "  $i. $PAIR"
done

echo ""
echo "Checking balance counts..."
docker exec backend-db-1 psql -U postgres -d surveys -c \
  "SELECT ap_type, count FROM s_ap_v1.ap_type_counts WHERE stratum = 'novice' ORDER BY ap_type;" 2>&1 | grep -v "row\|stratum\|^$"

echo ""
echo "✅ Test complete!"

