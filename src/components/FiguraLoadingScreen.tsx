import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeStepForProgress } from "@/hooks/useTryOnProgress";

interface FiguraLoadingScreenProps {
  progress: number;
  statusMessage: string;
}

export const FiguraLoadingScreen = ({ progress, statusMessage }: FiguraLoadingScreenProps) => {
  const progressPct = Math.min(100, Math.max(0, Math.round(progress)));
  const activeStep = activeStepForProgress(progressPct);

  return (
    <div className="relative flex min-h-[380px] flex-col px-5 py-6 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[28%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.06)_0%,transparent_70%)]"
      />

      <div className="relative z-10 mx-auto mb-6 h-[130px] w-[78px]">
        <svg className="h-full w-full text-primary" viewBox="0 0 200 420" fill="none" aria-hidden="true">
          <ellipse cx="100" cy="45" rx="28" ry="32" fill="currentColor" opacity="0.35" />
          <rect x="88" y="72" width="24" height="18" rx="8" fill="currentColor" opacity="0.35" />
          <path
            d="M55 90 C55 85 70 80 100 80 C130 80 145 85 145 90 L152 210 L48 210 Z"
            fill="currentColor"
            opacity="0.28"
          />
          <path
            d="M55 95 C38 102 30 135 33 178 L50 175 C47 145 51 118 62 107 Z"
            fill="currentColor"
            opacity="0.28"
          />
          <path
            d="M145 95 C162 102 170 135 167 178 L150 175 C153 145 149 118 138 107 Z"
            fill="currentColor"
            opacity="0.28"
          />
          <path
            d="M63 208 L68 340 L93 340 L100 265 L107 340 L132 340 L137 208 Z"
            fill="currentColor"
            opacity="0.22"
          />
        </svg>
        <div className="figura-scan-line absolute inset-x-[-8px] top-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/60 to-transparent shadow-[0_0_8px_hsl(var(--primary)/0.2)]" />
      </div>

      <div className="relative z-10 mb-5 flex w-full justify-center gap-1.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all duration-500",
              index < activeStep && "bg-primary",
              index === activeStep && "scale-125 bg-primary/45",
              index > activeStep && "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="relative z-10 mb-4 w-full">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Analysing
          </span>
          <span className="font-sans text-xs font-semibold tabular-nums text-primary">
            {progressPct}%
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="relative z-10 mb-5 min-h-[18px] w-full text-center">
        <p className="font-sans text-sm text-foreground transition-opacity duration-300">
          {statusMessage}
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-2 font-sans text-xs text-muted-foreground">
        <Lock size={12} className="shrink-0" />
        <span>Your photo is never stored</span>
      </div>
    </div>
  );
};
