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
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCurrency, formatDateFull } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/helpers";
import type { Sale, SaleItem, StockMovement } from "@/lib/types";
import { Search, RotateCcw, Undo2, History } from "lucide-react";
import toast from "react-hot-toast";

type ReturnableSale = Pick<Sale, "id" | "invoice_no" | "sale_date" | "total" | "status" | "created_at" | "sale_type" | "subtotal" | "discount" | "discount_type"> & {
  customers: { name: string } | null;
};

interface ReturnableItem extends SaleItem {
  availableToReturn: number;
  returnQty: number;
}

type ReturnHistoryEntry = StockMovement & {
  sales?: { invoice_no: string } | null;
};

export default function StockReturnsPage() {
  const [sales, setSales] = useState<ReturnableSale[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");

  // Return dialog
  const [selectedSale, setSelectedSale] = useState<ReturnableSale | null>(null);
  const [saleItems, setSaleItems] = useState<ReturnableItem[]>([]);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Return history
  const [returnHistory, setReturnHistory] = useState<ReturnHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const supabaseRef = useRef(supabase);
  useEffect(() => { supabaseRef.current = supabase; }, [supabase]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    let query = supabaseRef.current
      .from("sales")
      .select("id, invoice_no, sale_date, total, subtotal, discount, discount_type, status, created_at, customers(name)")
      .in("status", ["completed", "refunded"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (searchInvoice) query = query.ilike("invoice_no", `%${searchInvoice}%`);
    if (filterDateFrom) query = query.gte("sale_date", filterDateFrom);
    if (filterDateTo) query = query.lte("sale_date", filterDateTo);

    const { data } = await query;
    if (data) setSales(data as unknown as ReturnableSale[]);
    setLoading(false);
  }, [searchInvoice, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const init = async () => {
      await loadSales();
    };
    init();
  }, [loadSales]);

  const openReturnDialog = async (sale: ReturnableSale) => {
    setDetailsLoading(true);
    setSelectedSale(sale);
    setReturnReason("");

    const { data: items } = await supabase
      .from("sale_items")
      .select("*, product_variants(*, products(name))")
      .eq("sale_id", sale.id);

    if (items) {
      const returnable: ReturnableItem[] = items.map((item) => ({
        ...item,
        availableToReturn: item.quantity - (item.returned_quantity || 0),
        returnQty: 0,
      }));
      setSaleItems(returnable);
    }

    setDetailsLoading(false);
    setShowReturnDialog(true);
  };

  const handleReturnQtyChange = (itemId: string, qty: number) => {
    setSaleItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const clampedQty = Math.max(0, Math.min(qty, item.availableToReturn));
      return { ...item, returnQty: clampedQty };
    }));
  };

  const getEffectiveUnitPrice = (item: ReturnableItem) => {
    if (!selectedSale?.subtotal || selectedSale.subtotal <= 0) return item.unit_price;
    const ratio = (selectedSale.total || 0) / selectedSale.subtotal;
    return item.unit_price * ratio;
  };

  const processReturn = async () => {
    if (!selectedSale) return;
    const itemsToReturn = saleItems.filter((item) => item.returnQty > 0);
    if (itemsToReturn.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (!returnReason.trim()) {
      toast.error("Enter a reason for the return");
      return;
    }

    setProcessing(true);
    const userId = await getCurrentUserId();

    try {
      for (const item of itemsToReturn) {
        const variant = item.product_variants;
        if (!variant) continue;

        // Fetch current variant stock
        const { data: currentVariant } = await supabase
          .from("product_variants")
          .select("stock_ml, bottle_stock_qty")
          .eq("id", item.variant_id)
          .single();

        if (!currentVariant) continue;

        // Calculate stock to restore
        const isRetail = selectedSale.sale_type === "retail";
        const perfumeMlToRestore = isRetail
          ? item.returnQty * (variant.size_ml || 0)
          : (item.returnQty * (item.wholesale_ml_sold || 0)) / (item.quantity || 1);
        const bottlesToRestore = isRetail ? item.returnQty : 0;

        const prevMl = currentVariant.stock_ml || 0;
        const newMl = prevMl + perfumeMlToRestore;
        const prevBottle = currentVariant.bottle_stock_qty || 0;
        const newBottle = prevBottle + bottlesToRestore;

        // Update variant stock
        await supabase
          .from("product_variants")
          .update({
            stock_ml: newMl,
            stock_quantity: Math.round(newMl),
            bottle_stock_qty: newBottle,
          })
          .eq("id", item.variant_id);

        // Record stock movement
        await supabase.from("stock_movements").insert({
          variant_id: item.variant_id,
          type: "return",
          quantity_change: Math.round(newMl - prevMl),
          previous_quantity: Math.round(prevMl),
          new_quantity: Math.round(newMl),
          perfume_ml_change: perfumeMlToRestore,
          bottle_qty_change: bottlesToRestore,
          previous_perfume_ml: prevMl,
          new_perfume_ml: newMl,
          previous_bottle_qty: prevBottle,
          new_bottle_qty: newBottle,
          reason: `Return from ${selectedSale.invoice_no}: ${returnReason}`,
          reference_type: "return",
          reference_id: selectedSale.id,
          created_by: userId,
        });

        // Update sale_item returned_quantity
        const newReturnedQty = (item.returned_quantity || 0) + item.returnQty;
        await supabase
          .from("sale_items")
          .update({ returned_quantity: newReturnedQty })
          .eq("id", item.id);
      }

      // Check if all items are now fully returned
      const allItems = await supabase
        .from("sale_items")
        .select("quantity, returned_quantity")
        .eq("sale_id", selectedSale.id);

      const allFullyReturned = allItems.data?.every(
        (si) => si.returned_quantity >= si.quantity
      );

      if (allFullyReturned) {
        await supabase
          .from("sales")
          .update({
            status: "refunded",
            return_reason: returnReason,
            last_returned_at: new Date().toISOString(),
          })
          .eq("id", selectedSale.id);
      } else {
        await supabase
          .from("sales")
          .update({
            return_reason: returnReason,
            last_returned_at: new Date().toISOString(),
          })
          .eq("id", selectedSale.id);
      }

      const returnCount = itemsToReturn.reduce((sum, item) => sum + item.returnQty, 0);
      const totalValue = itemsToReturn.reduce((sum, item) => sum + item.returnQty * getEffectiveUnitPrice(item), 0);
      toast.success(`Return processed: ${returnCount} item(s) worth ${formatCurrency(totalValue)} from ${selectedSale.invoice_no}`);

      setShowReturnDialog(false);
      loadSales();
    } catch (err) {
      console.error("Return error:", err);
      toast.error("Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  const loadReturnHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data } = await supabaseRef.current
      .from("stock_movements")
      .select("*, sales!reference_id(invoice_no)")
      .eq("type", "return")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setReturnHistory(data as unknown as ReturnHistoryEntry[]);
    setHistoryLoading(false);
  }, []);

  const openHistory = () => {
    loadReturnHistory();
    setShowHistory(true);
  };

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchInvoice("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Returns</h1>
          <p className="text-sm text-muted-foreground">Process returns from completed sales and restore stock.</p>
        </div>
        <Button variant="outline" onClick={openHistory}>
          <History className="h-4 w-4 mr-1" /> Return History
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Find Sale</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Search Invoice</Label>
              <Input type="text" className="h-9 w-44" placeholder="INV-..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9 w-36" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-36" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" className="h-9" onClick={loadSales}>
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Completed Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center"><LoadingSpinner size="sm" /></TableCell></TableRow>
              ) : sales.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No completed sales found.</TableCell></TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs font-medium">{sale.invoice_no}</TableCell>
                    <TableCell>{sale.customers?.name || "Walk-in"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sale.total)}</TableCell>
                    <TableCell>
                      {sale.status === "refunded" ? (
                        <Badge variant="warning">Refunded</Badge>
                      ) : (
                        <Badge variant="success">Completed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateFull(sale.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReturnDialog(sale)}
                        disabled={sale.status === "refunded"}
                      >
                        <Undo2 className="h-4 w-4 mr-1" /> Return
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Return — {selectedSale?.invoice_no}</DialogTitle>
            <DialogDescription>Select items to return and restore to stock.</DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading sale items...</div>
          ) : (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Return Reason *</Label>
                <Input
                  placeholder="e.g. Customer returned, Damaged bottle, Wrong size..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Sold Qty</TableHead>
                    <TableHead>Already Returned</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Return Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleItems.map((item) => (
                    <TableRow key={item.id} className={item.availableToReturn <= 0 ? "opacity-50" : ""}>
                      <TableCell className="text-sm">
                        {item.product_variants?.products?.name || item.product_name_snapshot || "Item"}
                        {" "}({item.product_variants?.size_ml || item.variant_size_ml_snapshot}ml)
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.returned_quantity || 0}</TableCell>
                      <TableCell>
                        <Badge variant={item.availableToReturn > 0 ? "secondary" : "outline"}>
                          {item.availableToReturn}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20 h-8"
                          min={0}
                          max={item.availableToReturn}
                          value={item.returnQty || ""}
                          disabled={item.availableToReturn <= 0}
                          placeholder="0"
                          onChange={(e) => handleReturnQtyChange(item.id, parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.returnQty > 0 ? formatCurrency(item.returnQty * getEffectiveUnitPrice(item)) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Items selected: {saleItems.filter((i) => i.returnQty > 0).length}
                  </p>
                  <p className="text-lg font-bold text-gold">
                    Return value: {formatCurrency(
                      saleItems.reduce((sum, i) => sum + i.returnQty * getEffectiveUnitPrice(i), 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={processing}>Cancel</Button></DialogClose>
            <Button
              variant="gold"
              onClick={processReturn}
              disabled={processing || saleItems.filter((i) => i.returnQty > 0).length === 0 || !returnReason.trim()}
            >
              {processing ? (
                <><RotateCcw className="h-4 w-4 mr-1 animate-spin" /> Processing...</>
              ) : (
                <><Undo2 className="h-4 w-4 mr-1" /> Process Return</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return History</DialogTitle>
            <DialogDescription>All stock return transactions recorded.</DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading history...</div>
          ) : returnHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No returns recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Ml Restored</TableHead>
                  <TableHead>Bottles Restored</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateFull(entry.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {entry.sales?.invoice_no || "N/A"}
                    </TableCell>
                    <TableCell>{(entry.perfume_ml_change || 0) > 0 ? `+${entry.perfume_ml_change}ml` : "-"}</TableCell>
                    <TableCell>{(entry.bottle_qty_change || 0) > 0 ? `+${entry.bottle_qty_change}` : "-"}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{entry.reason || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
