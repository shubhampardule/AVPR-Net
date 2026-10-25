const sourceExtensions = new Set(["js", "jsx", "ts", "tsx", "py"]);

export function supportsFindingRemediation(finding) {
  const scanner = String(finding?.scanner || "").toLowerCase();
  const filePath = String(finding?.filePath || "");
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (filePath.split("/").some(part => part.startsWith(".") || ["node_modules", "vendor"].includes(part))) return false;
  if (!sourceExtensions.has(extension)) return false;
  if (["secrets", "dependency", "trivy"].includes(scanner)) return false;
  if (scanner === "bandit") return extension === "py";
  return scanner === "semgrep";
}
