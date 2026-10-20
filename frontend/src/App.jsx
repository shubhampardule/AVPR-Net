import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';

import { Navbar } from './components/navbar/Navbar';
import { HeroSection } from './components/hero/HeroSection';
import { ScrollNarrative } from './components/narrative/ScrollNarrative';
import { LiveVulnerabilityPlayground } from './components/interactive/LiveVulnerabilityPlayground';
import { ArchitectureGrid } from './components/capabilities/ArchitectureGrid';
import { FinalCtaSection } from './components/cta/FinalCtaSection';
import { Footer } from './components/footer/Footer';
import { ScanModal } from './components/modal/ScanModal';

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

function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('scan');

  const handleOpenAuthModal = (tab = 'login') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const handleOpenScanModal = () => {
    setModalTab('scan');
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F5F7FA] selection:bg-[#4ADE80]/20 selection:text-[#4ADE80]">
      <Navbar onOpenAuthModal={handleOpenAuthModal} />

      <div id="product">
        <HeroSection onOpenScanModal={handleOpenScanModal} />
      </div>

      <ScrollNarrative />

      <LiveVulnerabilityPlayground />

      <div id="security">
        <ArchitectureGrid />
      </div>

      <FinalCtaSection onOpenScanModal={handleOpenScanModal} />

      <Footer />

      <ScanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultTab={modalTab}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary><MotionConfig reducedMotion="user"><BrowserRouter>
      <Suspense fallback={<p role="status" className="p-8 text-slate-300">Loading workspace…</p>}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
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
      <Route path="*" element={<main className="p-12 text-white"><h1>Page not found</h1><a href="/" className="text-green-300 underline">Return home</a></main>} /></Routes></Suspense>
    </BrowserRouter></MotionConfig></AppErrorBoundary>
  );
}
