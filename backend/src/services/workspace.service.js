const os = require("os");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { getInstallationOctokit } = require("../config/github");

/**
 * Creates an ephemeral temporary workspace by downloading the repository zipball
 * using installation-scoped Octokit authentication.
 *
 * @param {string} installationId - GitHub App installation ID
 * @param {string} owner - Repository owner (user or organization)
 * @param {string} repo - Repository name
 * @param {string} [ref="HEAD"] - Commit SHA or branch name
 * @returns {Promise<{ workspacePath: string, cleanup: () => void }>}
 */
const createEphemeralWorkspace = async (installationId, owner, repo, ref = "HEAD") => {
  const octokit = await getInstallationOctokit(installationId);

  // 1. Create a secure temporary parent directory
  const baseTempDir = fs.mkdtempSync(path.join(os.tmpdir(), `securepatch-${owner}-${repo}-`));
  const zipFilePath = path.join(baseTempDir, "repo-archive.zip");
  const workspacePath = path.join(baseTempDir, "workspace");
  fs.mkdirSync(workspacePath, { recursive: true });

  const cleanup = () => {
    try {
      if (fs.existsSync(baseTempDir)) {
        fs.rmSync(baseTempDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[Workspace Cleanup Error] Failed to delete ${baseTempDir}:`, err.message);
    }
  };

  try {
    // 2. Download zipball from GitHub using installation authentication
    const response = await octokit.request("GET /repos/{owner}/{repo}/zipball/{ref}", {
      owner,
      repo,
      ref,
      headers: {
        accept: "application/vnd.github+json",
      },
    });

    // response.data is an ArrayBuffer in modern Octokit or Buffer
    const buffer = Buffer.isBuffer(response.data)
      ? response.data
      : Buffer.from(response.data);

    fs.writeFileSync(zipFilePath, buffer);

    // 3. Extract using AdmZip (cross-platform, zero native system dependencies)
    const zip = new AdmZip(zipFilePath);
    const extractTempDir = path.join(baseTempDir, "extracted");
    fs.mkdirSync(extractTempDir, { recursive: true });
    zip.extractAllTo(extractTempDir, true);

    // GitHub zipballs nest the source under a root folder like "owner-repo-commitSha/"
    const extractedEntries = fs.readdirSync(extractTempDir);
    if (extractedEntries.length === 1 && fs.statSync(path.join(extractTempDir, extractedEntries[0])).isDirectory()) {
      const innerDir = path.join(extractTempDir, extractedEntries[0]);
      // Move all items from innerDir to workspacePath
      const innerFiles = fs.readdirSync(innerDir);
      for (const item of innerFiles) {
        fs.renameSync(path.join(innerDir, item), path.join(workspacePath, item));
      }
      fs.rmSync(extractTempDir, { recursive: true, force: true });
    } else {
      // Direct move
      for (const item of extractedEntries) {
        fs.renameSync(path.join(extractTempDir, item), path.join(workspacePath, item));
      }
      fs.rmSync(extractTempDir, { recursive: true, force: true });
    }

    // Clean up the downloaded zip archive file immediately to save disk
    if (fs.existsSync(zipFilePath)) {
      fs.unlinkSync(zipFilePath);
    }

    return {
      workspacePath,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw new Error(`Failed to create repository workspace: ${error.message}`);
  }
};

module.exports = {
  createEphemeralWorkspace,
};
