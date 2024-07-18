#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo ".env file not found"
    exit 1
fi

# Run nixpacks build with the specified config and environment variables
nixpacks build --config nixpacks/web-arbitrum.toml . --name web-arbitrum \
--env DATABASE_URL=$DATABASE_URL \
--env POSTMARK_API_KEY=$POSTMARK_API_KEY \
--env NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
--env PORT=3000

docker run -p 3000:3000 -it web-arbitrum
