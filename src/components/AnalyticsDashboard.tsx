import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Eye, MousePointer, TrendingUp, BarChart3, Calendar, ShoppingBag, Users, BookOpen, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

type RollingValue = "7days" | "30days" | "all";
type DateRange =
  | { kind: "rolling"; value: RollingValue }
  | { kind: "month"; year: number; month: number };
type SourceFilter = "all" | "tradera" | "ebay" | "vintagesphere" | "pure_effect";

interface TopProduct {
  product_id: string;
  product_name: string;
  brand: string;
  clicks: number;
  uniqueClicks: number;
  purchases: number;
}

interface DailyData {
  date: string;
  views: number;
  clicks: number;
  buyNow: number;
  uniqueVisitors: number;
}

interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  buyNowClicks: number;
  uniqueVisitors: number;
  popularPages: { page_path: string; count: number }[];
  recentActivity: DailyData[];
  topProducts: TopProduct[];
}

const getDateRangeBounds = (range: DateRange): { start: Date | null; end: Date | null } => {
  if (range.kind === "month") {
    return {
      start: new Date(range.year, range.month, 1),
      end: new Date(range.year, range.month + 1, 1),
    };
  }
  if (range.value === "all") return { start: null, end: null };
  const d = new Date();
  if (range.value === "7days") {
    d.setDate(d.getDate() - 7);
  } else if (range.value === "30days") {
    d.setDate(d.getDate() - 30);
  }
  return { start: d, end: null };
};

const getDateRangeLabel = (range: DateRange): string => {
  if (range.kind === "month") {
    return new Date(range.year, range.month, 1).toLocaleDateString("sv-SE", {
      month: "long",
      year: "numeric",
    });
  }
  switch (range.value) {
    case "7days":
      return "Last 7 days";
    case "30days":
      return "Last 30 days";
    case "all":
      return "All time";
  }
};

