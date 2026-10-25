const { parsePatch, applyPatch } = require("diff");
const { bad } = require("./input");
const { MAX_SOURCE_BYTES } = require("./review-source");
function applyExactDiff(original, patch, filePath) {
  if (typeof original !== "string" || Buffer.byteLength(original) > MAX_SOURCE_BYTES) throw bad("Source exceeds the patch input limit", 413, "PATCH_INTEGRITY_FAILED");
  if (typeof patch !== "string" || patch.length > 18000) throw bad("Provide a bounded unified diff", 400, "PATCH_INTEGRITY_FAILED");
  const normalizedPath = String(filePath || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  let entries;
  try { entries = parsePatch(patch, { strict: true }); } catch { throw bad("Invalid unified diff", 400, "PATCH_INTEGRITY_FAILED"); }
  const cleanTarget = (p) => String(p || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  if (entries.length !== 1 || cleanTarget(entries[0].oldFileName) !== `a/${normalizedPath}` || cleanTarget(entries[0].newFileName) !== `b/${normalizedPath}` || !entries[0].hunks.length) throw bad("Diff must modify only the selected source file", 400, "PATCH_INTEGRITY_FAILED");
  let content;
  try { content = applyPatch(original, entries[0], { fuzzFactor: 0 }); } catch { throw bad("Diff does not apply to the scanned source", 409, "PATCH_INTEGRITY_FAILED"); }
  if (content === false || content === original || Buffer.byteLength(content) > MAX_SOURCE_BYTES) throw bad("Diff is empty, too large, or does not match the scanned source", 409, "PATCH_INTEGRITY_FAILED");
  return content;
}
module.exports = { applyExactDiff };
