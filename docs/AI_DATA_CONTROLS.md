# Hosted AI data controls

Hosted NVIDIA inference is an organization-level setting. New organizations
have `hostedAiEnabled: false`. Organizations created before this setting was
introduced retain their previous hosted-AI behavior until an owner or admin
changes the setting in Workspace settings. The API checks the stored setting
before accepting any assistant POST. Turning hosted AI off blocks new assistant
requests for every member.

When hosted AI is on, each member must approve each request. The assistant keeps
the submit button disabled until the member checks the request-specific approval
box. The approval is tied to the current form contents; changing the workflow or
any input invalidates that approval. The API also rejects POST requests that do
not carry the confirmation header from the UI.

The always-open preview applies the same best-effort redaction rules used by the
backend. For a repository finding, the preview endpoint reads only a finding
belonging to the selected organization and returns the normalized fields used
for analysis. For a source review, the complete selected source and request are
shown. The UI also displays the retrieval text sent to NVIDIA embeddings. The
embedding call selects up to four excerpts from the operator-approved shared
knowledge index; the excerpts are displayed in the result and sent to NVIDIA
inference. Private organization repositories are not indexed in this release.

The preview does not promise that arbitrary secrets or private facts will be
detected. The existing redaction rules cover representative keys, tokens,
credentials, email addresses and selected sensitive field names. Users should
avoid submitting material they are not allowed to disclose to NVIDIA. Review
NVIDIA's current service and trial terms before using confidential customer
material. Finding analysis results, including the original normalized finding,
can be cached for ten minutes; the finding itself remains under the existing
scan retention lifecycle. Code-review prompts are not written to that result
cache.

The API contract is:

- `GET /api/v1/organizations/:organizationId/ai/policy` reports whether the
  organization has opted in.
- `GET /api/v1/organizations/:organizationId/ai/preview/finding/:findingId`
  returns the redacted finding preview without calling NVIDIA.
- Every `POST /api/v1/organizations/:organizationId/ai/*` requires the
  `X-SecurePatch-AI-Consent: 1` header and an enabled organization setting.
- `GET` status and knowledge diagnostics do not submit an AI prompt.

This is a user-facing disclosure and a server-enforced organization control, not
a substitute for a legal privacy notice, data-processing agreement, deletion
policy or independent review of provider terms.
