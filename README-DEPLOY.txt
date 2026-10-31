Codex Hub Backend — full upgrade package
========================================
Files: server.js, reminders-routes.js, paystack-routes.js, fcm-routes.js,
       brevo-verify-routes.js, tavily-search.js, package.json

Render env (add if missing):
  HUB_PAYSTACK_SECRET_KEY   = sk_test_... or sk_live_... from NEW Hub Paystack business
  HUB_FRONTEND_URL          = https://codex-hub-prime.vercel.app
  FIREBASE_SERVICE_ACCOUNT  = (JSON service account)
  REMINDER_CRON_KEY         = long random string
  REMINDER_CRON_INPROCESS   = 1
  + existing AI / Brevo / Tavily keys

After deploy check:
  GET /paystack/status
  GET /reminders/status
  GET /credits/status  (needs Bearer)
