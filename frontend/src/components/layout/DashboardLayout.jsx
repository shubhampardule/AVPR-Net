import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  ShieldAlert,
  Bot,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { ThemeToggle } from "../ui/ThemeToggle";
import { BrandLockup } from "../ui/BrandLogo";
import NotificationCenter from "./NotificationCenter";
import OnboardingTour from "../ui/OnboardingTour";


export default function DashboardLayout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [contextError, setContextError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [showTour, setShowTour] = useState(false);
  const contextRequestId = useRef(0);
  const desiredOrganization = searchParams.get("org");
  useEffect(() => {
    const desired = organizations.find(item => (item.id || item._id) === desiredOrganization);
    if (desired) setSelectedOrg(desired);
  }, [desiredOrganization, organizations]);

  // First-time onboarding tutorial trigger
  useEffect(() => {
    const tourDone = localStorage.getItem("avprnet_tour_completed");
    if (!tourDone && !loading && organizations.length > 0) {
      const timer = setTimeout(() => setShowTour(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading, organizations.length]);

  useEffect(() => {
    const handleOpenTour = () => setShowTour(true);
    window.addEventListener("open-onboarding-tour", handleOpenTour);
    return () => window.removeEventListener("open-onboarding-tour", handleOpenTour);
  }, []);


  const createOrganization = async (event) => {
    event.preventDefault();
    setCreatingOrg(true);
    setOrgError("");
    try {
      const response = await fetch(`${API_BASE_URL}/organizations`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: organizationName.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Unable to create organization.");
      const organization = { ...body.data.organization, role: body.data.role };
      setOrganizations((items) => [...items, organization]);
      setSelectedOrg(organization);
      setShowOrgForm(false);
      setOrganizationName("");
    } catch (error) { setOrgError(error.message); }
    finally { setCreatingOrg(false); }
  };

  useEffect(() => {
    loadDashboardContext();
  }, []);

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const loadDashboardContext = async () => {
    const requestId = ++contextRequestId.current;
    setContextError(""); setLoading(true);
    try {
      const [userResponse, orgResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
        }),

        fetch(`${API_BASE_URL}/organizations`, {
          credentials: "include",
        }),
      ]);

      if (requestId !== contextRequestId.current) return;

      if (userResponse.status === 401) {
        window.location.href = "/login";
        return;
      }

      const userData = await userResponse.json();
      if (!userResponse.ok) throw new Error(userData.error?.message || "Unable to load your account.");
      const orgData = await orgResponse.json();
      if (requestId !== contextRequestId.current) return;
      if (!orgResponse.ok) throw new Error(orgData.error?.message || "Unable to load organizations.");

      const currentUser =
        userData.data?.user ||
        userData.user ||
        null;

      setUser(currentUser);

      const orgs =
        orgData.data?.organizations ||
        orgData.data ||
        [];

      const normalizedOrganizations =
        Array.isArray(orgs) ? orgs : [];

      setOrganizations(normalizedOrganizations);

      if (normalizedOrganizations.length > 0) {
        const desired = searchParams.get("org") || sessionStorage.getItem(`securepatch-org:${currentUser?.id || currentUser?._id}`);
        setSelectedOrg(normalizedOrganizations.find(item => (item.id || item._id) === desired) || normalizedOrganizations[0]);
      } else if (currentUser) {
        // Auto-create default workspace on first login if user has none
        try {
          const defaultName = currentUser.name ? `${currentUser.name.split(" ")[0]}'s Workspace` : "Default Workspace";
          const createRes = await fetch(`${API_BASE_URL}/organizations`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: defaultName }),
          });
          const createBody = await createRes.json();
          if (createRes.ok && createBody.data?.organization) {
            const newOrg = { ...createBody.data.organization, role: createBody.data.role };
            setOrganizations([newOrg]);
            setSelectedOrg(newOrg);
            sessionStorage.setItem(`securepatch-org:${currentUser?.id || currentUser?._id}`, newOrg._id || newOrg.id);
          } else {
            setSelectedOrg(null);
          }
        } catch {
          setSelectedOrg(null);
        }
      } else {
        setSelectedOrg(null);
      }
    } catch (error) {
      if (requestId === contextRequestId.current) {
        setUser(null);
        setOrganizations([]);
        setSelectedOrg(null);
        setContextError(error.message || "Unable to load workspace context.");
        console.error("Dashboard context loading failed:", error);
      }
    } finally {
      if (requestId === contextRequestId.current) setLoading(false);
    }
  };

  const handleOrganizationChange = (event) => {
    const value = event.target.value;
    if (value === "__new__") {
      setShowOrgForm(true);
      return;
    }

    const organization = organizations.find(
      (item) => (item._id || item.id) === value
    );

    setSelectedOrg(organization || null);
    if (organization) sessionStorage.setItem(`securepatch-org:${user?.id || user?._id}`, value);
  };

  const handleLogout = async () => {
    setSignOutError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Sign-out could not be confirmed. Please retry.");
      window.location.href = "/";
    } catch (error) {
      setSignOutError(error.message);
    }
  };

  const displayName =
    user?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    (loading ? "Loading account…" : "Account unavailable");

  const userInitial =
    user ? displayName.charAt(0).toUpperCase() : loading ? "…" : "?";

  return (
    <div className="review-workspace min-h-screen bg-bg-primary text-text-primary">
      {/* ---------------------------------------------------------------- */}
      {/* Background                                                      */}
      {/* ---------------------------------------------------------------- */}

      {/* ---------------------------------------------------------------- */}
      {/* Mobile Header                                                   */}
      {/* ---------------------------------------------------------------- */}

      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-bg-sidebar border-b border-border-subtle">

        <div className="h-full px-4 flex items-center justify-between">

          <Link
            to="/dashboard"
            className="flex items-center gap-2.5"
          >
            <BrandLockup wordmarkClassName="text-sm" />

          </Link>


          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTour(true)}
              className="p-2 rounded-lg bg-accent/10 text-accent border border-accent/20"
              title="Tour"
              aria-label="Start product tour"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <NotificationCenter
              key={`mobile-${selectedOrg?._id || selectedOrg?.id || "no-workspace"}`}
              organizationId={selectedOrg?._id || selectedOrg?.id}
            />
            <ThemeToggle />
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="p-2 rounded-lg bg-bg-card border border-border-subtle"
              aria-label="Toggle navigation"
              aria-expanded={mobileSidebarOpen}
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>


        </div>

      </header>


      {/* ---------------------------------------------------------------- */}
      {/* Application Shell                                               */}
      {/* ---------------------------------------------------------------- */}

      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <div className="relative z-10 min-h-screen">


        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                         */}
        {/* ---------------------------------------------------------------- */}

        <aside
          className={`
            fixed lg:fixed top-0 left-0 z-40
            h-screen w-[250px]
            bg-bg-sidebar
            border-r border-border-subtle
            flex flex-col
            transition-transform duration-300
            ${
              mobileSidebarOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
          `}
        >

          {/* ------------------------------------------------------------ */}
          {/* Logo                                                         */}
          {/* ------------------------------------------------------------ */}

          <div className="h-16 px-5 flex items-center border-b border-border-subtle">

            <Link
              to="/dashboard"
              className="flex items-center gap-2.5"
            >
              <BrandLockup wordmarkClassName="text-sm" />

            </Link>

          </div>


          {/* ------------------------------------------------------------ */}
          {/* Organization Selector                                        */}
          {/* ------------------------------------------------------------ */}

          <div data-tour="workspace-selector" className="p-4 border-b border-border-subtle">
            <div className="relative">
              <select
                aria-label="Workspace"
                disabled={loading || Boolean(contextError)}
                value={
                  selectedOrg?._id ||
                  selectedOrg?.id ||
                  ""
                }
                onChange={handleOrganizationChange}
                className="appearance-none w-full rounded-md border border-border-subtle bg-bg-card px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {organizations.length === 0 ? (
                  <option value="">{contextError ? "Workspace list unavailable" : loading ? "Loading workspaces…" : "No workspace"}</option>
                ) : (
                  organizations.map((org) => (
                    <option
                      key={org._id || org.id}
                      value={org._id || org.id}
                    >
                      {org.name}
                    </option>
                  ))
                )}
                <option value="__new__">+ New workspace</option>
              </select>

              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Navigation (Navigation only: 5 items with distinct icons)    */}
          {/* ------------------------------------------------------------ */}

          <nav aria-label="Workspace navigation" className="flex-1 p-3 overflow-y-auto space-y-1">
            <SidebarItem
              tourId="nav-overview"
              icon={LayoutDashboard}
              label="Overview"
              to="/dashboard"
              active={location.pathname === "/dashboard"}
            />

            <SidebarItem
              tourId="nav-repositories"
              icon={GitBranch}
              label="Repositories"
              to="/github"
              active={location.pathname.startsWith("/github")}
            />

            <SidebarItem
              tourId="nav-findings"
              icon={ShieldAlert}
              label="Findings"
              to="/findings"
              active={location.pathname === "/findings"}
            />

            <SidebarItem
              tourId="nav-assistant"
              icon={Bot}
              label="AI assistant"
              to="/assistant"
              active={location.pathname === "/assistant"}
            />

            <SidebarItem
              tourId="nav-settings"
              icon={Settings}
              label="Settings"
              to="/settings"
              active={location.pathname === "/settings"}
            />
          </nav>



          {/* ------------------------------------------------------------ */}
          {/* User                                                         */}
          {/* ------------------------------------------------------------ */}

          <div className="p-3 border-t border-border-subtle">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-card border border-border-subtle">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-mono font-bold text-accent">
                {userInitial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {loading
                    ? "Loading..."
                    : displayName}
                </div>

                <div className="truncate text-xs text-text-muted">
                  {user?.email ||
                    (loading ? "Loading account…" : "Account details unavailable")}
                </div>
              </div>

              <button
                onClick={handleLogout}
                title={user ? "Sign out" : "Sign out is unavailable until your account loads"}
                aria-label="Sign out"
                disabled={!user}
                className="p-1.5 text-text-muted hover:text-severity-critical transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* New Workspace Modal                                             */}
        {/* ---------------------------------------------------------------- */}

        {showOrgForm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-workspace-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                <h2 id="new-workspace-title" className="text-base font-semibold text-text-primary">
                  New workspace
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowOrgForm(false);
                    setOrgError("");
                    setOrganizationName("");
                  }}
                  className="text-text-muted hover:text-text-primary p-1 rounded-md transition"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={createOrganization} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="organization-name" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Workspace name
                  </label>
                  <input
                    id="organization-name"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    autoFocus
                    maxLength={150}
                    placeholder="e.g. My Project, Team Alpha"
                    className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                  {orgError && (
                    <p role="alert" className="mt-1.5 text-xs text-severity-critical">
                      {orgError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOrgForm(false);
                      setOrgError("");
                      setOrganizationName("");
                    }}
                    className="px-3 py-2 rounded-lg border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingOrg || !organizationName.trim()}
                    className="px-4 py-2 rounded-lg bg-accent text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingOrg ? "Creating..." : "Create workspace"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Mobile Backdrop                                                 */}
        {/* ---------------------------------------------------------------- */}

        {mobileSidebarOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() =>
              setMobileSidebarOpen(false)
            }
            aria-label="Close navigation"
          />
        )}


        {/* ---------------------------------------------------------------- */}
        {/* Main                                                            */}
        {/* ---------------------------------------------------------------- */}

        <div className="workspace-body min-h-screen min-w-0 pt-16 lg:ml-[250px] lg:pt-0">

          {/* ------------------------------------------------------------ */}
          {/* Desktop Topbar                                               */}
          {/* ------------------------------------------------------------ */}

          <header className="workspace-toolbar sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border-subtle bg-bg-primary px-8 lg:flex">

            <div className="flex items-center gap-2 text-xs font-medium text-text-muted">

              <Link to="/dashboard" className="hover:text-text-primary">Workspace</Link>

              <span>/</span>

              <span>
                {getPageLabel(location.pathname)}
              </span>

            </div>


            <div className="flex items-center gap-3">
              <button
                type="button"
                data-tour="quick-tour-btn"
                onClick={() => setShowTour(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/10 text-xs font-semibold text-accent hover:bg-accent/20 transition cursor-pointer shadow-sm"
                title="Start product tour"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tour</span>
              </button>
              <NotificationCenter
                key={`desktop-${selectedOrg?._id || selectedOrg?.id || "no-workspace"}`}
                organizationId={selectedOrg?._id || selectedOrg?.id}
              />
              <ThemeToggle />
            </div>

          </header>


          {/* ------------------------------------------------------------ */}
          {/* Page Content                                                  */}
          {/* ------------------------------------------------------------ */}

          {contextError && <section role="alert" className="mx-5 my-8 max-w-2xl rounded-xl border border-severity-critical/30 bg-severity-critical/[0.04] p-5 text-sm text-severity-critical sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Workspace unavailable</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">We couldn’t load your account.</h1>
            <p className="mt-2 leading-6 text-text-secondary">Try again. If this continues, contact your administrator with the technical details below.</p>
            <details className="mt-4 text-xs text-text-secondary">
              <summary className="w-fit cursor-pointer underline underline-offset-2">Technical details</summary>
              <p className="mt-2 break-words font-mono-code">{contextError}</p>
            </details>
            <button className="mt-5 rounded-md border border-severity-critical/20 px-3 py-2 text-xs font-semibold hover:bg-severity-critical/10" onClick={loadDashboardContext}>Retry</button>
          </section>}
          {signOutError && <div role="alert" className="m-5 rounded-lg border border-severity-critical/30 bg-severity-critical/[0.04] p-4 text-sm text-severity-critical">
            <p className="font-medium">Sign-out could not be confirmed.</p>
            <p className="mt-1 text-text-secondary">Please try again.</p>
            <details className="pt-1 text-xs text-text-secondary"><summary className="w-fit cursor-pointer underline underline-offset-2">Technical details</summary><p className="mt-2 break-words font-mono-code">{signOutError}</p></details>
          </div>}
          {!contextError && searchParams.get("organizationDeleted") === "1" && <p role="status" className="mx-6 mt-6 rounded-md border border-text-primary/15 bg-bg-secondary p-4 text-sm text-text-secondary">Organization access has been removed. Data erasure is queued after a 24-hour settling period and runs when the worker is available.</p>}
          <div id="workspace-content" tabIndex={-1}>
          {!contextError && <Outlet
            key={`${selectedOrg?.id || selectedOrg?._id}:${location.pathname}:${location.search}`}
            context={{
              user,
              organizations,
              selectedOrg,
              loading,
              refreshContext: loadDashboardContext,
            }}
          />}
          </div>

        </div>

      </div>

      <OnboardingTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onFinish={() => {
          localStorage.setItem("avprnet_tour_completed", "true");
          setShowTour(false);
        }}
      />
    </div>
  );
}


