"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart, Package, Users, AlertTriangle, DollarSign,
  BarChart3, Truck, Receipt, TrendingUp, TrendingDown, FlaskConical, BottleWine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface RecentSale {
  id: string;
  invoice_no: string;
  total: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  customers: { name: string } | null;
}

interface DashboardData {
  todayRevenue: number;
  todayCogs: number;
  todayProfit: number;
  todayDiscount: number;
  monthRevenue: number;
  monthExpenses: number;
  monthProfit: number;
  totalProducts: number;
  totalCustomers: number;
  perfumeLowCount: number;
  perfumeOutCount: number;
  bottleLowCount: number;
  bottleOutCount: number;
  dueCount: number;
  dueAmount: number;
  recentSales: RecentSale[];
  pendingPOs: { id: string; po_number: string }[];
  chartData: { day: string; revenue: number }[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStr = monthStart.toISOString();

        const [
          productsCount, customersCount,
          { data: lowPerfume }, { data: outPerfume },
          { data: lowBottle }, { data: outBottle },
          { data: todaySales }, { data: monthSales },
          { data: monthExpenses }, { data: recentSales },
          { data: dueSales }, { data: pendingPOs },
          { data: last7Sales },
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase.from("product_variants").select("id, products(name)").lt("stock_ml", 100).gt("stock_ml", 0).limit(100),
          supabase.from("product_variants").select("id, products(name)").lte("stock_ml", 0).limit(100),
          supabase.from("product_variants").select("id, products(name)").lt("bottle_stock_qty", 10).gt("bottle_stock_qty", 0).limit(100),
          supabase.from("product_variants").select("id, products(name)").lte("bottle_stock_qty", 0).limit(100),
          supabase.from("sales").select("id, total, subtotal, discount, sale_items(variant_id, quantity, product_variants(cost))").gte("created_at", today),
          supabase.from("sales").select("total").gte("created_at", monthStr),
          supabase.from("expenses").select("amount").gte("created_at", monthStr),
          supabase.from("sales").select("id, invoice_no, total, payment_status, payment_method, created_at, customers(name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("sales").select("id, total").neq("payment_status", "Paid").limit(100),
          supabase.from("purchase_orders").select("id, po_number").eq("status", "Pending").limit(20),
          supabase.from("sales").select("created_at, total").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at"),
        ]);

        let todayCogs = 0;
        let todayDiscount = 0;
        let todayRevenue = 0;
        if (todaySales) {
          for (const sale of todaySales) {
            const s = sale as unknown as { total: number; discount: number; sale_items?: { quantity: number; product_variants?: { cost: number } | null }[] };
            todayRevenue += Number(s.total) || 0;
            todayDiscount += Number(s.discount) || 0;
            if (s.sale_items) {
              for (const item of s.sale_items) {
                todayCogs += (Number(item.product_variants?.cost) || 0) * item.quantity;
              }
            }
          }
        }

        const monthRevenue = monthSales?.reduce((s: number, r: { total: number }) => s + Number(r.total), 0) || 0;
        const monthExpTotal = monthExpenses?.reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0) || 0;
        const totalDue = dueSales?.reduce((s: number, d: { total: number }) => s + Number(d.total), 0) || 0;

        const dayMap: Record<string, number> = {};
        last7Sales?.forEach((s: { created_at: string; total: number }) => {
          const day = new Date(s.created_at).toLocaleDateString("en-GB", { weekday: "short" });
          dayMap[day] = (dayMap[day] || 0) + Number(s.total);
        });
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const chartData = days.map((d) => ({ day: d, revenue: dayMap[d] || 0 }));

        setData({
          todayRevenue, todayCogs, todayProfit: todayRevenue - todayCogs, todayDiscount,
          monthRevenue, monthExpenses: monthExpTotal, monthProfit: monthRevenue - monthExpTotal,
          totalProducts: productsCount?.count || 0, totalCustomers: customersCount?.count || 0,
          perfumeLowCount: lowPerfume?.length || 0, perfumeOutCount: outPerfume?.length || 0,
          bottleLowCount: lowBottle?.length || 0, bottleOutCount: outBottle?.length || 0,
          dueCount: dueSales?.length || 0, dueAmount: totalDue,
          recentSales: (recentSales || []) as unknown as RecentSale[],
          pendingPOs: pendingPOs || [],
          chartData,
        });
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const alerts: { type: "destructive" | "warning"; message: string; link?: string }[] = [];
  if (data && data.perfumeOutCount > 0) alerts.push({ type: "destructive", message: `${data.perfumeOutCount} variants out of perfume stock`, link: "/inventory" });
  if (data && data.perfumeLowCount > 0) alerts.push({ type: "warning", message: `${data.perfumeLowCount} variants low on perfume`, link: "/inventory" });
  if (data && data.bottleOutCount > 0) alerts.push({ type: "destructive", message: `${data.bottleOutCount} variants out of bottles`, link: "/inventory" });
  if (data && data.bottleLowCount > 0) alerts.push({ type: "warning", message: `${data.bottleLowCount} variants low on bottles`, link: "/inventory" });
  if (data && data.dueCount > 0) alerts.push({ type: "destructive", message: `${data.dueCount} unpaid/due sales (${formatCurrency(data.dueAmount)})`, link: "/sales" });
  if (data && data.pendingPOs.length > 0) alerts.push({ type: "warning", message: `${data.pendingPOs.length} pending purchase orders`, link: "/suppliers" });

