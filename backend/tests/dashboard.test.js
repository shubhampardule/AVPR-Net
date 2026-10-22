jest.mock("../src/models/Organization", () => ({ findById: jest.fn() }));
jest.mock("../src/models/Scan", () => ({ countDocuments: jest.fn(), find: jest.fn(), aggregate: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ countDocuments: jest.fn(), aggregate: jest.fn(), find: jest.fn() }));
jest.mock("../src/services/github.service", () => ({ getRepositories: jest.fn() }));

const Organization = require("../src/models/Organization");
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const { getRepositories } = require("../src/services/github.service");
const DashboardService = require("../src/services/dashboard.service");

const query = (value) => ({
  sort() { return this; },
  limit() { return this; },
  select() { return this; },
  lean: async () => value,
});

describe("DashboardService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns organization-scoped counts and risk distribution from riskCategory", async () => {
    const organizationId = "org-123";
    const organization = { _id: organizationId, name: "AVPR-Net", githubInstallationId: "install-1" };
    Organization.findById.mockReturnValue({ lean: async () => organization });
    Scan.countDocuments.mockResolvedValue(4);
    Finding.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    Scan.aggregate
      .mockResolvedValueOnce([{ _id: { owner: "team", repo: "project" }, scan: "scan-1" }])
      .mockResolvedValueOnce([{ _id: { owner: "team", repo: "project" }, scan: "scan-1", status: "completed", scannerErrors: [] }]);
    Finding.aggregate
      .mockResolvedValueOnce([{ _id: "medium", count: 3 }])
      .mockResolvedValueOnce([{ _id: "high", count: 1 }, { _id: "medium", count: 1 }]);
    Finding.find.mockReturnValue(query([
      { _id: "finding-1", scan: "scan-1", riskCategory: "high", riskScore: 8 },
      { _id: "finding-2", scan: "scan-1", riskCategory: "medium", riskScore: 4 },
    ]));
    Scan.find
      .mockReturnValueOnce(query([{ _id: "scan-1", startedAt: "2026-10-04T00:00:00Z", completedAt: "2026-10-04T00:01:00Z" }]))
      .mockReturnValueOnce(query([{ scannersUsed: ["bandit", "semgrep"], scannerErrors: [] }]));
    getRepositories.mockResolvedValue([{ name: "Orion" }]);

    const result = await DashboardService.getOrganizationOverview(organizationId);

    expect(Scan.countDocuments).toHaveBeenCalledWith({ organization: organizationId });
    expect(Finding.countDocuments).toHaveBeenCalledWith({ organization: organizationId });
    expect(Scan.aggregate).toHaveBeenNthCalledWith(1, expect.arrayContaining([
      { $match: { organization: organizationId, status: "completed", scannersUsed: { $exists: true, $ne: [] }, scannerErrors: { $size: 0 } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: { owner: { $toLower: "$owner" }, repo: { $toLower: "$repo" } }, scan: { $first: "$_id" } } },
    ]));
    expect(Finding.aggregate).toHaveBeenNthCalledWith(1, [
      { $match: { organization: organizationId } },
      { $group: { _id: "$riskCategory", count: { $sum: 1 } } },
    ]);
    expect(Finding.countDocuments).toHaveBeenNthCalledWith(2, { organization: organizationId, scan: { $in: ["scan-1"] }, status: { $nin: ["resolved", "dismissed"] } });
    expect(Finding.find).toHaveBeenCalledWith({ organization: organizationId, scan: { $in: ["scan-1"] }, status: { $nin: ["resolved", "dismissed"] } });
    expect(getRepositories).toHaveBeenCalledWith("install-1");
    expect(result.repositories).toEqual({ connected: true, total: 1 });
    expect(result.totals).toEqual({ scans: 4, findings: 3, criticalAndHigh: 0, currentFindings: 2, currentCriticalAndHigh: 1 });
    expect(result.riskDistribution).toEqual({ critical: 0, high: 0, medium: 3, low: 0 });
    expect(result.currentRiskDistribution).toEqual({ critical: 0, high: 1, medium: 1, low: 0 });
    expect(result.currentFindingsStatus).toMatchObject({ repositoriesWithSuccessfulBaseline: 1, repositoriesUsingEarlierSuccessfulResult: 0, repositoriesWithoutSuccessfulBaseline: 0 });
    expect(result.priorityFindings.map(({ _id }) => _id)).toEqual(["finding-1", "finding-2"]);
    expect(result.recentScans[0].durationMs).toBe(60_000);
    expect(result.scannerStatus).toEqual({
      bandit: { status: "completed", scanAt: undefined },
      semgrep: { status: "completed", scanAt: undefined },
    });
  });

  it("keeps current findings on the last full scan when newer scans are partial or failed", async () => {
    const organizationId = "org-history";
    Organization.findById.mockReturnValue({ lean: async () => ({
      _id: organizationId,
      name: "History",
      githubInstallationId: null,
    }) });
    Scan.countDocuments.mockResolvedValue(5);
    Finding.countDocuments.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
    Scan.aggregate
      .mockResolvedValueOnce([
        { _id: { owner: "team", repo: "partial" }, scan: "scan-partial-baseline" },
        { _id: { owner: "team", repo: "complete" }, scan: "scan-complete-latest" },
      ])
      .mockResolvedValueOnce([
        { _id: { owner: "team", repo: "partial" }, scan: "scan-partial-new", status: "completed", scannerErrors: [{ scanner: "bandit" }] },
        { _id: { owner: "team", repo: "failed" }, scan: "scan-failed-new", status: "failed", scannerErrors: [] },
        { _id: { owner: "team", repo: "complete" }, scan: "scan-complete-latest", status: "completed", scannerErrors: [] },
      ]);
    Finding.aggregate
      .mockResolvedValueOnce([{ _id: "high", count: 12 }])
      .mockResolvedValueOnce([{ _id: "medium", count: 3 }]);
    Finding.find.mockReturnValue(query([
      { _id: "older-open", scan: "scan-partial-baseline", status: "open" },
      { _id: "latest-open", scan: "scan-complete-latest", status: "open" },
    ]));
    Scan.find
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));

    const result = await DashboardService.getOrganizationOverview(organizationId);

    const currentFilter = {
      organization: organizationId,
      scan: { $in: ["scan-partial-baseline", "scan-complete-latest"] },
      status: { $nin: ["resolved", "dismissed"] },
    };
    expect(Finding.countDocuments).toHaveBeenNthCalledWith(2, currentFilter);
    expect(Finding.aggregate).toHaveBeenNthCalledWith(2, [
      { $match: currentFilter },
      { $group: { _id: "$riskCategory", count: { $sum: 1 } } },
    ]);
    expect(Finding.find).toHaveBeenCalledWith(currentFilter);
    expect(result.currentFindingsStatus).toEqual({
      repositoriesWithScans: 3,
      repositoriesWithSuccessfulBaseline: 2,
      repositoriesUsingEarlierSuccessfulResult: 1,
      repositoriesWithoutSuccessfulBaseline: 1,
    });
    expect(result.priorityFindings.map(({ _id }) => _id)).toEqual(["older-open", "latest-open"]);
  });

  it("reports accessible repositories that have never established a full-scan baseline", async () => {
    Organization.findById.mockReturnValue({ lean: async () => ({
      _id: "org-installed",
      name: "Installed",
      githubInstallationId: "installation-5",
    }) });
    Scan.countDocuments.mockResolvedValue(1);
    Finding.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    Scan.aggregate
      .mockResolvedValueOnce([{ _id: { owner: "team", repo: "scanned" }, scan: "scan-complete" }])
      .mockResolvedValueOnce([{ _id: { owner: "team", repo: "scanned" }, scan: "scan-complete", status: "completed", scannerErrors: [] }]);
    Finding.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    Finding.find.mockReturnValue(query([]));
    Scan.find.mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    getRepositories.mockResolvedValue([
      { owner: "Team", name: "Scanned" },
      { owner: "team", name: "never-scanned" },
    ]);

    const result = await DashboardService.getOrganizationOverview("org-installed");

    expect(result.currentFindingsStatus).toEqual({
      repositoriesWithScans: 1,
      repositoriesWithSuccessfulBaseline: 1,
      repositoriesUsingEarlierSuccessfulResult: 0,
      repositoriesWithoutSuccessfulBaseline: 1,
    });
  });

  it("does not invent a repository count when GitHub is not connected", async () => {
    Organization.findById.mockReturnValue({ lean: async () => ({ _id: "org-2", name: "Empty", githubInstallationId: null }) });
    Scan.countDocuments.mockResolvedValue(0);
    Finding.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    Scan.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    Finding.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    Finding.find.mockReturnValue(query([]));
    Scan.find
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));

    const result = await DashboardService.getOrganizationOverview("org-2");

    expect(result.repositories).toEqual({ connected: false, total: null });
    expect(result.riskDistribution).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    expect(result.totals.currentFindings).toBe(0);
    expect(getRepositories).not.toHaveBeenCalled();
  });
});
