import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Navbar } from './components/navbar/Navbar';
import { HeroSection } from './components/hero/HeroSection';
import { ScrollNarrative } from './components/narrative/ScrollNarrative';
import { LiveVulnerabilityPlayground } from './components/interactive/LiveVulnerabilityPlayground';
import { ArchitectureGrid } from './components/capabilities/ArchitectureGrid';
import { FinalCtaSection } from './components/cta/FinalCtaSection';
import { Footer } from './components/footer/Footer';
import { ScanModal } from './components/modal/ScanModal';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GitHub from './pages/GitHub';
import DashboardLayout from "./components/layout/DashboardLayout";
import Repository from "./pages/Repository";
import FileViewer from "./pages/FileViewer";
import ScanPage from "./pages/ScanPage";
import Assistant from "./pages/Assistant";

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/assistant-demo" element={<Assistant demo />} />

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
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
      </Routes>
    </BrowserRouter>
  );
}
