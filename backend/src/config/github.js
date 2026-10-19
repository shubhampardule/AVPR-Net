const fs = require("fs");
const path = require("path");

const env = require("./env");

const configuredPrivateKey = env.github.privateKey || "";
const privateKey = configuredPrivateKey.includes("BEGIN ")
  ? configuredPrivateKey.replace(/\\n/g, "\n")
  : fs.readFileSync(
      path.resolve(process.cwd(), configuredPrivateKey),
      "utf8"
    );

// Octokit is ESM-only. Keep its native dynamic import intact when the Vercel
// build bundles this CommonJS application into a single function entrypoint.
const loadOctokit = () => import("octokit");
let githubAppPromise;
const getGithubApp = () => {
  if (!githubAppPromise) {
    githubAppPromise = loadOctokit().then(({ App }) => new App({
      appId: env.github.appId,
      privateKey,
    }));
  }
  return githubAppPromise;
};

const githubApp = {
  octokit: {
    request: (...args) => getGithubApp().then((app) => app.octokit.request(...args)),
  },
  getInstallationOctokit: async (installationId) =>
    (await getGithubApp()).getInstallationOctokit(installationId),
};

const getInstallationOctokit = async (installationId) => {
  return githubApp.getInstallationOctokit(installationId);
};

module.exports = {
  githubApp,
  getInstallationOctokit,
};
