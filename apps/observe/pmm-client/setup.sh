#!/bin/bash
set -e

# Wait for PMM Server to be ready
until curl -k https://pmm-server:443/ping; do
    echo "Waiting for PMM Server..."
    sleep 5
done

# Function to parse DATABASE_URL
parse_db_url() {
    local db_url=$1
    local user=$(echo $db_url | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local pass=$(echo $db_url | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    local host=$(echo $db_url | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local port=$(echo $db_url | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local dbname=$(echo $db_url | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "$user $pass $host $port $dbname"
}

# Configure main database if DATABASE_URL is set
if [ ! -z "$MAIN_DATABASE_URL" ]; then
    read user pass host port dbname <<< $(parse_db_url "$MAIN_DATABASE_URL")
    pmm-admin add postgresql \
        --username="$user" \
        --password="$pass" \
        --host="$host" \
        --port="$port" \
        --database="$dbname" \
        --cluster=main-cluster \
        --environment=production \
        --service-name=main-db \
        --force
fi

# Configure web database if WEB_DATABASE_URL is set
if [ ! -z "$WEB_DATABASE_URL" ]; then
    read user pass host port dbname <<< $(parse_db_url "$WEB_DATABASE_URL")
    pmm-admin add postgresql \
        --username="$user" \
        --password="$pass" \
        --host="$host" \
        --port="$port" \
        --database="$dbname" \
        --cluster=web-cluster \
        --environment=production \
        --service-name=web-db \
        --force
fi

# Keep the container running
tail -f /dev/null 