const { parsePatch, applyPatch } = require("diff");
const { bad } = require("./input");
function applyExactDiff(original, patch, filePath) {
  if (typeof patch !== "string" || patch.length > 18000) throw bad("Provide a bounded unified diff", 400, "PATCH_INTEGRITY_FAILED");
  let entries;
  try { entries = parsePatch(patch, { strict: true }); } catch { throw bad("Invalid unified diff", 400, "PATCH_INTEGRITY_FAILED"); }
  if (entries.length !== 1 || entries[0].oldFileName !== `a/${filePath}` || entries[0].newFileName !== `b/${filePath}` || !entries[0].hunks.length) throw bad("Diff must modify only the selected source file", 400, "PATCH_INTEGRITY_FAILED");
  let content;
  try { content = applyPatch(original, entries[0], { fuzzFactor: 0 }); } catch { throw bad("Diff does not apply to the scanned source", 409, "PATCH_INTEGRITY_FAILED"); }
  if (content === false || content === original || content.length > 16000) throw bad("Diff is empty, too large, or does not match the scanned source", 409, "PATCH_INTEGRITY_FAILED");
  return content;
}
module.exports = { applyExactDiff };
