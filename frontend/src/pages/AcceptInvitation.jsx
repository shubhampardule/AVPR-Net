import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

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

  return <main className="min-h-screen bg-[#08090B] p-6 text-white"><section className="mx-auto mt-24 max-w-lg space-y-4 rounded-xl border border-white/10 bg-[#0D0F12] p-6">
    <h1 className="text-xl font-semibold">Join a SecurePatch workspace</h1>
    {message && <p role="status" className="text-slate-300">{message}</p>}
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {organization && <><p className="text-green-200">You joined {organization.name}.</p><Link className="inline-block rounded bg-green-300 px-4 py-2 font-medium text-black" to="/dashboard">Open workspace</Link></>}
    {error && <p className="text-sm text-slate-400">If this link was sent to a different email, sign out and use the invited account.</p>}
  </section></main>;
}
