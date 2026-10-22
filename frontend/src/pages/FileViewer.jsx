import React, { useEffect, useState } from "react";
import {
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  FileCode2,
  FileText,
  FileImage,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { API_BASE_URL } from "../config/api";

export default function FileViewer() {
  const { owner, repo } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { selectedOrg } = useOutletContext();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const organizationId =
    selectedOrg?._id ||
    selectedOrg?.id ||
    selectedOrg?.organization?._id ||
    selectedOrg?.organization?.id;

  const filePath = searchParams.get("path");
  const ref = searchParams.get("ref");

  const decodedOwner = decodeURIComponent(owner || "");
  const decodedRepo = decodeURIComponent(repo || "");

  const fetchFile = async () => {
    if (
      !organizationId ||
      !decodedOwner ||
      !decodedRepo ||
      !filePath
    ) {
      setLoading(false);
      setFile(null);
      setError(!organizationId ? "Choose a workspace to view this file." : "Select a file from a repository to view its source.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/github/organizations/${organizationId}/repositories/${encodeURIComponent(
          decodedOwner
        )}/${encodeURIComponent(
          decodedRepo
        )}/file?path=${encodeURIComponent(filePath)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
            "Failed to load file"
        );
      }

      setFile(
        data.data?.file ||
          data.data ||
          data.file ||
          null
      );
    } catch (err) {
      console.error("Failed to load file:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFile();
  }, [
    organizationId,
    decodedOwner,
    decodedRepo,
    filePath,
    ref,
  ]);

  const isImage = isImageFile(filePath);

  return (
    <main className="app-document min-h-screen">

      {/* Header */}
      <header className="page-header border-b border-border-subtle bg-bg-primary">
        <div className="px-6 py-5 lg:px-8">

          <button
            onClick={() =>
              navigate(
                `/github/${encodeURIComponent(
                  decodedOwner
                )}/${encodeURIComponent(
                  decodedRepo
                )}`
              )
            }
            className="mb-4 flex items-center gap-2 text-xs font-mono-code text-text-muted transition hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to repository
          </button>

          <div className="flex items-center gap-3">

            <FileCode2 className="h-5 w-5 text-accent-blue" />

            <div>
              <h1 className="break-words text-xl font-semibold">
                {filePath || "File"}
              </h1>

              <p className="mt-1 font-mono-code text-xs text-text-muted">
                {decodedOwner}/{decodedRepo}
              </p>
            </div>

          </div>

        </div>
      </header>

      <div className="app-page">

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-severity-critical/20 bg-severity-critical/5 p-4">

            <AlertCircle className="mt-0.5 h-5 w-5 text-severity-critical" />

            <div>
              <p className="text-sm font-medium text-severity-critical">
                Unable to load file
              </p>

              <p className="mt-1 text-sm text-text-secondary">
                {error}
              </p>
              <button type="button" onClick={fetchFile} className="mt-3 inline-flex items-center gap-2 rounded-md border border-border-light px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" aria-hidden="true" />Retry file</button>
            </div>

          </div>
        )}

        {loading ? (
          <div className="h-[500px] animate-pulse rounded-xl border border-border-subtle bg-bg-secondary" />
        ) : error && !file ? null : !file ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-secondary p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-text-muted" />

            <h3 className="mt-4 font-medium">
              File not available
            </h3>
          </div>
        ) : isImage ? (
          <ImagePreview
            file={file}
            filePath={filePath}
          />
        ) : (
          <CodeViewer
            file={file}
            filePath={filePath}
          />
        )}

      </div>
    </main>
  );
}

/* ---------------- Code Viewer ---------------- */

function CodeViewer({ file, filePath }) {
  const content =
    file.content ||
    file.text ||
    "";

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const lines = content.split("\n");
  const copyFile = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError("Clipboard unavailable. Select the file contents to copy them manually.");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-4 py-3">

        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-accent-blue" />

          <span className="font-mono-code text-xs text-text-secondary">
            Source content
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono-code text-[11px] text-text-muted">
            {lines.length} lines
          </span>
          <button type="button" onClick={copyFile} aria-label={copied ? "File copied to clipboard" : "Copy file to clipboard"}
            className="rounded border border-text-primary/10 px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

      </div>
      {copyError && <p role="alert" className="border-b border-border-subtle px-4 py-2 text-xs text-severity-medium">{copyError}</p>}

      <div className="overflow-auto">
        <pre className="min-w-max py-4 font-mono-code text-xs leading-6">

          {lines.map((line, index) => (
            <div
              key={index}
              className="flex hover:bg-text-primary/[0.025]"
            >
              <span className="sticky left-0 w-14 shrink-0 select-none border-r border-border-subtle bg-bg-secondary px-3 text-right text-text-muted">
                {index + 1}
              </span>

              <code className="px-5 text-text-secondary">
                {line || " "}
              </code>
            </div>
          ))}

        </pre>
      </div>

    </div>
  );
}

/* ---------------- Image Preview ---------------- */

function ImagePreview({ file, filePath }) {
  /*
   * Important:
   * The current backend converts GitHub content to UTF-8 text.
   * That works for source files but NOT for binary images.
   *
   * Therefore image rendering will be enabled after the backend
   * returns binary content/base64 correctly.
   */

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">

      <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-elevated px-4 py-3">
        <FileImage className="h-4 w-4 text-accent-blue" />

        <span className="font-mono-code text-xs text-text-secondary">
          {filePath}
        </span>
      </div>

      <div className="flex min-h-[400px] items-center justify-center p-10">

        <div className="text-center">

          <FileImage className="mx-auto h-10 w-10 text-text-muted" />

          <p className="mt-4 text-sm font-medium text-text-secondary">
            Image preview
          </p>

          <p className="mt-1 text-xs text-text-muted">
            Binary preview support will be enabled with the
            repository content API.
          </p>

        </div>

      </div>
    </div>
  );
}

function isImageFile(path = "") {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(
    path
  );
}
