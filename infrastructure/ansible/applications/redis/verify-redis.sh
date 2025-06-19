#!/bin/bash
# Verify Redis deployment and HAProxy configuration

set -e

echo "=== Redis Deployment Verification ==="
echo

# Check if Redis job is running
echo "1. Checking Nomad job status..."
if nomad job status redis >/dev/null 2>&1; then
    echo "✓ Redis job is deployed"
    nomad job status redis | grep -A 5 "Allocations"
else
    echo "✗ Redis job not found"
    exit 1
fi
echo

# Check etcd for Redis instances
echo "2. Checking etcd for Redis instances..."
ETCD_ENDPOINTS=$(consul kv get etcd/endpoints 2>/dev/null || echo "http://localhost:2379")
echo "Using etcd endpoints: $ETCD_ENDPOINTS"

for endpoint in $(echo $ETCD_ENDPOINTS | tr ',' ' '); do
    echo "Checking $endpoint..."
    if curl -s "$endpoint/v3/kv/range" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"key":"'$(echo -n "/service/redis/instances" | base64)'","range_end":"'$(echo -n "/service/redis/instancez" | base64)'"}' | grep -q "key"; then
        echo "✓ Found Redis instances in etcd"
        break
    fi
done
echo

# Check HAProxy on local node
echo "3. Checking HAProxy status..."
if systemctl is-active --quiet haproxy; then
    echo "✓ HAProxy is running"
    
    # Check if HAProxy is configured with Redis backends
    if curl -s http://localhost:8404/stats | grep -q "redis"; then
        echo "✓ HAProxy has Redis backends configured"
    else
        echo "⚠ HAProxy is running but no Redis backends found"
    fi
else
    echo "✗ HAProxy is not running"
fi
echo

# Check Confd
echo "4. Checking Confd status..."
if systemctl is-active --quiet confd-redis; then
    echo "✓ Confd is running"
    journalctl -u confd-redis -n 10 --no-pager | tail -5
else
    echo "✗ Confd is not running"
fi
echo

# Test Redis connection through HAProxy
echo "5. Testing Redis connection through HAProxy..."
REDIS_PASSWORD=$(consul kv get redis/password 2>/dev/null || echo "proposalsapp_redis_password")

if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h localhost -p 6380 -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
        echo "✓ Redis connection successful through HAProxy"
        
        # Test write
        TEST_KEY="test:verify:$(date +%s)"
        if redis-cli -h localhost -p 6380 -a "$REDIS_PASSWORD" SET "$TEST_KEY" "test-value" EX 60 2>/dev/null | grep -q "OK"; then
            echo "✓ Write operation successful"
        fi
        
        # Test read
        if redis-cli -h localhost -p 6380 -a "$REDIS_PASSWORD" GET "$TEST_KEY" 2>/dev/null | grep -q "test-value"; then
            echo "✓ Read operation successful"
        fi
    else
        echo "✗ Failed to connect to Redis through HAProxy"
    fi
else
    echo "⚠ redis-cli not installed, skipping connection test"
fi
echo

echo "=== Verification Complete ==="
echo
echo "To view HAProxy stats: http://localhost:8404/stats"
echo "To connect to Redis: redis-cli -h localhost -p 6380 -a <password>"