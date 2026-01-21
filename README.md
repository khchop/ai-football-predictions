This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Geist font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Coolify

This project is deployed using [Coolify](https://coolify.io). Coolify auto-detects Next.js applications and builds them using Nixpacks.

### Scheduled Tasks

Configure the following cron jobs in Coolify to call these endpoints:

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/update-live-scores` | `* * * * *` | Every minute |
| `/api/cron/fetch-fixtures` | `0 */6 * * *` | Every 6 hours |
| `/api/cron/fetch-analysis` | `*/10 * * * *` | Every 10 minutes |
| `/api/cron/generate-predictions` | `*/10 * * * *` | Every 10 minutes |
| `/api/cron/update-results` | `*/10 * * * *` | Every 10 minutes |
