import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
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
import { GithubIcon } from "../ui/GithubIcon";
import { API_BASE_URL } from "../../config/api";

export default function DashboardLayout() {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [showOrgForm, setShowOrgForm] = useState(false);

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
    try {
      const [userResponse, orgResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
        }),

        fetch(`${API_BASE_URL}/organizations`, {
          credentials: "include",
        }),
      ]);

      if (!userResponse.ok) {
        window.location.href = "/login";
        return;
      }

      const userData = await userResponse.json();
      const orgData = await orgResponse.json();
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
        setSelectedOrg(normalizedOrganizations[0]);
      }
    } catch (error) {
      console.error(
        "Dashboard context loading failed:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOrganizationChange = (event) => {
    const organizationId = event.target.value;

    const organization = organizations.find(
      (item) =>
        (item._id || item.id) === organizationId
    );

    setSelectedOrg(organization || null);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/";
    }
  };

  const displayName =
    user?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Developer";

  const userInitial =
    displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F5F7FA]">

      {/* ---------------------------------------------------------------- */}
      {/* Background                                                      */}
      {/* ---------------------------------------------------------------- */}

      <div className="fixed inset-0 tech-grid opacity-20 pointer-events-none" />


      {/* ---------------------------------------------------------------- */}
      {/* Mobile Header                                                   */}
      {/* ---------------------------------------------------------------- */}

      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-[#08090B]/90 backdrop-blur-xl border-b border-white/[0.06]">

        <div className="h-full px-4 flex items-center justify-between">

          <Link
            to="/dashboard"
            className="flex items-center gap-2.5"
          >

            <div className="w-8 h-8 rounded-lg bg-[#111419] border border-white/[0.1] flex items-center justify-center">

              <ShieldCheck className="w-4 h-4 text-[#4ADE80]" />

            </div>

            <span className="font-mono text-sm font-semibold">
              Secure<span className="text-[#4ADE80]">Patch</span>
            </span>

          </Link>


          <button
            onClick={() =>
              setMobileSidebarOpen(
                !mobileSidebarOpen
              )
            }
            className="p-2 rounded-lg bg-[#111419] border border-white/[0.08]"
            aria-label="Toggle navigation"
          >

            {mobileSidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}

          </button>

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
            bg-[#0D0F12]
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

              <div className="w-8 h-8 rounded-lg bg-[#111419] border border-white/[0.1] flex items-center justify-center">

                <ShieldCheck className="w-4 h-4 text-[#4ADE80]" />

              </div>


              <div>

                <div className="font-mono text-sm font-semibold">
                  Secure<span className="text-[#4ADE80]">Patch</span>
                </div>

                <div className="text-[8px] font-mono text-text-muted uppercase tracking-wider">
                  Security Platform
                </div>

              </div>

            </Link>

          </div>


          {/* ------------------------------------------------------------ */}
          {/* Organization Selector                                        */}
          {/* ------------------------------------------------------------ */}

          <div className="p-4 border-b border-white/[0.06]">

            <div className="text-[9px] font-mono text-text-muted uppercase tracking-wider mb-2">
              Workspace
            </div>


            <div className="relative">

              <select
                value={
                  selectedOrg?._id ||
                  selectedOrg?.id ||
                  ""
                }
                onChange={handleOrganizationChange}
                className="appearance-none w-full bg-[#111419] border border-white/[0.08] rounded-lg px-3 py-2.5 pr-8 text-xs font-mono text-text-primary focus:outline-none focus:border-[#4ADE80]/50"
              >

                {organizations.length === 0 ? (
                  <option value="">
                    No organization
                  </option>
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

            {organizations.length > 0 && <button type="button" onClick={() => setShowOrgForm((open) => !open)} className="mt-3 text-xs text-[#4ADE80] hover:underline">{showOrgForm ? "Cancel" : "Create organization"}</button>}
            {(showOrgForm || (!loading && organizations.length === 0)) && (
              <form onSubmit={createOrganization} className="mt-3 space-y-2">
                <label htmlFor="organization-name" className="block text-xs text-text-secondary">Organization name</label>
                <input id="organization-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required maxLength={150} placeholder="Your team or project" className="w-full rounded-lg border border-white/10 bg-[#111419] px-3 py-2 text-xs focus:border-[#4ADE80] focus:outline-none" />
                {orgError && <p role="alert" className="text-xs text-red-300">{orgError}</p>}
                <button disabled={creatingOrg || !organizationName.trim()} className="w-full rounded-lg bg-[#4ADE80] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{creatingOrg ? "Creating..." : "Create workspace"}</button>
              </form>
            )}

          </div>


          {/* ------------------------------------------------------------ */}
          {/* Navigation                                                    */}
          {/* ------------------------------------------------------------ */}

          <nav className="flex-1 p-3 overflow-y-auto">

            {/* Platform */}

            <div className="text-[9px] font-mono text-text-muted uppercase tracking-wider px-3 mb-2">
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
                badge="Soon"
                disabled
              />

            </div>


            {/* Workspace */}

            <div className="mt-8 text-[9px] font-mono text-text-muted uppercase tracking-wider px-3 mb-2">
              Workspace
            </div>


            <div className="space-y-1">

              <SidebarItem
                icon={GithubIcon}
                label="GitHub"
                to="/github"
                active={
                  location.pathname === "/github"
                }
              />


              <SidebarItem
                icon={Settings}
                label="Settings"
                badge="Soon"
                disabled
              />

            </div>

          </nav>


          {/* ------------------------------------------------------------ */}
          {/* User                                                         */}
          {/* ------------------------------------------------------------ */}

          <div className="p-3 border-t border-white/[0.06]">

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#111419] border border-white/[0.06]">

              <div className="w-8 h-8 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/20 flex items-center justify-center text-xs font-mono font-bold text-[#4ADE80]">
                {userInitial}
              </div>


              <div className="flex-1 min-w-0">

                <div className="text-xs font-medium text-text-primary truncate">
                  {loading
                    ? "Loading..."
                    : displayName}
                </div>

                <div className="text-[9px] font-mono text-text-muted truncate">
                  {user?.email ||
                    "Authenticated user"}
                </div>

              </div>


              <button
                onClick={handleLogout}
                title="Sign out"
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

        <main className="lg:ml-[250px] min-h-screen min-w-0">

          {/* ------------------------------------------------------------ */}
          {/* Desktop Topbar                                               */}
          {/* ------------------------------------------------------------ */}

          <header className="hidden lg:flex h-16 px-8 items-center justify-between border-b border-white/[0.06] bg-[#08090B]/70 backdrop-blur-xl">

            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted uppercase tracking-wider">

              <span className="text-[#4ADE80]">
                SECUREPATCH
              </span>

              <span>/</span>

              <span>
                {getPageLabel(location.pathname)}
              </span>

            </div>


            <div className="flex items-center gap-3">

              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111419] border border-white/[0.06]">

                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />

                <span className="text-[9px] font-mono text-text-muted">
                  SYSTEM OPERATIONAL
                </span>

              </div>


              <div className="w-8 h-8 rounded-lg bg-[#111419] border border-white/[0.08] flex items-center justify-center text-xs font-mono text-[#4ADE80]">
                {userInitial}
              </div>

            </div>

          </header>


          {/* ------------------------------------------------------------ */}
          {/* Page Content                                                  */}
          {/* ------------------------------------------------------------ */}

          <Outlet
            context={{
              user,
              organizations,
              selectedOrg,
              loading,
              refreshContext: loadDashboardContext,
            }}
          />

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
          active ? "text-[#4ADE80]" : ""
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
