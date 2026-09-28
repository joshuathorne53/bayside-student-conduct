# Bayside College Student Conduct Register

A secure staff application for recording, reviewing and actioning uniform and phone breaches. It replaces the spreadsheet workflow with an authenticated web interface and persistent database.

## What it does

- Restricts all pages and write operations to signed-in `@bayside.edu.vic.au` accounts.
- Records uniform and phone breaches with staff attribution and Melbourne timestamps.
- Calculates uniform escalation from distinct breach dates: Level 1 for days 1–3, then Levels 2–5 from days 4–7+.
- Generates a parent/carer email draft using the current escalation level.
- Filters the action register by homegroup and status, with durable actioned tracking.
- Stores students, breach types and breaches in Cloudflare D1.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The local Sites environment supplies a test identity and local D1 database. Production uses the Sites sign-in flow and server-side email-domain checks.

## Database

The Drizzle schema is in `db/schema.ts`; generated migrations are in `drizzle/`. The app also safely creates missing tables and default breach types at runtime.

Student records can be loaded into the `students` table with `id`, `name`, `homegroup` and `active` fields. Until a roster is loaded, staff can enter a student name and choose a homegroup manually.

## Deployment

The application is configured for OpenAI Sites in `.openai/hosting.json`. GitHub Pages is not suitable for this project because the staff login and database require server-side code.
