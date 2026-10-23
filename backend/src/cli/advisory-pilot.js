require("dotenv").config({ quiet: true });
const { runPilot } = require("../services/advisory-pilot.service");
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--download-public-sources") throw new Error("Public source download flag required");
  console.log(JSON.stringify(await runPilot(), null, 2));
}
if (require.main === module) main().catch(() => {
  // Remote/scanner errors can contain source or machine paths; use a fixed diagnostic.
  console.error("Advisory pilot failed. Requires --download-public-sources, reachable pinned sources and full Semgrep/Bandit coverage. No success report was produced.");
  process.exitCode = 2;
});
module.exports = { main };
