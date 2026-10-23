// Semgrep may prefix a local rule ID with its configuration's host path.
// Canonicalize only the project-owned namespace; leave third-party IDs intact.
function canonicalRule(value) {
  return String(value||"").match(/(?:^|\.)(securepatch\.(?:js|python)\.[a-z-]+)$/)?.[1]||String(value||"");
}
module.exports={canonicalRule};
