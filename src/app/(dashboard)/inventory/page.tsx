"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDateFull, downloadCSV } from "@/lib/utils";
import { getCurrentUserId, can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import type { StockMovement } from "@/lib/types";
import { getPerfumeStockRisk, getBottleStockRisk } from "@/lib/types";
import { Search, AlertTriangle, CheckCircle, XCircle, Download, History, FlaskConical, BottleWine } from "lucide-react";
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
  stock_ml: number;
  low_stock_ml_threshold: number;
  bottle_stock_qty: number;
  low_bottle_threshold: number;
  retail_price: number | null;
  wholesale_price_per_ml: number | null;
  active: boolean;
  products: { name: string; category: string | null };
};

export default function InventoryPage() {
  const { profile } = useProfile();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [concentrationFilter, setConcentrationFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [adjustMl, setAdjustMl] = useState("0");
  const [adjustBottles, setAdjustBottles] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadVariants = useCallback(async () => {
    return await supabase
      .from("product_variants")
      .select("*, products(name, category)")
      .order("stock_ml", { ascending: true });
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await loadVariants();
      if (data) setVariants(data);
      setLoading(false);
    })();
  }, [loadVariants]);

  const fetchData = async () => {
    const { data } = await loadVariants();
    if (data) setVariants(data);
    setLoading(false);
  };

  const handleAdjust = async () => {
    if (!selectedVariant || !adjustReason) {
      toast.error("Reason is required");
      return;
    }
    const newMl = parseFloat(adjustMl);
    const newBottles = parseInt(adjustBottles);
    if (isNaN(newMl) || newMl < 0 || isNaN(newBottles) || newBottles < 0) {
      toast.error("Invalid quantities");
      return;
    }

    setSaving(true);
    const userId = await getCurrentUserId();
    const prevMl = selectedVariant.stock_ml || 0;
    const prevBottles = selectedVariant.bottle_stock_qty || 0;

    const { error } = await supabase
      .from("product_variants")
      .update({
        stock_ml: newMl,
        stock_quantity: Math.round(newMl),
        bottle_stock_qty: newBottles,
      })
      .eq("id", selectedVariant.id);

    if (error) { toast.error("Adjustment failed"); setSaving(false); return; }

    await supabase.from("stock_movements").insert({
      variant_id: selectedVariant.id,
      type: "adjustment",
      quantity_change: Math.round(newMl - prevMl),
      previous_quantity: Math.round(prevMl),
      new_quantity: Math.round(newMl),
      perfume_ml_change: newMl - prevMl,
      bottle_qty_change: newBottles - prevBottles,
      previous_perfume_ml: prevMl,
      new_perfume_ml: newMl,
      previous_bottle_qty: prevBottles,
      new_bottle_qty: newBottles,
      reason: adjustReason,
      reference_type: "adjustment",
      created_by: userId,
    });

    toast.success(`Stock updated: ${newMl}ml, ${newBottles} bottles`);
    setShowAdjust(false);
    setSaving(false);
    fetchData();
  };

  const openAdjust = (v: Variant) => {
    setSelectedVariant(v);
    setAdjustMl(String(v.stock_ml || 0));
    setAdjustBottles(String(v.bottle_stock_qty || 0));
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
    const headers = ["Product", "SKU", "Size", "Perfume ML", "Bottle Qty", "Cost", "Retail Price", "WS Price/ml", "Perfume Threshold", "Bottle Threshold", "Barcode"];
    const rows = filtered.map((v) => [
      v.products?.name || "Unknown", v.sku || "", String(v.size_ml),
      String(v.stock_ml || 0), String(v.bottle_stock_qty || 0),
      String(v.cost || 0), String(v.retail_price ?? v.price ?? 0),
      String(v.wholesale_price_per_ml ?? ""),
      String(v.low_stock_ml_threshold || 100), String(v.low_bottle_threshold || 10), v.barcode || "",
    ]);
    downloadCSV(`inventory-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  // Derived unique values for dropdowns
  const categories = [...new Set(variants.map(v => v.products?.category).filter(Boolean))] as string[];
  const sizes = [...new Set(variants.map(v => v.size_ml))].sort((a, b) => a - b);
  const concentrations = [...new Set(variants.map(v => v.concentration))].sort();

  // Compute risk counts
  const lowPerfumeCount = variants.filter((v) => {
    const risk = getPerfumeStockRisk(v.stock_ml || 0, v.low_stock_ml_threshold || 100);
    return risk === "low";
  }).length;
  const outPerfumeCount = variants.filter((v) => {
    const risk = getPerfumeStockRisk(v.stock_ml || 0, v.low_stock_ml_threshold || 100);
    return risk === "out";
  }).length;
  const lowBottleCount = variants.filter((v) => {
    const risk = getBottleStockRisk(v.bottle_stock_qty || 0, v.low_bottle_threshold || 10);
    return risk === "low";
  }).length;
  const outBottleCount = variants.filter((v) => {
    const risk = getBottleStockRisk(v.bottle_stock_qty || 0, v.low_bottle_threshold || 10);
    return risk === "out";
  }).length;

  const filtered = variants.filter((v) => {
    const matchesSearch = !search ||
      v.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.sku?.toLowerCase().includes(search.toLowerCase()) ||
      v.barcode?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (categoryFilter !== "all" && v.products?.category !== categoryFilter) return false;
    if (sizeFilter !== "all" && v.size_ml !== parseFloat(sizeFilter)) return false;
    if (concentrationFilter !== "all" && v.concentration !== concentrationFilter) return false;
    if (activeFilter === "active" && !v.active) return false;
    if (activeFilter === "inactive" && v.active) return false;

    const perfumeRisk = getPerfumeStockRisk(v.stock_ml || 0, v.low_stock_ml_threshold || 100);
    const bottleRisk = getBottleStockRisk(v.bottle_stock_qty || 0, v.low_bottle_threshold || 10);

    if (stockFilter === "safe") return perfumeRisk === "safe" && bottleRisk === "safe";
    if (stockFilter === "low_perfume") return perfumeRisk === "low";
    if (stockFilter === "out_perfume") return perfumeRisk === "out";
    if (stockFilter === "low_bottle") return bottleRisk === "low";
    if (stockFilter === "out_bottle") return bottleRisk === "out";
    return true;
  });

  const perfumeRiskBadge = (risk: "safe" | "low" | "out") => {
    switch (risk) {
      case "safe": return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Safe</Badge>;
      case "low": return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" /> Low</Badge>;
      case "out": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Out</Badge>;
    }
  };

  const bottleRiskBadge = (risk: "safe" | "low" | "out") => {
    switch (risk) {
      case "safe": return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> OK</Badge>;
      case "low": return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" /> Low</Badge>;
      case "out": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Out</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track perfume (ml) and bottle stock levels.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Alert cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className={outPerfumeCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><FlaskConical className="h-3 w-3" /> Out of Perfume</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className={`text-2xl font-bold ${outPerfumeCount > 0 ? "text-destructive" : ""}`}>{outPerfumeCount}</p></CardContent>
        </Card>
        <Card className={lowPerfumeCount > 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><FlaskConical className="h-3 w-3" /> Low Perfume</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className={`text-2xl font-bold ${lowPerfumeCount > 0 ? "text-yellow-500" : ""}`}>{lowPerfumeCount}</p></CardContent>
        </Card>
        <Card className={outBottleCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><BottleWine className="h-3 w-3" /> Out of Bottles</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className={`text-2xl font-bold ${outBottleCount > 0 ? "text-destructive" : ""}`}>{outBottleCount}</p></CardContent>
        </Card>
        <Card className={lowBottleCount > 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><BottleWine className="h-3 w-3" /> Low Bottles</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className={`text-2xl font-bold ${lowBottleCount > 0 ? "text-yellow-500" : ""}`}>{lowBottleCount}</p></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, SKU or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="safe">Safe</SelectItem>
            <SelectItem value="low_perfume">Low Perfume</SelectItem>
            <SelectItem value="out_perfume">Out of Perfume</SelectItem>
            <SelectItem value="low_bottle">Low Bottles</SelectItem>
            <SelectItem value="out_bottle">Out of Bottles</SelectItem>
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {sizes.length > 0 && (
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-24 h-9"><SelectValue placeholder="Size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sizes</SelectItem>
              {sizes.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}ml</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {concentrations.length > 0 && (
          <Select value={concentrationFilter} onValueChange={setConcentrationFilter}>
            <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {concentrations.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
                <TableHead>Size</TableHead>
                <TableHead>Perfume (ml)</TableHead>
                <TableHead>Bottles</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Retail</TableHead>
                <TableHead>WS/ml</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center"><LoadingSpinner size="sm" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No inventory items.</TableCell></TableRow>
              ) : (
                filtered.map((v) => {
                  const perfumeRisk = getPerfumeStockRisk(v.stock_ml || 0, v.low_stock_ml_threshold || 100);
                  const bottleRisk = getBottleStockRisk(v.bottle_stock_qty || 0, v.low_bottle_threshold || 10);
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.products?.name || "Unknown"}</TableCell>
                      <TableCell className="font-mono text-xs">{v.sku || "-"}</TableCell>
                      <TableCell>{v.size_ml}ml / {v.concentration}</TableCell>
                      <TableCell>
                        <span className={perfumeRisk === "out" ? "text-destructive font-semibold" : perfumeRisk === "low" ? "text-yellow-500 font-semibold" : ""}>
                          {v.stock_ml || 0} ml
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">/ thresh: {v.low_stock_ml_threshold || 100}</span>
                      </TableCell>
                      <TableCell>
                        <span className={bottleRisk === "out" ? "text-destructive font-semibold" : bottleRisk === "low" ? "text-yellow-500 font-semibold" : ""}>
                          {v.bottle_stock_qty || 0}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">/ thresh: {v.low_bottle_threshold || 10}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs">Perfume: {perfumeRiskBadge(perfumeRisk)}</span>
                          <span className="text-xs">Bottles: {bottleRiskBadge(bottleRisk)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{v.retail_price ? formatCurrency(v.retail_price) : (v.price ? formatCurrency(v.price) : "-")}</TableCell>
                      <TableCell className="text-xs">{v.wholesale_price_per_ml ? formatCurrency(v.wholesale_price_per_ml) : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openHistory(v)} title="Stock History">
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
            <DialogDescription>{selectedVariant?.products?.name} - {selectedVariant?.size_ml}ml</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Perfume Stock (ml) *</Label>
                <Input type="number" min={0} value={adjustMl} onChange={(e) => setAdjustMl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Current: {selectedVariant?.stock_ml || 0}ml</p>
              </div>
              <div className="space-y-2">
                <Label>Bottle Stock (qty)</Label>
                <Input type="number" min={0} value={adjustBottles} onChange={(e) => setAdjustBottles(e.target.value)} />
                <p className="text-xs text-muted-foreground">Current: {selectedVariant?.bottle_stock_qty || 0}</p>
              </div>
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
            <DialogDescription>{selectedVariant?.products?.name} - {selectedVariant?.size_ml}ml ({selectedVariant?.sku})</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="text-center"><LoadingSpinner size="sm" /></div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No movements recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ML Change</TableHead>
                  <TableHead>Bottle Change</TableHead>
                  <TableHead>Prev ML</TableHead>
                  <TableHead>New ML</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{formatDateFull(m.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        m.type === "sale" || m.type === "cancel_return" ? "destructive" :
                        m.type === "purchase_receive" ? "success" :
                        m.type === "adjustment" ? "warning" : "secondary"
                      }>
                        {m.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className={m.perfume_ml_change < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                      {m.perfume_ml_change > 0 ? "+" : ""}{m.perfume_ml_change}ml
                    </TableCell>
                    <TableCell>
                      {m.bottle_qty_change !== 0 ? (
                        <span className={m.bottle_qty_change < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                          {m.bottle_qty_change > 0 ? "+" : ""}{m.bottle_qty_change}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{m.previous_perfume_ml ?? m.previous_quantity}</TableCell>
                    <TableCell>{m.new_perfume_ml ?? m.new_quantity}</TableCell>
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
