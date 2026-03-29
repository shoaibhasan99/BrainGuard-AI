# notify-upcoming-appointments

This Supabase Edge Function scans the `appointments` table, finds appointments
starting in the next **2 hours**, and inserts rows into
`appointment_notifications` for both the patient and the doctor. Because the
notifications table has Realtime enabled, connected clients immediately receive
those reminders.

## Environment variables

The function expects the standard Supabase variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These are automatically injected when you deploy with `supabase functions deploy`.

## Deploy

From the project root:

```bash
supabase functions deploy notify-upcoming-appointments --no-verify-jwt
```

## Schedule (run every 10 minutes, for example)

In the Supabase Dashboard:

1. Go to **Edge Functions → Scheduled Functions → New schedule**
2. Select `notify-upcoming-appointments`
3. Cron expression example: `*/10 * * * *`

This means the function runs every 10 minutes and creates notifications for
appointments that start in roughly two hours.














