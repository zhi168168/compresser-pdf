# Production monitoring

The deployment exposes `GET https://compresser-pdf.com/api/health`.
It performs a real `SELECT 1` database query and returns only:

- HTTP 200: `{"status":"ok"}`
- HTTP 503: `{"status":"unavailable"}`

Responses are not cached or indexed. The endpoint does not expose credentials,
hostnames, users, schema details, or PDF contents. It uses one connection per warm
health-function instance. Connection establishment times out after 10 seconds;
database statements time out after 3 seconds, with a 4-second client query timeout.
This accommodates a sleeping Neon database without leaving an unbounded query.
This check verifies availability, not account registration, mail delivery, or all
database tables. Use the manual account smoke test after releases as well.

## GitHub availability checks

For the current repository, the schedule was enabled on 2026-10-20 after a
successful manual check. No failed-workflow email delivery has been tested;
confirm the operator's GitHub notification preferences as described below.

The repository includes **Website availability** (`.github/workflows/monitor.yml`),
checking the production homepage and database health approximately every 15 minutes.
Activate it with Repository variable `AVAILABILITY_MONITOR_ENABLED=true`, then run
the workflow manually and confirm success. It retries a transient failure once.
If `HEALTH_CHECK_TOKEN` is set on Vercel, set the same Actions Secret for the monitor.
Successful checks do not send notifications from the application.

In GitHub Settings → Notifications → Actions, enable email notifications for failed
workflows and confirm the destination mailbox. No custom notification email is sent
by this implementation. A passing monitor proves checks worked, not that an alert
has reached the operator. Provider email notification preferences must be verified.

GitHub schedules may be delayed or skipped and can be disabled after prolonged
repository inactivity; inspect their latest success regularly. This is an initial
availability check, not a continuous uptime SLA. Account for Actions usage if the
repository becomes private. For more reliable independent alerts before paid launch,
also use a dedicated uptime service as below.

## Optional dedicated monitoring service

Create an HTTPS monitor in UptimeRobot or another provider for the URL above.
Start with a **15-minute interval**, HTTP 200 expected, and a timeout of at least
20 seconds. If supported, alert after two consecutive failures and send recovery
notifications. Use an email address you actually receive messages at. Create a
second, inexpensive homepage monitor for `https://compresser-pdf.com/`.

**No UptimeRobot account or dedicated notification subscription is created by
the code.** The operator must create it and test an alert/recovery notification.
Do not check the database endpoint every minute: every successful query wakes or
keeps Neon compute active and consumes the free compute allowance. Even 15-minute
checks consume compute; review Neon Usage after the first week. A five-minute
interval can prevent scale-to-zero and is inappropriate for a tight free budget.

Optional: set a random `HEALTH_CHECK_TOKEN` Secret in Vercel Production, redeploy,
and configure the monitor with `Authorization: Bearer <token>`. Use only a monitor
that supports private headers. Do not put this token in URLs. Without the variable,
the generic endpoint is public. The optional token reduces unauthorised database
wakeups; Vercel traffic/firewall controls can add protection if needed.

## Diagnose failures

1. Check Vercel deployment status and Function logs, filtering by the generic event.
2. Check Neon service status, compute state, usage and connection settings.
3. For missing emails, check Brevo Transactional logs and sending limits.
4. After recovery, verify the homepage, health endpoint and an actual account flow.

`server/observability.js` emits only an allowlisted event, a generated request ID,
and a timestamp. It must never receive request bodies, URLs, query strings,
headers, email addresses, passwords, tokens, raw errors, or PDF data. Do not enable
verbose authentication logs in production. Vercel and Brevo maintain their own
platform logs; review their access and retention in those provider dashboards.
No analytics or external telemetry SDK is added by this implementation.
