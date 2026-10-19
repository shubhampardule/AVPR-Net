jest.mock("../src/models/Organization", () => ({ findById: jest.fn() }));
jest.mock("../src/models/Scan", () => ({ countDocuments: jest.fn(), find: jest.fn() }));
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
    const organization = { _id: organizationId, name: "SecurePatch", githubInstallationId: "install-1" };
    Organization.findById.mockReturnValue({ lean: async () => organization });
    Scan.countDocuments.mockResolvedValue(4);
    Finding.countDocuments.mockResolvedValue(3);
    Finding.aggregate
      .mockResolvedValueOnce([{ _id: "medium", count: 3 }])
      .mockResolvedValueOnce([
        { severity: "low", riskCategory: "medium", riskScore: 4.93 },
        { severity: "low", riskCategory: "medium", riskScore: 4.93 },
        { severity: "medium", riskCategory: "medium", riskScore: 4.22 },
      ]);
    Scan.find
      .mockReturnValueOnce(query([{ _id: "scan-1", startedAt: "2026-10-04T00:00:00Z", completedAt: "2026-10-04T00:01:00Z" }]))
      .mockReturnValueOnce(query([{ scannersUsed: ["bandit", "semgrep"], scannerErrors: [] }]));
    getRepositories.mockResolvedValue([{ name: "Orion" }]);

    const result = await DashboardService.getOrganizationOverview(organizationId);

    expect(Scan.countDocuments).toHaveBeenCalledWith({ organization: organizationId });
    expect(Finding.countDocuments).toHaveBeenCalledWith({ organization: organizationId });
    expect(Finding.aggregate).toHaveBeenNthCalledWith(1, [
      { $match: { organization: organizationId } },
      { $group: { _id: "$riskCategory", count: { $sum: 1 } } },
    ]);
    expect(Finding.aggregate).toHaveBeenNthCalledWith(2, expect.arrayContaining([
      { $match: { organization: organizationId } },
      { $group: { _id: "$fingerprint", finding: { $first: "$$ROOT" } } },
    ]));
    expect(getRepositories).toHaveBeenCalledWith("install-1");
    expect(result.repositories).toEqual({ connected: true, total: 1 });
    expect(result.totals).toEqual({ scans: 4, findings: 3, criticalAndHigh: 0 });
    expect(result.riskDistribution).toEqual({ critical: 0, high: 0, medium: 3, low: 0 });
    expect(result.priorityFindings.map(({ severity, riskCategory }) => [severity, riskCategory])).toEqual([
      ["low", "medium"],
      ["low", "medium"],
      ["medium", "medium"],
    ]);
    expect(result.recentScans[0].durationMs).toBe(60_000);
    expect(result.scannerStatus).toEqual({
      bandit: { status: "completed", scanAt: undefined },
      semgrep: { status: "completed", scanAt: undefined },
    });
  });

  it("does not invent a repository count when GitHub is not connected", async () => {
    Organization.findById.mockReturnValue({ lean: async () => ({ _id: "org-2", name: "Empty", githubInstallationId: null }) });
    Scan.countDocuments.mockResolvedValue(0);
    Finding.countDocuments.mockResolvedValue(0);
    Finding.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    Scan.find
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));

    const result = await DashboardService.getOrganizationOverview("org-2");

    expect(result.repositories).toEqual({ connected: false, total: null });
    expect(result.riskDistribution).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    expect(getRepositories).not.toHaveBeenCalled();
  });
});
