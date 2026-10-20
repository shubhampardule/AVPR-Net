import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  GitBranch,
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  FileImage,
  RefreshCw,
  ShieldCheck,
  Globe,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  ScanLine,
} from "lucide-react";

import { API_BASE_URL } from "../config/api";
import RepositoryAutomation from "../components/ui/RepositoryAutomation";

export default function Repository() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();

  const {
    selectedOrg,
    loading: contextLoading = false,
  } = useOutletContext();

  const [files, setFiles] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const organizationId =
    selectedOrg?._id ||
    selectedOrg?.id ||
    selectedOrg?.organization?._id ||
    selectedOrg?.organization?.id;

  const decodedOwner = decodeURIComponent(owner || "");
  const decodedRepo = decodeURIComponent(repo || "");

  const repository = useMemo(
    () => ({
      owner: decodedOwner,
      name: decodedRepo,
    }),
    [decodedOwner, decodedRepo]
  );

  const fetchFiles = async (isRefresh = false) => {
    if (
      !organizationId ||
      !repository.owner ||
      !repository.name
    ) {
      return;
    }

    try {
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(
        `${API_BASE_URL}/github/organizations/${organizationId}/repositories/${encodeURIComponent(
          repository.owner
        )}/${encodeURIComponent(
          repository.name
        )}/files`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
            "Failed to load repository files"
        );
      }

      const repositoryFiles =
        data.data?.files ||
        data.data?.tree ||
        data.files ||
        [];

      setFiles(repositoryFiles);
    } catch (err) {
      console.error(
        "Failed to load repository files:",
        err
      );

      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!contextLoading && organizationId) {
      fetchFiles();
    }
  }, [
    contextLoading,
    organizationId,
    repository.owner,
    repository.name,
  ]);

  /*
   * Convert flat GitHub paths into a folder tree.
   *
   * Example:
   *
   * src/App.jsx
   * src/components/Button.jsx
   *
   * becomes:
   *
   * src/
   *   App.jsx
   *   components/
   *     Button.jsx
   */
  const tree = useMemo(() => {
    const root = {
      type: "folder",
      name: "",
      path: "",
      children: [],
    };

    files.forEach((file) => {
      if (!file.path) return;

      const parts = file.path.split("/");
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;

        let existing = current.children.find(
          (child) => child.name === part
        );

        if (!existing) {
          existing = {
            type: isFile ? "file" : "folder",
            name: part,
            path: parts
              .slice(0, index + 1)
              .join("/"),
            size: isFile ? file.size : null,
            commitSha: isFile ? file.commitSha : null,
            children: isFile ? undefined : [],
          };

          current.children.push(existing);
        }

        if (!isFile) {
          current = existing;
        }
      });
    });

    sortTree(root);

    return root.children;
  }, [files]);

  const toggleFolder = (path) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };

  const handleItemClick = (item) => {
    if (item.type === "folder") {
      toggleFolder(item.path);
      return;
    }

    navigate(
      `/github/${encodeURIComponent(
        repository.owner
      )}/${encodeURIComponent(
        repository.name
      )}/file?path=${encodeURIComponent(item.path)}${item.commitSha ? `&ref=${item.commitSha}` : ""}`
    );
  };

  return (
    <div className="min-h-screen">

      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
        <div className="px-6 py-5 lg:px-8">

          <button
            onClick={() => navigate("/github")}
            className="mb-4 flex items-center gap-2 text-xs font-mono-code text-text-muted transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to GitHub
          </button>

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                <Folder className="h-5 w-5 text-accent-blue" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {repository.name}
                  </h1>

                  <span className="rounded-full border border-accent-security/20 bg-accent-security/10 px-2 py-0.5 text-[10px] font-mono-code text-accent-security">
                    CONNECTED
                  </span>
                </div>

                <p className="mt-1 font-mono-code text-xs text-text-muted">
                  {repository.owner}/{repository.name}
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2">

              <button
                onClick={() => fetchFiles(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-secondary transition hover:border-white/15 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              <button
                onClick={() => navigate(`/github/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/scan`)}
                title="Run security scan on repository"
                className="flex items-center gap-2 rounded-lg border border-accent-security/30 bg-accent-security/10 px-3 py-2 text-sm font-medium text-accent-security hover:bg-accent-security/20 transition cursor-pointer"
              >
                <ScanLine className="h-4 w-4" />
                Scan Repository
              </button>

            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">

        {/* Repository metadata */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">

          <InfoCard
            icon={GitBranch}
            label="Default Branch"
            value="main"
          />

          <InfoCard
            icon={ShieldCheck}
            label="Access"
            value="Read-only"
          />

          <InfoCard
            icon={Globe}
            label="Source"
            value="GitHub"
          />

        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4">

            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

            <div>
              <p className="text-sm font-medium text-red-300">
                Unable to load repository
              </p>

              <p className="mt-1 text-sm text-text-secondary">
                {error}
              </p>
            </div>

          </div>
        )}

        <RepositoryAutomation organization={selectedOrg} owner={decodedOwner} repo={decodedRepo} />
        {/* Explorer */}
        <section>

          <div className="mb-5 flex items-end justify-between">

            <div>
              <p className="font-mono-code text-xs uppercase tracking-[0.18em] text-accent-blue">
                Repository Explorer
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Files
              </h2>

              <p className="mt-1 text-sm text-text-secondary">
                Browse repository files before security analysis.
              </p>
            </div>

            {!loading && (
              <span className="font-mono-code text-xs text-text-muted">
                {files.length}{" "}
                {files.length === 1
                  ? "file"
                  : "files"}
              </span>
            )}

          </div>

          {loading || contextLoading ? (
            <LoadingTree />
          ) : tree.length === 0 ? (
            <EmptyTree />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">

              {/* Explorer header */}
              <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-5 py-3">
                <span className="font-mono-code text-[10px] uppercase tracking-wider text-text-muted">
                  Repository
                </span>

                <span className="font-mono-code text-[10px] uppercase tracking-wider text-text-muted">
                  Size
                </span>
              </div>

              <div className="py-1">
                {tree.map((item) => (
                  <TreeItem
                    key={item.path}
                    item={item}
                    depth={0}
                    expandedFolders={expandedFolders}
                    onClick={handleItemClick}
                  />
                ))}
              </div>

            </div>
          )}

        </section>

      </main>
    </div>
  );
}

