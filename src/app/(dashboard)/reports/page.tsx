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
import { Download, TrendingUp, TrendingDown } from "lucide-react";
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
  const [productProfitRanking, setProductProfitRanking] = useState<{ name: string; profit: number; margin: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [customerRanking, setCustomerRanking] = useState<{ name: string; total: number; count: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<{ id: string; stock_ml: number; bottle_stock_qty: number; products?: { name: string } | null }[]>([]);
  const [orderBreakdown, setOrderBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [saleTypeBreakdown, setSaleTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [dateRange, setDateRange] = useState("7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterCustomerType, setFilterCustomerType] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSaleType, setFilterSaleType] = useState("");
  const [filterOrderType, setFilterOrderType] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string; customer_type?: string }[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { from, to } = getDateRange();
        const fromStr = from.toISOString();
        const toStr = to.toISOString();

        const { data: custData } = await supabase.from("customers").select("id, name").order("name");
        if (custData) setCustomers(custData);

        let salesQuery = supabase
          .from("sales")
          .select("id, total, subtotal, discount, tax, tax_amount, payment_method, order_type, sale_type, status, created_at, customer_id, customers(name), sale_items(variant_id, quantity, subtotal, unit_price, unit_cost, line_cost, line_profit, perfume_ml_sold, bottle_qty_sold, product_name_snapshot, product_variants(cost, retail_cost, wholesale_cost_per_ml, products(name)))")
          .gte("created_at", fromStr)
          .lte("created_at", toStr)
          .order("created_at");

        if (filterCustomer && filterCustomer !== "all") salesQuery = salesQuery.eq("customer_id", filterCustomer);
        if (filterCustomerType && filterCustomerType !== "all") salesQuery = salesQuery.eq("sale_type", filterCustomerType);
        if (filterPayment && filterPayment !== "all") salesQuery = salesQuery.eq("payment_method", filterPayment);
        if (filterStatus && filterStatus !== "all") salesQuery = salesQuery.eq("status", filterStatus);
        if (filterSaleType && filterSaleType !== "all") salesQuery = salesQuery.eq("sale_type", filterSaleType);
        if (filterOrderType && filterOrderType !== "all") salesQuery = salesQuery.eq("order_type", filterOrderType);

        const { data: sales } = await salesQuery;
        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount")
          .gte("created_at", fromStr)
          .lte("created_at", toStr);

        const { data: lowStock } = await supabase
          .from("product_variants")
          .select("*, products(name)")
          .lt("stock_ml", 100)
          .order("stock_ml", { ascending: true })
          .limit(20);
        if (lowStock) setLowStockItems(lowStock);

        if (!sales || sales.length === 0) {
          setSummary({ revenue: 0, discount: 0, tax: 0, cogs: 0, grossProfit: 0, expensesTotal: 0, netProfit: 0, transactions: 0, avgOrderValue: 0 });
          setSalesData([]); setProductRanking([]); setProductProfitRanking([]);
          setPaymentBreakdown([]); setCustomerRanking([]); setOrderBreakdown([]); setSaleTypeBreakdown([]);
          setLoading(false);
          return;
        }

        let revenue = 0, discount = 0, tax = 0, cogs = 0;
        let allTransactions = 0;
        const dayMap: Record<string, number> = {};
        const payMap: Record<string, number> = {};
        const orderMap: Record<string, number> = {};
        const saleTypeMap: Record<string, number> = {};
        const prodMap: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {};
        const custMap: Record<string, { name: string; total: number; count: number }> = {};

        for (const sale of sales) {
          const s = sale as unknown as {
            total: number; discount: number; tax_amount: number; tax: number; subtotal: number;
            created_at: string; payment_method: string; order_type: string; sale_type: string;
            status: string; customer_id: string | null; customers?: { name: string } | null;
            sale_items?: { variant_id: string; quantity: number; subtotal: number; unit_price: number;
              unit_cost: number; line_cost: number; line_profit: number;
              perfume_ml_sold: number; bottle_qty_sold: number; product_name_snapshot: string;
              product_variants?: { cost: number; retail_cost: number | null; wholesale_cost_per_ml: number | null; products?: { name: string } | null } | null }[]
          };

          allTransactions++;

          // Skip cancelled sales from revenue/profit calculations
          if (s.status === "cancelled") continue;

          revenue += Number(s.total) || 0;
          discount += Number(s.discount) || 0;
          tax += Number(s.tax_amount) || Number(s.tax) || 0;

          const day = new Date(s.created_at).toLocaleDateString("en-GB", { weekday: "short" });
          dayMap[day] = (dayMap[day] || 0) + Number(s.total);

          const pm = s.payment_method || "Unknown";
          payMap[pm] = (payMap[pm] || 0) + Number(s.total);

          const ot = s.order_type || "Offline";
          orderMap[ot] = (orderMap[ot] || 0) + Number(s.total);

          const st = s.sale_type || "retail";
          saleTypeMap[st] = (saleTypeMap[st] || 0) + Number(s.total);

          if (s.customer_id && s.customers?.name) {
            if (!custMap[s.customer_id]) custMap[s.customer_id] = { name: s.customers.name, total: 0, count: 0 };
            custMap[s.customer_id].total += Number(s.total);
            custMap[s.customer_id].count++;
          }

          if (s.sale_items) {
            for (const item of s.sale_items) {
              // Use snapshot cost from sale_items (most accurate), fallback to variant cost
              const itemCost = Number(item.line_cost) || Number(item.unit_cost) * item.quantity ||
                Number(item.product_variants?.retail_cost ?? item.product_variants?.cost ?? 0) * item.quantity;
              cogs += itemCost;

              const pName = item.product_name_snapshot || item.product_variants?.products?.name || "Unknown";
              if (!prodMap[pName]) prodMap[pName] = { name: pName, qty: 0, revenue: 0, cost: 0 };
              prodMap[pName].qty += item.quantity;
              prodMap[pName].revenue += Number(item.subtotal);

              // Use snapshot line_cost if available
              const itemLineCost = Number(item.line_cost) ||
                (Number(item.product_variants?.retail_cost ?? item.product_variants?.cost ?? 0) * item.quantity);
              prodMap[pName].cost += itemLineCost;
            }
          }
        }

        const expensesTotal = expenses?.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0) || 0;
        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - expensesTotal;
        const completedCount = allTransactions - sales.filter((s: { status?: string }) => s.status === "cancelled").length;
        const avgOrderValue = completedCount > 0 ? revenue / completedCount : 0;
        const transactions = completedCount;

        setSummary({ revenue, discount, tax, cogs, grossProfit, expensesTotal, netProfit, transactions, avgOrderValue });
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        setSalesData(days.map((d) => ({ day: d, revenue: dayMap[d] || 0 })));
        setProductRanking(Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
        setProductProfitRanking(
          Object.values(prodMap).map((p) => ({
            name: p.name,
            profit: p.revenue - p.cost,
            margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue * 100) : 0,
          })).sort((a, b) => b.profit - a.profit).slice(0, 10)
        );
        setPaymentBreakdown(Object.entries(payMap).map(([name, value]) => ({ name, value })));
        setCustomerRanking(Object.values(custMap).sort((a, b) => b.total - a.total).slice(0, 10));
        setOrderBreakdown(Object.entries(orderMap).map(([name, value]) => ({ name, value })));
        setSaleTypeBreakdown(Object.entries(saleTypeMap).map(([name, value]) => ({ name, value })));
      } catch (err) {
        console.error("Reports error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getDateRange, filterCustomer, filterCustomerType, filterPayment, filterStatus, filterSaleType, filterOrderType, refreshTrigger, supabase]);

  const handleExport = () => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Revenue", formatCurrency(summary.revenue)],
      ["Discount", formatCurrency(summary.discount)],
      ["Tax Collected", formatCurrency(summary.tax)],
      ["COGS (actual cost)", formatCurrency(summary.cogs)],
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

      {/* Date Range + Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setFilterCustomer(""); setFilterCustomerType(""); setFilterPayment(""); setFilterStatus(""); setFilterSaleType(""); setFilterOrderType(""); }}>Clear</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
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
                <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" className="h-9 w-36" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" className="h-9 w-36" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Customer</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer Type</Label>
              <Select value={filterCustomerType} onValueChange={setFilterCustomerType}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sale Type</Label>
              <Select value={filterSaleType} onValueChange={setFilterSaleType}>
                <SelectTrigger className="h-9 w-28"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Order Type</Label>
              <Select value={filterOrderType} onValueChange={setFilterOrderType}>
                <SelectTrigger className="h-9 w-28"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="bKash">bKash</SelectItem>
                  <SelectItem value="Nagad">Nagad</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-28"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm" className="h-9" onClick={() => setRefreshTrigger(t => t + 1)}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-gold">{formatCurrency(summary.revenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">COGS (actual)</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-muted-foreground">{formatCurrency(summary.cogs)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Gross Profit</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold flex items-center gap-1 ${summary.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {summary.grossProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(summary.grossProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Expenses</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{formatCurrency(summary.expensesTotal)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Net Profit</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold flex items-center gap-1 ${summary.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {summary.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(summary.netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Discount</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatCurrency(summary.discount)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tax Collected</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatCurrency(summary.tax)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{summary.transactions}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Avg Order Value</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatCurrency(summary.avgOrderValue)}</p></CardContent></Card>
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
          <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)`}>
                    {paymentBreakdown.map((_, idx: number) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Type + Sale Type */}
        <Card>
          <CardHeader><CardTitle>Order Type Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)`}>
                    {orderBreakdown.map((_, idx: number) => (<Cell key={idx} fill={COLORS[(idx + 4) % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sale Type Breakdown */}
        <Card>
          <CardHeader><CardTitle>Retail vs Wholesale</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={saleTypeBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)`}>
                    {saleTypeBreakdown.map((_, idx: number) => (<Cell key={idx} fill={idx === 0 ? "#c9a96e" : "#6B2737"} />))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
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
              {lowStockItems.map((v) => (
                <Badge key={v.id} variant="destructive" className="text-xs">
                  {v.products?.name} ({v.stock_ml || 0}ml, {v.bottle_stock_qty || 0} bottles)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Rankings */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Products by Revenue</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>#</TableHead><TableHead>Product</TableHead><TableHead>Units</TableHead><TableHead>Revenue</TableHead></TableRow>
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
          <CardHeader><CardTitle>Top Products by Profit</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>#</TableHead><TableHead>Product</TableHead><TableHead>Profit</TableHead><TableHead>Margin</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {productProfitRanking.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales data.</TableCell></TableRow>
                ) : (
                  productProfitRanking.map((item, idx) => (
                    <TableRow key={item.name}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className={item.profit >= 0 ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>{formatCurrency(item.profit)}</TableCell>
                      <TableCell>
                        <Badge variant={item.margin >= 20 ? "success" : item.margin >= 0 ? "warning" : "destructive"}>
                          {item.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
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
              <TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Orders</TableHead><TableHead>Total Spent</TableHead></TableRow>
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
