import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { LoaderCircle } from 'lucide-react';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';

import { Navbar } from './components/navbar/Navbar';
import { HeroSection } from './components/hero/HeroSection';
import { ScrollNarrative } from './components/narrative/ScrollNarrative';
import { LiveVulnerabilityPlayground } from './components/interactive/LiveVulnerabilityPlayground';
import { ArchitectureGrid } from './components/capabilities/ArchitectureGrid';
import { FinalCtaSection } from './components/cta/FinalCtaSection';
import { Footer } from './components/footer/Footer';

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GitHub = lazy(() => import("./pages/GitHub"));
const DashboardLayout = lazy(() => import("./components/layout/DashboardLayout"));
const Repository = lazy(() => import("./pages/Repository"));
const FileViewer = lazy(() => import("./pages/FileViewer"));
const ScanPage = lazy(() => import("./pages/ScanPage"));
const Assistant = lazy(() => import("./pages/Assistant"));

const Settings = lazy(() => import("./pages/Settings"));
const Findings = lazy(() => import("./pages/Findings"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));

function Home() {
  return (
    <div className="review-home min-h-screen">
      <a className="skip-link" href="#public-content">Skip to content</a>
      <Navbar />
      <main id="public-content">

      <div id="product">
        <HeroSection />
      </div>

      <LiveVulnerabilityPlayground />

      <ScrollNarrative />

      <ArchitectureGrid />

      <FinalCtaSection />

      </main>
      <Footer />
    </div>
  );
}

function RouteMetadata() {
  const { pathname, search } = useLocation();
  const filePath = pathname.endsWith('/file') ? new URLSearchParams(search).get('path') : null;
  useEffect(() => {
    const titles = { '/': 'Repository security review', '/login': 'Sign in', '/dashboard': 'Overview', '/github': 'Repositories', '/findings': 'Findings', '/settings': 'Workspace settings', '/assistant': 'AI assistant', '/assistant-demo': 'Assistant demo', '/invite/accept': 'Join workspace' };
    const label = titles[pathname] || (pathname.startsWith('/github/') ? (filePath || (pathname.endsWith('/scan') ? 'Security scans' : 'Repository')) : 'Page not found');
    document.title = `${label} · AVPR-Net`;
  }, [pathname, filePath]);
  useEffect(() => { window.scrollTo({ top:0, left:0, behavior:'instant' }); }, [pathname, filePath]);
  return null;
}

function LoadingScreen() {
  return (
    <main role="status" className="flex min-h-screen items-center justify-center bg-bg-primary px-5 text-text-secondary">
      <div className="flex items-center gap-3 rounded-lg border border-text-primary/[0.08] bg-bg-secondary px-4 py-3 text-sm">
        <LoaderCircle className="h-4 w-4 animate-spin text-accent-security" aria-hidden="true" />
        <span>Loading AVPR-Net…</span>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AppErrorBoundary><ThemeProvider><MotionConfig reducedMotion="user"><BrowserRouter>
      <RouteMetadata />
      <Suspense fallback={<LoadingScreen />}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/invite/accept" element={<AcceptInvitation />} />
        <Route path="/assistant-demo" element={import.meta.env.PROD ? <Navigate to="/assistant" replace /> : <Assistant demo />} />

        <Route element={<DashboardLayout />}>
          <Route path="/settings" element={<Settings />} /><Route path="/findings" element={<Findings />} /><Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assistant" element={<Assistant />} />

          <Route path="/github" element={<GitHub />} />

          <Route
            path="/github/:owner/:repo"
            element={<Repository />}
          />

          <Route
            path="/github/:owner/:repo/scan"
            element={<ScanPage />}
          />

          <Route
            path="/github/:owner/:repo/file"
            element={<FileViewer />}
          />
        </Route>
      <Route path="*" element={<main className="flex min-h-screen items-center justify-center bg-bg-primary px-5 text-text-primary"><div className="max-w-md text-center"><h1 className="text-3xl font-semibold tracking-tight">Page not found</h1><p className="mt-3 text-sm leading-6 text-text-secondary">The address may be incorrect, or the page may have moved.</p><Link to="/" className="mt-6 inline-flex rounded-md bg-accent-security px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-security">Return to AVPR-Net</Link></div></main>} /></Routes></Suspense>
    </BrowserRouter></MotionConfig></ThemeProvider></AppErrorBoundary>
  );
}
