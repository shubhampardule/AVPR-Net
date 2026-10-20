import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
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
    <div className="min-h-screen bg-[#101416] text-[#E8EEEB] selection:bg-[#78A88B]/20 selection:text-[#78A88B]">
      <Navbar />

      <div id="product">
        <HeroSection />
      </div>

      <ScrollNarrative />

      <LiveVulnerabilityPlayground />

      <ArchitectureGrid />

      <FinalCtaSection />

      <Footer />
    </div>
  );
}

function LoadingScreen() {
  return (
    <main role="status" className="flex min-h-screen items-center justify-center bg-[#101416] px-5 text-[#B1BCB6]">
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171D1F] px-4 py-3 text-sm">
        <LoaderCircle className="h-4 w-4 animate-spin text-[#A8C4B1]" aria-hidden="true" />
        <span>Loading SecurePatch…</span>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AppErrorBoundary><ThemeProvider><MotionConfig reducedMotion="user"><BrowserRouter>
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
      <Route path="*" element={<main className="flex min-h-screen items-center justify-center bg-[#101416] px-5 text-[#E8EEEB]"><div className="max-w-md text-center"><h1 className="text-3xl font-semibold tracking-tight">Page not found</h1><p className="mt-3 text-sm leading-6 text-[#AEB9B3]">The address may be incorrect, or the page may have moved.</p><Link to="/" className="mt-6 inline-flex rounded-md bg-[#78A88B] px-4 py-2.5 text-sm font-semibold text-[#101916] transition-colors hover:bg-[#8DB89C]">Return to SecurePatch</Link></div></main>} /></Routes></Suspense>
    </BrowserRouter></MotionConfig></ThemeProvider></AppErrorBoundary>
  );
}
