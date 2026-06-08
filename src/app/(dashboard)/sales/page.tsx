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
import { formatCurrency, formatDateFull, downloadCSV, calculateSaleTotals, validateStockBeforeSale } from "@/lib/utils";
import { getBusinessSettings, getCurrentUserId } from "@/lib/helpers";
import { getPrintStyles } from "@/components/receipt/receipt-view";
import { printReceipt } from "@/components/receipt/receipt-pdf";
import type { Product, Variant, Customer, Sale, SaleItem, CartItem, BusinessSettings } from "@/lib/types";
import {
  Search, Plus, Trash2, Printer, Download, Eye, Barcode, XCircle, ShoppingCart, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

type SaleRow = Omit<Sale, 'sale_items' | 'customers'> & {
  customers: { name: string; customer_type?: string } | null;
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
  const [filterSaleType, setFilterSaleType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");

  // New sale state
  const [showSale, setShowSale] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [orderType, setOrderType] = useState<"Offline" | "Online">("Offline");
  const [saleType, setSaleType] = useState<"retail" | "wholesale">("retail");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [paidAmount, setPaidAmount] = useState("");
  const [redeemPoints, setRedeemPoints] = useState("0");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [notes, setNotes] = useState("");
  const [cashierName, setCashierName] = useState("");

  // Sale details
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Last created sale for print
  const [lastCreatedSale, setLastCreatedSale] = useState<{ sale: SaleRow; items: SaleItem[] } | null>(null);
  const printedRef = useRef<{ sale: SaleRow; items: SaleItem[] } | null>(null);

  const openNewSale = () => {
    resetSaleForm();
    setShowSale(true);
  };

  const barcodeRef = useRef<HTMLInputElement>(null);
  const supabaseRef = useRef(supabase);
  const openNewSaleRef = useRef<() => void>(() => {});
  useEffect(() => { supabaseRef.current = supabase; }, [supabase]);

  const loadData = useCallback(async () => {
    const client = supabaseRef.current;
    const [p, c, s] = await Promise.all([
      client.from("products").select("*, product_variants(*)").order("name"),
      client.from("customers").select("*").order("name"),
      client.from("sales").select("*, customers(name, customer_type), sale_items(id)").order("created_at", { ascending: false }).limit(50),
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

  // Focus barcode input when opening new sale dialog
  useEffect(() => {
    if (showSale) {
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [showSale]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSale) setShowSale(false);
        if (showDetails) setShowDetails(false);
        if (showProductPicker) setShowProductPicker(false);
      }
      if (e.key === "Enter" && !showSale && !showDetails && document.activeElement === document.body) {
        openNewSaleRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSale, showDetails, showProductPicker]);

  // Auto-print after save if lastCreatedSale exists
  useEffect(() => {
    if (lastCreatedSale && printedRef.current !== lastCreatedSale) {
      printReceipt({
        sale: lastCreatedSale.sale as unknown as Sale,
        items: lastCreatedSale.items,
        businessName: settings?.business_name || "Resh Perfumes",
        tagline: settings?.tagline || "",
        footer: settings?.receipt_footer || "",
        cashierName,
      });
      printedRef.current = lastCreatedSale;
    }
  }, [lastCreatedSale, settings?.business_name, settings?.tagline, settings?.receipt_footer, cashierName]);

  const loadFilteredSales = useCallback(async () => {
    setLoading(true);
    let query = supabaseRef.current
      .from("sales")
      .select("*, customers(name, customer_type), sale_items(id)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (searchInvoice) query = query.ilike("invoice_no", `%${searchInvoice}%`);
    if (filterDateFrom) query = query.gte("sale_date", filterDateFrom);
    if (filterDateTo) query = query.lte("sale_date", filterDateTo);
    if (filterCustomer && filterCustomer !== "all") query = query.eq("customer_id", filterCustomer);
    if (filterPaymentMethod && filterPaymentMethod !== "all") query = query.eq("payment_method", filterPaymentMethod);
    if (filterOrderType && filterOrderType !== "all") query = query.eq("order_type", filterOrderType);
    if (filterSaleType && filterSaleType !== "all") query = query.eq("sale_type", filterSaleType);
    if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus);
    if (searchInvoice) query = query.ilike("invoice_no", `%${searchInvoice}%`);

    const { data } = await query;
    if (data) setSales(data);
    setLoading(false);
  }, [searchInvoice, filterDateFrom, filterDateTo, filterCustomer, filterPaymentMethod, filterOrderType, filterSaleType, filterStatus]);

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
      if (saleType === "retail") {
        const existing = prev.find((item) => item.variant.id === variant.id);
        if (existing) {
          return prev.map((item) =>
            item.variant.id === variant.id ? { ...item, qty: item.qty + 1 } : item
          );
        }
        return [...prev, {
          variant,
          productName: product?.name || "",
          qty: 1,
          unitPrice: variant.retail_price ?? variant.price ?? 0,
        }];
      }
      return [...prev, {
        variant,
        productName: product?.name || "",
        qty: 1,
        unitPrice: variant.wholesale_price_per_ml ?? 0,
        wholesaleMl: 0,
        bottleQty: 0,
      }];
    });
  };

  /** Barcode scan: find variant by barcode and add to cart */
  const handleBarcodeSearch = () => {
    const code = barcodeInput.trim();
    if (!code) return;

    for (const product of products) {
      if (!product.product_variants) continue;
      for (const v of product.product_variants) {
        if (v.barcode === code) {
          addToCart(v);
          setBarcodeInput("");
          barcodeRef.current?.focus();
          return;
        }
      }
    }
    toast.error(`No product found with barcode: ${code}`);
    setBarcodeInput("");
    barcodeRef.current?.focus();
  };

  const updateQty = (variantId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.variant.id !== variantId));
      return;
    }
    setCart((prev) => prev.map((item) => item.variant.id === variantId ? { ...item, qty } : item));
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variant.id !== variantId));
  };

  // When customer changes, auto-set sale type
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.customer_type === "wholesale") {
      setSaleType("wholesale");
    } else {
      setSaleType("retail");
    }
  };

  // Calculate cart totals respecting retail vs wholesale pricing
  const calculateCartSubtotal = () => {
    return cart.reduce((sum, item) => {
      if (saleType === "retail") {
        return sum + item.qty * item.unitPrice;
      }
      // Wholesale: unitPrice is price per ml, wholesaleMl is the ml quantity
      const ml = item.wholesaleMl || 0;
      return sum + ml * item.unitPrice;
    }, 0);
  };

  const cartSubtotal = calculateCartSubtotal();
  const totals = calculateSaleTotals(
    cart.map((item) => ({
      ...item,
      unitPrice: saleType === "retail" ? item.unitPrice : (item.wholesaleMl || 0) * item.unitPrice,
      qty: saleType === "retail" ? item.qty : 1,
    })),
    discountType,
    parseFloat(discount) || 0,
    settings?.tax_rate || 0
  );
  // Override totals subtotal with correct calculation
  totals.subtotal = cartSubtotal;

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer);
  const redeemPts = Math.min(
    parseInt(redeemPoints) || 0,
    selectedCustomerData?.loyalty_points || 0
  );
  const redeemValue = redeemPts;
  const finalTotal = Math.max(0, totals.total - redeemValue);

  const handleSaveSale = async () => {
    if (cart.length === 0) { toast.error("Add at least one item"); return; }

    // Validate wholesale ml inputs
    if (saleType === "wholesale") {
      for (const item of cart) {
        const ml = item.wholesaleMl || 0;
        if (ml <= 0) {
          toast.error(`Enter ml quantity for ${item.productName}`);
          return;
        }
      }
    }

    // Validate stock
    const stockCheck = validateStockBeforeSale(
      cart.map((item) => ({
        ...item,
        wholesaleMl: item.wholesaleMl || (saleType === "retail" ? undefined : 0),
      })),
      saleType
    );
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
        sale_type: saleType,
        status: "completed",
        discount_type: discountType,
        paid_amount: paidAmt,
        due_amount: dueAmt,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (se || !sale) { toast.error("Failed to create sale"); setSaving(false); return; }

    // Build sale items data with cost snapshots
    const saleItemsData = cart.map((item) => {
      const unitCost = saleType === "retail"
        ? (item.variant.retail_cost ?? item.variant.cost ?? 0)
        : (item.variant.wholesale_cost_per_ml ?? 0);

      if (saleType === "retail") {
        const lineTotal = item.qty * item.unitPrice;
        const lineCost = item.qty * unitCost;
        return {
          sale_id: sale.id,
          variant_id: item.variant.id,
          quantity: item.qty,
          unit_price: item.unitPrice,
          unit_cost: unitCost,
          line_cost: lineCost,
          line_profit: lineTotal - lineCost,
          subtotal: lineTotal,
          perfume_ml_sold: item.qty * item.variant.size_ml,
          bottle_qty_sold: item.qty,
          product_name_snapshot: item.productName,
          variant_size_ml_snapshot: item.variant.size_ml,
          wholesale_ml_sold: 0,
        };
      }
      const ml = item.wholesaleMl || 0;
      const lineTotal = ml * item.unitPrice;
      const lineCost = ml * unitCost;
      return {
        sale_id: sale.id,
        variant_id: item.variant.id,
        quantity: Math.ceil(ml / item.variant.size_ml) || 1,
        unit_price: item.unitPrice,
        unit_cost: unitCost,
        line_cost: lineCost,
        line_profit: lineTotal - lineCost,
        subtotal: lineTotal,
        perfume_ml_sold: ml,
        bottle_qty_sold: item.bottleQty || 0,
        product_name_snapshot: item.productName,
        variant_size_ml_snapshot: item.variant.size_ml,
        wholesale_ml_sold: ml,
      };
    });

    const { error: sie } = await supabase.from("sale_items").insert(saleItemsData);
    if (sie) { toast.error("Failed to add sale items"); setSaving(false); return; }

    // Deduct stock + record stock movements
    for (const item of cart) {
      if (saleType === "retail") {
        const neededMl = item.qty * item.variant.size_ml;
        const prevMl = item.variant.stock_ml || 0;
        const newMl = Math.max(0, prevMl - neededMl);
        const prevBottle = item.variant.bottle_stock_qty || 0;
        const newBottle = Math.max(0, prevBottle - item.qty);

        await supabase
          .from("product_variants")
          .update({
            stock_ml: newMl,
            stock_quantity: Math.round(newMl),
            bottle_stock_qty: newBottle,
          })
          .eq("id", item.variant.id);

        await supabase.from("stock_movements").insert({
          variant_id: item.variant.id,
          type: "sale",
          quantity_change: -item.qty,
          previous_quantity: Math.round(prevMl),
          new_quantity: Math.round(newMl),
          perfume_ml_change: -neededMl,
          bottle_qty_change: -item.qty,
          previous_perfume_ml: prevMl,
          new_perfume_ml: newMl,
          previous_bottle_qty: prevBottle,
          new_bottle_qty: newBottle,
          reason: `Sale ${sale.invoice_no}`,
          reference_type: "sale",
          reference_id: sale.id,
          created_by: userId,
        });
      } else {
        // Wholesale
        const usedMl = item.wholesaleMl || 0;
        const prevMl = item.variant.stock_ml || 0;
        const newMl = Math.max(0, prevMl - usedMl);
        const usedBottles = item.bottleQty || 0;
        const prevBottle = item.variant.bottle_stock_qty || 0;
        const newBottle = Math.max(0, prevBottle - usedBottles);

        await supabase
          .from("product_variants")
          .update({
            stock_ml: newMl,
            stock_quantity: Math.round(newMl),
            bottle_stock_qty: newBottle,
          })
          .eq("id", item.variant.id);

        await supabase.from("stock_movements").insert({
          variant_id: item.variant.id,
          type: "sale",
          quantity_change: -Math.round(usedMl),
          previous_quantity: Math.round(prevMl),
          new_quantity: Math.round(newMl),
          perfume_ml_change: -usedMl,
          bottle_qty_change: -usedBottles,
          previous_perfume_ml: prevMl,
          new_perfume_ml: newMl,
          previous_bottle_qty: prevBottle,
          new_bottle_qty: newBottle,
          reason: `Sale ${sale.invoice_no} (wholesale ${usedMl}ml)`,
          reference_type: "sale",
          reference_id: sale.id,
          created_by: userId,
        });
      }
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

    // Fetch sale items for printing
    const { data: createdSaleItems } = await supabase
      .from("sale_items")
      .select("*, product_variants(*, products(name))")
      .eq("sale_id", sale.id);
    
    setLastCreatedSale({ sale: sale as unknown as SaleRow, items: createdSaleItems || [] });

    toast.success(`Sale ${sale.invoice_no} recorded! (${formatCurrency(finalTotal)})`);
    setShowSale(false);
    resetSaleForm();
    loadData();
    setSaving(false);
  };

  const resetSaleForm = () => {
    setCart([]);
    setDiscount("0");
    setDiscountType("amount");
    setSelectedCustomer("");
    setSaleType("retail");
    setPaymentMethod("Cash");
    setPaymentStatus("Paid");
    setPaidAmount("");
    setRedeemPoints("0");
    setNotes("");
  };

  /** Cancel a sale: return stock, mark status cancelled */
  const handleCancelSale = async () => {
    if (!selectedSale) return;
    if (!confirm(`Cancel sale ${selectedSale.invoice_no}? Stock will be returned.`)) return;

    setCancelling(true);
    const userId = await getCurrentUserId();

    // Return stock for each item
    for (const item of saleItems) {
      const variant = item.product_variants;
      if (!variant) continue;

      const { data: currentVariant } = await supabase
        .from("product_variants")
        .select("stock_ml, bottle_stock_qty")
        .eq("id", item.variant_id)
        .single();

      if (!currentVariant) continue;

      // For retail sales, return ml and bottles based on variant size
      // We can determine sale type from selectedSale
      const isRetail = selectedSale.sale_type === "retail";
      const returnMl = isRetail ? item.quantity * (variant.size_ml || 0) : (item.wholesale_ml_sold || 0);

      const prevMl = currentVariant.stock_ml || 0;
      const newMl = prevMl + returnMl;
      const prevBottle = currentVariant.bottle_stock_qty || 0;
      const newBottle = isRetail ? prevBottle + item.quantity : prevBottle;

      await supabase
        .from("product_variants")
        .update({
          stock_ml: newMl,
          stock_quantity: Math.round(newMl),
          bottle_stock_qty: newBottle,
        })
        .eq("id", item.variant_id);

      await supabase.from("stock_movements").insert({
        variant_id: item.variant_id,
        type: "cancel_return",
        quantity_change: returnMl,
        previous_quantity: Math.round(prevMl),
        new_quantity: Math.round(newMl),
        perfume_ml_change: returnMl,
        bottle_qty_change: isRetail ? item.quantity : 0,
        previous_perfume_ml: prevMl,
        new_perfume_ml: newMl,
        previous_bottle_qty: prevBottle,
        new_bottle_qty: newBottle,
        reason: `Cancel sale ${selectedSale.invoice_no}`,
        reference_type: "sale",
        reference_id: selectedSale.id,
        created_by: userId,
      });
    }

    // Update sale status
    await supabase
      .from("sales")
      .update({ status: "cancelled" })
      .eq("id", selectedSale.id);

    toast.success(`Sale ${selectedSale.invoice_no} cancelled. Stock returned.`);
    setShowDetails(false);
    setCancelling(false);
    loadData();
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.product_variants?.some((v) =>
      v.sku?.toLowerCase().includes(searchProduct.toLowerCase()) ||
      v.barcode?.toLowerCase().includes(searchProduct.toLowerCase())
    )
  );

  const clearFilters = () => {
    setFilterDateFrom(""); setFilterDateTo(""); setFilterCustomer("");
    setFilterPaymentMethod(""); setFilterOrderType("");
    setFilterSaleType(""); setFilterStatus(""); setSearchInvoice("");
  };

  const handleExportSales = () => {
    const headers = ["Invoice", "Customer", "Sale Type", "Status", "Items", "Total", "Payment Method", "Payment Status", "Date"];
    const rows = sales.map((s) => [
      s.invoice_no, s.customers?.name || "Walk-in", s.sale_type || "retail",
      s.status || "completed", String(s.sale_items?.length || 0),
      String(s.total), s.payment_method, s.payment_status, formatDateFull(s.created_at),
    ]);
    downloadCSV(`sales-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
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
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Record and manage sales transactions.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-1" /> Invoices
            </Button>
          </Link>
          <Button variant="outline" onClick={handleExportSales}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button variant="gold" onClick={openNewSale}>
            <Plus className="h-4 w-4" /> New Sale
          </Button>
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
                <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sale Type</Label>
              <Select value={filterSaleType} onValueChange={setFilterSaleType}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
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
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center"><LoadingSpinner size="sm" /></TableCell></TableRow>
              ) : sales.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No sales yet.</TableCell></TableRow>
              ) : (
                sales.map((sale: SaleRow) => (
                  <TableRow key={sale.id} className="cursor-pointer" onClick={() => loadSaleDetails(sale)}>
                    <TableCell className="font-mono text-xs font-medium">{sale.invoice_no}</TableCell>
                    <TableCell>{sale.customers?.name || "Walk-in"}</TableCell>
                    <TableCell>
                      <Badge variant={sale.sale_type === "wholesale" ? "gold" : "secondary"}>
                        {sale.sale_type || "retail"}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(sale.status || "completed")}</TableCell>
                    <TableCell>{sale.sale_items?.length || "-"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-xs">{sale.payment_method}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateFull(sale.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); loadSaleDetails(sale); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          printReceipt({
                            sale: sale as unknown as Sale,
                            items: [],
                            businessName: settings?.business_name || "Resh Perfumes",
                            tagline: settings?.tagline || "",
                            footer: settings?.receipt_footer || "",
                            cashierName,
                          });
                          loadSaleDetails(sale);
                        }}>
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

      {/* New Sale Dialog */}
      <Dialog open={showSale} onOpenChange={setShowSale}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sale</DialogTitle>
            <DialogDescription>Create a new sales invoice.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Customer + Sale Type + Order */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer (optional)</Label>
                <Select value={selectedCustomer} onValueChange={handleCustomerChange}>
                  <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.customer_type || "retail"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sale Type</Label>
                <Select value={saleType} onValueChange={(v) => setSaleType(v as "retail" | "wholesale")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail (Fixed Bottles)</SelectItem>
                    <SelectItem value="wholesale">Wholesale (Per ML)</SelectItem>
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

            {/* Payment */}
            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
              </div>
            </div>

            {paymentStatus === "Partial" && (
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input type="number" placeholder="Enter amount paid..." value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
            )}

            <Separator />

            {/* Barcode Input */}
            <div className="space-y-2">
              <Label>Scan or enter barcode</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={barcodeRef}
                    className="pl-10"
                    placeholder="Scan barcode or type here..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleBarcodeSearch(); }}
                  />
                </div>
                <Button variant="outline" onClick={handleBarcodeSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Product Search */}
            <div className="space-y-2">
              <Label>Search Products</Label>
              <Input
                placeholder="Search by name, SKU, barcode..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                onFocus={() => setShowProductPicker(true)}
              />
              {showProductPicker && searchProduct && (
                <Card className="max-h-48 overflow-y-auto">
                  <CardContent className="p-2 space-y-1">
                    {filteredProducts.slice(0, 10).map((product) =>
                      product.product_variants?.filter((v) => v.active !== false).map((v) => {
                        const price = saleType === "retail"
                          ? (v.retail_price ?? v.price ?? 0)
                          : (v.wholesale_price_per_ml ?? 0);
                        return (
                          <button
                            key={v.id}
                            className="w-full text-left p-2 rounded hover:bg-muted text-sm flex justify-between"
                            onClick={() => { addToCart(v); setSearchProduct(""); setShowProductPicker(false); }}
                          >
                            <span>{product.name} - {v.size_ml}ml ({v.concentration})</span>
                            <span className="text-gold font-medium">
                              {saleType === "retail" ? formatCurrency(price) : `${formatCurrency(price)}/ml`}
                            </span>
                          </button>
                        );
                      })
                    )}
                    {filteredProducts.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">No products found</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <Label>Cart</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      {saleType === "retail" ? (
                        <TableHead>Qty</TableHead>
                      ) : (
                        <>
                          <TableHead>ML Qty</TableHead>
                          <TableHead>Bottles</TableHead>
                        </>
                      )}
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.variant.id}>
                        <TableCell className="text-sm">{item.productName} - {item.variant.size_ml}ml</TableCell>
                        <TableCell>
                          {saleType === "retail"
                            ? formatCurrency(item.unitPrice)
                            : `${formatCurrency(item.unitPrice)}/ml`
                          }
                        </TableCell>
                        {saleType === "retail" ? (
                          <TableCell>
                            <Input
                              type="number"
                              className="w-16 h-8"
                              min={1}
                              max={Math.min(
                                Math.floor((item.variant.stock_ml || 0) / item.variant.size_ml),
                                item.variant.bottle_stock_qty || 999
                              )}
                              value={item.qty}
                              onChange={(e) => updateQty(item.variant.id, parseInt(e.target.value) || 0)}
                            />
                          </TableCell>
                        ) : (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-20 h-8"
                                min={1}
                                max={item.variant.stock_ml || 0}
                                value={item.wholesaleMl || ""}
                                placeholder="ml"
                                onChange={(e) => {
                                  const ml = parseFloat(e.target.value) || 0;
                                  setCart((prev) => prev.map((ci) =>
                                    ci.variant.id === item.variant.id ? { ...ci, wholesaleMl: ml } : ci
                                  ));
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-16 h-8"
                                min={0}
                                max={item.variant.bottle_stock_qty || 0}
                                value={item.bottleQty || ""}
                                placeholder="bot"
                                onChange={(e) => {
                                  const bq = parseInt(e.target.value) || 0;
                                  setCart((prev) => prev.map((ci) =>
                                    ci.variant.id === item.variant.id ? { ...ci, bottleQty: bq } : ci
                                  ));
                                }}
                              />
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          {saleType === "retail"
                            ? formatCurrency(item.qty * item.unitPrice)
                            : formatCurrency((item.wholesaleMl || 0) * item.unitPrice)
                          }
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.variant.id)}>
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
                    <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount (৳)</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" className="w-24 h-9" min={0} max={discountType === "percent" ? 100 : undefined}
                    value={discount} onChange={(e) => setDiscount(e.target.value)}
                    placeholder={discountType === "percent" ? "%" : "৳"} />
                </div>

                {selectedCustomer && (selectedCustomerData?.loyalty_points || 0) > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Redeem Points (Available: {selectedCustomerData?.loyalty_points || 0})</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" className="w-24 h-9" min={0} max={selectedCustomerData?.loyalty_points || 0}
                        value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} placeholder="Points" />
                      {redeemPts > 0 && <span className="text-xs text-muted-foreground">-{formatCurrency(redeemValue)}</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(totals.subtotal)}</p>
                {totals.discountAmount > 0 && (
                  <p className="text-sm text-destructive">Discount: -{formatCurrency(totals.discountAmount)}{discountType === "percent" && ` (${discount}%)`}</p>
                )}
                {totals.taxAmount > 0 && (
                  <p className="text-sm text-muted-foreground">Tax ({settings?.tax_rate || 0}%): {formatCurrency(totals.taxAmount)}</p>
                )}
                {redeemValue > 0 && <p className="text-sm text-green-600">Loyalty: -{formatCurrency(redeemValue)}</p>}
                <p className="text-lg font-bold text-gold">Total: {formatCurrency(finalTotal)}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="outline" onClick={handleSaveSale} disabled={saving || cart.length === 0}>
              <Printer className="h-4 w-4 mr-1" /> Save & Print
            </Button>
            <Button variant="gold" onClick={handleSaveSale} disabled={saving || cart.length === 0}>
              {saving ? <><ShoppingCart className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : `Record Sale — ${formatCurrency(finalTotal)}`}
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
              <Printer className="h-4 w-4 mr-1" /> Print
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
            {selectedSale?.status === "completed" && (
              <Button variant="destructive" onClick={handleCancelSale} disabled={cancelling}>
                <XCircle className="h-4 w-4 mr-1" /> {cancelling ? "Cancelling..." : "Cancel Sale"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{getPrintStyles()}</style>
    </div>
  );
}
