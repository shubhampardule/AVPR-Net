const fs = require("node:fs/promises");
const { evaluateBenchmark } = require("../services/benchmark.service");
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run benchmark -- path/to/annotations.json");
  const handle = await fs.open(file, "r");
  let input;
  try {
    if ((await handle.stat()).size > 5 * 1024 * 1024) throw new Error("Benchmark file exceeds 5 MiB");
    input = JSON.parse(await handle.readFile({ encoding: "utf8" }));
  } finally { await handle.close(); }
  console.log(JSON.stringify(evaluateBenchmark(input), null, 2));
}
if (require.main === module) main().catch(error => {
  // Parse errors can include file contents. Return fixed diagnostic text for malformed JSON.
  console.error(error instanceof SyntaxError ? "Invalid benchmark JSON" : error.code ? "Benchmark file could not be read" : error.message);
  process.exitCode = 2;
});
module.exports = { main };
