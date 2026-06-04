"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Pencil, Search, Package } from "lucide-react";
import toast from "react-hot-toast";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  created_at: string;
  product_variants: Variant[];
};

type Variant = {
  id: string;
  size_ml: number;
  concentration: string;
  price: number;
  cost: number;
  sku: string;
  stock_quantity: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const supabase = createClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    size_ml: "50",
    concentration: "EDP",
    price: "",
    cost: "",
    stock_quantity: "0",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .order("created_at", { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", description: "", category: "", size_ml: "50", concentration: "EDP", price: "", cost: "", stock_quantity: "0" });
    setEditing(null);
  };

  const openEdit = (product: Product) => {
    const v = product.product_variants?.[0];
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      size_ml: v?.size_ml?.toString() || "50",
      concentration: v?.concentration || "EDP",
      price: v?.price?.toString() || "",
      cost: v?.cost?.toString() || "",
      stock_quantity: v?.stock_quantity?.toString() || "0",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error("Name and price are required");
      return;
    }

    const variantData = {
      size_ml: parseInt(form.size_ml),
      concentration: form.concentration,
      price: parseFloat(form.price),
      cost: form.cost ? parseFloat(form.cost) : 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
    };

    if (editing) {
      const { error: pe } = await supabase
        .from("products")
        .update({ name: form.name, description: form.description, category: form.category })
        .eq("id", editing.id);

      if (pe) { toast.error("Failed to update product"); return; }

      const variant = editing.product_variants?.[0];
      if (variant) {
        await supabase.from("product_variants").update(variantData).eq("id", variant.id);
      }

      toast.success("Product updated");
    } else {
      const { data: newProduct, error: pe } = await supabase
        .from("products")
        .insert({ name: form.name, description: form.description, category: form.category })
        .select()
        .single();

      if (pe || !newProduct) { toast.error("Failed to create product"); return; }

      const { error: ve } = await supabase
        .from("product_variants")
        .insert({ ...variantData, product_id: newProduct.id });

      if (ve) { toast.error("Product created but variant failed"); } else {
        toast.success("Product created");
      }
    }

    setShowDialog(false);
    resetForm();
    loadProducts();
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your perfume catalog.</p>
        </div>
        <Button variant="gold" onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size / Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
              ) : (
                filtered.map((product) => {
                  const v = product.product_variants?.[0];
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell>{v ? `${v.size_ml}ml / ${v.concentration}` : "-"}</TableCell>
                      <TableCell>{v ? formatCurrency(v.price) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={v && v.stock_quantity < 10 ? "destructive" : "success"}>
                          {v?.stock_quantity || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(product.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="E.g. Rose Oud" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="E.g. Floral" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Top notes, middle notes, base notes..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Size (ml)</Label>
                <Input type="number" value={form.size_ml} onChange={(e) => setForm({ ...form, size_ml: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Concentration</Label>
                <Input value={form.concentration} onChange={(e) => setForm({ ...form, concentration: e.target.value })} placeholder="EDP, EDT..." />
              </div>
              <div className="space-y-2">
                <Label>Stock Qty</Label>
                <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (৳)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cost (৳)</Label>
                <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="gold" onClick={handleSave}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
