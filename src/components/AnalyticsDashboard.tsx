import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Eye, MousePointer, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  popularPages: { page_path: string; count: number }[];
  recentActivity: { date: string; views: number; clicks: number }[];
}

export const AnalyticsDashboard = () => {
  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["site-analytics"],
    queryFn: async () => {
      // Get total page views
      const { count: totalViews } = await supabase
        .from("site_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "page_view");

      // Get total clicks
      const { count: totalClicks } = await supabase
        .from("site_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "click");

      // Get popular pages
      const { data: pageViews } = await supabase
        .from("site_analytics")
        .select("page_path")
        .eq("event_type", "page_view");

      // Count occurrences of each page
      const pageCounts: Record<string, number> = {};
      pageViews?.forEach((view) => {
        pageCounts[view.page_path] = (pageCounts[view.page_path] || 0) + 1;
      });

      const popularPages = Object.entries(pageCounts)
        .map(([page_path, count]) => ({ page_path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get activity for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentEvents } = await supabase
        .from("site_analytics")
        .select("event_type, created_at")
        .gte("created_at", sevenDaysAgo.toISOString());

      // Group by date
      const activityByDate: Record<string, { views: number; clicks: number }> = {};
      recentEvents?.forEach((event) => {
        const date = new Date(event.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (!activityByDate[date]) {
          activityByDate[date] = { views: 0, clicks: 0 };
        }
        if (event.event_type === "page_view") {
          activityByDate[date].views++;
        } else {
          activityByDate[date].clicks++;
        }
      });

      const recentActivity = Object.entries(activityByDate)
        .map(([date, data]) => ({ date, ...data }))
        .slice(-7);

      return {
        totalViews: totalViews || 0,
        totalClicks: totalClicks || 0,
        popularPages,
        recentActivity,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getPageName = (path: string): string => {
    if (path === "/") return "Home";
    return path
      .split("/")
      .filter(Boolean)[0]
      ?.replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || path;
  };

  // Calculate max for bar chart scaling
  const maxPageCount = Math.max(...(analytics?.popularPages.map((p) => p.count) || [1]));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <BarChart3 size={20} className="text-primary" />
        Statistics
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Views */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye size={16} className="text-primary" />
              Total Page Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {analytics?.totalViews.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        {/* Total Clicks */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointer size={16} className="text-primary" />
              Product Clicks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {analytics?.totalClicks.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        {/* Engagement Rate */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Engagement Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {analytics && analytics.totalViews > 0
                ? ((analytics.totalClicks / analytics.totalViews) * 100).toFixed(1)
                : "0"}
              %
            </p>
            <p className="text-xs text-muted-foreground mt-1">Clicks / Views</p>
          </CardContent>
        </Card>
      </div>

      {/* Popular Pages */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground">
            Popular Pages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.popularPages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics?.popularPages.map((page, index) => (
                <div key={page.page_path} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">
                      {index + 1}. {getPageName(page.page_path)}
                    </span>
                    <span className="text-muted-foreground">
                      {page.count.toLocaleString()} views
                    </span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all duration-500"
                      style={{ width: `${(page.count / maxPageCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {analytics && analytics.recentActivity.length > 0 && (
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">
              Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-32">
              {analytics.recentActivity.map((day) => {
                const maxValue = Math.max(
                  ...analytics.recentActivity.map((d) => d.views + d.clicks),
                  1
                );
                const height = ((day.views + day.clicks) / maxValue) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary/60 rounded-t transition-all duration-300 hover:bg-primary/80"
                      style={{ height: `${height}%`, minHeight: "4px" }}
                      title={`${day.views} views, ${day.clicks} clicks`}
                    />
                    <span className="text-xs text-muted-foreground">{day.date}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary/60 rounded" /> Activity
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