const buildMonthOptions = (): { year: number; month: number; label: string; value: string }[] => {
  const opts: { year: number; month: number; label: string; value: string }[] = [];
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  // iterate back to March 2026 (year=2026, month=2)
  while (y > 2026 || (y === 2026 && m >= 2)) {
    const label = new Date(y, m, 1).toLocaleDateString("sv-SE", {
      month: "long",
      year: "numeric",
    });
    opts.push({ year: y, month: m, label, value: `${y}-${m}` });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return opts;
};

const chartConfig: ChartConfig = {
  uniqueVisitors: {
    label: "Unique Visitors",
    color: "hsl(var(--primary))",
  },
  clicks: {
    label: "Product Clicks",
    color: "hsl(var(--primary) / 0.5)",
  },
};

export const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>({ kind: "rolling", value: "7days" });
  const monthOptions = buildMonthOptions();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // Fetch product marketplace map for source filtering
  const { data: productMarketplaceMap } = useQuery({
    queryKey: ["product-marketplace-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, marketplace");
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        if (p.marketplace) map[p.id] = p.marketplace.toLowerCase();
      });
      return map;
    },
    staleTime: 60000,
  });

  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["site-analytics", dateRange, sourceFilter, productMarketplaceMap],
    queryFn: async () => {
      const { start: rangeStart, end: rangeEnd } = getDateRangeBounds(dateRange);
      const applyRange = <T,>(q: T): T => {
        let r: any = q;
        if (rangeStart) r = r.gte("created_at", rangeStart.toISOString());
        if (rangeEnd) r = r.lt("created_at", rangeEnd.toISOString());
        return r as T;
      };
      const mpMap = productMarketplaceMap || {};

      // Helper: check if a product_id matches the source filter
      const matchesSource = (productId: string | undefined): boolean => {
        if (sourceFilter === "all" || !productId) return true;
        return mpMap[productId] === sourceFilter;
      };

      // Build base query for page views
      let viewsQuery = supabase
        .from("site_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "page_view");
      
      viewsQuery = applyRange(viewsQuery);
      
      const { count: totalViews } = await viewsQuery;

      // Build base query for product clicks
      let clicksQuery = supabase
        .from("site_analytics")
        .select("metadata")
        .eq("event_type", "product_click");
      
      clicksQuery = applyRange(clicksQuery);
      
      const { data: clicksData } = await clicksQuery;
      const filteredClicks = clicksData?.filter((e) => {
        const meta = e.metadata as { product_id?: string } | null;
        return matchesSource(meta?.product_id);
      }) || [];
      const totalClicks = filteredClicks.length;

      // Build query for Buy Now clicks
      let buyNowQuery = supabase
        .from("site_analytics")
        .select("metadata")
        .eq("event_type", "buy_now_click");
      
      buyNowQuery = applyRange(buyNowQuery);
      
      const { data: buyNowData } = await buyNowQuery;
      const filteredBuyNow = buyNowData?.filter((e) => {
        const meta = e.metadata as { product_id?: string } | null;
        return matchesSource(meta?.product_id);
      }) || [];
      const buyNowClicks = filteredBuyNow.length;

      // Get unique visitors total via RPC: counts DISTINCT visitor_ids over the
      // period after excluding bot-like visitors with > 200 events on any day.
      // A person who visits multiple days is still counted once.
      const { data: uvTotal } = await supabase.rpc("get_unique_visitors_total", {
        p_start: rangeStart ? rangeStart.toISOString() : null,
        p_end: rangeEnd ? rangeEnd.toISOString() : null,
        p_bot_threshold: 200,
      });
      const uniqueVisitors = Number(uvTotal ?? 0);

      // Get popular pages
      let pagesQuery = supabase
        .from("site_analytics")
        .select("page_path")
        .eq("event_type", "page_view");
      
      pagesQuery = applyRange(pagesQuery);
      
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
      let chartStart: Date;
      let chartEnd: Date | null;
      let chartDays: number;
      if (dateRange.kind === "month") {
        chartStart = new Date(dateRange.year, dateRange.month, 1);
        chartEnd = new Date(dateRange.year, dateRange.month + 1, 1);
        chartDays = Math.round((chartEnd.getTime() - chartStart.getTime()) / 86400000);
      } else {
        chartDays = dateRange.value === "7days" ? 7 : 30;
        chartStart = new Date();
        chartStart.setDate(chartStart.getDate() - chartDays);
        chartEnd = null;
      }

      let recentEventsQuery = supabase
        .from("site_analytics")
        .select("event_type, page_path, created_at, visitor_id, metadata")
        .gte("created_at", chartStart.toISOString());
      if (chartEnd) {
        recentEventsQuery = recentEventsQuery.lt("created_at", chartEnd.toISOString());
      }
      const { data: recentEvents } = await recentEventsQuery;

      // Group by date
      const activityByDate: Record<string, { views: number; clicks: number; buyNow: number; visitors: Set<string> }> = {};

      // Initialize all dates in range
      for (let i = 0; i < chartDays; i++) {
        const d = new Date(chartStart);
        d.setDate(d.getDate() + i);
        const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        activityByDate[dateKey] = { views: 0, clicks: 0, buyNow: 0, visitors: new Set() };
      }
      
      recentEvents?.forEach((event) => {
        const date = new Date(event.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (!activityByDate[date]) {
          activityByDate[date] = { views: 0, clicks: 0, buyNow: 0, visitors: new Set() };
        }
        
        // For product-related events, apply source filter
        if (event.event_type === "product_click" || event.event_type === "buy_now_click") {
          const meta = (event as any).metadata as { product_id?: string } | null;
          if (!matchesSource(meta?.product_id)) return;
        }
        
        if (event.event_type === "page_view") {
          activityByDate[date].views++;
        } else if (event.event_type === "buy_now_click") {
          activityByDate[date].buyNow++;
        } else if (event.event_type === "product_click") {
          activityByDate[date].clicks++;
        }
        if (event.visitor_id) {
          activityByDate[date].visitors.add(event.visitor_id);
        }
      });

      // Per-day unique visitors via RPC (matches the (visitor_id, day) + bot filter rule)
      const { data: dailyUvRows } = await supabase.rpc("get_unique_visitors", {
        p_start: chartStart.toISOString(),
        p_end: chartEnd ? chartEnd.toISOString() : null,
        p_bot_threshold: 200,
      });
      const dailyUvByDate: Record<string, number> = {};
      (dailyUvRows ?? []).forEach((row: { day: string; unique_visitors: number | string }) => {
        const dateKey = new Date(row.day).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        dailyUvByDate[dateKey] = Number(row.unique_visitors ?? 0);
      });

      const recentActivity: DailyData[] = Object.entries(activityByDate)
        .map(([date, data]) => ({ 
          date, 
          views: data.views,
          clicks: data.clicks,
          buyNow: data.buyNow,
          uniqueVisitors: dailyUvByDate[date] ?? 0,
        }));

      // Get top products by clicks and purchases with unique click counts
      let productClicksQuery = supabase
        .from("site_analytics")
        .select("metadata, visitor_id")
        .eq("event_type", "product_click");
      
      productClicksQuery = applyRange(productClicksQuery);
      
      const { data: productClicks } = await productClicksQuery;

      let purchaseClicksQuery = supabase
        .from("site_analytics")
        .select("metadata")
        .eq("event_type", "buy_now_click");
      
      purchaseClicksQuery = applyRange(purchaseClicksQuery);
      
      const { data: purchaseClicks } = await purchaseClicksQuery;

      // Aggregate product data with unique visitors per product
      const productStats: Record<string, TopProduct & { uniqueVisitors: Set<string> }> = {};
      
      productClicks?.forEach((event) => {
        const meta = event.metadata as { product_id?: string; product_name?: string; brand?: string } | null;
        if (meta?.product_id && matchesSource(meta.product_id)) {
          if (!productStats[meta.product_id]) {
            productStats[meta.product_id] = {
              product_id: meta.product_id,
              product_name: meta.product_name || "Unknown",
              brand: meta.brand || "Unknown",
              clicks: 0,
              uniqueClicks: 0,
              purchases: 0,
              uniqueVisitors: new Set(),
            };
          }
          productStats[meta.product_id].clicks++;
          if (event.visitor_id) {
            productStats[meta.product_id].uniqueVisitors.add(event.visitor_id);
          }
        }
      });

      purchaseClicks?.forEach((event) => {
        const meta = event.metadata as { product_id?: string; product_name?: string; brand?: string } | null;
        if (meta?.product_id && matchesSource(meta.product_id)) {
          if (!productStats[meta.product_id]) {
            productStats[meta.product_id] = {
              product_id: meta.product_id,
              product_name: meta.product_name || "Unknown",
              brand: meta.brand || "Unknown",
              clicks: 0,
              uniqueClicks: 0,
              purchases: 0,
              uniqueVisitors: new Set(),
            };
          }
          productStats[meta.product_id].purchases++;
        }
      });

      const topProducts = Object.values(productStats)
        .map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          brand: p.brand,
          clicks: p.clicks,
          uniqueClicks: p.uniqueVisitors.size,
          purchases: p.purchases,
        }))
        .sort((a, b) => (b.clicks + b.purchases * 2) - (a.clicks + a.purchases * 2))
        .slice(0, 10);

      return {
        totalViews: totalViews || 0,
        totalClicks: totalClicks || 0,
        buyNowClicks: buyNowClicks || 0,
        uniqueVisitors,
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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

  // Calculate intent rate (Buy Now clicks / Product clicks), capped at 100%
  const intentRate = analytics && analytics.totalClicks > 0
    ? Math.min((analytics.buyNowClicks / analytics.totalClicks) * 100, 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <BarChart3 size={20} className="text-primary" />
          Statistics
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <Store size={16} className="text-muted-foreground" />
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["all", "tradera", "ebay", "vintagesphere", "pure_effect"] as SourceFilter[]).map((source) => (
                <Button
                  key={source}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSourceFilter(source)}
                  className={`rounded-none px-3 py-1.5 text-xs font-medium transition-colors ${
                    sourceFilter === source
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "hover:bg-secondary"
                  }`}
                >
                  {source === "all" ? "All Sources" : source === "tradera" ? "Tradera" : source === "ebay" ? "eBay" : source === "pure_effect" ? "Pure Effect" : "VintageSphere"}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-muted-foreground" />
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["7days", "30days", "all"] as RollingValue[]).map((range) => {
                const active = dateRange.kind === "rolling" && dateRange.value === range;
                return (
                  <Button
                    key={range}
                    variant="ghost"
                    size="sm"
                    onClick={() => setDateRange({ kind: "rolling", value: range })}
                    className={`rounded-none px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "hover:bg-secondary"
                    }`}
                  >
                    {range === "7days" ? "7 days" : range === "30days" ? "30 days" : "All time"}
                  </Button>
                );
              })}
            </div>
            <select
              value={dateRange.kind === "month" ? `${dateRange.year}-${dateRange.month}` : ""}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m] = e.target.value.split("-").map(Number);
                setDateRange({ kind: "month", year: y, month: m });
              }}
              className={`h-8 rounded-md border px-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                dateRange.kind === "month"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-secondary"
              }`}
            >
              <option value="" disabled>Välj månad</option>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-background text-foreground">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Unique Visitors */}
        <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users size={16} className="text-primary shrink-0" />
              <span className="truncate">Unique Visitors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {(analytics?.uniqueVisitors ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{getDateRangeLabel(dateRange)}</p>
          </CardContent>
        </Card>

        {/* Total Views */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye size={16} className="text-primary shrink-0" />
              <span className="truncate">Page Views</span>
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
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointer size={16} className="text-primary shrink-0" />
              <span className="truncate">Product Clicks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {(analytics?.totalClicks ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{getDateRangeLabel(dateRange)}</p>
          </CardContent>
        </Card>

        {/* Purchase Intent */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag size={16} className="text-primary shrink-0" />
              <span className="truncate">Purchase Intent</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {(analytics?.buyNowClicks ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Buy Now clicks</p>
          </CardContent>
        </Card>

        {/* Intent Rate */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border/30 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary shrink-0" />
              <span className="truncate">Intent Rate</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {intentRate}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Intent / Clicks</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Line Chart */}
      {analytics && analytics.recentActivity.length > 0 && (
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Trends ({getDateRangeLabel(dateRange)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={analytics.recentActivity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={(dateRange.kind === "rolling" && dateRange.value === "30days") || dateRange.kind === "month" ? 4 : 0}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="uniqueVisitors" 
                  stroke="var(--color-uniqueVisitors)" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="clicks" 
                  stroke="var(--color-clicks)" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-primary rounded" /> Unique Visitors
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-primary/50 rounded" /> Product Clicks
              </span>
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="overflow-x-auto">
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right w-16">Clicks</TableHead>
                      <TableHead className="text-right w-20">Unique</TableHead>
                      <TableHead className="text-right w-16">Intent</TableHead>
                      <TableHead className="text-right w-16">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topProducts.map((product, index) => (
                      <TableRow key={product.product_id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[180px]">
                              {product.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {product.brand}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {product.clicks}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-muted-foreground">
                          {product.uniqueClicks}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {product.purchases}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {product.clicks > 0 
                            ? `${Math.min((product.purchases / product.clicks) * 100, 100).toFixed(0)}%`
                            : "0%"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Story Views */}
      <StoryViewsSection />

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
    </div>
  );
};

// ── Story Views Section ──────────────────────────────────────

interface StoryViewRow {
  story_title: string;
  story_status: string;
  published_at: string | null;
  total: number;
  views_7d: number;
  views_30d: number;
  unique_7d: number;
  unique_30d: number;
}

const StoryViewsSection = () => {
  const { data: storyViews, isLoading } = useQuery<StoryViewRow[]>({
    queryKey: ["story-views-stats"],
    queryFn: async () => {
      // Get all stories
      const { data: stories, error: storiesErr } = await supabase
        .from("style_guides")
        .select("id, title, status, published_at")
        .order("published_at", { ascending: false });

      if (storiesErr || !stories) return [];

      // Get all story views
      const { data: views, error: viewsErr } = await supabase
        .from("story_views")
        .select("story_id, viewed_at, ip_hash");

      if (viewsErr) return [];

      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      // Aggregate views per story
      const viewsByStory: Record<string, { total: number; d7: number; d30: number; ips7d: Set<string>; ips30d: Set<string> }> = {};
      views?.forEach((v) => {
        if (!viewsByStory[v.story_id]) viewsByStory[v.story_id] = { total: 0, d7: 0, d30: 0, ips7d: new Set(), ips30d: new Set() };
        viewsByStory[v.story_id].total++;
        const ts = new Date(v.viewed_at).getTime();
        const ip = v.ip_hash || v.story_id + ts; // fallback to ensure uniqueness when no ip_hash
        if (ts >= sevenDaysAgo) { viewsByStory[v.story_id].d7++; viewsByStory[v.story_id].ips7d.add(ip); }
        if (ts >= thirtyDaysAgo) { viewsByStory[v.story_id].d30++; viewsByStory[v.story_id].ips30d.add(ip); }
      });

      return stories.map((s) => ({
        story_title: s.title,
        story_status: s.status,
        published_at: s.published_at,
        total: viewsByStory[s.id]?.total ?? 0,
        views_7d: viewsByStory[s.id]?.d7 ?? 0,
        views_30d: viewsByStory[s.id]?.d30 ?? 0,
        unique_7d: viewsByStory[s.id]?.ips7d.size ?? 0,
        unique_30d: viewsByStory[s.id]?.ips30d.size ?? 0,
      })).sort((a, b) => b.total - a.total);
    },
    refetchInterval: 30000,
  });

  const statusBadge = (status: string) => {
    if (status === "published") return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">Published</span>;
    if (status === "archived") return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Archived</span>;
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800">Draft</span>;
  };

  return (
    <Card className="border-border/30">
      <CardHeader>
        <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
          <BookOpen size={16} className="text-primary" />
          Story Views
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse h-20 bg-muted rounded" />
        ) : !storyViews?.length ? (
          <p className="text-muted-foreground text-sm">No stories yet</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Story</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="text-right w-16">Total</TableHead>
                    <TableHead className="text-right w-14">7d</TableHead>
                    <TableHead className="text-right w-20">Unique (7d)</TableHead>
                    <TableHead className="text-right w-14">30d</TableHead>
                    <TableHead className="text-right w-20">Unique (30d)</TableHead>
                    <TableHead className="w-28">Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storyViews.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="font-medium text-foreground truncate max-w-[220px]">
                          {row.story_title}
                        </p>
                      </TableCell>
                      <TableCell>{statusBadge(row.story_status)}</TableCell>
                      <TableCell className="text-right font-semibold">{row.total}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.views_7d}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.unique_7d}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.views_30d}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.unique_30d}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.published_at
                          ? new Date(row.published_at).toLocaleDateString("sv-SE")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
