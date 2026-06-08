"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateFull, downloadCSV } from "@/lib/utils";
import { getBusinessSettings } from "@/lib/helpers";
import { printReceipt } from "@/components/receipt/receipt-pdf";
import { getPrintStyles } from "@/components/receipt/receipt-view";
import type { Sale, SaleItem, BusinessSettings } from "@/lib/types";
import { Search, Download, Printer, Eye, FileText } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

type InvoiceRow = Pick<Sale, "id" | "invoice_no" | "sale_date" | "subtotal" | "total" | "payment_method" | "payment_status" | "order_type" | "sale_type" | "status" | "paid_amount" | "due_amount" | "discount" | "tax" | "tax_rate" | "created_at" | "notes"> & {
  customers: { name: string; customer_type?: string } | null;
  sale_items: { id: string }[];
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterSaleType, setFilterSaleType] = useState("");
  const [filterOrderType, setFilterOrderType] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  // Details dialog
  const [selectedSale, setSelectedSale] = useState<InvoiceRow | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [cashierName, setCashierName] = useState("");

  const supabaseRef = useRef(supabase);
  useEffect(() => { supabaseRef.current = supabase; }, [supabase]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabaseRef.current
      .from("sales")
      .select("id, invoice_no, sale_date, subtotal, total, payment_method, payment_status, order_type, sale_type, status, paid_amount, due_amount, discount, tax, tax_rate, created_at, notes, customers(name, customer_type), sale_items(id)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (searchInvoice) query = query.ilike("invoice_no", `%${searchInvoice}%`);
    if (filterDateFrom) query = query.gte("sale_date", filterDateFrom);
    if (filterDateTo) query = query.lte("sale_date", filterDateTo);
    if (filterCustomer && filterCustomer !== "all") query = query.eq("customer_id", filterCustomer);
    if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterPaymentMethod && filterPaymentMethod !== "all") query = query.eq("payment_method", filterPaymentMethod);
    if (filterSaleType && filterSaleType !== "all") query = query.eq("sale_type", filterSaleType);
    if (filterOrderType && filterOrderType !== "all") query = query.eq("order_type", filterOrderType);

    const { data } = await query;
    if (data) setInvoices(data as unknown as InvoiceRow[]);
    setLoading(false);
  }, [searchInvoice, filterDateFrom, filterDateTo, filterCustomer, filterStatus, filterPaymentMethod, filterSaleType, filterOrderType]);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabaseRef.current.from("customers").select("id, name").order("name");
    if (data) setCustomers(data);
  }, []);

  const loadSettings = useCallback(async () => {
    const s = await getBusinessSettings();
    if (s) setSettings(s);
  }, []);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabaseRef.current.auth.getUser();
    if (!user) return;
    const { data } = await supabaseRef.current.from("profiles").select("full_name").eq("id", user.id).single();
    if (data?.full_name) setCashierName(data.full_name);
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadInvoices(), loadCustomers(), loadSettings(), loadProfile()]);
    };
    init();
  }, [loadInvoices, loadCustomers, loadSettings, loadProfile]);

  const loadInvoiceDetails = async (inv: InvoiceRow) => {
    setDetailsLoading(true);
    setSelectedSale(inv);
    const { data } = await supabase
      .from("sale_items")
      .select("*, product_variants(*, products(name))")
      .eq("sale_id", inv.id);
    if (data) setSaleItems(data);
    setDetailsLoading(false);
    setShowDetails(true);
  };

  const printInvoice = async (inv: InvoiceRow) => {
    const { data } = await supabase
      .from("sale_items")
      .select("*, product_variants(*, products(name))")
      .eq("sale_id", inv.id);
    if (data) {
      printReceipt({
        sale: inv as unknown as Sale,
        items: data,
        businessName: settings?.business_name || "Resh Perfumes",
        tagline: settings?.tagline || "",
        footer: settings?.receipt_footer || "",
        cashierName,
      });
    } else {
      toast.error("Failed to load invoice items for printing");
    }
  };

  const clearFilters = () => {
    setFilterDateFrom(""); setFilterDateTo(""); setFilterCustomer("");
    setFilterStatus(""); setFilterPaymentMethod(""); setFilterSaleType(""); setFilterOrderType(""); setSearchInvoice("");
  };

  const handleExportCSV = () => {
    const headers = ["Invoice", "Customer", "Type", "Status", "Payment", "Total", "Paid", "Due", "Date"];
    const rows = invoices.map((inv) => [
      inv.invoice_no,
      inv.customers?.name || "Walk-in",
      inv.sale_type || "retail",
      inv.status || "completed",
      inv.payment_method || "Cash",
      String(inv.total),
      String(inv.paid_amount || 0),
      String(inv.due_amount || 0),
      new Date(inv.created_at).toLocaleDateString(),
    ]);
    downloadCSV(`invoices-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("Invoices exported");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="success">Completed</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      case "refunded": return <Badge variant="warning">Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const paymentStatusIcon = (status: string) => {
    switch (status) {
      case "Paid": return <Badge variant="success">{status}</Badge>;
      case "Partial": return <Badge variant="warning">{status}</Badge>;
      case "Due": return <Badge variant="destructive">{status}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Browse, search, and print all sales invoices.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Link href="/sales">
            <Button variant="gold">
              <FileText className="h-4 w-4 mr-1" /> New Sale
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Search Invoice</Label>
              <Input type="text" className="h-9 w-40" placeholder="INV-..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9 w-36" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-36" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="All" /></SelectTrigger>
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
            <Button variant="secondary" size="sm" className="h-9" onClick={loadInvoices}>
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid / Due</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center"><LoadingSpinner size="sm" /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell></TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-medium">{inv.invoice_no}</TableCell>
                    <TableCell>{inv.customers?.name || "Walk-in"}</TableCell>
                    <TableCell>
                      <Badge variant={inv.sale_type === "wholesale" ? "gold" : "secondary"}>
                        {inv.sale_type || "retail"}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(inv.status || "completed")}</TableCell>
                    <TableCell>{inv.sale_items?.length || "-"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(inv.total)}</TableCell>
                    <TableCell>
                      <span className="text-green-600">{formatCurrency(inv.paid_amount || 0)}</span>
                      {(inv.due_amount || 0) > 0 && (
                        <span className="text-destructive ml-1">/ {formatCurrency(inv.due_amount)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{paymentStatusIcon(inv.payment_status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateFull(inv.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => loadInvoiceDetails(inv)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => printInvoice(inv)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice — {selectedSale?.invoice_no}</DialogTitle>
            <DialogDescription>
              {selectedSale?.customers?.name ? `Customer: ${selectedSale.customers.name}` : "Walk-in customer"}
              {" — "}{selectedSale ? formatDateFull(selectedSale.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading details...</div>
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Payment:</span><p className="font-medium">{selectedSale?.payment_method}</p></div>
                <div><span className="text-muted-foreground">Status:</span><p>{selectedSale ? paymentStatusIcon(selectedSale.payment_status) : null}</p></div>
                <div><span className="text-muted-foreground">Sale Type:</span><p><Badge variant={selectedSale?.sale_type === "wholesale" ? "gold" : "secondary"}>{selectedSale?.sale_type || "retail"}</Badge></p></div>
                <div>
                  <span className="text-muted-foreground">Order Status:</span>
                  <p>{selectedSale ? statusBadge(selectedSale.status || "completed") : null}</p>
                </div>
              </div>

              {(selectedSale?.notes) && (
                <p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {selectedSale.notes}</p>
              )}

              <Separator />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleItems.map((item) => (
                    <TableRow key={item.id}>
                       <TableCell className="text-sm">
                         {item.product_variants?.products?.name || item.product_name_snapshot || "Item"} ({item.product_variants?.size_ml ?? item.variant_size_ml_snapshot ?? 0}ml)
                       </TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              <div className="flex justify-end">
                <div className="text-right space-y-1 w-64">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedSale?.subtotal || 0)}</span>
                  </div>
                  {(selectedSale?.discount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Discount</span><span>-{formatCurrency(selectedSale?.discount || 0)}</span>
                    </div>
                  )}
                  {(selectedSale?.tax || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax ({selectedSale?.tax_rate || 0}%)</span><span>{formatCurrency(selectedSale?.tax || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gold text-lg">
                    <span>Total</span><span>{formatCurrency(selectedSale?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Paid</span><span className="text-green-600">{formatCurrency(selectedSale?.paid_amount || 0)}</span>
                  </div>
                  {(selectedSale?.due_amount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Due</span><span>{formatCurrency(selectedSale?.due_amount || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 flex-wrap">
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            <Button variant="outline" onClick={() => {
              if (!selectedSale) return;
              printReceipt({
                sale: selectedSale as unknown as Sale,
                items: saleItems,
                businessName: settings?.business_name || "Resh Perfumes",
                tagline: settings?.tagline || "",
                footer: settings?.receipt_footer || "",
                cashierName,
              });
            }}>
              <Printer className="h-4 w-4 mr-1" /> Print Receipt
            </Button>
            <Button variant="gold" onClick={() => {
              if (!selectedSale) return;
              printReceipt({
                sale: selectedSale as unknown as Sale,
                items: saleItems,
                businessName: settings?.business_name || "Resh Perfumes",
                tagline: settings?.tagline || "",
                footer: settings?.receipt_footer || "",
                cashierName,
              });
            }}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{getPrintStyles()}</style>
    </div>
  );
}
