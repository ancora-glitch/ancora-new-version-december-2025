import { useEffect, useState, useRef, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { X, ExternalLink } from "lucide-react";

interface RedirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl: string;
  partnerName?: string;
  /** If true, navigation was already triggered by user click - just show UI */
  navigationTriggered?: boolean;
}

const DISPLAY_DURATION_MS = 2000;

/**
 * Creates and clicks an anchor element to navigate - must be called 
 * synchronously within a user-initiated event handler to avoid popup blockers.
 */
export const triggerUserInitiatedNavigation = (url: string): void => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  // Some browsers need the element in the DOM
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  // Clean up immediately
  document.body.removeChild(anchor);
};

export const RedirectModal = ({
  isOpen,
  onClose,
  redirectUrl,
  partnerName = "our partner",
  navigationTriggered = false,
}: RedirectModalProps) => {
  const [progress, setProgress] = useState(0);
  const [showManualLink, setShowManualLink] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (displayTimeoutRef.current) {
      clearTimeout(displayTimeoutRef.current);
      displayTimeoutRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    cleanup();
    setProgress(0);
    setShowManualLink(false);
    onClose();
  }, [cleanup, onClose]);

  // Handle ESC key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
      // Trap focus inside modal
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Focus close button on open
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Progress animation - purely cosmetic since navigation already happened
  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setShowManualLink(false);
      return;
    }

    const startTime = Date.now();
    
    // Smooth progress animation
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / DISPLAY_DURATION_MS) * 100, 100);
      setProgress(newProgress);
    }, 50);

    // Show manual link as fallback after delay
    displayTimeoutRef.current = setTimeout(() => {
      cleanup();
      setShowManualLink(true);
    }, DISPLAY_DURATION_MS);

    return cleanup;
  }, [isOpen, cleanup]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-secondary via-background to-secondary"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redirect-modal-title"
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Cancel and stay on Ancora"
      >
        <X size={20} className="text-foreground" />
      </button>

      {/* Content */}
      <div 
        ref={modalRef}
        className="flex flex-col items-center text-center px-8 max-w-md space-y-6 animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        <p className="font-sans text-base text-muted-foreground tracking-wide">
          You are now leaving
        </p>

        <h1 
          id="redirect-modal-title"
          className="font-logo text-5xl md:text-6xl font-bold text-primary/95 tracking-[0.16em]"
        >
          ANCORA
        </h1>

        <p className="font-sans text-base text-muted-foreground tracking-wide">
          …and heading over to
        </p>

        {/* Partner Name */}
        <div className="mt-2 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <span className="font-serif text-2xl md:text-3xl font-medium text-foreground capitalize">
            {partnerName}
          </span>
        </div>

        {/* Progress bar - only show when navigation was triggered */}
        {navigationTriggered && !showManualLink && (
          <div className="w-48 mt-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Progress value={progress} className="h-1 bg-muted" />
          </div>
        )}

        {/* Manual fallback link - shown after delay or if navigation wasn't triggered */}
        {(showManualLink || !navigationTriggered) && (
          <a
            href={redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 animate-fade-up"
          >
            Continue to {partnerName}
            <ExternalLink size={16} />
          </a>
        )}

        {/* Cancel link */}
        <button
          onClick={handleClose}
          className="mt-4 font-sans text-sm text-muted-foreground/70 hover:text-foreground underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
