"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

export default function ReportsPage() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [productRanking, setProductRanking] = useState<any[]>([]);
  const [summary, setSummary] = useState({ revenue: 0, cost: 0, profit: 0, transactions: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      // Sales by day (last 7)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: sales } = await supabase
        .from("sales")
        .select("created_at, total")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at");

      // Group by day
      const dayMap: Record<string, number> = {};
      sales?.forEach((s: any) => {
        const day = new Date(s.created_at).toLocaleDateString("en-GB", { weekday: "short" });
        dayMap[day] = (dayMap[day] || 0) + Number(s.total);
      });

      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const chartData = days.map((d) => ({
        day: d,
        revenue: dayMap[d] || 0,
      }));
      setSalesData(chartData);

      // Summary
      const { data: allSales } = await supabase.from("sales").select("total");
      const { data: variants } = await supabase.from("product_variants").select("price, cost, stock_quantity");

      const revenue = allSales?.reduce((s: number, r: any) => s + Number(r.total), 0) || 0;
      const totalCost = variants?.reduce((s: number, v: any) => s + (Number(v.cost) || 0) * v.stock_quantity, 0) || 0;
      const profit = revenue - totalCost;

      setSummary({
        revenue,
        cost: totalCost,
        profit: revenue - totalCost,
        transactions: allSales?.length || 0,
      });

      // Top products
      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("variant_id, quantity, subtotal, product_variants(product_id, products(name))")
        .limit(100);

      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
      saleItems?.forEach((item: any) => {
        const name = item.product_variants?.products?.name || "Unknown";
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
        productMap[name].qty += item.quantity;
        productMap[name].revenue += Number(item.subtotal);
      });

      setProductRanking(
        Object.values(productMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
      );
    } catch (err) {
      console.error("Reports error:", err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ["#c9a96e", "#6B2737", "#2D6A4F", "#1a1a2e", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Analytics and insights for your business.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-gold">{formatCurrency(summary.revenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Cost</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-muted-foreground">{formatCurrency(summary.cost)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Gross Profit</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(summary.profit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.transactions}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 7-Day Sales Chart */}
        <Card>
          <CardHeader><CardTitle>Last 7 Days Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `৳${v}`} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value) || 0), "Revenue"]}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                  />
                  <Bar dataKey="revenue" fill="#c9a96e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Products Pie */}
        <Card>
          <CardHeader><CardTitle>Top Products by Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productRanking.slice(0, 6)}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {productRanking.slice(0, 6).map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Ranking Table */}
      <Card>
        <CardHeader><CardTitle>Product Sales Ranking</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Units Sold</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productRanking.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales data yet.</TableCell></TableRow>
              ) : (
                productRanking.map((item, idx) => (
                  <TableRow key={item.name}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.qty}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(item.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
