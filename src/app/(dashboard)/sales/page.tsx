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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateFull } from "@/lib/utils";
import { Search, ShoppingCart, Plus, Trash2, Printer, Download } from "lucide-react";
import toast from "react-hot-toast";

type Product = { id: string; name: string; product_variants: Variant[] };
type Variant = { id: string; product_id: string; size_ml: number; concentration: string; price: number; stock_quantity: number; sku: string };
type Customer = { id: string; name: string; barcode_id: string | null; loyalty_points: number };
type SaleItem = { variant: Variant; productName: string; qty: number; unitPrice: number };

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  // New sale state
  const [showSale, setShowSale] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [orderType, setOrderType] = useState<"Offline" | "Online">("Offline");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [p, c, s] = await Promise.all([
      supabase.from("products").select("*, product_variants(*)"),
      supabase.from("customers").select("id, name, barcode_id, loyalty_points").order("name"),
      supabase.from("sales").select("*, customers(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    if (p.data) setProducts(p.data);
    if (c.data) setCustomers(c.data);
    if (s.data) setSales(s.data);
    setLoading(false);
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

  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const discountNum = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountNum);
  const loyaltyEarn = Math.floor(total / 100);

  const handleSaveSale = async () => {
    if (cart.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);

    const invoiceNo = `INV-${String(Date.now()).slice(-6)}`;

    const { data: sale, error: se } = await supabase
      .from("sales")
      .insert({
        invoice_no: invoiceNo,
        customer_id: selectedCustomer || null,
        subtotal,
        discount: discountNum,
        total,
        payment_method: "Cash",
        order_type: orderType,
      })
      .select()
      .single();

    if (se || !sale) { toast.error("Failed to create sale"); setSaving(false); return; }

    const saleItems = cart.map((item) => ({
      sale_id: sale.id,
      variant_id: item.variant.id,
      quantity: item.qty,
      unit_price: item.unitPrice,
      subtotal: item.qty * item.unitPrice,
    }));

    const { error: sie } = await supabase.from("sale_items").insert(saleItems);
    if (sie) { toast.error("Failed to add sale items"); setSaving(false); return; }

    // Deduct stock
    for (const item of cart) {
      await supabase
        .from("product_variants")
        .update({ stock_quantity: item.variant.stock_quantity - item.qty })
        .eq("id", item.variant.id);
    }

    // Loyalty points auto-handled by DB trigger on sales insert

    toast.success(`Sale ${invoiceNo} recorded!`);
    setShowSale(false);
    setCart([]);
    setDiscount("0");
    setSelectedCustomer("");
    loadData();
    setSaving(false);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

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

      {/* Sales History */}
      <Card>
        <CardHeader>
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
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sales yet.</TableCell></TableRow>
              ) : (
                sales.map((sale: any) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs font-medium">{sale.invoice_no}</TableCell>
                    <TableCell>{sale.customers?.name || "Walk-in"}</TableCell>
                    <TableCell><Badge variant={sale.order_type === "Online" ? "default" : "secondary"}>{sale.order_type}</Badge></TableCell>
                    <TableCell>{sale.sale_items?.length || "-"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateFull(sale.created_at)}</TableCell>
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
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.loyalty_points} pts)</SelectItem>
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

            <div className="flex justify-between items-center border-t pt-4">
              <div className="space-y-1">
                <Label>Discount (৳)</Label>
                <Input type="number" className="w-28" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</p>
                <p className="text-lg font-bold text-gold">Total: {formatCurrency(total)}</p>
                {selectedCustomer && (
                  <p className="text-xs text-muted-foreground">+{loyaltyEarn} loyalty points</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSaveSale} disabled={saving || cart.length === 0}>
              {saving ? "Saving..." : `Record Sale — ${formatCurrency(total)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