  const isProfit = (data?.todayProfit || 0) >= 0;
  const isMonthProfit = (data?.monthProfit || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, idx) => (
            <Link key={idx} href={alert.link || "#"}>
              <Card className={`${alert.type === "destructive" ? "border-red-500/50 bg-red-500/5" : "border-yellow-500/50 bg-yellow-500/5"} cursor-pointer hover:opacity-80`}>
                <CardContent className="py-3 flex items-center gap-3">
                  <AlertTriangle className={`h-5 w-5 ${alert.type === "destructive" ? "text-red-500" : "text-yellow-500"}`} />
                  <p className={`text-sm font-medium ${alert.type === "destructive" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                    {alert.message}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your perfume business at a glance.</p>
        </div>
        <Link href="/sales">
          <Button variant="gold">+ New Sale</Button>
        </Link>
      </div>

      {/* KPI Cards - Distinct colors, larger icons */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-gold">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Sales</CardTitle>
            <div className="p-2 rounded-lg bg-gold/10"><DollarSign className="h-5 w-5 text-gold" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.todayRevenue || 0)}</div>
            <p className={`text-xs flex items-center gap-1 mt-1 ${isProfit ? "text-green-600" : "text-destructive"}`}>
              {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              Profit: {formatCurrency(data?.todayProfit || 0)}
              {(data?.todayDiscount || 0) > 0 && <span className="text-muted-foreground">· Disc: {formatCurrency(data?.todayDiscount || 0)}</span>}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Month Revenue</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10"><BarChart3 className="h-5 w-5 text-blue-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.monthRevenue || 0)}</div>
            <p className={`text-xs flex items-center gap-1 mt-1 ${isMonthProfit ? "text-green-600" : "text-destructive"}`}>
              Expenses: {formatCurrency(data?.monthExpenses || 0)}
              <span className="text-muted-foreground">· Net: {formatCurrency(data?.monthProfit || 0)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products / Customers</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10"><Package className="h-5 w-5 text-purple-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Users className="h-3 w-3 inline mr-1" />{data?.totalCustomers || 0} customers
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? (data.perfumeLowCount + data.perfumeOutCount + data.bottleLowCount + data.bottleOutCount) : 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <FlaskConical className="h-3 w-3 inline mr-1" />
              Perfume: {data?.perfumeOutCount || 0} out / {data?.perfumeLowCount || 0} low
              <span className="mx-1">·</span>
              <BottleWine className="h-3 w-3 inline mr-1" />
              Bottles: {data?.bottleOutCount || 0} out / {data?.bottleLowCount || 0} low
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 7-Day Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Last 7 Days Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `৳${v}`} />
                  <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value) || 0), "Revenue"] as [string, string]}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                  <Bar dataKey="revenue" fill="#c9a96e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Sales</CardTitle></CardHeader>
          <CardContent>
            {data?.recentSales && data.recentSales.length > 0 ? (
              <div className="space-y-3">
                {data.recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.invoice_no}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.customers?.name || "Walk-in"} · {sale.payment_method}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(sale.total)}</span>
                      <Badge variant={sale.payment_status === "Paid" ? "success" : sale.payment_status === "Partial" ? "warning" : "destructive"} className="text-xs">
                        {sale.payment_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No sales yet. Start by adding products and recording a sale.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/sales">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-l-4 border-l-gold">
                <ShoppingCart className="h-5 w-5 text-gold" /> New Sale
              </Button>
            </Link>
            <Link href="/products">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-l-4 border-l-purple-500">
                <Package className="h-5 w-5 text-purple-500" /> Add Product
              </Button>
            </Link>
            <Link href="/expenses">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-l-4 border-l-red-500">
                <Receipt className="h-5 w-5 text-red-500" /> Add Expense
              </Button>
            </Link>
            <Link href="/suppliers">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-l-4 border-l-blue-500">
                <Truck className="h-5 w-5 text-blue-500" /> New PO
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
