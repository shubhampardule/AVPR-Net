# Defensive event investigation

Provenance: original guidance authored for this project's synthetic demonstration.
These are investigation heuristics, not labeled attack signatures or external
security standards. No production logs or personal data are included.

## Repeated authentication failures

Numerous failed SSH or HTTP authentication attempts in a short interval can
indicate password guessing, but a stale service credential or a misconfigured
health checker can produce similar events. Review the time window, counts,
source distribution, destination service and successful authentication events.
Check authorized administration and scheduled maintenance. Do not equate failed
attempts alone with confirmed compromise. Verify log completeness before assigning
urgency. Suggested defensive next steps: inspect authentication logs, review MFA
and service-account configuration, and propose rate limits for operator review.
Do not automatically block an address or execute a firewall change.

## Benign service checks

Periodic successful connections to an expected service port with stable low
volume may be an authorized health check. Confirm the monitoring inventory,
expected schedule, identity and destination. Absence of alerts does not establish
that a network is free of threats. Missing payloads and surrounding events limit
interpretation. Retain any supplied detector verdict unchanged.

## Unusual outbound volume

An outbound traffic spike might be backup, deployment, synchronization or possible
unauthorized transfer. Compare the destination, baseline byte counts, approved
jobs, process identity and time window. Collect authorized surrounding telemetry.
Do not assert data exfiltration based on volume alone. Suggest log queries and
additional monitoring before proposing disruptive remediation.

## Static scanner evidence

SecurePatch's Semgrep and Bandit adapters scan repository source, not network
traffic. Their normalized findings contain scanner, ruleId, CWE, filePath,
startLine, evidenceSnippet and severity. A weighted riskScore prioritizes findings
and is not a calibrated probability. Preserve that original result when providing
an AI explanation. Validate whether the reported data flow is reachable and
whether an input is attacker-controlled before recommending a patch.
