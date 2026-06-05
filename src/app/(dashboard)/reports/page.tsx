"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, downloadCSV } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

const COLORS = ["#c9a96e", "#6B2737", "#2D6A4F", "#1a1a2e", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];


type Summary = {
  revenue: number;
  discount: number;
  tax: number;
  cogs: number;
  grossProfit: number;
  expensesTotal: number;
  netProfit: number;
  transactions: number;
  avgOrderValue: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary>({
    revenue: 0, discount: 0, tax: 0, cogs: 0, grossProfit: 0,
    expensesTotal: 0, netProfit: 0, transactions: 0, avgOrderValue: 0,
  });
  const [salesData, setSalesData] = useState<{ day: string; revenue: number }[]>([]);
  const [productRanking, setProductRanking] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);

  const [customerRanking, setCustomerRanking] = useState<{ name: string; total: number; count: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<{ id: string; stock_quantity: number; products?: { name: string } | null }[]>([]);
  const [orderBreakdown, setOrderBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [productQtyRanking, setProductQtyRanking] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [dateRange, setDateRange] = useState("7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const supabase = createClient();

  const getDateRange = useCallback(() => {
    const now = new Date();
    let from: Date;

    if (dateRange === "custom" && customFrom) {
      return { from: new Date(customFrom), to: customTo ? new Date(customTo) : now };
    }

    if (dateRange === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "0") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      const days = parseInt(dateRange);
      from = new Date(now);
      from.setDate(from.getDate() - (isNaN(days) ? 7 : days));
    }
    return { from, to: now };
  }, [dateRange, customFrom, customTo]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const fromStr = from.toISOString();
      const toStr = to.toISOString();

      // Sales in range
      const { data: sales } = await supabase
        .from("sales")
        .select("id, total, subtotal, discount, tax, tax_amount, payment_method, order_type, created_at, customer_id, customers(name), sale_items(variant_id, quantity, subtotal, unit_price, product_variants(cost, products(name)))")
        .gte("created_at", fromStr)
        .lte("created_at", toStr)
        .order("created_at");

      // Expenses in range
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", fromStr)
        .lte("created_at", toStr);

      // Low stock
      const { data: lowStock } = await supabase
        .from("product_variants")
        .select("*, products(name)")
        .lt("stock_quantity", 10)
        .order("stock_quantity", { ascending: true })
        .limit(20);

      if (lowStock) setLowStockItems(lowStock);

      if (!sales || sales.length === 0) {
        setSummary({ revenue: 0, discount: 0, tax: 0, cogs: 0, grossProfit: 0, expensesTotal: 0, netProfit: 0, transactions: 0, avgOrderValue: 0 });
        setSalesData([]);
        setProductRanking([]);
        setPaymentBreakdown([]);
        setCustomerRanking([]);
        setOrderBreakdown([]);
        setProductQtyRanking([]);
        setLoading(false);
        return;
      }

      // Calculate metrics
      let revenue = 0, discount = 0, tax = 0, cogs = 0;
      const transactions = sales.length;
      const dayMap: Record<string, number> = {};
      const payMap: Record<string, number> = {};
      const orderMap: Record<string, number> = {};
      const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
      const custMap: Record<string, { name: string; total: number; count: number }> = {};

      for (const sale of sales) {
        const s = sale as unknown as { total: number; discount: number; tax_amount: number; tax: number; subtotal: number; created_at: string; payment_method: string; order_type: string; customer_id: string | null; customers?: { name: string } | null; sale_items?: { variant_id: string; quantity: number; subtotal: number; unit_price: number; product_variants?: { cost: number; products?: { name: string } | null } | null }[] };
        revenue += Number(s.total) || 0;
        discount += Number(s.discount) || 0;
        tax += Number(s.tax_amount) || Number(s.tax) || 0;

        // Day grouping
        const day = new Date(s.created_at).toLocaleDateString("en-GB", { weekday: "short" });
        dayMap[day] = (dayMap[day] || 0) + Number(s.total);

        // Payment method
        const pm = s.payment_method || "Unknown";
        payMap[pm] = (payMap[pm] || 0) + Number(s.total);

        // Order type
        const ot = s.order_type || "Offline";
        orderMap[ot] = (orderMap[ot] || 0) + Number(s.total);

        // Customer
        if (s.customer_id && s.customers?.name) {
          if (!custMap[s.customer_id]) custMap[s.customer_id] = { name: s.customers.name, total: 0, count: 0 };
          custMap[s.customer_id].total += Number(s.total);
          custMap[s.customer_id].count++;
        }

        // Products & COGS
        if (s.sale_items) {
          for (const item of s.sale_items) {
            const itemCost = Number(item.product_variants?.cost) || 0;
            cogs += itemCost * item.quantity;

            const pName = item.product_variants?.products?.name || "Unknown";
            if (!prodMap[pName]) prodMap[pName] = { name: pName, qty: 0, revenue: 0 };
            prodMap[pName].qty += item.quantity;
            prodMap[pName].revenue += Number(item.subtotal);
          }
        }
      }

      const expensesTotal = expenses?.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0) || 0;
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expensesTotal;
      const avgOrderValue = transactions > 0 ? revenue / transactions : 0;

      setSummary({ revenue, discount, tax, cogs, grossProfit, expensesTotal, netProfit, transactions, avgOrderValue });

      // Chart data
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      setSalesData(days.map((d) => ({ day: d, revenue: dayMap[d] || 0 })));

      // Product ranking
      setProductRanking(
        Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
      );

      // Payment breakdown
      setPaymentBreakdown(
        Object.entries(payMap).map(([name, value]) => ({ name, value }))
      );

      // Customer ranking
      setCustomerRanking(
        Object.values(custMap).sort((a, b) => b.total - a.total).slice(0, 10)
      );

      // Order type breakdown
      setOrderBreakdown(
        Object.entries(orderMap).map(([name, value]) => ({ name, value }))
      );

      // Product ranking by quantity
      setProductQtyRanking(
        Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 10)
      );
    } catch (err) {
      console.error("Reports error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, [getDateRange]);

  const handleExport = () => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Revenue", formatCurrency(summary.revenue)],
      ["Discount", formatCurrency(summary.discount)],
      ["Tax Collected", formatCurrency(summary.tax)],
      ["COGS", formatCurrency(summary.cogs)],
      ["Gross Profit", formatCurrency(summary.grossProfit)],
      ["Expenses", formatCurrency(summary.expensesTotal)],
      ["Net Profit", formatCurrency(summary.netProfit)],
      ["Transactions", String(summary.transactions)],
      ["Avg Order Value", formatCurrency(summary.avgOrderValue)],
    ];
    downloadCSV(`report-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
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
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Analytics and insights for your business.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Today</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateRange === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" className="h-9 w-40" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" className="h-9 w-40" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </>
            )}
            <Button variant="secondary" size="sm" className="h-9" onClick={fetchReports}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-gold">{formatCurrency(summary.revenue)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">COGS</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-muted-foreground">{formatCurrency(summary.cogs)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gross Profit</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${summary.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(summary.grossProfit)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Expenses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(summary.expensesTotal)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Net Profit</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${summary.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(summary.netProfit)}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Discount Given</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(summary.discount)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tax Collected</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(summary.tax)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{summary.transactions}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Avg Order Value</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(summary.avgOrderValue)}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart */}
        <Card>
          <CardHeader><CardTitle>Revenue by Day</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `৳${v}`} />
                  <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value) || 0), "Revenue"]}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                  <Bar dataKey="revenue" fill="#c9a96e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card>
          <CardHeader><CardTitle>Payment Method Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)`}>
                    {paymentBreakdown.map((_, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Type Breakdown */}
        <Card>
          <CardHeader><CardTitle>Order Type Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)`}>
                    {orderBreakdown.map((_, idx: number) => (
                      <Cell key={idx} fill={COLORS[(idx + 4) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {orderBreakdown.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-destructive">Low Stock Alert — {lowStockItems.length} items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((v: { id: string; stock_quantity: number; products?: { name: string } | null }) => (
                <Badge key={v.id} variant="destructive" className="text-xs">
                  {v.products?.name} ({v.stock_quantity} left)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Ranking Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Products by Revenue</CardTitle></CardHeader>
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
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales data.</TableCell></TableRow>
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

        <Card>
          <CardHeader><CardTitle>Top Products by Quantity</CardTitle></CardHeader>
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
                {productQtyRanking.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales data.</TableCell></TableRow>
                ) : (
                  productQtyRanking.map((item, idx) => (
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

      {/* Customer Ranking */}
      <Card>
        <CardHeader><CardTitle>Top Customers</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerRanking.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No customer data.</TableCell></TableRow>
              ) : (
                customerRanking.map((item, idx) => (
                  <TableRow key={item.name}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(item.total)}</TableCell>
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
