const {
    getInstallationOctokit,
} = require("../config/github");

const getRepositories = async (installationId) => {
    const octokit = await getInstallationOctokit(installationId);

    const { data } = await octokit.request(
        "GET /installation/repositories"
    );

    return data.repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        defaultBranch: repo.default_branch,
    }));
};

const getRepositoryFiles = async (
    installationId,
    owner,
    repo
) => {
    const octokit = await getInstallationOctokit(installationId);

    const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
        {
            owner,
            repo,
            tree_sha: "HEAD",
            recursive: "true",
        }
    );

    return data.tree
        .filter((item) => item.type === "blob")
        .map((item) => ({
            path: item.path,
            size: item.size,
        }));
};

const getFileContent = async (
    installationId,
    owner,
    repo,
    filePath
) => {
    const octokit = await getInstallationOctokit(installationId);

    const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
            owner,
            repo,
            path: filePath,
        }
    );

    if (Array.isArray(data)) {
        throw new Error("The provided path is a directory, not a file");
    }

    const content = Buffer.from(
        data.content,
        "base64"
    ).toString("utf8");

    return {
        path: data.path,
        name: data.name,
        size: data.size,
        content,
    };
};

module.exports = {
    getRepositories,
    getRepositoryFiles,
    getFileContent,
};