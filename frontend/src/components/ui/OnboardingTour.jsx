import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight, ChevronLeft, Check, HelpCircle } from "lucide-react";

export const TOUR_STEPS = [
  {
    target: '[data-tour="add-repo-btn"], [data-tour="nav-repositories"]',
    fallbackTarget: '[data-tour="nav-repositories"]',
    title: "1. Add Your Repository",
    content: "Start here! Click Add Repository to authorize your GitHub repositories. AVPR-Net will connect through the GitHub App to fetch code securely without storing personal tokens.",
    placement: "bottom",
  },
  {
    target: '[data-tour="workspace-selector"]',
    title: "2. Workspaces & Access Control",
    content: "All repositories, scans, and security findings are grouped inside workspaces. Select your active team workspace here or create a new one.",
    placement: "bottom",
  },
  {
    target: '[data-tour="nav-findings"]',
    title: "3. Triage & Prioritize Vulnerabilities",
    content: "Review normalized findings from Semgrep, Bandit, and dependency scanners with source code context, CWE classification, and deterministic risk metrics (0–10).",
    placement: "right",
  },
  {
    target: '[data-tour="nav-assistant"]',
    title: "4. Agentic AI Remediation (NVIDIA Nemotron)",
    content: "Remediate vulnerabilities with open-source NVIDIA Nemotron on Nebius Token Factory. The AI drafts verified single-file patches, rescans them instantly, and opens pull requests.",
    placement: "right",
  },
  {
    target: '[data-tour="quick-tour-btn"]',
    title: "5. Replay Tour Anytime",
    content: "You're all set! You can replay this interactive step-by-step walkthrough at any time by clicking the Tour button in the top bar.",
    placement: "bottom",
  },
];

export default function OnboardingTour({ isOpen, onClose, onFinish }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const step = TOUR_STEPS[currentStep];

  const updatePosition = useCallback(() => {
    if (!step) return;
    const selectors = (step.target || "").split(",").map((s) => s.trim());
    let element = null;

    for (const sel of selectors) {
      if (!sel) continue;
      const candidates = document.querySelectorAll(sel);
      for (const el of candidates) {
        if (el && el.offsetParent !== null) {
          element = el;
          break;
        }
      }
      if (element) break;
    }

    if (!element && step.fallbackTarget) {
      element = document.querySelector(step.fallbackTarget);
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      });
      setIsVisible(true);
    } else {
      // If target element is not found on current page, still show bubble in bottom-right corner as a fallback
      setTargetRect(null);
      setIsVisible(true);
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const timer = setTimeout(updatePosition, 100);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      clearTimeout(timer);
    };
  }, [isOpen, currentStep, updatePosition]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((c) => c + 1);
    } else {
      if (onFinish) onFinish();
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((c) => c - 1);
    }
  };

  if (!isOpen || !step) return null;

  // Calculate card position relative to target
  let cardStyle = {};
  const margin = 14;

  if (targetRect) {
    if (step.placement === "right") {
      cardStyle = {
        top: Math.max(16, Math.min(window.innerHeight - 280, targetRect.top - 10)),
        left: Math.min(window.innerWidth - 360, targetRect.right + margin),
      };
    } else if (step.placement === "bottom") {
      cardStyle = {
        top: Math.min(window.innerHeight - 280, targetRect.bottom + margin),
        left: Math.max(16, Math.min(window.innerWidth - 360, targetRect.left)),
      };
    } else if (step.placement === "left") {
      cardStyle = {
        top: Math.max(16, targetRect.top),
        left: Math.max(16, targetRect.left - 340 - margin),
      };
    } else {
      cardStyle = {
        top: Math.max(16, targetRect.top - 240 - margin),
        left: Math.max(16, targetRect.left),
      };
    }
  } else {
    // Center-bottom fallback
    cardStyle = {
      bottom: 24,
      right: 24,
    };
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-auto">
        {/* Subtle dark backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
          onClick={onClose}
        />

        {/* Highlight spotlight box over target element */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="absolute rounded-xl border-2 border-accent-security shadow-[0_0_24px_rgba(163,180,237,0.35)] pointer-events-none z-[101]"
          >
            {/* Pulsating beacon dot on the corner */}
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-security opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-accent-security"></span>
            </span>
          </motion.div>
        )}

        {/* Floating Tutorial Bubble / Card */}
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          style={cardStyle}
          className="absolute z-[102] w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-text-primary/15 bg-bg-secondary/95 p-5 shadow-2xl backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-text-primary/10">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-security/15 text-accent-security">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold tracking-wider uppercase text-accent-security">
                Quick Tour · {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition"
              title="Skip tutorial (Esc)"
              aria-label="Close tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
            <p className="text-xs leading-relaxed text-text-secondary">{step.content}</p>
          </div>

          {/* Progress dots & Actions */}
          <div className="mt-4 pt-3 flex items-center justify-between border-t border-text-primary/10">
            {/* Step indicator dots */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? "w-5 bg-accent-security"
                      : "w-1.5 bg-text-primary/20 hover:bg-text-primary/40"
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1 rounded-lg border border-text-primary/15 bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-text-primary/25 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}

              <button
                onClick={handleNext}
                className="inline-flex items-center gap-1 rounded-lg bg-accent-security px-3 py-1.5 text-xs font-semibold text-on-accent hover:opacity-95 shadow-sm transition"
              >
                {currentStep === TOUR_STEPS.length - 1 ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Got it!
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
