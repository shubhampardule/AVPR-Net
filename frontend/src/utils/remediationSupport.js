const sourceExtensions = new Set([
  "js", "jsx", "cjs", "mjs",
  "ts", "tsx", "cts", "mts",
  "py", "pyw",
]);

export function supportsFindingRemediation(finding) {
  const scanner = String(finding?.scanner || "").toLowerCase();
  const filePath = String(finding?.filePath || "");
  const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  const extension = normalizedPath.split(".").pop()?.toLowerCase();
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.some(part => (part.startsWith(".") && part !== "." && part !== "..") || ["node_modules", "vendor"].includes(part))) return false;
  if (!sourceExtensions.has(extension)) return false;
  if (["secrets", "dependency", "trivy"].includes(scanner)) return false;
  if (scanner === "bandit") return ["py", "pyw"].includes(extension);
  return scanner === "semgrep";
}

