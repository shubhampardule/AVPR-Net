const fs = require("fs");
const path = require("path");
const { App } = require("octokit");

const env = require("./env");

const privateKeyPath = path.resolve(
  __dirname,
  "../../",
  env.github.privateKey
);

const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const githubApp = new App({
  appId: env.github.appId,
  privateKey,
});

const getInstallationOctokit = async (installationId) => {
  return await githubApp.getInstallationOctokit(installationId);
};

module.exports = {
  githubApp,
  getInstallationOctokit,
};