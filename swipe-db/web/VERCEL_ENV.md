# Vercel Environment Variables

Configure these in Vercel Project Settings > Environment Variables.

## Required

```bash
DATABASE_URL=
R2_ACCOUNT_ID=d00730b1a6b727069dc485d8018b018c
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=business-hub-materials
```

`DATABASE_URL` must be a production Postgres connection string. The local `brunonikel@localhost` value from `.env` will not work on Vercel.

`R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are already in the local ignored `.env` file. Copy them from there into Vercel; do not commit them.

## Optional

```bash
R2_PUBLIC_BASE_URL=
PRISMA_LOG_QUERIES=0
```

Leave `R2_PUBLIC_BASE_URL` blank unless a public/custom R2 domain is configured. When blank, the app creates short-lived signed R2 URLs server-side.
