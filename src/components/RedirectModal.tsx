import { useEffect, useState } from "react";

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
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(3);
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

        {/* Countdown indicator */}
        <p className="mt-8 font-sans text-xs text-muted-foreground/70 animate-fade-up" style={{ animationDelay: "0.4s" }}>
          Redirecting in {countdown}s...
        </p>
      </div>
    </div>
  );
};
