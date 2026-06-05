"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDateFull, downloadCSV } from "@/lib/utils";
import { getCurrentUserId, can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import type { StockMovement } from "@/lib/types";
import { Search, AlertTriangle, CheckCircle, XCircle, Download, History } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";

type Variant = {
  id: string;
  product_id: string;
  size_ml: number;
  concentration: string;
  price: number;
  cost: number;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  barcode: string | null;
  products: { name: string; category: string | null };
};

export default function InventoryPage() {
  const { profile } = useProfile();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Stock movement history
  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_variants")
        .select("*, products(name, category)")
        .order("stock_quantity", { ascending: true });
      if (data) setVariants(data);
      setLoading(false);
    })();
  }, []);

  const handleAdjust = async () => {
    if (!selectedVariant || !adjustReason) {
      toast.error("Reason is required");
      return;
    }
    const newQty = parseInt(adjustQty);
    if (isNaN(newQty) || newQty < 0) {
      toast.error("Invalid quantity");
      return;
    }

    setSaving(true);
    const userId = await getCurrentUserId();
    const prevQty = selectedVariant.stock_quantity;

    const { error } = await supabase
      .from("product_variants")
      .update({ stock_quantity: newQty })
      .eq("id", selectedVariant.id);

    if (error) { toast.error("Adjustment failed"); setSaving(false); return; }

    // Record stock movement
    const { error: me } = await supabase.from("stock_movements").insert({
      variant_id: selectedVariant.id,
      type: "adjustment",
      quantity_change: newQty - prevQty,
      previous_quantity: prevQty,
      new_quantity: newQty,
      reason: adjustReason,
      reference_type: "adjustment",
      created_by: userId,
    });

    if (me) console.error("Failed to record movement:", me);

    toast.success(`Stock updated to ${newQty}`);
    setShowAdjust(false);
    setSaving(false);
    // Reload inventory
    const { data: reloadData } = await supabase
      .from("product_variants")
      .select("*, products(name, category)")
      .order("stock_quantity", { ascending: true });
    if (reloadData) setVariants(reloadData);
  };

  const openAdjust = (v: Variant) => {
    setSelectedVariant(v);
    setAdjustQty(v.stock_quantity.toString());
    setAdjustReason("");
    setShowAdjust(true);
  };

  const openHistory = async (v: Variant) => {
    setSelectedVariant(v);
    setHistoryLoading(true);
    setShowHistory(true);
    const { data } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("variant_id", v.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setMovements(data);
    setHistoryLoading(false);
  };

  const handleExport = () => {
    const headers = ["Product", "SKU", "Size", "Concentration", "Cost", "Price", "Stock", "Threshold", "Barcode"];
    const rows = filtered.map((v) => [
      v.products?.name || "Unknown", v.sku || "", String(v.size_ml), v.concentration,
      String(v.cost || 0), String(v.price), String(v.stock_quantity), String(v.low_stock_threshold || 10), v.barcode || "",
    ]);
    downloadCSV(`inventory-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  const lowStock = variants.filter((v) => v.stock_quantity < (v.low_stock_threshold || 10));
  const outOfStock = variants.filter((v) => v.stock_quantity <= 0);

  const filtered = variants.filter((v) => {
    const matchesSearch = v.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.sku?.toLowerCase().includes(search.toLowerCase()) ||
      v.barcode?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (stockFilter === "low") return v.stock_quantity < (v.low_stock_threshold || 10) && v.stock_quantity > 0;
    if (stockFilter === "out") return v.stock_quantity <= 0;
    return true;
  });

  const movementTypeBadge = (type: string) => {
    const map: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
      sale: "destructive",
      purchase_receive: "success",
      adjustment: "warning",
      return: "secondary",
      damage: "destructive",
    };
    return <Badge variant={map[type] || "default"}>{type.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track stock levels across all products.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {outOfStock.length > 0 && <span>{outOfStock.length} out of stock</span>}
              {outOfStock.length > 0 && lowStock.length > 0 && <span>&middot;</span>}
              {lowStock.length > 0 && <span>{lowStock.length} low on stock</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap gap-2">
              {lowStock.slice(0, 5).map((v) => (
                <Badge key={v.id} variant="destructive" className="text-xs">
                  {v.products?.name} ({v.stock_quantity} left)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, SKU or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Size / Type</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No inventory items.</TableCell></TableRow>
              ) : (
                filtered.map((v) => {
                  const threshold = v.low_stock_threshold || 10;
                  const isLow = v.stock_quantity < threshold && v.stock_quantity > 0;
                  const isOut = v.stock_quantity <= 0;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.products?.name || "Unknown"}</TableCell>
                      <TableCell className="font-mono text-xs">{v.sku || "-"}</TableCell>
                      <TableCell>{v.size_ml}ml / {v.concentration}</TableCell>
                      <TableCell>{v.cost ? formatCurrency(v.cost) : "-"}</TableCell>
                      <TableCell>{formatCurrency(v.price)}</TableCell>
                      <TableCell className="font-semibold">{v.stock_quantity}</TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Out</Badge>
                        ) : isLow ? (
                          <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" /> Low</Badge>
                        ) : (
                          <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openHistory(v)}>
                            <History className="h-4 w-4" />
                          </Button>
                          {can(profile?.role, "edit") && (
                            <Button variant="ghost" size="sm" onClick={() => openAdjust(v)}>
                              Adjust
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedVariant?.products?.name} - {selectedVariant?.size_ml}ml
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>New Quantity</Label>
              <Input type="number" min={0} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Current: {selectedVariant?.stock_quantity} &middot; Change: {(parseInt(adjustQty) || 0) - (selectedVariant?.stock_quantity || 0)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="E.g. Stock count, damaged, returned" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleAdjust} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Movement History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Movement History</DialogTitle>
            <DialogDescription>
              {selectedVariant?.products?.name} - {selectedVariant?.size_ml}ml ({selectedVariant?.sku})
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No movements recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Previous</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{formatDateFull(m.created_at)}</TableCell>
                    <TableCell>{movementTypeBadge(m.type)}</TableCell>
                    <TableCell className={m.quantity_change < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                      {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                    </TableCell>
                    <TableCell>{m.previous_quantity}</TableCell>
                    <TableCell>{m.new_quantity}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{m.reason || "-"}</TableCell>
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
