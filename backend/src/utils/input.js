const mongoose = require("mongoose");
const bad = (message, statusCode = 400, code = "INVALID_INPUT") => Object.assign(new Error(message), { statusCode, code });
function integer(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw bad(`Expected an integer between 1 and ${max}`);
  return Number(value);
}
function repository(owner, repo) {
  if (typeof owner !== "string" || typeof repo !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || [".", ".."].includes(repo)) throw bad("Invalid GitHub repository identifier");
}
function objectId(value) { if (typeof value !== "string" || !mongoose.isValidObjectId(value)) throw bad("Invalid identifier"); return value; }
function optionalCommitSha(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value)) throw bad("Invalid commit SHA");
  return value;
}
module.exports = { bad, integer, repository, objectId, optionalCommitSha };
