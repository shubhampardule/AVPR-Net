import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  GitBranch,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { ThemeToggle } from "../ui/ThemeToggle";
import { BrandLockup } from "../ui/BrandLogo";

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
  const contextRequestId = useRef(0);
  const desiredOrganization = searchParams.get("org");
  useEffect(() => {
    const desired = organizations.find(item => (item.id || item._id) === desiredOrganization);
    if (desired) setSelectedOrg(desired);
  }, [desiredOrganization, organizations]);

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
    const organizationId = event.target.value;

    const organization = organizations.find(
      (item) =>
        (item._id || item.id) === organizationId
    );

    setSelectedOrg(organization || null);
    if (organization) sessionStorage.setItem(`securepatch-org:${user?.id || user?._id}`, organizationId);
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
    <div className="min-h-screen bg-[#101416] text-[#E8EEEB]">

      {/* ---------------------------------------------------------------- */}
      {/* Background                                                      */}
      {/* ---------------------------------------------------------------- */}

      {/* ---------------------------------------------------------------- */}
      {/* Mobile Header                                                   */}
      {/* ---------------------------------------------------------------- */}

      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-[#101416] border-b border-white/[0.06]">

        <div className="h-full px-4 flex items-center justify-between">

          <Link
            to="/dashboard"
            className="flex items-center gap-2.5"
          >
            <BrandLockup wordmarkClassName="text-sm" />

          </Link>


          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="p-2 rounded-lg bg-[#202729] border border-white/[0.08]"
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

      <div className="relative z-10 min-h-screen">


        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                         */}
        {/* ---------------------------------------------------------------- */}

        <aside
          className={`
            fixed lg:fixed top-0 left-0 z-40
            h-screen w-[250px]
            bg-[#171D1F]
            border-r border-white/[0.06]
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

          <div className="h-16 px-5 flex items-center border-b border-white/[0.06]">

            <Link
              to="/dashboard"
              className="flex items-center gap-2.5"
            >
              <BrandLockup wordmarkClassName="text-sm" descriptor />

            </Link>

          </div>


          {/* ------------------------------------------------------------ */}
          {/* Organization Selector                                        */}
          {/* ------------------------------------------------------------ */}

          <div className="p-4 border-b border-white/[0.06]">

            <div className="mb-2 px-1 text-xs font-medium text-text-muted">
              Workspace
            </div>


            <div className="relative">

              <select
                disabled={loading || Boolean(contextError)}
                value={
                  selectedOrg?._id ||
                  selectedOrg?.id ||
                  ""
                }
                onChange={handleOrganizationChange}
                className="appearance-none w-full rounded-md border border-white/[0.1] bg-[#202729] px-3 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:border-[#78A88B]/60"
              >

                {organizations.length === 0 ? (
                  <option value="">{contextError ? "Organization list unavailable" : loading ? "Loading organizations…" : "No organization"}</option>
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

              </select>


              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />

            </div>

            {!contextError && organizations.length > 0 && <button type="button" onClick={() => setShowOrgForm((open) => !open)} className="mt-3 text-sm font-medium text-[#A8C4B1] hover:underline underline-offset-2">{showOrgForm ? "Cancel" : "Create organization"}</button>}
            {!contextError && (showOrgForm || (!loading && organizations.length === 0)) && (
              <form onSubmit={createOrganization} className="mt-3 space-y-2">
                <label htmlFor="organization-name" className="block text-xs text-text-secondary">Organization name</label>
                <input id="organization-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required maxLength={150} placeholder="Your team or project" className="w-full rounded-lg border border-white/10 bg-[#202729] px-3 py-2 text-xs focus:border-[#78A88B] focus:outline-none" />
                {orgError && <p role="alert" className="text-xs text-red-300">{orgError}</p>}
                <button disabled={creatingOrg || !organizationName.trim()} className="w-full rounded-lg bg-[#78A88B] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{creatingOrg ? "Creating..." : "Create workspace"}</button>
              </form>
            )}

          </div>


          {/* ------------------------------------------------------------ */}
          {/* Navigation                                                    */}
          {/* ------------------------------------------------------------ */}

          <nav className="flex-1 p-3 overflow-y-auto">

            {/* Platform */}

            <div className="mb-2 px-3 text-xs font-medium text-text-muted">
              Platform
            </div>


            <div className="space-y-1">

              <SidebarItem icon={ShieldCheck} label="AI assistant" to="/assistant" active={location.pathname === "/assistant"} />

              <SidebarItem
                icon={LayoutDashboard}
                label="Overview"
                to="/dashboard"
                active={
                  location.pathname === "/dashboard"
                }
              />


              <SidebarItem
                icon={GitBranch}
                label="Repositories"
                to="/github"
                active={
                  location.pathname === "/github"
                }
              />


              <SidebarItem
                icon={ShieldAlert}
                label="Findings"
                to="/findings"
                active={location.pathname === "/findings"}
              />

            </div>


            {/* Workspace */}

            <div className="mb-2 mt-8 px-3 text-xs font-medium text-text-muted">
              Workspace
            </div>


            <div className="space-y-1">

              <SidebarItem
                icon={Settings}
                label="Settings"
                to="/settings"
                active={location.pathname === "/settings"}
              />

            </div>

          </nav>


          {/* ------------------------------------------------------------ */}
          {/* User                                                         */}
          {/* ------------------------------------------------------------ */}

          <div className="p-3 border-t border-white/[0.06]">

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#202729] border border-white/[0.06]">

              <div className="w-8 h-8 rounded-lg bg-[#78A88B]/10 border border-[#78A88B]/20 flex items-center justify-center text-xs font-mono font-bold text-[#78A88B]">
                {userInitial}
              </div>


              <div className="flex-1 min-w-0">

                <div className="text-xs font-medium text-text-primary truncate">
                  {loading
                    ? "Loading..."
                    : displayName}
                </div>

                <div className="truncate text-[11px] text-text-muted">
                  {user?.email ||
                    (loading ? "Loading account…" : "Account details unavailable")}
                </div>

              </div>


              <button
                onClick={handleLogout}
                title={user ? "Sign out" : "Sign out is unavailable until your account loads"}
                aria-label="Sign out"
                disabled={!user}
                className="p-1.5 text-text-muted hover:text-[#F87171] transition-colors"
              >

                <LogOut className="w-3.5 h-3.5" />

              </button>

            </div>

          </div>

        </aside>


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

        <main className="min-h-screen min-w-0 pt-16 lg:ml-[250px] lg:pt-0">

          {/* ------------------------------------------------------------ */}
          {/* Desktop Topbar                                               */}
          {/* ------------------------------------------------------------ */}

          <header className="hidden h-16 items-center justify-between border-b border-white/[0.06] bg-[#101416] px-8 lg:flex">

            <div className="flex items-center gap-2 text-xs font-medium text-text-muted">

              <span className="text-[#78A88B]">SecurePatch</span>

              <span>/</span>

              <span>
                {getPageLabel(location.pathname)}
              </span>

            </div>


            <div className="flex items-center gap-3">

              <ThemeToggle />
              <span className="text-xs text-text-muted">{user ? "Signed in" : loading ? "Loading account" : "Account unavailable"}</span>

              <div title={user?.name || (loading ? "Loading account" : "Account unavailable")} className="w-8 h-8 rounded-full bg-[#202729] border border-white/[0.1] flex items-center justify-center text-xs font-medium text-[#D7DFDA]">
                {userInitial}
              </div>

            </div>

          </header>


          {/* ------------------------------------------------------------ */}
          {/* Page Content                                                  */}
          {/* ------------------------------------------------------------ */}

          {contextError && <section role="alert" className="mx-5 my-8 max-w-2xl rounded-xl border border-red-400/30 bg-red-400/[0.04] p-5 text-sm text-red-100 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-red-100/70">Workspace unavailable</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">We couldn’t load your account.</h1>
            <p className="mt-2 leading-6 text-red-100/75">Try again. If this continues, contact your administrator with the technical details below.</p>
            <details className="mt-4 text-xs text-red-100/70">
              <summary className="w-fit cursor-pointer underline underline-offset-2">Technical details</summary>
              <p className="mt-2 break-words font-mono-code">{contextError}</p>
            </details>
            <button className="mt-5 rounded-md border border-red-100/20 px-3 py-2 text-xs font-semibold hover:bg-red-100/10" onClick={loadDashboardContext}>Retry</button>
          </section>}
          {signOutError && <div role="alert" className="m-5 rounded-lg border border-red-400/30 bg-red-400/[0.04] p-4 text-sm text-red-100">
            <p className="font-medium">Sign-out could not be confirmed.</p>
            <p className="mt-1 text-red-100/75">Please try again.</p>
            <details className="pt-1 text-xs text-red-100/70"><summary className="w-fit cursor-pointer underline underline-offset-2">Technical details</summary><p className="mt-2 break-words font-mono-code">{signOutError}</p></details>
          </div>}
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

        </main>

      </div>

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
}) {
  const className = `
    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
    text-left transition-all
    ${
      active
        ? "bg-white/[0.06] text-text-primary border border-white/[0.07]"
        : "text-text-muted hover:text-text-primary hover:bg-white/[0.035]"
    }
    ${
      disabled
        ? "opacity-60 cursor-not-allowed hover:bg-transparent hover:text-text-muted"
        : ""
    }
  `;

  if (disabled) {
    return (
      <div className={className}>

        <Icon className="w-4 h-4" />

        <span className="text-xs font-medium flex-1">
          {label}
        </span>

        {badge && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-muted uppercase">
            {badge}
          </span>
        )}

      </div>
    );
  }

  return (
    <Link
      to={to}
      className={className}
    >

      <Icon
        className={`w-4 h-4 ${
          active ? "text-[#78A88B]" : ""
        }`}
      />

      <span className="text-xs font-medium flex-1">
        {label}
      </span>

      {badge && (
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-muted uppercase">
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
  switch (pathname) {
    case "/dashboard":
      return "Dashboard";

    case "/github":
      return "GitHub";

    case "/settings":
      return "Settings";

    case "/findings":
      return "Findings";

    default:
      return "Dashboard";
  }
}
