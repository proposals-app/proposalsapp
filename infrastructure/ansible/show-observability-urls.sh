#!/bin/bash

echo "========================================"
echo "Observability Stack Access URLs"
echo "========================================"

# Function to get service info from Consul
get_service_url() {
    local service=$1
    local port=$2
    local consul_server="100.125.71.27"
    
    # Query Consul for the service
    local result=$(curl -s "http://${consul_server}:8500/v1/health/service/${service}?passing=true" | \
        jq -r '.[0] | "\(.Service.Address):\(.Service.Port)"' 2>/dev/null)
    
    if [ "$result" != "null:null" ] && [ -n "$result" ]; then
        echo "http://${result}"
    else
        echo "Service not found or not healthy"
    fi
}

echo ""
echo "Grafana UI:"
echo "  URL: $(get_service_url grafana 3000)"
echo "  Login: admin / admin"
echo ""
echo "Prometheus:"
echo "  URL: $(get_service_url prometheus 9090)"
echo ""
echo "Loki:"
echo "  URL: $(get_service_url loki 3100)"
echo ""
echo "Alloy (on each node):"
echo "  - http://100.102.96.79:12345 (dc3/fsn)"
echo "  - http://100.122.216.79:12345 (dc1/sib-01)"
echo "  - http://100.116.72.67:12345 (dc2/sib-03)"
echo ""
echo "========================================"
echo ""
echo "To check service health:"
echo "  curl -s http://100.125.71.27:8500/v1/health/service/grafana?passing=true | jq ."
echo "  curl -s http://100.125.71.27:8500/v1/health/service/prometheus?passing=true | jq ."
echo "  curl -s http://100.125.71.27:8500/v1/health/service/loki?passing=true | jq ."
echo ""