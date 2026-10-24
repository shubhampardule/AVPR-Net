jest.mock("../src/config/github", () => ({ getInstallationOctokit: jest.fn() }));
const { getInstallationOctokit } = require("../src/config/github");
const { getRepositories } = require("../src/services/github.service");
const repo = id => ({ id, name: `repo-${id}`, full_name: `owner/repo-${id}`, owner: { login: "owner" }, default_branch: "main" });
beforeEach(() => jest.clearAllMocks());

test("explicit refresh bypasses the access cache immediately after adding a repository", async () => {
  const paginate = jest.fn().mockResolvedValueOnce([repo(1)]).mockResolvedValueOnce([repo(1), repo(2)]);
  getInstallationOctokit.mockResolvedValue({ paginate });
  expect(await getRepositories("fresh-access")).toHaveLength(1);
  expect(await getRepositories("fresh-access")).toHaveLength(1);
  expect(paginate).toHaveBeenCalledTimes(1);
  expect(await getRepositories("fresh-access", { forceRefresh: true })).toHaveLength(2);
  expect(await getRepositories("fresh-access")).toHaveLength(2);
});

test("an older in-flight repository request cannot overwrite newly refreshed access", async () => {
  let finishOld;
  const paginate = jest.fn().mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce([repo(2)]);
  getInstallationOctokit.mockResolvedValue({ paginate });
  const oldRequest = getRepositories("overlapping-access");
  await Promise.resolve();
  await getRepositories("overlapping-access", { forceRefresh: true });
  finishOld([repo(1)]);
  await oldRequest;
  expect((await getRepositories("overlapping-access"))[0].id).toBe(2);
});
