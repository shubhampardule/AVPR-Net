jest.mock("../src/config/github", () => ({ getInstallationOctokit: jest.fn() }));

const { getInstallationOctokit } = require("../src/config/github");
const { getRepositoryMetadata } = require("../src/services/github.service");

test("repository metadata comes from GitHub, including the real default branch", async () => {
  getInstallationOctokit.mockResolvedValue({ request: jest.fn().mockResolvedValue({ data: {
    id: 42, name: "AVPR", full_name: "shubhampardule/AVPR", owner: { login: "shubhampardule" },
    private: true, default_branch: "develop", html_url: "https://github.com/shubhampardule/AVPR",
  } }) });
  await expect(getRepositoryMetadata("123", "shubhampardule", "AVPR")).resolves.toEqual({
    id: 42, name: "AVPR", fullName: "shubhampardule/AVPR", owner: "shubhampardule",
    private: true, defaultBranch: "develop", htmlUrl: "https://github.com/shubhampardule/AVPR",
  });
});
