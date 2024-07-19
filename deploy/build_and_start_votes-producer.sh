#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo ".env file not found"
    exit 1
fi

# Run nixpacks build with the specified config and environment variables
nixpacks build --config nixpacks/votes-producer.toml . --name votes-producer

docker run -it votes-producer
