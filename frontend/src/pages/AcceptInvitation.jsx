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

  return <main className="min-h-screen bg-bg-primary p-6 text-text-primary"><div className="mx-auto flex max-w-lg items-center justify-between"><Link to="/" aria-label="AVPR-Net home"><BrandLockup wordmarkClassName="text-sm" /></Link><ThemeToggle /></div><section className="mx-auto mt-8 max-w-lg space-y-4 rounded-xl border border-text-primary/10 bg-bg-secondary p-6">
    <h1 className="text-xl font-semibold">Join a AVPR-Net workspace</h1>
    {message && <p role="status" className="text-text-secondary">{message}</p>}
    {error && <p role="alert" className="text-severity-critical">{error}</p>}
    {organization && <><p className="text-accent-security">You joined {organization.name}.</p><Link className="inline-block rounded-md bg-accent-security px-4 py-2 font-medium text-on-accent transition-colors hover:bg-accent-security" to="/dashboard">Open workspace</Link></>}
    {error && <p className="text-sm text-text-muted">If this link was sent to a different email, sign out and use the invited account.</p>}
  </section></main>;
}
