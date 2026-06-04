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
import { formatCurrency } from "@/lib/utils";
import { Search, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
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
  products: { name: string; category: string | null };
};

export default function InventoryPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    const { data } = await supabase
      .from("product_variants")
      .select("*, products(name, category)")
      .order("stock_quantity", { ascending: true });
    if (data) setVariants(data);
    setLoading(false);
  };

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

    const { error } = await supabase
      .from("product_variants")
      .update({ stock_quantity: newQty })
      .eq("id", selectedVariant.id);

    if (error) { toast.error("Adjustment failed"); return; }

    toast.success(`Stock updated to ${newQty}`);
    setShowAdjust(false);
    loadInventory();
  };

  const openAdjust = (v: Variant) => {
    setSelectedVariant(v);
    setAdjustQty(v.stock_quantity.toString());
    setAdjustReason("");
    setShowAdjust(true);
  };

  const lowStock = variants.filter((v) => v.stock_quantity < (v.low_stock_threshold || 10));
  const filtered = variants.filter((v) =>
    v.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track stock levels across all products.</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {lowStock.length} item{lowStock.length > 1 ? "s" : ""} low on stock
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

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                <TableHead className="w-16"></TableHead>
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
                  const isLow = v.stock_quantity < threshold;
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
                        <Button variant="ghost" size="sm" onClick={() => openAdjust(v)}>
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="E.g. Stock count, damaged, returned" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleAdjust}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
