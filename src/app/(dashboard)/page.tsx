"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart, Package, Users, AlertTriangle,
  DollarSign, BarChart3, Truck, Receipt,
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
  lowStockItems: { id: string; products: { name: string } | null; stock_quantity: number }[];
  outStockItems: { id: string; products: { name: string } | null; stock_quantity: number }[];
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

        const [productsCount, customersCount,
          { data: lowStock }, { data: outStock },
          { data: todaySales }, { data: monthSales },
          { data: monthExpenses }, { data: recentSales },
          { data: dueSales }, { data: pendingPOs },
          { data: last7Sales },
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase.from("product_variants").select("*, products(name)").lt("stock_quantity", 10).gt("stock_quantity", 0).limit(20),
          supabase.from("product_variants").select("*, products(name)").lte("stock_quantity", 0).limit(20),
          supabase.from("sales").select("id, total, subtotal, discount, sale_items(variant_id, quantity, product_variants(cost))").gte("created_at", today),
          supabase.from("sales").select("total").gte("created_at", monthStr),
          supabase.from("expenses").select("amount").gte("created_at", monthStr),
          supabase.from("sales").select("id, invoice_no, total, payment_status, payment_method, created_at, customers(name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("sales").select("id, total").neq("payment_status", "Paid").limit(100),
          supabase.from("purchase_orders").select("id, po_number").eq("status", "Pending").limit(20),
          supabase.from("sales").select("created_at, total").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at"),
        ]);

        // Today COGS
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

        // Last 7 days chart
        const dayMap: Record<string, number> = {};
        last7Sales?.forEach((s: { created_at: string; total: number }) => {
          const day = new Date(s.created_at).toLocaleDateString("en-GB", { weekday: "short" });
          dayMap[day] = (dayMap[day] || 0) + Number(s.total);
        });
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const chartData = days.map((d) => ({ day: d, revenue: dayMap[d] || 0 }));

        setData({
          todayRevenue,
          todayCogs,
          todayProfit: todayRevenue - todayCogs,
          todayDiscount,
          monthRevenue,
          monthExpenses: monthExpTotal,
          monthProfit: monthRevenue - monthExpTotal,
          totalProducts: productsCount?.count || 0,
          totalCustomers: customersCount?.count || 0,
            lowStockItems: (lowStock || []) as unknown as { id: string; products: { name: string } | null; stock_quantity: number }[],
            outStockItems: (outStock || []) as unknown as { id: string; products: { name: string } | null; stock_quantity: number }[],
          dueCount: dueSales?.length || 0,
          dueAmount: totalDue,
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const alerts: { type: "destructive" | "warning"; message: string; link?: string }[] = [];
  if (data && data.lowStockItems.length > 0) alerts.push({ type: "warning", message: `${data.lowStockItems.length} items low on stock`, link: "/inventory" });
  if (data && data.outStockItems.length > 0) alerts.push({ type: "destructive", message: `${data.outStockItems.length} items out of stock`, link: "/inventory" });
  if (data && data.dueCount > 0) alerts.push({ type: "destructive", message: `${data.dueCount} unpaid/due sales (${formatCurrency(data.dueAmount)})`, link: "/sales" });
  if (data && data.pendingPOs.length > 0) alerts.push({ type: "warning", message: `${data.pendingPOs.length} pending purchase orders`, link: "/suppliers" });

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <Link key={idx} href={alert.link || "#"}>
              <Card className={`${alert.type === "destructive" ? "border-destructive/50 bg-destructive/5" : "border-yellow-500/50 bg-yellow-500/5"} cursor-pointer hover:opacity-80`}>
                <CardContent className="py-3 flex items-center gap-3">
                  <AlertTriangle className={`h-5 w-5 ${alert.type === "destructive" ? "text-destructive" : "text-yellow-500"}`} />
                  <p className={`text-sm font-medium ${alert.type === "destructive" ? "text-destructive" : "text-yellow-600"}`}>
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.todayRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Profit: {formatCurrency(data?.todayProfit || 0)}
              {data && data.todayDiscount > 0 && ` · Discount: ${formatCurrency(data.todayDiscount)}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <BarChart3 className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.monthRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Expenses: {formatCurrency(data?.monthExpenses || 0)}
              {data?.monthProfit !== undefined && ` · Net: ${formatCurrency(data.monthProfit)}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">Active products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">Registered customers</p>
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
          <CardHeader>
            <CardTitle className="text-lg">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentSales && data.recentSales.length > 0 ? (
              <div className="space-y-3">
                {data.recentSales.map((sale: { id: string; invoice_no: string; total: number; payment_status: string; payment_method: string; customers: { name: string } | null }) => (
                  <div key={sale.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.invoice_no}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.customers?.name || "Walk-in"} &middot; {sale.payment_method}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{formatCurrency(sale.total)}</span>
                      <Badge
                        variant={sale.payment_status === "Paid" ? "success" : sale.payment_status === "Partial" ? "warning" : "destructive"}
                        className="ml-2 text-xs"
                      >
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
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <ShoppingCart className="h-5 w-5" /> New Sale
              </Button>
            </Link>
            <Link href="/products">
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Package className="h-5 w-5" /> Add Product
              </Button>
            </Link>
            <Link href="/expenses">
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Receipt className="h-5 w-5" /> Add Expense
              </Button>
            </Link>
            <Link href="/suppliers">
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Truck className="h-5 w-5" /> New PO
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
