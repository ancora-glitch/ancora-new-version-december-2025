import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface RedirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl: string;
  marketplaceName?: string;
  marketplaceLogo?: string;
}

export const RedirectModal = ({
  isOpen,
  onClose,
  redirectUrl,
  marketplaceName = "Marketplace",
  marketplaceLogo,
}: RedirectModalProps) => {
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(2);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.open(redirectUrl, "_blank");
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, redirectUrl, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-secondary via-background to-secondary">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-background/60 backdrop-blur-sm hover:bg-background transition-colors"
        aria-label="Close and cancel redirect"
      >
        <X size={18} className="text-foreground" />
      </button>

      {/* Content */}
      <div className="flex flex-col items-center text-center px-8 space-y-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <p className="font-sans text-base text-muted-foreground tracking-wide">
          You are now leaving
        </p>

        <h1 className="font-logo text-5xl md:text-6xl font-bold text-primary/95 tracking-[0.16em]">
          ANCORA
        </h1>

        <p className="font-sans text-base text-muted-foreground tracking-wide">
          …and catwalking over to
        </p>

        {/* Marketplace Logo */}
        <div className="mt-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          {marketplaceLogo ? (
            <img
              src={marketplaceLogo}
              alt={marketplaceName}
              className="h-12 md:h-16 object-contain"
            />
          ) : (
            <div className="px-8 py-4 bg-muted/50 rounded-lg">
              <span className="font-sans text-lg font-medium text-foreground">
                {marketplaceName}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs animate-fade-up" style={{ animationDelay: "0.4s" }}>
          {/* Continue Button - Primary CTA */}
          <button
            onClick={() => {
              window.open(redirectUrl, "_blank");
              onClose();
            }}
            className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>

          {/* Go Back Button - Secondary */}
          <button
            onClick={onClose}
            className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            Go back
          </button>
        </div>

        {/* Countdown indicator */}
        <p className="mt-4 font-sans text-xs text-muted-foreground/70">
          Auto-redirecting in {countdown}s...
        </p>
      </div>
    </div>
  );
};