/* ==========================================================================
   Sidebar Item
   ========================================================================== */

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  badge,
  to,
  disabled = false,
  tourId,
}) {
  const className = `
    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
    text-left transition-all text-sm
    ${
      active
        ? "bg-accent/15 text-accent font-medium border border-accent/25 shadow-sm"
        : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
    }
    ${
      disabled
        ? "opacity-60 cursor-not-allowed hover:bg-transparent hover:text-text-muted"
        : ""
    }
  `;

  if (disabled) {
    return (
      <div data-tour={tourId} className={className} aria-current={active ? "page" : undefined}>
        <Icon className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-medium flex-1">
          {label}
        </span>
        {badge && (
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-border-subtle text-text-muted uppercase">
            {badge}
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      to={to}
      data-tour={tourId}
      className={className} aria-current={active ? "page" : undefined}
    >
      <Icon
        className={`w-4 h-4 ${
          active ? "text-accent" : "text-text-muted"
        }`}
      />
      <span className="text-sm font-medium flex-1">
        {label}
      </span>
      {badge && (
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-border-subtle text-text-muted uppercase">
          {badge}
        </span>
      )}
    </Link>
  );
}


/* ==========================================================================
   Page Label
   ========================================================================== */

function getPageLabel(pathname) {
  if (pathname.startsWith("/github/")) return pathname.endsWith("/scan") ? "Security scans" : pathname.endsWith("/file") ? "Source file" : "Repository";
  switch (pathname) {
    case "/dashboard":
      return "Overview";

    case "/github":
      return "Repositories";

    case "/assistant":
      return "AI assistant";

    case "/settings":
      return "Settings";

    case "/findings":
      return "Findings";

    default:
      return "Overview";
  }
}
