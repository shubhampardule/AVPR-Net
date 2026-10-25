jest.mock("../src/config/github", () => ({ getInstallationOctokit: jest.fn() }));
const { getInstallationOctokit } = require("../src/config/github");
const { getFileContent } = require("../src/services/github.service");
function fixture(bytes, filename = "image.png", extra = {}) {
  getInstallationOctokit.mockResolvedValue({ request: jest.fn().mockResolvedValue({ data: {
    type: "file", path: filename, name: filename, size: bytes.length, sha: "a".repeat(40),
    encoding: "base64", content: bytes.toString("base64"), ...extra,
  } }) });
}
test.each([
  ["image.png", [137,80,78,71,13,10,26,10], "image/png"],
  ["image.jpg", [255,216,255,224], "image/jpeg"],
  ["image.gif", [...Buffer.from("GIF89a")], "image/gif"],
  ["image.webp", [...Buffer.from("RIFF1234WEBP")], "image/webp"],
  ["image.ico", [0,0,1,0,1,0], "image/x-icon"],
])("image preview %s uses verified raster bytes while remediation remains text-only", async (filename, bytes, mimeType) => {
  const buffer = Buffer.from(bytes);
  fixture(buffer, filename);
  expect(await getFileContent("1", "team", "repo", filename, "a".repeat(40), { preview: true }))
    .toMatchObject({ kind: "image", mimeType, encoding: "base64", content: buffer.toString("base64") });
});
test("binary content is still refused outside the preview endpoint", async () => {
  fixture(Buffer.from([137,80,78,71,13,10,26,10,0]));
  await expect(getFileContent("1", "team", "repo", "image.png")).rejects.toMatchObject({ code: "BINARY_FILE" });
});
test("HTML renamed to an image is rejected and SVG stays inert source text", async () => {
  fixture(Buffer.from("<script>alert(1)</script>"));
  await expect(getFileContent("1", "team", "repo", "image.png", undefined, { preview: true }))
    .rejects.toMatchObject({ code: "FILE_UNSUPPORTED", statusCode: 415 });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  fixture(Buffer.from(svg), "image.svg");
  expect(await getFileContent("1", "team", "repo", "image.svg", undefined, { preview: true })).toMatchObject({ content: svg });
});
test("actual decoded byte limits apply even when remote size metadata is wrong", async () => {
  fixture(Buffer.alloc(256 * 1024 + 1), "image.png", { size: 1 });
  await expect(getFileContent("1", "team", "repo", "image.png", undefined, { preview: true }))
    .rejects.toMatchObject({ code: "FILE_UNSUPPORTED", statusCode: 413 });
});
