const {
  SCAN_JOB_TIMEOUT_MS,
  SCAN_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  SCAN_RECORD_DEADLINE_MS,
} = require("../src/config/scan-timing");

test("Vercel queue redelivery leaves time before the scan record expires", () => {
  const visibilityTimeoutMs = SCAN_QUEUE_VISIBILITY_TIMEOUT_SECONDS * 1000;
  expect(SCAN_QUEUE_VISIBILITY_TIMEOUT_SECONDS).toBe(660);
  expect(visibilityTimeoutMs).toBeGreaterThan(SCAN_JOB_TIMEOUT_MS);
  expect(visibilityTimeoutMs + SCAN_JOB_TIMEOUT_MS).toBeLessThan(SCAN_RECORD_DEADLINE_MS);
});
