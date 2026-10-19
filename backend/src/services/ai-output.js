const { NvidiaError } = require("./nvidia.service");
const invalid = () => new NvidiaError("AI_INVALID_OUTPUT", "AI returned invalid structured output or unsupported citations");
const isText = (value, max = 2000) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isList = (value) => Array.isArray(value) && value.length <= 12 && value.every((s) => isText(s));

function parseObject(text, expected) {
  let value;
  try { value = JSON.parse(text); } catch (_) { throw invalid(); }
  if (!value || Array.isArray(value) || typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) throw invalid();
  return value;
}

function resolveSources(ids, retrieved) {
  if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length ||
    ids.some((id) => typeof id !== "string" || !retrieved.some((s) => s.id === id))) throw invalid();
  return ids.map((id) => retrieved.find((s) => s.id === id));
}

module.exports = { invalid, isText, isList, parseObject, resolveSources };
