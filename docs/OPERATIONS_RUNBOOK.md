# Operations checks and recovery

Status: local implementation and deterministic tests. The check below also ran read-only against the configured database on 22 October 2026: worker heartbeat valid, no queued scans, no failed/partial scans in the recent window. New request/provider/webhook counters are not deployed yet, so zero counters do not establish live provider health. External alert routing and recovery drills remain open under R13/R14.

## Read-only monitoring

From `backend`, run `npm run ops:check` with the intended environment's backend `DATABASE_URL`. The CLI honors `MONGODB_DNS_SERVERS`, disables collection/index creation, uses a small connection pool and query deadlines, reads aggregate metadata, and disconnects afterward. It never prints repository names, source, identities, provider responses, or database connection strings.

Output is one JSON record. Exit 0 means current checks passed; 1 means degraded; 2 means unavailable or invalid setup. Missing database configuration, connection failure, and query timeout cannot produce a green result. “ok” proves these narrow observations only; it does not call GitHub/NVIDIA, test a queue delivery, verify scanner installation, or prove backups exist.

An operator can run this from their existing monitoring system every minute. Alert after two consecutive nonzero checks and clear only after two healthy checks; deliver notifications through the organization's chosen alerting integration. No scheduler, notification recipient, credential, or external alert destination is provisioned by this repository.

| Alert | First action |
| --- | --- |
| DATABASE_UNAVAILABLE / DATABASE_QUERY_FAILED | Check Atlas availability, DNS, network access and connection budgets. Preserve error/request IDs in sanitized operator logs. Do not disable certificate validation. |
| WORKER_HEARTBEAT_STALE | Check the Vercel daemon revision, restarts and scanner readiness logs; inspect existing active job leases before restarting. |
| QUEUE_AGE_HIGH | Oldest queued scan is at least five minutes old. Check worker capacity, provider quotas and stuck leases. Do not blindly enqueue duplicates. |
| SCAN_FAILURES_HIGH / SCANNER_ERRORS_HIGH | Five or more failed or partial scans in fifteen minutes. Inspect scanner availability, deadlines and coverage. Do not relabel failed/partial runs clean. Cancellations are excluded from failed-scan counts. |
| PROVIDER_FAILURES_HIGH / REQUEST_FAILURES_HIGH | Five or more recorded middleware errors in the recent window. Inspect correlated request IDs and upstream status without logging raw bodies or secrets. |
| WEBHOOK_REJECTS_HIGH | Five or more rejected signatures. Verify the secret and raw-body setup; distinguish misconfiguration from unsolicited traffic. Never bypass signature verification. |

Signal counters use fixed categories and per-minute buckets, expire after one hour, and contain no source or account identifiers. The window includes the first partial minute, so it may cover up to sixteen minute buckets. Counter writes are best effort and bounded; failure cannot change the original API result. Counts are not a durable audit trail. Middleware counters cover errors reaching that middleware, not all errors handled internally by individual features. Database outages cannot be persisted into those counters; the CLI detects its own database failure instead.

## Recovery drill checklist (not yet executed live)

Use a separately named staging database, disposable repositories and test accounts. Record the environment, source/release revision, operator, expected behavior, observations and recovery time. Do not erase, uninstall, or restore over production as a test.

1. Restore a backup into a **new isolated staging database**. Check snapshot time, document counts and known scan/review evidence. Reapply deletion tombstones before enabling access; exclude or invalidate restored sessions, pending invitation tokens, provider credentials and automation. Retention guarantees remain unapproved until this is tested.
2. Stop/restart only the staging worker while a bounded fixture scan runs. Confirm heartbeat detection, lease expiry, no duplicate terminal findings, retry/cancellation behavior and temporary-workspace cleanup. An unavailable worker must never create a clean result.
3. Exercise duplicate queue deliveries and stale queued jobs. Verify the unique active-repository lock and idempotent result persistence using deterministic job IDs and expected findings.
4. Roll back a staging deployment to a previously verified revision compatible with the current data schema. Verify health, sessions, organization isolation, source browsing, a completed scan and scanner coverage. Avoid schema-destructive rollbacks.
5. Revoke a disposable GitHub installation and sign out the test account. Confirm authorization fails, stale installation bindings recover, stored findings retain provenance, and reconnection requires the normal selected-repository authorization.
6. For deletion, test concurrent invitation acceptance, ownership transfer and writes during the settling period, worker restart during bounded purge, and a large scoped dataset. Confirm other organizations are unaffected and no success is reported before purge completion.

## External GitHub state observed

Read-only `GET /app` on 22 October 2026 confirmed `avpr-net` requests Contents read, Email addresses read and Metadata read, with no subscribed events. R11 and R12 remain open: GitHub settings and installation permission acceptance must change before event scans or draft PR writes can be live-tested. The existing server handlers and guarded draft-PR service should be preserved.
