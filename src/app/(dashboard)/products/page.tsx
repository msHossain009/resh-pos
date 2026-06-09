"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, downloadCSV } from "@/lib/utils";
import { can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import { DEFAULT_VARIANT_SIZES } from "@/lib/constants";
import type { Product, Variant } from "@/lib/types";
import { Plus, Pencil, Search, Eye, EyeOff, Download, Wand2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const CONCENTRATIONS = ["EDP", "EDT", "EDC", "Parfum", "Extrait", "Cologne"] as const;
const PRODUCT_STATUSES = ["Active", "Inactive", "Cancelled"] as const;

export default function ProductsPage() {
  const { profile } = useProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    category_id: "",
    category: "",
    image_url: "",
    active: true as boolean,
    status: "Active" as string,
  });

  const [variants, setVariants] = useState<Partial<Variant>[]>([]);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [editingVariantIdx, setEditingVariantIdx] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState({
    size_ml: "50",
    concentration: "EDP",
    retail_price: "",
    retail_cost: "",
    wholesale_price_per_ml: "",
    wholesale_cost_per_ml: "",
    stock_ml: "0",
    bottle_stock_qty: "0",
    low_stock_ml_threshold: "100",
    low_bottle_threshold: "10",
    sku: "",
    barcode: "",
    active: true,
  });

  const loadProducts = useCallback(async () => {
    return await Promise.all([
      supabase.from("products").select("*, product_variants(*)").order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name").order("name"),
    ]);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const [p, c] = await loadProducts();
      if (p.data) setProducts(p.data);
      if (c.data) setCategories(c.data);
      setLoading(false);
    })();
  }, [loadProducts]);

  const fetchData = async () => {
    const [p, c] = await loadProducts();
    if (p.data) setProducts(p.data);
    if (c.data) setCategories(c.data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", description: "", category_id: "", category: "", image_url: "", active: true, status: "Active" });
    setVariants([]);
    setEditing(null);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || "",
      category_id: product.category_id || "",
      category: product.category || "",
      image_url: product.image_url || "",
      active: product.active,
      status: product.active ? "Active" : "Inactive",
    });
    setVariants(product.product_variants?.map((v: Variant) => ({ ...v })) || []);
    setShowDialog(true);
  };

  const resetVariantForm = () => {
    setVariantForm({
      size_ml: "50", concentration: "EDP", retail_price: "", retail_cost: "",
      wholesale_price_per_ml: "", wholesale_cost_per_ml: "",
      stock_ml: "0", bottle_stock_qty: "0",
      low_stock_ml_threshold: "100", low_bottle_threshold: "10",
      sku: "", barcode: "", active: true,
    });
    setEditingVariantIdx(null);
  };

  const openAddVariant = () => { resetVariantForm(); setShowVariantDialog(true); };

  const openEditVariant = (idx: number) => {
    const v = variants[idx];
    if (!v) return;
    setVariantForm({
      size_ml: String(v.size_ml || 50),
      concentration: v.concentration || "EDP",
      retail_price: String(v.retail_price ?? v.price ?? ""),
      retail_cost: String(v.retail_cost ?? v.cost ?? ""),
      wholesale_price_per_ml: String(v.wholesale_price_per_ml ?? ""),
      wholesale_cost_per_ml: String(v.wholesale_cost_per_ml ?? ""),
      stock_ml: String(v.stock_ml ?? 0),
      bottle_stock_qty: String(v.bottle_stock_qty ?? 0),
      low_stock_ml_threshold: String(v.low_stock_ml_threshold ?? 100),
      low_bottle_threshold: String(v.low_bottle_threshold ?? 10),
      sku: v.sku || "",
      barcode: v.barcode || "",
      active: v.active !== false,
    });
    setEditingVariantIdx(idx);
    setShowVariantDialog(true);
  };

  /** Generate default 6/15/30/50/100ml variants with auto pricing */
  const generateDefaultVariants = () => {
    const basePrice = 500; // default base price, user will adjust
    const existingSizes = new Set(variants.map((v) => v.size_ml));
    const newVariants: Partial<Variant>[] = [];

    for (const size of DEFAULT_VARIANT_SIZES) {
      if (existingSizes.has(size)) continue;
      const multiplier = size / 50; // scale relative to 50ml
      const retailPrice = Math.round(basePrice * multiplier);
      const retailCost = Math.round(basePrice * 0.6 * multiplier);
      newVariants.push({
        size_ml: size,
        concentration: "EDP",
        price: retailPrice,
        cost: retailCost,
        retail_price: retailPrice,
        retail_cost: retailCost,
        wholesale_price_per_ml: Math.round(basePrice / 50 * 0.8 * 100) / 100,
        wholesale_cost_per_ml: Math.round(basePrice / 50 * 0.5 * 100) / 100,
        stock_ml: 0,
        stock_quantity: 0,
        bottle_stock_qty: 0,
        low_stock_ml_threshold: 100,
        low_stock_threshold: 100,
        low_bottle_threshold: 10,
        sku: "",
        barcode: null,
        active: true,
        status: "active",
      });
    }

    if (newVariants.length === 0) {
      toast.error("All default variants already exist");
      return;
    }
    setVariants((prev) => [...prev, ...newVariants]);
    toast.success(`Added ${newVariants.length} default variant(s)`);
  };

  const saveVariant = () => {
    if (!variantForm.retail_price && !variantForm.wholesale_price_per_ml) {
      toast.error("Retail price or wholesale price is required");
      return;
    }
    const variant: Partial<Variant> = {
      size_ml: parseFloat(variantForm.size_ml) || 50,
      concentration: variantForm.concentration,
      price: parseFloat(variantForm.retail_price) || 0,
      cost: parseFloat(variantForm.retail_cost) || 0,
      retail_price: parseFloat(variantForm.retail_price) || null,
      retail_cost: parseFloat(variantForm.retail_cost) || null,
      wholesale_price_per_ml: parseFloat(variantForm.wholesale_price_per_ml) || null,
      wholesale_cost_per_ml: parseFloat(variantForm.wholesale_cost_per_ml) || null,
      stock_ml: parseFloat(variantForm.stock_ml) || 0,
      stock_quantity: Math.round(parseFloat(variantForm.stock_ml) || 0),
      bottle_stock_qty: parseInt(variantForm.bottle_stock_qty) || 0,
      low_stock_ml_threshold: parseFloat(variantForm.low_stock_ml_threshold) || 100,
      low_stock_threshold: Math.round(parseFloat(variantForm.low_stock_ml_threshold) || 100),
      low_bottle_threshold: parseInt(variantForm.low_bottle_threshold) || 10,
      sku: variantForm.sku,
      barcode: variantForm.barcode || null,
      active: variantForm.active,
      status: variantForm.active ? "active" : "inactive",
    };

    setVariants((prev) => {
      if (editingVariantIdx !== null) {
        const updated = [...prev];
        updated[editingVariantIdx] = variant;
        return updated;
      }
      return [...prev, variant];
    });
    setShowVariantDialog(false);
    resetVariantForm();
  };

  const removeVariant = (idx: number) => {
    const v = variants[idx];
    if (v?.id && editing) {
      setVariants((prev) => prev.map((item, i) => i === idx ? { ...item, active: false } : item));
      toast("Variant marked inactive");
    } else {
      setVariants((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Product name is required"); return; }
    if (variants.length === 0) { toast.error("Add at least one variant"); return; }

    setSaving(true);

    const productActive = form.status === "Active";
    const catId = form.category_id && categories.some(c => c.id === form.category_id) ? form.category_id : null;
    const productData: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      category_id: catId,
      image_url: form.image_url || null,
      active: productActive,
    };

    try {
      if (editing) {
        const { error: pe } = await supabase.from("products").update(productData).eq("id", editing.id);
        if (pe) { toast.error("Failed to update product"); setSaving(false); return; }

        for (const v of variants) {
          const variantData: Record<string, unknown> = {
            product_id: editing.id,
            size_ml: v.size_ml,
            concentration: v.concentration,
            price: v.retail_price ?? v.price ?? 0,
            cost: v.retail_cost ?? v.cost ?? 0,
            retail_price: v.retail_price ?? null,
            retail_cost: v.retail_cost ?? null,
            wholesale_price_per_ml: v.wholesale_price_per_ml ?? null,
            wholesale_cost_per_ml: v.wholesale_cost_per_ml ?? null,
            stock_ml: v.stock_ml ?? 0,
            stock_quantity: Math.round(v.stock_ml ?? 0),
            bottle_stock_qty: v.bottle_stock_qty ?? 0,
            low_stock_ml_threshold: v.low_stock_ml_threshold ?? 100,
            low_stock_threshold: Math.round(v.low_stock_ml_threshold ?? 100),
            low_bottle_threshold: v.low_bottle_threshold ?? 10,
            sku: v.sku || undefined,
            barcode: v.barcode || null,
            active: form.status === "Cancelled" ? false : (v.active !== false),
          };
          if (v.id) {
            const { error: ve } = await supabase.from("product_variants").update(variantData).eq("id", v.id);
            if (ve) { toast.error("Failed to update variant: " + ve.message); setSaving(false); return; }
          } else {
            const { error: ve } = await supabase.from("product_variants").insert(variantData);
            if (ve) { toast.error("Failed to create variant: " + ve.message); setSaving(false); return; }
          }
        }
        toast.success("Product updated");
      } else {
        const { data: newProduct, error: pe } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        if (pe || !newProduct) { toast.error("Failed to create product"); setSaving(false); return; }

        for (const v of variants) {
          const variantData: Record<string, unknown> = {
            product_id: newProduct.id,
            size_ml: v.size_ml,
            concentration: v.concentration,
            price: v.retail_price ?? v.price ?? 0,
            cost: v.retail_cost ?? v.cost ?? 0,
            retail_price: v.retail_price ?? null,
            retail_cost: v.retail_cost ?? null,
            wholesale_price_per_ml: v.wholesale_price_per_ml ?? null,
            wholesale_cost_per_ml: v.wholesale_cost_per_ml ?? null,
            stock_ml: v.stock_ml ?? 0,
            stock_quantity: Math.round(v.stock_ml ?? 0),
            bottle_stock_qty: v.bottle_stock_qty ?? 0,
            low_stock_ml_threshold: v.low_stock_ml_threshold ?? 100,
            low_stock_threshold: Math.round(v.low_stock_ml_threshold ?? 100),
            low_bottle_threshold: v.low_bottle_threshold ?? 10,
            sku: v.sku || undefined,
            barcode: v.barcode || null,
            active: v.active !== false,
          };
          const { error: ve } = await supabase.from("product_variants").insert(variantData);
          if (ve) { toast.error("Failed to create variant: " + ve.message); setSaving(false); return; }
        }
        toast.success("Product created");
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Product save error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const newActive = !product.active;
      const newStatus = newActive ? "active" : "inactive";
      const { error } = await supabase
        .from("products")
        .update({ active: newActive, status: newStatus })
        .eq("id", product.id);
      if (error) { toast.error("Failed to toggle status"); return; }
      toast.success(newActive ? "Product activated" : "Product deactivated");
      fetchData();
    } catch (err) {
      console.error("Toggle active error:", err);
      toast.error("An unexpected error occurred");
    }
  };

  const handleExport = () => {
    const headers = ["Name", "Category", "Variants", "Total Stock (ml)", "Status", "Created"];
    const rows = filtered.map((p) => [
      p.name, p.category || "-", String(p.product_variants?.length || 0),
      String(totalStockMl(p)), p.active ? "Active" : "Inactive", formatDate(p.created_at),
    ]);
    downloadCSV(`products-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  const filtered = products.filter((p) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      p.name.toLowerCase().includes(searchLower) ||
      p.category?.toLowerCase().includes(searchLower) ||
      p.product_variants?.some((v) =>
        v.sku?.toLowerCase().includes(searchLower) ||
        v.barcode?.toLowerCase().includes(searchLower)
      );
    if (!matchesSearch) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "inactive" && p.active) return false;
    return true;
  });

  const totalStockMl = (product: Product) =>
    product.product_variants?.reduce((sum, v) => sum + (v.stock_ml ?? v.stock_quantity ?? 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your perfume catalog with ml/bottle stock.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          {can(profile?.role, "create") && (
            <Button variant="gold" onClick={() => { resetForm(); setShowDialog(true); }}>
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, SKU, barcode or category..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all_cat">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
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
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Stock (ml)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center"><LoadingSpinner size="sm" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
              ) : (
                filtered.map((product) => {
                  const stockMl = totalStockMl(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                        {product.active === false && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                      </TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell>{product.product_variants?.length || 0}</TableCell>
                      <TableCell>
                        <Badge variant={stockMl <= 0 ? "destructive" : stockMl < 100 ? "warning" : "success"}>
                          {stockMl} ml
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.active ? "success" : "secondary"}>
                          {product.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(product.created_at)}</TableCell>
                      <TableCell>
                        {can(profile?.role, "edit") && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(product)} title={product.active ? "Deactivate" : "Reactivate"}>
                              {product.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="E.g. Rose Oud" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v, active: v === "Active" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categories.some(c => c.id === form.category_id) ? form.category_id : "__none__"} onValueChange={(v) => {
                  if (v === "__custom__") {
                    setForm({ ...form, category_id: "", category: "" });
                  } else {
                    const cat = categories.find(c => c.id === v);
                    setForm({ ...form, category_id: v, category: cat?.name || v });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                    <SelectItem value="__custom__">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {(!form.category_id || !categories.some(c => c.id === form.category_id)) && (
                  <Input className="mt-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Enter custom category" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Image URL (optional)</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Top notes, middle notes, base notes..." />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-2">
              <Label>Variants</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generateDefaultVariants}>
                  <Wand2 className="h-4 w-4 mr-1" /> Generate Defaults
                </Button>
                <Button variant="outline" size="sm" onClick={openAddVariant}>
                  <Plus className="h-4 w-4 mr-1" /> Add Variant
                </Button>
              </div>
            </div>

            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No variants added yet. Click &ldquo;Generate Defaults&rdquo; for 6/15/30/50/100ml.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {variants.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{v.size_ml}ml</span>
                      <span className="text-muted-foreground ml-2">/ {v.concentration}</span>
                      <span className="ml-2 text-gold">{formatCurrency(v.retail_price ?? v.price ?? 0)}</span>
                      {v.wholesale_price_per_ml ? (
                        <span className="ml-2 text-xs text-muted-foreground">WS: {formatCurrency(v.wholesale_price_per_ml)}/ml</span>
                      ) : null}
                      <span className="ml-2 text-xs">ML: {v.stock_ml ?? 0} | Bot: {v.bottle_stock_qty ?? 0}</span>
                      <Badge variant={v.active !== false ? "success" : "secondary"} className="ml-1">
                        {v.active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditVariant(idx)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeVariant(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Form Dialog */}
      <Dialog open={showVariantDialog} onOpenChange={setShowVariantDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVariantIdx !== null ? "Edit Variant" : "Add Variant"}</DialogTitle>
            <DialogDescription>Configure product variant details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Size (ml) *</Label>
                <Input type="number" value={variantForm.size_ml} onChange={(e) => setVariantForm({ ...variantForm, size_ml: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Concentration</Label>
                <Select value={variantForm.concentration} onValueChange={(v) => setVariantForm({ ...variantForm, concentration: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONCENTRATIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <select className="border rounded p-2 w-full text-sm h-9" value={variantForm.active ? "true" : "false"}
                  onChange={(e) => setVariantForm({ ...variantForm, active: e.target.value === "true" })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <Separator />
            <p className="text-xs font-semibold text-muted-foreground">Retail Pricing</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Retail Price (৳) *</Label>
                <Input type="number" step="0.01" value={variantForm.retail_price} onChange={(e) => setVariantForm({ ...variantForm, retail_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Retail Cost (৳)</Label>
                <Input type="number" step="0.01" value={variantForm.retail_cost} onChange={(e) => setVariantForm({ ...variantForm, retail_cost: e.target.value })} />
              </div>
            </div>

            <Separator />
            <p className="text-xs font-semibold text-muted-foreground">Wholesale Pricing (per ml)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>WS Price per ml</Label>
                <Input type="number" step="0.01" value={variantForm.wholesale_price_per_ml} onChange={(e) => setVariantForm({ ...variantForm, wholesale_price_per_ml: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>WS Cost per ml</Label>
                <Input type="number" step="0.01" value={variantForm.wholesale_cost_per_ml} onChange={(e) => setVariantForm({ ...variantForm, wholesale_cost_per_ml: e.target.value })} />
              </div>
            </div>

            <Separator />
            <p className="text-xs font-semibold text-muted-foreground">Stock</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Perfume Stock (ml)</Label>
                <Input type="number" min={0} value={variantForm.stock_ml} onChange={(e) => setVariantForm({ ...variantForm, stock_ml: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bottle Stock (qty)</Label>
                <Input type="number" min={0} value={variantForm.bottle_stock_qty} onChange={(e) => setVariantForm({ ...variantForm, bottle_stock_qty: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Low Perfume Threshold (ml)</Label>
                <Input type="number" min={0} value={variantForm.low_stock_ml_threshold} onChange={(e) => setVariantForm({ ...variantForm, low_stock_ml_threshold: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Low Bottle Threshold</Label>
                <Input type="number" min={0} value={variantForm.low_bottle_threshold} onChange={(e) => setVariantForm({ ...variantForm, low_bottle_threshold: e.target.value })} />
              </div>
            </div>

            <Separator />
            <p className="text-xs font-semibold text-muted-foreground">Identifiers</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} placeholder="Auto if empty" />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input value={variantForm.barcode} onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={saveVariant}>
              {editingVariantIdx !== null ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
