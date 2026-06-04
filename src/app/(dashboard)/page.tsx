"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart, Package, Users, TrendingUp, AlertTriangle,
  DollarSign, ArrowUpRight, ArrowDownRight, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type DashboardData = {
  todaySales: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockItems: number;
  recentSales: any[];
  salesByDay: { date: string; total: number }[];
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [
        { count: productsCount },
        { count: customersCount },
        { data: lowStock },
        { data: todaySalesData },
        { data: recentSales },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("product_variants").select("id").lt("stock_quantity", 10),
        supabase.from("sales").select("total").gte("created_at", today).limit(100),
        supabase.from("sales").select("id, invoice_no, total, created_at, order_type, customers(name)").order("created_at", { ascending: false }).limit(5),
      ]);

      const todayTotal = todaySalesData?.reduce((sum: number, s: any) => sum + Number(s.total), 0) || 0;

      setData({
        todaySales: todayTotal,
        totalProducts: productsCount || 0,
        totalCustomers: customersCount || 0,
        lowStockItems: lowStock?.length || 0,
        recentSales: recentSales || [],
        salesByDay: [],
      });
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your perfume business at a glance.</p>
        </div>
        <Link href="/sales">
          <Button variant="gold">+ New Sale</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.todaySales || 0)}</div>
            <p className="text-xs text-muted-foreground">Revenue from today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">Active products in catalog</p>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.lowStockItems || 0) > 0 ? "text-destructive" : ""}`}>
              {data?.lowStockItems || 0}
            </div>
            <p className="text-xs text-muted-foreground">Items below threshold</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentSales && data.recentSales.length > 0 ? (
              <div className="space-y-3">
                {data.recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.invoice_no}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.customers?.name || "Walk-in"} &middot; {sale.order_type}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(sale.total)}</span>
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

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/products" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Package className="h-4 w-4" /> Manage Products
              </Button>
            </Link>
            <Link href="/customers" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Users className="h-4 w-4" /> View Customers
              </Button>
            </Link>
            <Link href="/inventory" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Package className="h-4 w-4" /> Check Inventory
              </Button>
            </Link>
            <Link href="/reports" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <BarChart3 className="h-4 w-4" /> View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


