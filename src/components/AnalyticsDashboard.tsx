import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Eye, MousePointer, TrendingUp, BarChart3, Calendar, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DateRange = "7days" | "30days" | "all";

interface TopProduct {
  product_id: string;
  product_name: string;
  brand: string;
  clicks: number;
  purchases: number;
}

interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  buyNowClicks: number;
  popularPages: { page_path: string; count: number }[];
  recentActivity: { date: string; views: number; clicks: number; buyNow: number }[];
  topProducts: TopProduct[];
}

const getDateRangeStart = (range: DateRange): Date | null => {
  if (range === "all") return null;
  
  const date = new Date();
  if (range === "7days") {
    date.setDate(date.getDate() - 7);
  } else if (range === "30days") {
    date.setDate(date.getDate() - 30);
  }
  return date;
};

const getDateRangeLabel = (range: DateRange): string => {
  switch (range) {
    case "7days":
      return "Last 7 days";
    case "30days":
      return "Last 30 days";
    case "all":
      return "All time";
  }
};

export const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>("7days");

  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["site-analytics", dateRange],
    queryFn: async () => {
      const rangeStart = getDateRangeStart(dateRange);

      // Build base query for page views
      let viewsQuery = supabase
        .from("site_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "page_view");
      
      if (rangeStart) {
        viewsQuery = viewsQuery.gte("created_at", rangeStart.toISOString());
      }
      
      const { count: totalViews } = await viewsQuery;

      // Build base query for product clicks
      let clicksQuery = supabase
        .from("site_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "product_click");
      
      if (rangeStart) {
        clicksQuery = clicksQuery.gte("created_at", rangeStart.toISOString());
      }
      
      const { count: totalClicks } = await clicksQuery;

      // Build query for Buy Now clicks
      let buyNowQuery = supabase
        .from("site_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "buy_now_click");
      
      if (rangeStart) {
        buyNowQuery = buyNowQuery.gte("created_at", rangeStart.toISOString());
      }
      
      const { count: buyNowClicks } = await buyNowQuery;

      // Get popular pages
      let pagesQuery = supabase
        .from("site_analytics")
        .select("page_path")
        .eq("event_type", "page_view");
      
      if (rangeStart) {
        pagesQuery = pagesQuery.gte("created_at", rangeStart.toISOString());
      }
      
      const { data: pageViews } = await pagesQuery;

      // Count occurrences of each page
      const pageCounts: Record<string, number> = {};
      pageViews?.forEach((view) => {
        pageCounts[view.page_path] = (pageCounts[view.page_path] || 0) + 1;
      });

      const popularPages = Object.entries(pageCounts)
        .map(([page_path, count]) => ({ page_path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get activity for the chart
      const chartDays = dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : 30;
      const chartStart = new Date();
      chartStart.setDate(chartStart.getDate() - chartDays);

      const { data: recentEvents } = await supabase
        .from("site_analytics")
        .select("event_type, page_path, created_at")
        .gte("created_at", chartStart.toISOString());

      // Group by date
      const activityByDate: Record<string, { views: number; clicks: number; buyNow: number }> = {};
      recentEvents?.forEach((event) => {
        const date = new Date(event.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (!activityByDate[date]) {
          activityByDate[date] = { views: 0, clicks: 0, buyNow: 0 };
        }
        if (event.event_type === "page_view") {
          activityByDate[date].views++;
        } else if (event.event_type === "buy_now_click") {
          activityByDate[date].buyNow++;
        } else if (event.event_type === "product_click") {
          activityByDate[date].clicks++;
        }
      });

      const recentActivity = Object.entries(activityByDate)
        .map(([date, data]) => ({ date, ...data }))
        .slice(-chartDays);

      // Get top products by clicks and purchases
      let productClicksQuery = supabase
        .from("site_analytics")
        .select("metadata")
        .eq("event_type", "product_click");
      
      if (rangeStart) {
        productClicksQuery = productClicksQuery.gte("created_at", rangeStart.toISOString());
      }
      
      const { data: productClicks } = await productClicksQuery;

      let purchaseClicksQuery = supabase
        .from("site_analytics")
        .select("metadata")
        .eq("event_type", "buy_now_click");
      
      if (rangeStart) {
        purchaseClicksQuery = purchaseClicksQuery.gte("created_at", rangeStart.toISOString());
      }
      
      const { data: purchaseClicks } = await purchaseClicksQuery;

      // Aggregate product data
      const productStats: Record<string, TopProduct> = {};
      
      productClicks?.forEach((event) => {
        const meta = event.metadata as { product_id?: string; product_name?: string; brand?: string } | null;
        if (meta?.product_id) {
          if (!productStats[meta.product_id]) {
            productStats[meta.product_id] = {
              product_id: meta.product_id,
              product_name: meta.product_name || "Unknown",
              brand: meta.brand || "Unknown",
              clicks: 0,
              purchases: 0,
            };
          }
          productStats[meta.product_id].clicks++;
        }
      });

      purchaseClicks?.forEach((event) => {
        const meta = event.metadata as { product_id?: string; product_name?: string; brand?: string } | null;
        if (meta?.product_id) {
          if (!productStats[meta.product_id]) {
            productStats[meta.product_id] = {
              product_id: meta.product_id,
              product_name: meta.product_name || "Unknown",
              brand: meta.brand || "Unknown",
              clicks: 0,
              purchases: 0,
            };
          }
          productStats[meta.product_id].purchases++;
        }
      });

      const topProducts = Object.values(productStats)
        .sort((a, b) => (b.clicks + b.purchases * 2) - (a.clicks + a.purchases * 2))
        .slice(0, 5);

      return {
        totalViews: totalViews || 0,
        totalClicks: totalClicks || 0,
        buyNowClicks: buyNowClicks || 0,
        popularPages,
        recentActivity,
        topProducts,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            Statistics
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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

  const maxPageCount = Math.max(...(analytics?.popularPages.map((p) => p.count) || [1]));

  // Calculate conversion rate (Buy Now clicks / Product clicks)
  const conversionRate = analytics && analytics.totalClicks > 0
    ? ((analytics.buyNowClicks / analytics.totalClicks) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <BarChart3 size={20} className="text-primary" />
          Statistics
        </h2>
        
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted-foreground" />
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["7days", "30days", "all"] as DateRange[]).map((range) => (
              <Button
                key={range}
                variant="ghost"
                size="sm"
                onClick={() => setDateRange(range)}
                className={`rounded-none px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRange === range
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "hover:bg-secondary"
                }`}
              >
                {range === "7days" ? "7 days" : range === "30days" ? "30 days" : "All time"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Views */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye size={16} className="text-primary" />
              Page Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {(analytics?.totalViews ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{getDateRangeLabel(dateRange)}</p>
          </CardContent>
        </Card>

        {/* Product Clicks */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointer size={16} className="text-primary" />
              Product Clicks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {(analytics?.totalClicks ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{getDateRangeLabel(dateRange)}</p>
          </CardContent>
        </Card>

        {/* Buy Now Clicks */}
        <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag size={16} className="text-primary" />
              Buy Now Clicks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {(analytics?.buyNowClicks ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Purchase intent</p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {conversionRate}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Buy Now / Product Clicks</p>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
            <ShoppingBag size={16} className="text-primary" />
            Top Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!analytics?.topProducts?.length ? (
            <p className="text-muted-foreground text-sm">No product data yet</p>
          ) : (
            <div className="space-y-4">
              {analytics.topProducts.map((product, index) => (
                <div key={product.product_id} className="flex items-start justify-between gap-4 pb-3 border-b border-border/30 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-4">
                        {index + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {product.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.brand}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {product.clicks}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Clicks
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {product.purchases}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Buy Now
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              {dateRange === "7days" ? "Last 7 Days" : dateRange === "30days" ? "Last 30 Days" : "Recent Activity"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-1 h-32 overflow-x-auto">
              {analytics.recentActivity.map((day) => {
                const maxValue = Math.max(
                  ...analytics.recentActivity.map((d) => d.views + d.clicks + d.buyNow),
                  1
                );
                const totalHeight = ((day.views + day.clicks + day.buyNow) / maxValue) * 100;
                const buyNowHeight = (day.buyNow / (day.views + day.clicks + day.buyNow || 1)) * totalHeight;
                return (
                  <div
                    key={day.date}
                    className="flex-1 min-w-[20px] flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full flex flex-col justify-end rounded-t overflow-hidden"
                      style={{ height: `${totalHeight}%`, minHeight: "4px" }}
                      title={`${day.views} views, ${day.clicks} clicks, ${day.buyNow} buy now`}
                    >
                      <div 
                        className="w-full bg-primary/90"
                        style={{ height: `${buyNowHeight}%`, minHeight: day.buyNow > 0 ? "2px" : "0" }}
                      />
                      <div 
                        className="w-full bg-primary/40 flex-1"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate max-w-full">
                      {dateRange === "30days" ? day.date.split(" ")[1] : day.date}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary/40 rounded" /> Views & Clicks
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary/90 rounded" /> Buy Now
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
