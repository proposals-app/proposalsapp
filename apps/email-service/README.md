# Email Service (Simplified)

A streamlined email notification service for ProposalsApp that sends notifications for:

- New proposals
- Ending proposals
- New discussions

## Features

- **Single file implementation** (~380 lines)
- **Type-safe** - No `as any` casts
- **Direct database queries** using Kysely
- **Email templates** from `@proposalsapp/emails` library
- **Cron-based scheduling** - runs every minute
- **Notification cooldowns** - prevents duplicate emails
- **Multi-DAO support** - Arbitrum and Uniswap

## Architecture

```
index.ts
├── Configuration
├── Database helper (getDaoDb)
├── Email sending (Resend)
├── Notification tracking
├── DAO processing
└── Cron scheduler
```

## Dependencies

- `@proposalsapp/db` - Database access
- `@proposalsapp/emails` - Email templates
- `resend` - Email sending
- `node-cron` - Scheduling
- `date-fns` - Date formatting

## Running

```bash
# Install dependencies
yarn install

# Set environment variables
export RESEND_API_KEY=your_api_key

# Run the service
yarn start
```

## Environment Variables

- `RESEND_API_KEY` - Required. Your Resend API key
- `FROM_EMAIL` - Optional. Default: "Proposals.app <no-reply@proposals.app>"
- `RESEND_MAX_SENDS_PER_SECOND` - Optional. Default: `4`. Sends are spaced to stay under Resend's
  per-team API rate limit (10 requests/second by default, shared with the web app)
- `NEW_ITEM_LOOKBACK_HOURS` - Optional. Default: `24`. How far back to look for proposals whose
  voting started and topics that were created

## How It Works

1. **Every minute**, the cron job runs
2. **For each DAO**, it checks for:
   - New proposals (active, voting started in the last 24 hours)
   - Ending proposals (ending in next 60 minutes)
   - New discussions (created in the last 24 hours)
3. **For each notification type**, it:
   - Gets users who opted in for that notification type
   - Checks if notification was already sent (new proposals and discussions: ever; ending proposals:
     within a 24 hour cooldown)
   - Sends email using Resend
   - Records notification in database

## Database Schema

Uses the following tables:

- `dao` - DAO information
- `proposal` - Proposals
- `discourseTopic` - Forum discussions
- `discoursePost` - Forum posts (to get topic author)
- `discourseUser` - Forum users
- `user` - User preferences
- `userNotification` - Notification history
- `voter` - For ENS lookups

## Type Safety

The service is fully type-safe with:

- Typed database queries via Kysely
- Proper DAO database resolution
- No `as any` casts
- Full TypeScript strict mode
