import { test, expect } from "@playwright/test";
import { createTwoFilesPatch, parsePatch, formatPatch } from "diff";

const scanId = "scan-assistant-1";
const findingId = "64b64c0f8bd4f4f86f39b123";
const originalCode = "export function parsePort(value) { return parseInt(value, 10); }\n";
const proposalCode = createTwoFilesPatch("a/src/ports.js", "b/src/ports.js", originalCode,
  "export function parsePort(value) {\n  if (!/^\\d+$/.test(value)) throw new Error('invalid port');\n  return Number(value);\n}\n");

function verificationFixture(action, syntaxStatus = "passed") {
  return { _id: `verification-${action}`, action, createdAt: "2026-10-22T09:00:00.000Z", repository: "example/project",
    targetPath: "src/ports.js", sourceCommitSha: "a".repeat(40), pullRequest: action === "draft_pr" ? { number: 42, url: "https://github.com/example/project/pull/42" } : null,
    checks: [{ name: "patch_integrity", status: "passed" }, { name: "syntax", status: syntaxStatus },
      { name: "allowed_tests", status: "unavailable" }, { name: "security_rescan", status: "unavailable" }] };
}

async function mockAssistant(page, { codeResponse, onAnalyze, onRetrieve, onPatchValidate, onPullRequest, fixturesDelayMs = 0, healthStatus = "configured", healthFailures = 0, previewFailures = 0, sourceFailures = 0, sourceWindow, patchSyntaxStatus = "valid", verificationRecords = [], rescanOutcome = "target_alert_absent" } = {}) {
  let healthFailureCount = 0;
  let previewFailureCount = 0;
  let sourceFailureCount = 0;
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let data = {};

    if (path.endsWith("/ai/health")) {
      const shouldFailHealth = typeof healthFailures === "function"
        ? await healthFailures(healthFailureCount++)
        : healthFailureCount++ < healthFailures;
      if (shouldFailHealth) {
        await route.fulfill({ status: 503, json: { success: false, error: { message: "Provider health check timed out." } } });
        return;
      }
    }

    if (path.endsWith("/auth/me")) data = { user: { id: "assistant-test-user", name: "Assistant Test" } };
    else if (path.endsWith("/organizations")) data = { organizations: [{ id: "assistant-org", name: "Assistant Test Org", role: "owner" }] };
    else if (path.endsWith("/ai/health")) data = { status: healthStatus, languages: ["javascript", "python", "typescript", "c", "cpp", "bash"], execution: "disabled" };
    else if (path.endsWith("/ai/policy")) data = { hostedAiEnabled: true, provider: "NVIDIA", consentRequired: true };
    else if (path.endsWith("/ai/knowledge")) data = { chunks: 2, sources: ["approved-security-guide.md"] };
    else if (path.endsWith("/ai/fixtures")) data = {
      events: {
        suspicious: { id: "event-suspicious", category: "authentication", synthetic: true, failed_attempts: 12 },
        benign: { id: "event-benign", category: "service_check", synthetic: true, connections: 2 },
      },
      code: {
        javascript: { language: "javascript", mode: "generate", request: "Use safe JavaScript input handling.", originalCode: "" },
        python: { language: "python", mode: "generate", request: "Validate untrusted Python values.", originalCode: "" },
        typescript: { language: "typescript", mode: "generate", request: "Write a safe TypeScript validator.", originalCode: "" },
        c: { language: "c", mode: "generate", request: "Write a safe C parser.", originalCode: "" },
        cpp: { language: "cpp", mode: "generate", request: "Write a safe C++ parser.", originalCode: "" },
        bash: { language: "bash", mode: "generate", request: "Validate shell inputs.", originalCode: "" },
        review: { language: "javascript", mode: "review", request: "Review this port parser.", originalCode },
      },
      provenance: "Synthetic assistant-control fixture",
    };
    else if (path.endsWith(`/ai/preview/finding/${findingId}`) && previewFailureCount < previewFailures) {
      previewFailureCount += 1;
      await route.fulfill({ status: 503, json: { success: false, error: { message: "Finding preview service unavailable." } } });
      return;
    }
    else if (path.endsWith(`/ai/preview/finding/${findingId}`)) data = {
      findingId, original: { title: "Unsafe port parsing", scanner: "semgrep", filePath: "src/ports.js", startLine: 4 },
    };
    else if (path.endsWith(`/ai/finding/${findingId}`) && (typeof sourceFailures === "function" ? sourceFailures() : sourceFailureCount++ < sourceFailures)) {
      await route.fulfill({ status: 503, json: { success: false, error: { message: "GitHub source temporarily unavailable." } } });
      return;
    }
    else if (path.endsWith(`/ai/finding/${findingId}`)) data = {
      scanId, findingId, filePath: "src/ports.js", commitSha: "a".repeat(40), language: "javascript", mode: "review",
      originalCode, request: "Review this port parser for unsafe input handling.", ...(sourceWindow ? { sourceWindow } : {}),
    };
    else if (path.endsWith(`/scans/${scanId}/findings/${findingId}/verifications`)) data = { verifications: verificationRecords };
    else if (path.endsWith("/ai/analyze") && request.method() === "POST") {
      await onAnalyze?.(request);
      data = { status: "complete", analysis: { summary: "Synthetic evidence reviewed." }, retrieved_sources: [{ id: "evidence-1", source: "approved-security-guide.md", startLine: 1, endLine: 4, score: 0.92, text: "Validate untrusted values before use." }] };
    }
    else if (path.endsWith("/ai/code") && request.method() === "POST") {
      await codeResponse?.(request);
      let responsePatch = proposalCode;
      if (sourceWindow) {
        const entry = parsePatch(proposalCode)[0];
        for (const hunk of entry.hunks) { hunk.oldStart += sourceWindow.startLine - 1; hunk.newStart += sourceWindow.startLine - 1; }
        responsePatch = formatPatch(entry);
      }
      data = {
        status: "complete", language: JSON.parse(request.postData()).language,
        proposal: { explanation: "Validates the value before parsing.", code: responsePatch, format: "diff", assumptions: ["Input is a string."], dependencies: [], security_considerations: ["Rejects non-decimal input."], validation_instructions: ["Run the unit tests."], tests: ["Reject letters."] },
        validation: { status: "not_executed", message: "Syntax checks are not execution." }, sources: [],
      };
    }
    else if (path.endsWith("/ai/retrieve") && request.method() === "POST") {
      await onRetrieve?.(request);
      data = { sources: [{ id: "source-1", source: "approved-security-guide.md", startLine: 7, endLine: 11, score: 0.9, text: "Reject malformed values before parsing." }] };
    }
    else if (path.endsWith(`/scans/${scanId}/findings/${findingId}/validate`) && request.method() === "POST") {
      await onPatchValidate?.(request);
      data = { applies: true, syntax: { status: patchSyntaxStatus }, verification: verificationFixture("validation", patchSyntaxStatus === "valid" ? "passed" : patchSyntaxStatus) };
    }
    else if (path.endsWith(`/scans/${scanId}/findings/${findingId}/rescans`) && request.method() === "POST") {
      data = {job:{id:"rescan-1",status:"completed",commitSha:"a".repeat(40),patchHash:"b".repeat(64),
        result:{status:rescanOutcome==="target_alert_absent"?"passed":"failed",outcome:rescanOutcome,remainingTargetAlerts:rescanOutcome==="target_alert_remains"?1:0,tests:"not_executed"}}};
    }
    else if (path.endsWith(`/scans/${scanId}/findings/${findingId}/pull-request`) && request.method() === "POST") {
      await onPullRequest?.(request);
      data = { number: 42, url: "https://github.com/example/project/pull/42", status: "draft", verification: verificationFixture("draft_pr"), verificationRecorded: true };
    }
    else if (path.endsWith("/findings")) data = { findings: [], pagination: { page: 1, total: 0, totalPages: 1 } };

    if (path.endsWith("/ai/fixtures") && fixturesDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, fixturesDelayMs));
    }
    await route.fulfill({ json: { success: true, data } });
  });
}

