const path = require("node:path");
const { policyHash } = require("../src/services/patch-rescan.service");

require("esbuild").build({
  absWorkingDir: path.resolve(__dirname, ".."),
  entryPoints: ["src/app.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  alias: { diff: require.resolve("diff") },
  define: { __AVPR_RESCAN_POLICY_HASH__: JSON.stringify(policyHash()) },
  outfile: "src/app.vercel.cjs",
}).catch(() => { process.exitCode = 1; });