/* ---------------- Tree Item ---------------- */

function TreeItem({
  item,
  depth,
  expandedFolders,
  onClick,
}) {
  const isFolder = item.type === "folder";
  const isExpanded = expandedFolders.has(item.path);

  const Icon = isFolder
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(item.name);

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => onClick(item)}
        className="flex w-full items-center justify-between border-b border-border-subtle px-5 py-3 text-left transition last:border-b-0 hover:bg-white/[0.025]"
        style={{
          paddingLeft: `${20 + depth * 28}px`,
        }}
      >

        <div className="flex min-w-0 items-center gap-2.5">

          {isFolder ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            )
          ) : (
            <span className="w-3.5" />
          )}

          <Icon
            className={`h-4 w-4 shrink-0 ${
              isFolder
                ? "text-accent-blue"
                : "text-text-muted"
            }`}
          />

          <span
            className={`truncate font-mono-code text-xs ${
              isFolder
                ? "text-text-primary"
                : "text-text-secondary"
            }`}
          >
            {item.name}
          </span>

        </div>

        <div className="flex shrink-0 items-center gap-4">

          {!isFolder && (
            <span className="font-mono-code text-[10px] text-text-muted">
              {formatFileSize(item.size)}
            </span>
          )}

          {isFolder && (
            <span className="font-mono-code text-[9px] uppercase tracking-wider text-text-muted">
              Folder
            </span>
          )}

        </div>

      </motion.button>

      {isFolder && isExpanded && (
        <div>
          {item.children.map((child) => (
            <TreeItem
              key={child.path}
              item={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Helpers ---------------- */

function sortTree(node) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  node.children.forEach((child) => {
    if (child.type === "folder") {
      sortTree(child);
    }
  });
}

function getFileIcon(fileName) {
  const extension =
    fileName.split(".").pop()?.toLowerCase();

  if (
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
      "ico",
    ].includes(extension)
  ) {
    return FileImage;
  }

  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "cpp",
      "c",
      "css",
      "html",
      "json",
      "xml",
      "sql",
      "sh",
    ].includes(extension)
  ) {
    return FileCode2;
  }

  return FileText;
}

function formatFileSize(size) {
  if (!size || size <= 0) {
    return "—";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4">
      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025]">
          <Icon className="h-4 w-4 text-accent-blue" />
        </div>

        <div>
          <p className="font-mono-code text-[9px] uppercase tracking-wider text-text-muted">
            {label}
          </p>

          <p className="mt-1 text-sm font-medium text-text-primary">
            {value}
          </p>
        </div>

      </div>
    </div>
  );
}

function LoadingTree() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={item}
          className="flex h-14 animate-pulse items-center gap-3 border-b border-border-subtle px-5 last:border-b-0"
        >
          <div className="h-7 w-7 rounded-lg bg-white/[0.05]" />
          <div className="h-3 w-52 rounded bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

function EmptyTree() {
  return (
    <div className="rounded-xl border border-dashed border-border-subtle bg-bg-secondary p-12 text-center">
      <Folder className="mx-auto h-8 w-8 text-text-muted" />

      <h3 className="mt-4 font-medium">
        No files found
      </h3>

      <p className="mt-2 text-sm text-text-secondary">
        No source files are available in this repository.
      </p>
    </div>
  );
}