async function approve(page) {
  const consent = page.getByRole("checkbox", { name: /I approve sending the data shown above/ });
  await consent.check();
  return consent;
}

test("submitted proposal inputs stay fixed while its model request is pending", async ({ page }) => {
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  await mockAssistant(page, { codeResponse: async () => { entered(); await waiting; } });
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Code & review", exact: true }).click();
  await page.getByRole("button", { name: "Load review example", exact: true }).click();
  await approve(page);
  await page.getByRole("button", { name: "Draft proposal", exact: true }).click();
  await started;
  try {
    await expect(page.getByRole("combobox", { name: /^Language/ })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: /^Mode/ })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Code request" })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Source for review" })).toBeDisabled();
  } finally { release(); }
  await expect(page.getByRole("button", { name: "Download proposal" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Code request" })).toBeEnabled();
});

test("signed-in assistant exposes one working theme toggle at desktop and mobile widths", async ({ page }) => {
  await mockAssistant(page);
  await page.goto("/assistant");
  const themeToggle = page.getByRole("button", { name: /^Use (light|dark) appearance$/ });

  await expect(themeToggle).toHaveCount(1);
  const before = await themeToggle.getAttribute("aria-label");
  await themeToggle.click();
  await expect(themeToggle).not.toHaveAttribute("aria-label", before);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(themeToggle).toHaveCount(1);
  const mobileBefore = await themeToggle.getAttribute("aria-label");
  await themeToggle.click();
  await expect(themeToggle).not.toHaveAttribute("aria-label", mobileBefore);
  await expect(themeToggle).toHaveCount(1);
});

test("assistant investigation fixtures, tabs, evidence details, consent and submission work", async ({ page }) => {
  const pageErrors = [];
  const submittedBodies = [];
  await mockAssistant(page, { onAnalyze: request => submittedBodies.push({ body: JSON.parse(request.postData()), headers: request.headers() }) });
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible();
  await expect(page.getByText("NVIDIA: Connected")).toBeVisible();

  const preview = page.getByLabel("Sanitized data preview");
  await expect(preview).toContainText("event-suspicious");
  await page.getByRole("button", { name: "benign fixture" }).click();
  await expect(preview).toContainText("service_check");
  await page.getByRole("button", { name: "suspicious fixture" }).click();
  await expect(preview).toContainText("failed_attempts");

  const reviewDetails = page.getByText("Review the data for this request");
  await reviewDetails.click();
  await expect(page.getByText(/This preview shows the supplied evidence after best-effort redaction/)).toBeHidden();
  await reviewDetails.click();
  await expect(page.getByText(/This preview shows the supplied evidence after best-effort redaction/)).toBeVisible();

  const consent = page.getByRole("checkbox", { name: /I approve sending the data shown above/ });
  const analyze = page.getByRole("button", { name: "Analyze evidence" });
  await expect(analyze).toBeDisabled();
  await consent.check();
  await page.getByRole("button", { name: "Code & review" }).click();
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Draft proposal" })).toBeDisabled();
  await page.getByRole("button", { name: "Investigate" }).click();
  // Approval follows the exact request fingerprint: it is not valid on the code tab,
  // but remains valid if we return to the unchanged investigation request.
  await expect(consent).toBeChecked();
  await expect(analyze).toBeEnabled();
  await page.getByLabel("Event JSON").fill('{"category":"changed-after-approval","synthetic":true}');
  await expect(consent).not.toBeChecked();
  await expect(analyze).toBeDisabled();
  await consent.check();
  await analyze.click();
  await expect(page.getByText("Synthetic evidence reviewed.")).toBeVisible();
  await expect(consent).toBeChecked();
  expect(submittedBodies).toHaveLength(1);
  expect(submittedBodies[0].body.event.category).toBe("changed-after-approval");
  expect(submittedBodies[0].headers["x-securepatch-ai-consent"]).toBe("1");
  await expect(page.getByText("approved-security-guide.md:1–4")).toBeVisible();
  await page.getByText(/approved-security-guide\.md:1–4/).click();
  await expect(page.getByText("Validate untrusted values before use.")).toBeVisible();

  await page.getByRole("button", { name: "Code & review" }).click();
  await expect(page.getByLabel("Language")).toHaveValue("javascript");
  await expect(page.getByLabel("Mode")).toHaveValue("generate");
  await page.getByRole("button", { name: "Knowledge" }).click();
  await expect(page.getByRole("heading", { name: "Inspect shared knowledge" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("assistant results sit below the form on desktop and mobile for every workflow", async ({ page }) => {
  await mockAssistant(page);
  await page.goto("/assistant");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const workflow of ["Investigate", "Code & review", "Knowledge"]) {
      await page.getByRole("button", { name: workflow, exact: true }).click();
      const form = await page.locator("form").boundingBox();
      const result = await page.getByRole("region", { name: "Assistant result" }).boundingBox();
      expect(result.y).toBeGreaterThanOrEqual(form.y + form.height);
      expect(Math.abs(result.x - form.x)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("assistant rejects malformed JSON and shows a recoverable validation error", async ({ page }) => {
  let analyzeCount = 0;
  await mockAssistant(page, { onAnalyze: () => { analyzeCount += 1; } });
  await page.goto("/assistant");
  await expect(page.getByText("NVIDIA: Connected")).toBeVisible();
  await page.getByLabel("Event JSON").fill("{bad json");
  await approve(page);
  await page.getByRole("button", { name: "Analyze evidence" }).click();
  await expect(page.getByRole("alert")).toHaveText("Event must contain valid JSON.");
  expect(analyzeCount).toBe(0);
  await expect(page.getByRole("checkbox", { name: /I approve sending the data shown above/ })).toBeChecked();
  await page.getByLabel("Event JSON").fill('{"category":"authentication","synthetic":true}');
  await expect(page.getByRole("button", { name: "Analyze evidence" })).toBeDisabled();
  await approve(page);
  await page.getByRole("button", { name: "Analyze evidence" }).click();
  await expect(page.getByText("Synthetic evidence reviewed.")).toBeVisible();
  expect(analyzeCount).toBe(1);
});

test("assistant preserves event JSON entered before examples finish loading", async ({ page }) => {
  await mockAssistant(page, { fixturesDelayMs: 1000 });
  await page.goto("/assistant");
  const eventJson = page.getByLabel("Event JSON");
  await eventJson.fill('{"category":"custom"}');
  await expect(page.getByText("NVIDIA: Connected")).toBeVisible();
  await expect(eventJson).toHaveValue('{"category":"custom"}');
});

test("assistant reports the provider connected after a successful request", async ({ page }) => {
  await mockAssistant(page, { healthStatus: "configured_unverified" });
  await page.goto("/assistant");
  await expect(page.getByText("NVIDIA: Configured · verification pending")).toBeVisible();
  await approve(page);
  await page.getByRole("button", { name: "Analyze evidence" }).click();
  await expect(page.getByText("Synthetic evidence reviewed.")).toBeVisible();
  await expect(page.getByText("NVIDIA: Connected")).toBeVisible();
});

test("missing hosted-provider configuration disables requests with useful guidance", async ({ page }) => {
  await mockAssistant(page, { healthStatus: "missing_key" });
  await page.goto("/assistant");
  await expect(page.getByText(/Hosted AI is not configured on this deployment/)).toBeVisible();
  const consent = page.getByRole("checkbox", { name: /I approve sending the data shown above/ });
  for (const [workflow, submit] of [["Investigate", "Analyze evidence"], ["Code & review", "Draft proposal"], ["Knowledge", "Retrieve sources"]]) {
    await page.getByRole("button", { name: workflow, exact: true }).click();
    await expect(consent).toBeDisabled();
    await expect(page.getByRole("button", { name: submit, exact: true })).toBeDisabled();
  }
});

test("assistant setup failures offer a working retry", async ({ page }) => {
  let retryEnabled = false;
  await mockAssistant(page, { healthFailures: () => !retryEnabled });
  await page.goto("/assistant");
  await expect(page.getByRole("alert")).toContainText("Provider health check timed out.");
  retryEnabled = true;
  await page.getByRole("button", { name: "Retry setup" }).click();
  await expect(page.getByText("NVIDIA: Connected")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("assistant finding preview failures offer a working retry", async ({ page }) => {
  await mockAssistant(page, { previewFailures: 1 });
  await page.goto("/assistant");
  await page.getByLabel("Finding ID").fill(findingId);
  await expect(page.getByRole("alert")).toContainText("Finding preview service unavailable.");
  await page.getByRole("button", { name: "Retry preview" }).click();
  await expect(page.getByLabel("Sanitized data preview")).toContainText("Unsafe port parsing");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("assistant code controls submit the selected review, copy and download the proposal", async ({ page }) => {
  let codeRequest;
  await mockAssistant(page, { codeResponse: request => { codeRequest = request; } });
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async text => {
      if (window.__denyAssistantClipboard) throw new Error("permission denied");
      window.__assistantClipboard = text;
    } },
  }));
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Code & review" }).click();
  await page.getByRole("button", { name: "Load review example" }).click();
  await expect(page.getByLabel("Language")).toHaveValue("javascript");
  await expect(page.getByLabel("Mode")).toHaveValue("review");
  await expect(page.getByLabel("Source for review")).toHaveValue(originalCode);
  const fixtureRequests = {
    javascript: "Use safe JavaScript input handling.",
    python: "Validate untrusted Python values.",
    typescript: "Write a safe TypeScript validator.",
    c: "Write a safe C parser.",
    cpp: "Write a safe C++ parser.",
    bash: "Validate shell inputs.",
  };
  for (const [languageName, requestText] of Object.entries(fixtureRequests)) {
    await page.getByLabel("Language").selectOption(languageName);
    await expect(page.getByLabel("Code request")).toHaveValue(requestText);
  }
  await page.getByLabel("Language").selectOption("python");
  await page.getByLabel("Mode").selectOption("review");
  await page.getByLabel("Mode").selectOption("review");
  await expect(page.getByLabel("Source for review")).toBeVisible();
  await page.getByLabel("Source for review").fill("def parse_port(value):\n    return int(value)\n");
  await page.getByLabel("Code request").fill("Reject non-decimal strings before parsing.");

  const consent = await approve(page);
  const submit = page.getByRole("button", { name: "Draft proposal" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Validates the value before parsing.")).toBeVisible();
  expect(JSON.parse(codeRequest.postData())).toMatchObject({
    language: "python", mode: "review", request: "Reject non-decimal strings before parsing.",
    originalCode: "def parse_port(value):\n    return int(value)\n",
  });
  await expect(consent).toBeChecked();

  await page.getByRole("button", { name: "Copy proposal" }).click();
  await expect.poll(() => page.evaluate(() => window.__assistantClipboard)).toBe(proposalCode);
  await expect(page.getByRole("button", { name: "Copy proposal" })).toHaveText("Copied");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download proposal" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("securepatch.patch");
  await page.evaluate(() => { window.__denyAssistantClipboard = true; });
  await page.getByRole("button", { name: "Copy proposal" }).click();
  await expect(page.getByRole("alert")).toContainText("Clipboard unavailable. Download the proposal instead.");
});

test("assistant knowledge search submits the approved query and source disclosure expands", async ({ page }) => {
  let retrieveRequest;
  await mockAssistant(page, { onRetrieve: request => { retrieveRequest = request; } });
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Knowledge" }).click();
  await page.getByLabel("Knowledge query").fill("strict port validation");
  const consent = await approve(page);
  await page.getByRole("button", { name: "Retrieve sources" }).click();
  await expect(page.getByText("approved-security-guide.md:7–11")).toBeVisible();
  expect(JSON.parse(retrieveRequest.postData()).query).toBe("strict port validation");
  expect(retrieveRequest.headers()["x-securepatch-ai-consent"]).toBe("1");
  await expect(consent).toBeChecked();
  await page.getByLabel("Knowledge query").fill("a different query");
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Retrieve sources" })).toBeDisabled();
  await page.getByText(/approved-security-guide\.md:7–11/).click();
  await expect(page.getByText("Reject malformed values before parsing.")).toBeVisible();
});

test("review deep link validates the proposed patch and creates an acknowledged draft PR", async ({ page }) => {
  let validationRequest;
  let pullRequestRequest;
  await mockAssistant(page, {
    onPatchValidate: request => { validationRequest = request; },
    onPullRequest: request => { pullRequestRequest = request; },
  });
  await page.goto(`/assistant?mode=review&findingId=${findingId}`);
  await expect(page.getByLabel("Source for review")).toHaveValue(originalCode);
  await approve(page);
  await page.getByRole("button", { name: "Draft proposal" }).click();
  await expect(page.getByText("Validates the value before parsing.")).toBeVisible();
  await expect(page.getByText(/Target: src\/ports\.js at aaaaaaa/)).toBeVisible();
  const comparison = page.getByRole("region", { name: "Before and after code comparison" });
  await expect(comparison.getByRole("heading", { name: "Before Scanned source" })).toBeVisible();
  await expect(comparison.getByRole("heading", { name: "After Proposed source" })).toBeVisible();
  await page.getByLabel("Source for review").fill("Edited after generation");
  await expect(comparison).toContainText("return parseInt(value, 10)");
  await comparison.getByRole("button", { name: "Unified diff" }).click();
  await expect(comparison.locator("code")).toHaveText(proposalCode);
  await comparison.getByRole("button", { name: "Side by side" }).click();
  await comparison.screenshot({ path: "test-results/assistant-side-by-side-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(comparison.getByRole("button", { name: "Unified diff" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await comparison.screenshot({ path: "test-results/assistant-side-by-side-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  const validate = page.getByRole("button", { name: "Check patch against scanned source" });
  await validate.click();
  await expect(page.getByText("Patch applies. Syntax: valid. Tests were not executed.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Remediation verification history" })).toBeVisible();
  await expect(page.getByText("Allowed project tests")).toBeVisible();
  await expect(page.getByText("Security rescan")).toBeVisible();
  await expect(page.getByText("Unavailable").first()).toBeVisible();
  expect(JSON.parse(validationRequest.postData())).toMatchObject({ patch: proposalCode, acknowledged: false });

  const createPr = page.getByRole("button", { name: "Create draft pull request" });
  await expect(createPr).toBeDisabled();
  await page.getByRole("checkbox", { name: /I reviewed this patch and understand/ }).check();
  await expect(page.getByText("Static checks passed — tests not run")).toBeVisible();
  await expect(createPr).toBeEnabled();
  await createPr.click();
  await expect(page.getByRole("link", { name: "Open draft pull request #42" })).toHaveAttribute("href", "https://github.com/example/project/pull/42");
  expect(JSON.parse(pullRequestRequest.postData())).toMatchObject({ patch: proposalCode, acknowledged: true });
});

test("scanner-rejected proposals offer feedback and require fresh model consent",async({page})=>{
 await mockAssistant(page,{rescanOutcome:"target_alert_remains"});
 await page.goto(`/assistant?mode=review&findingId=${findingId}`);
 await approve(page);await page.getByRole("button",{name:"Draft proposal"}).click();
 await page.getByRole("button",{name:"Revise with scanner feedback"}).click();
 await expect(page.getByLabel("Code request")).toHaveValue(/Scanner feedback:.*still triggered the original scanner rule/s);
 await expect(page.getByRole("button",{name:"Draft proposal"})).toBeDisabled();
 await expect(page.getByRole("button",{name:"Create draft pull request"})).toHaveCount(0);
 await approve(page);await expect(page.getByRole("button",{name:"Draft proposal"})).toBeEnabled();
});
test("switching from a finding explanation auto-fills the scanned source and fix request", async ({ page }) => {
  await mockAssistant(page, { fixturesDelayMs: 400 });
  await page.goto(`/assistant?findingId=${findingId}`);
  await page.getByRole("button", { name: "Code & review" }).click();
  await expect(page.getByLabel("Source for review")).toHaveValue(originalCode);
  await expect(page.getByLabel("Code request")).toHaveValue("Review this port parser for unsafe input handling.");
  await expect(page.getByText(/Source loaded automatically: src\/ports.js/)).toBeVisible();
  await expect(page.getByLabel("Language")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Load review example" })).toHaveCount(0);
  await expect(page.getByLabel("Code request")).toHaveValue("Review this port parser for unsafe input handling.");
});

test("large-file findings submit their exact excerpt offset and show before/after at real file lines", async ({ page }) => {
  let submitted;
  await mockAssistant(page, { sourceWindow: { startLine: 701, endLine: 701, totalLines: 1468 },
    codeResponse: request => { submitted = JSON.parse(request.postData()); } });
  await page.goto(`/assistant?mode=review&findingId=${findingId}`);
  await expect(page.getByLabel("Source for review")).toHaveValue(originalCode);
  await expect(page.getByText(/Showing lines 701–701 of 1468/)).toBeVisible();
  await approve(page);
  await page.getByRole("button", { name: "Draft proposal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "After Proposed source" })).toBeVisible();
  expect(submitted).toMatchObject({ originalCode, targetPath: "src/ports.js", targetStartLine: 701 });
  await expect(page.getByText(/Excerpt from line 701/)).toBeVisible();
  const comparison = page.getByRole("region", { name: "Before and after code comparison" });
  await comparison.getByRole("button", { name: "Unified diff", exact: true }).click();
  await expect(comparison.locator("code")).toContainText("@@ -701");
  await expect(page.getByRole("checkbox", { name: /I approve sending the data shown above/ })).toBeChecked();
});

test("source loading failures block proposals and offer a working retry", async ({ page }) => {
  let sourceUnavailable = true;
  await mockAssistant(page, { sourceFailures: () => sourceUnavailable });
  await page.goto(`/assistant?mode=review&findingId=${findingId}`);
  await expect(page.getByText(/Could not load the affected source/)).toContainText("GitHub source temporarily unavailable.");
  await expect(page.getByRole("button", { name: "Draft proposal" })).toBeDisabled();
  sourceUnavailable = false;
  await page.getByRole("button", { name: "Retry source" }).click();
  await expect(page.getByLabel("Source for review")).toHaveValue(originalCode);
  await expect(page.getByText(/Could not load the affected source/)).toHaveCount(0);
  await approve(page);
  await expect(page.getByRole("button", { name: "Draft proposal" })).toBeEnabled();
});

test("a syntax failure is recorded and blocks draft pull request creation", async ({ page }) => {
  await mockAssistant(page, { patchSyntaxStatus: "failed" });
  await page.goto(`/assistant?mode=review&findingId=${findingId}`);
  await approve(page);
  await page.getByRole("button", { name: "Draft proposal" }).click();
  await page.getByRole("button", { name: "Check patch against scanned source" }).click();
  await expect(page.getByRole("region", { name: "Remediation verification history" })).toBeVisible();
  await expect(page.getByText("Failed").first()).toBeVisible();
  await page.getByRole("checkbox", { name: /I reviewed this patch and understand/ }).check();
  await expect(page.getByRole("button", { name: "Create draft pull request" })).toBeDisabled();
});
