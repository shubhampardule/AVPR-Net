const { bad } = require("./input");
const MAX_SOURCE_BYTES = 256 * 1024;

// Keep model input bounded without truncating a line or inventing source text.
function reviewSource(content, finding) {
  if (Buffer.byteLength(content) > MAX_SOURCE_BYTES) throw bad("Source exceeds the 256 KB review limit", 413, "FILE_UNSUPPORTED");
  const requestBytes = text => Buffer.byteLength(JSON.stringify(text)) - 2;
  if (content.length <= 8000 && requestBytes(content) <= 8000) return { originalCode: content };
  const lines = content.match(/[^\n]*\n|[^\n]+$/g) || [];
  const target = finding.startLine - 1;
  if (!Number.isSafeInteger(target) || target < 0 || target >= lines.length) {
    throw bad("This finding has no valid source line. Rescan the repository before drafting a fix.", 409, "SOURCE_LINE_UNAVAILABLE");
  }
  const limit = 4000;
  let start = target, end = target + 1, length = requestBytes(lines[target]);
  if (length > limit) throw bad("The affected line exceeds the review limit. Review this generated or minified file manually.", 413, "SOURCE_LINE_UNAVAILABLE");
  while (true) {
    let expanded = false;
    if (start > 0 && length + requestBytes(lines[start - 1]) <= limit) { length += requestBytes(lines[--start]); expanded = true; }
    if (end < lines.length && length + requestBytes(lines[end]) <= limit) { length += requestBytes(lines[end++]); expanded = true; }
    if (!expanded) break;
  }
  return { originalCode: lines.slice(start, end).join(""),
    sourceWindow: { startLine: start + 1, endLine: end, totalLines: lines.length } };
}
module.exports = { MAX_SOURCE_BYTES, reviewSource };
