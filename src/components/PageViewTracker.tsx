import { usePageViewTracking } from "@/hooks/useAnalytics";

interface PageViewTrackerProps {
  children: React.ReactNode;
}

export const PageViewTracker = ({ children }: PageViewTrackerProps) => {
  usePageViewTracking();
  return <>{children}</>;
};
