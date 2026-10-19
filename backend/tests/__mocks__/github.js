const githubApp = {
  octokit: {
    request: jest.fn(),
  },
};

const getInstallationOctokit = jest.fn();

module.exports = {
  githubApp,
  getInstallationOctokit,
};