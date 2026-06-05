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
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateFull, calculateSaleTotals, validateStockBeforeSale } from "@/lib/utils";
import { getBusinessSettings, getCurrentUserId } from "@/lib/helpers";
import { getPrintStyles } from "@/components/receipt/receipt-view";
import { printReceipt } from "@/components/receipt/receipt-pdf";
import type { Product, Variant, Customer, Sale, SaleItem, CartItem, BusinessSettings } from "@/lib/types";
import { Search, Plus, Trash2, Printer, Download, Eye } from "lucide-react";
import toast from "react-hot-toast";

type SaleRow = Omit<Sale, 'sale_items' | 'customers'> & {
  customers: { name: string } | null;
  sale_items: { id: string }[];
};

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterOrderType, setFilterOrderType] = useState("");

  // New sale state
  const [showSale, setShowSale] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [orderType, setOrderType] = useState<"Offline" | "Online">("Offline");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [paidAmount, setPaidAmount] = useState("");
  const [redeemPoints, setRedeemPoints] = useState("0");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // Sale details
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Cashier name for receipt
  const [cashierName, setCashierName] = useState("");

  const supabaseRef = useRef(supabase);
  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  const loadData = useCallback(async () => {
    const client = supabaseRef.current;
    const [p, c, s] = await Promise.all([
      client.from("products").select("*, product_variants(*)").order("name"),
      client.from("customers").select("id, name, email, phone, barcode_id, loyalty_points, total_spent, created_at, updated_at").order("name"),
      client.from("sales").select("*, customers(name), sale_items(id)").order("created_at", { ascending: false }).limit(50),
    ]);
    if (p.data) setProducts(p.data);
    if (c.data) setCustomers(c.data);
    if (s.data) setSales(s.data);
    setLoading(false);
  }, []);

  const loadSettings = useCallback(async () => {
    const s = await getBusinessSettings();
    if (s) setSettings(s);
  }, []);

  const loadProfile = useCallback(async () => {
    const client = supabaseRef.current;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const { data } = await client.from("profiles").select("full_name").eq("id", user.id).single();
    if (data?.full_name) setCashierName(data.full_name);
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadData();
      await loadSettings();
      await loadProfile();
    };
    init();
  }, [loadData, loadSettings, loadProfile]);

  const loadFilteredSales = useCallback(async () => {
    setLoading(true);
    let query = supabaseRef.current
      .from("sales")
      .select("*, customers(name), sale_items(id)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterDateFrom) query = query.gte("sale_date", filterDateFrom);
    if (filterDateTo) query = query.lte("sale_date", filterDateTo);
    if (filterCustomer) query = query.eq("customer_id", filterCustomer);
    if (filterPaymentMethod) query = query.eq("payment_method", filterPaymentMethod);
    if (filterOrderType) query = query.eq("order_type", filterOrderType);

    const { data } = await query;
    if (data) setSales(data);
    setLoading(false);
  }, [filterDateFrom, filterDateTo, filterCustomer, filterPaymentMethod, filterOrderType]);

  const loadSaleDetails = async (sale: SaleRow) => {
    setDetailsLoading(true);
    setSelectedSale(sale);
    const { data } = await supabase
      .from("sale_items")
      .select("*, product_variants(*, products(name))")
      .eq("sale_id", sale.id);
    if (data) setSaleItems(data);
    setDetailsLoading(false);
    setShowDetails(true);
  };

  const addToCart = (variant: Variant) => {
    const product = products.find((p) => p.id === variant.product_id);
    setCart((prev) => {
      const existing = prev.find((item) => item.variant.id === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.variant.id === variant.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { variant, productName: product?.name || "", qty: 1, unitPrice: variant.price }];
    });
  };

  const updateQty = (variantId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.variant.id !== variantId));
      return;
    }
    setCart((prev) => prev.map((item) => item.variant.id === variantId ? { ...item, qty } : item));
  };

  const totals = calculateSaleTotals(
    cart,
    discountType,
    parseFloat(discount) || 0,
    settings?.tax_rate || 0
  );

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer);
  const redeemPts = Math.min(
    parseInt(redeemPoints) || 0,
    selectedCustomerData?.loyalty_points || 0
  );
  const redeemValue = redeemPts; // 1 point = 1 BDT
  const finalTotal = Math.max(0, totals.total - redeemValue);

  const handleSaveSale = async () => {
    if (cart.length === 0) { toast.error("Add at least one item"); return; }

    // Validate stock
    const stockCheck = validateStockBeforeSale(cart);
    if (!stockCheck.valid) {
      stockCheck.errors.forEach((e) => toast.error(e));
      return;
    }

    setSaving(true);
    const userId = await getCurrentUserId();

    const paidAmt = paymentStatus === "Paid"
      ? finalTotal
      : paymentStatus === "Partial"
        ? Math.min(parseFloat(paidAmount) || 0, finalTotal)
        : 0;
    const dueAmt = Math.max(0, finalTotal - paidAmt);

    const { data: sale, error: se } = await supabase
      .from("sales")
      .insert({
        customer_id: selectedCustomer || null,
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        total: finalTotal,
        tax: totals.taxAmount,
        tax_rate: settings?.tax_rate || 0,
        tax_amount: totals.taxAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_type: orderType,
        discount_type: discountType,
        paid_amount: paidAmt,
        due_amount: dueAmt,
        created_by: userId,
      })
      .select()
      .single();

    if (se || !sale) { toast.error("Failed to create sale"); setSaving(false); return; }

    const saleItemsData = cart.map((item) => ({
      sale_id: sale.id,
      variant_id: item.variant.id,
      quantity: item.qty,
      unit_price: item.unitPrice,
      subtotal: item.qty * item.unitPrice,
    }));

    const { error: sie } = await supabase.from("sale_items").insert(saleItemsData);
    if (sie) { toast.error("Failed to add sale items"); setSaving(false); return; }

    // Deduct stock + record stock movements
    for (const item of cart) {
      const prevQty = item.variant.stock_quantity;
      const newQty = prevQty - item.qty;
      await supabase
        .from("product_variants")
        .update({ stock_quantity: newQty })
        .eq("id", item.variant.id);

      await supabase.from("stock_movements").insert({
        variant_id: item.variant.id,
        type: "sale",
        quantity_change: -item.qty,
        previous_quantity: prevQty,
        new_quantity: newQty,
        reason: `Sale ${sale.invoice_no}`,
        reference_type: "sale",
        reference_id: sale.id,
        created_by: userId,
      });
    }

    // Burn loyalty points if redeemed
    if (redeemPts > 0 && selectedCustomer) {
      await supabase
        .from("customers")
        .update({ loyalty_points: (selectedCustomerData?.loyalty_points || 0) - redeemPts })
        .eq("id", selectedCustomer);

      await supabase.from("loyalty_transactions").insert({
        customer_id: selectedCustomer,
        points: -redeemPts,
        type: "burn",
        reference_type: "sale",
        reference_id: sale.id,
        description: `Points redeemed on sale ${sale.invoice_no}`,
      });
    }

    toast.success(`Sale ${sale.invoice_no} recorded! (${formatCurrency(finalTotal)})`);
    setShowSale(false);
    setCart([]);
    setDiscount("0");
    setDiscountType("amount");
    setSelectedCustomer("");
    setPaymentMethod("Cash");
    setPaymentStatus("Paid");
    setPaidAmount("");
    setRedeemPoints("0");
    loadData();
    setSaving(false);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCustomer("");
    setFilterPaymentMethod("");
    setFilterOrderType("");
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
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Record and manage sales transactions.</p>
        </div>
        <Button variant="gold" onClick={() => setShowSale(true)}>
          <Plus className="h-4 w-4" /> New Sale
        </Button>
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
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9 w-40" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-40" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
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
              <Label className="text-xs">Order Type</Label>
              <Select value={filterOrderType} onValueChange={setFilterOrderType}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm" className="h-9" onClick={loadFilteredSales}>
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : sales.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No sales yet.</TableCell></TableRow>
              ) : (
                sales.map((sale: SaleRow) => (
                  <TableRow key={sale.id} className="cursor-pointer" onClick={() => loadSaleDetails(sale)}>
                    <TableCell className="font-mono text-xs font-medium">{sale.invoice_no}</TableCell>
                    <TableCell>{sale.customers?.name || "Walk-in"}</TableCell>
                    <TableCell><Badge variant={sale.order_type === "Online" ? "default" : "secondary"}>{sale.order_type}</Badge></TableCell>
                    <TableCell>{sale.sale_items?.length || "-"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-xs">{sale.payment_method}</TableCell>
                    <TableCell>{paymentStatusIcon(sale.payment_status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateFull(sale.created_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); loadSaleDetails(sale); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Sale Dialog */}
      <Dialog open={showSale} onOpenChange={setShowSale}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sale</DialogTitle>
            <DialogDescription>Create a new sales invoice.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer (optional)</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.loyalty_points} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Order Type</Label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as "Offline" | "Online")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Offline">Offline (In-Store)</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="bKash">bKash</SelectItem>
                    <SelectItem value="Nagad">Nagad</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid (Full)</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Due">Due (Unpaid)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {paymentStatus === "Partial" && (
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  placeholder="Enter amount paid..."
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Add Items</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search products..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  onFocus={() => setShowProductPicker(true)}
                />
              </div>
              {showProductPicker && searchProduct && (
                <Card className="max-h-48 overflow-y-auto">
                  <CardContent className="p-2 space-y-1">
                    {filteredProducts.slice(0, 10).map((product) =>
                      product.product_variants?.map((v) => (
                        <button
                          key={v.id}
                          className="w-full text-left p-2 rounded hover:bg-muted text-sm flex justify-between"
                          onClick={() => { addToCart(v); setSearchProduct(""); setShowProductPicker(false); }}
                        >
                          <span>{product.name} - {v.size_ml}ml ({v.concentration})</span>
                          <span className="text-gold font-medium">{formatCurrency(v.price)}</span>
                        </button>
                      ))
                    )}
                    {filteredProducts.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">No products found</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {cart.length > 0 && (
              <div className="space-y-2">
                <Label>Cart</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.variant.id}>
                        <TableCell className="text-sm">{item.productName} - {item.variant.size_ml}ml</TableCell>
                        <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-16 h-8"
                            min={1}
                            max={item.variant.stock_quantity}
                            value={item.qty}
                            onChange={(e) => updateQty(item.variant.id, parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(item.qty * item.unitPrice)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => updateQty(item.variant.id, 0)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Separator />

            {/* Discount + Totals */}
            <div className="flex justify-between items-start">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as "amount" | "percent")}>
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount (৳)</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-24 h-9"
                    min={0}
                    max={discountType === "percent" ? 100 : undefined}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder={discountType === "percent" ? "%" : "৳"}
                  />
                </div>

                {/* Loyalty Redeem */}
                {selectedCustomer && (selectedCustomerData?.loyalty_points || 0) > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Redeem Points (Available: {selectedCustomerData?.loyalty_points || 0})
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 h-9"
                        min={0}
                        max={selectedCustomerData?.loyalty_points || 0}
                        value={redeemPoints}
                        onChange={(e) => setRedeemPoints(e.target.value)}
                        placeholder="Points"
                      />
                      {redeemPts > 0 && (
                        <span className="text-xs text-muted-foreground">
                          -{formatCurrency(redeemValue)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">
                  Subtotal: {formatCurrency(totals.subtotal)}
                </p>
                {totals.discountAmount > 0 && (
                  <p className="text-sm text-destructive">
                    Discount: -{formatCurrency(totals.discountAmount)}
                    {discountType === "percent" && ` (${discount}%)`}
                  </p>
                )}
                {totals.taxAmount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Tax ({settings?.tax_rate || 0}%): {formatCurrency(totals.taxAmount)}
                  </p>
                )}
                {redeemValue > 0 && (
                  <p className="text-sm text-green-600">
                    Loyalty: -{formatCurrency(redeemValue)}
                  </p>
                )}
                <p className="text-lg font-bold text-gold">
                  Total: {formatCurrency(finalTotal)}
                </p>
                {selectedCustomer && redeemPts === 0 && (
                  <p className="text-xs text-muted-foreground">
                    +{totals.loyaltyEarn} loyalty points
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSaveSale} disabled={saving || cart.length === 0}>
              {saving ? "Saving..." : `Record Sale — ${formatCurrency(finalTotal)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Details — {selectedSale?.invoice_no}</DialogTitle>
            <DialogDescription>
              {selectedSale?.customers?.name
                ? `Customer: ${selectedSale.customers.name}`
                : "Walk-in customer"}
              {" — "}
              {selectedSale ? formatDateFull(selectedSale.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading details...</div>
          ) : (
            <div className="grid gap-4">
              {/* Sale Info */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Payment:</span>
                  <p className="font-medium">{selectedSale?.payment_method}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p>{selectedSale ? paymentStatusIcon(selectedSale.payment_status) : null}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p><Badge variant={selectedSale?.order_type === "Online" ? "default" : "secondary"}>{selectedSale?.order_type}</Badge></p>
                </div>
              </div>

              <Separator />

              {/* Items Table */}
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
                        {item.product_variants?.products?.name || "Item"} ({item.product_variants?.size_ml}ml)
                      </TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="text-right space-y-1 w-64">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedSale?.subtotal || 0)}</span>
                  </div>
                  {(selectedSale?.discount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedSale?.discount || 0)}</span>
                    </div>
                  )}
                  {(selectedSale?.tax || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax ({selectedSale?.tax_rate || 0}%)</span>
                      <span>{formatCurrency(selectedSale?.tax || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(selectedSale?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Paid</span>
                    <span className="text-green-600">{formatCurrency(selectedSale?.paid_amount || 0)}</span>
                  </div>
                  {(selectedSale?.due_amount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Due</span>
                      <span>{formatCurrency(selectedSale?.due_amount || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedSale) return;
                printReceipt({
                  sale: selectedSale as unknown as Sale,
                  items: saleItems,
                  businessName: settings?.business_name || "Resh POS",
                  tagline: settings?.tagline || "",
                  footer: settings?.receipt_footer || "",
                  cashierName,
                });
              }}
            >
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                if (!selectedSale) return;
                printReceipt({
                  sale: selectedSale as unknown as Sale,
                  items: saleItems,
                  businessName: settings?.business_name || "Resh POS",
                  tagline: settings?.tagline || "",
                  footer: settings?.receipt_footer || "",
                  cashierName,
                });
              }}
            >
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt print styles */}
      <style>{getPrintStyles()}</style>
    </div>
  );
}
