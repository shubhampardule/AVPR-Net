import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { BrandLockup } from "../components/ui/BrandLogo";

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const location = useLocation();
  const attempted = useRef(false);
  const [message, setMessage] = useState("Checking your invitation…");
  const [error, setError] = useState("");
  const [organization, setOrganization] = useState(null);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const token = new URLSearchParams(location.search).get("token");
    if (!token) { setMessage(""); setError("This invitation link is missing its token."); return; }

    (async () => {
      try {
        const authResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
        if (authResponse.status === 401) {
          const returnTo = `${location.pathname}${location.search}`;
          navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
          return;
        }
        if (!authResponse.ok) throw new Error("Your sign-in could not be checked. Please try again.");

        const response = await fetch(`${API_BASE_URL}/organizations/invitations/accept`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "This invitation could not be accepted.");
        navigate("/invite/accept", { replace: true });
        setOrganization(data.data.organization);
        setMessage("");
      } catch (acceptError) {
        setMessage(""); setError(acceptError.message);
      }
    })();
  }, [location.pathname, location.search, navigate]);

  return <main className="min-h-screen bg-[#101416] p-6 text-white"><div className="mx-auto flex max-w-lg items-center justify-between"><Link to="/" aria-label="SecurePatch home"><BrandLockup wordmarkClassName="text-sm" /></Link><ThemeToggle /></div><section className="mx-auto mt-8 max-w-lg space-y-4 rounded-xl border border-white/10 bg-[#171D1F] p-6">
    <h1 className="text-xl font-semibold">Join a SecurePatch workspace</h1>
    {message && <p role="status" className="text-slate-300">{message}</p>}
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {organization && <><p className="text-[#A8C4B1]">You joined {organization.name}.</p><Link className="inline-block rounded-md bg-[#78A88B] px-4 py-2 font-medium text-[#101916] transition-colors hover:bg-[#8DB89C]" to="/dashboard">Open workspace</Link></>}
    {error && <p className="text-sm text-slate-400">If this link was sent to a different email, sign out and use the invited account.</p>}
  </section></main>;
}
