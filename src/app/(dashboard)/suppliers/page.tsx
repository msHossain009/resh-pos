"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, downloadCSV } from "@/lib/utils";
import { getCurrentUserId, can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import type { Supplier, PurchaseOrderItem, Variant } from "@/lib/types";
import { Plus, Pencil, Search, Eye, XCircle, Package, Download } from "lucide-react";
import toast from "react-hot-toast";

interface PurchaseOrderRow {
  id: string;
  po_number: string;
  supplier_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  suppliers?: { name: string } | null;
}

export default function SuppliersPage() {
  const { profile } = useProfile();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  // Supplier dialog
  const [showSupplier, setShowSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", contact: "", email: "", phone: "", address: "" });

  // PO dialog
  const [showPO, setShowPO] = useState(false);
  const [poForm, setPoForm] = useState({ supplier_id: "", notes: "" });
  const [poItems, setPoItems] = useState<{ variant_id: string; variant_label: string; quantity: number; unit_cost: number }[]>([]);
  const [variants, setVariants] = useState<(Variant & { products?: { name: string } })[]>([]);

  // PO details
  const [showPODetails, setShowPODetails] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [poDetailItems, setPoDetailItems] = useState<PurchaseOrderItem[]>([]);

  // Receive dialog
  const [showReceive, setShowReceive] = useState(false);
  const [receiveItems, setReceiveItems] = useState<{ id: string; variant_label: string; quantity: number; received_quantity: number; receive_qty: string }[]>([]);
  const [receiveSaving, setReceiveSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [s, po, v] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("product_variants").select("*, products(name)").order("sku"),
    ]);
    if (s.data) setSuppliers(s.data);
    if (po.data) setPurchaseOrders(po.data);
    if (v.data) setVariants(v.data);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Supplier CRUD
  const handleSaveSupplier = async () => {
    if (!supplierForm.name) { toast.error("Supplier name required"); return; }
    const data = {
      name: supplierForm.name,
      contact_person: supplierForm.contact || null,
      email: supplierForm.email || null,
      phone: supplierForm.phone || null,
      address: supplierForm.address || null,
    };

    if (editingSupplier) {
      const { error } = await supabase.from("suppliers").update(data).eq("id", editingSupplier.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Supplier updated");
    } else {
      const { error } = await supabase.from("suppliers").insert(data);
      if (error) { toast.error("Failed to create"); return; }
      toast.success("Supplier added");
    }
    setShowSupplier(false);
    setSupplierForm({ name: "", contact: "", email: "", phone: "", address: "" });
    setEditingSupplier(null);
    fetchData();
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      contact: s.contact_person || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
    });
    setShowSupplier(true);
  };

  // PO Items management
  const addPOItem = () => {
    setPoItems([...poItems, { variant_id: "", variant_label: "", quantity: 1, unit_cost: 0 }]);
  };

  const updatePOItem = (idx: number, field: string, value: string | number) => {
    const updated = [...poItems];
    if (field === "variant_id") updated[idx].variant_id = value as string;
    else if (field === "variant_label") updated[idx].variant_label = value as string;
    else if (field === "quantity") updated[idx].quantity = value as number;
    else if (field === "unit_cost") updated[idx].unit_cost = value as number;
    if (field === "variant_id") {
      const v = variants.find((v) => v.id === value);
      if (v) {
        updated[idx].variant_label = `${v.products?.name || "Product"} - ${v.size_ml}ml (${v.concentration})`;
        updated[idx].unit_cost = Number(v.cost) || 0;
      }
    }
    setPoItems(updated);
  };

  const removePOItem = (idx: number) => {
    setPoItems(poItems.filter((_, i) => i !== idx));
  };

  const poTotal = poItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const handleCreatePO = async () => {
    if (!poForm.supplier_id) { toast.error("Select a supplier"); return; }
    if (poItems.length === 0) { toast.error("Add at least one item"); return; }

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        supplier_id: poForm.supplier_id,
        status: "Pending",
        notes: poForm.notes || null,
        total_amount: poTotal,
        created_by: await getCurrentUserId(),
      })
      .select()
      .single();

    if (poErr || !po) { toast.error("Failed to create PO"); return; }

    const itemsData = poItems.map((item) => ({
      po_id: po.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      received_quantity: 0,
    }));

    const { error: itemsErr } = await supabase.from("purchase_order_items").insert(itemsData);
    if (itemsErr) { toast.error("PO created but items failed"); } else {
      toast.success(`Purchase order ${po.po_number} created`);
    }

    setShowPO(false);
    setPoForm({ supplier_id: "", notes: "" });
    setPoItems([]);
    fetchData();
  };

  // PO Details
  const openPODetails = async (po: PurchaseOrderRow) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from("purchase_order_items")
      .select("*, product_variants(*, products(name))")
      .eq("po_id", po.id);
    if (data) setPoDetailItems(data);
    setShowPODetails(true);
  };

  // Receive flow
  const openReceive = async (po: PurchaseOrderRow) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from("purchase_order_items")
      .select("*, product_variants(*, products(name))")
      .eq("po_id", po.id);
    if (data) {
      setReceiveItems(
        data.map((item: PurchaseOrderItem & { product_variants?: Variant & { products?: { name: string } | null } }) => ({
          id: item.id,
          variant_label: `${item.product_variants?.products?.name || "Product"} - ${item.product_variants?.size_ml}ml`,
          quantity: item.quantity,
          received_quantity: item.received_quantity,
          receive_qty: String(item.quantity - item.received_quantity),
        }))
      );
    }
    setShowReceive(true);
  };

  const handleReceive = async () => {
    const po = selectedPO;
    if (!po) { toast.error("No PO selected"); return; }
    setReceiveSaving(true);
    let allReceived = true;
    let anyReceived = false;

    for (const item of receiveItems) {
      const receiveQty = parseInt(item.receive_qty) || 0;
      if (receiveQty <= 0) continue;
      anyReceived = true;
      const newReceived = item.received_quantity + receiveQty;
      if (newReceived < item.quantity) allReceived = false;

      // Update received_quantity
      await supabase.from("purchase_order_items").update({ received_quantity: newReceived }).eq("id", item.id);

      // Get variant
      const poiItem = poDetailItems.find((p) => p.id === item.id);
      if (poiItem) {
        const v = poiItem.product_variants;
        const prevStockMl = v?.stock_ml || 0;
        const prevBottleQty = v?.bottle_stock_qty || 0;
        const newStockMl = prevStockMl + receiveQty * (v?.size_ml || 0);
        const newBottleQty = prevBottleQty + receiveQty;

        // Increase stock (ml + bottles)
        await supabase.from("product_variants").update({
          stock_ml: newStockMl,
          stock_quantity: Math.round(newStockMl),
          bottle_stock_qty: newBottleQty,
        }).eq("id", poiItem.variant_id);

        // Record stock movement
        const userId = await getCurrentUserId();
        await supabase.from("stock_movements").insert({
          variant_id: poiItem.variant_id,
          type: "purchase_receive",
          quantity_change: receiveQty,
          previous_quantity: Math.round(prevStockMl),
          new_quantity: Math.round(newStockMl),
          perfume_ml_change: newStockMl - prevStockMl,
          bottle_qty_change: receiveQty,
          previous_perfume_ml: prevStockMl,
          new_perfume_ml: newStockMl,
          previous_bottle_qty: prevBottleQty,
          new_bottle_qty: newBottleQty,
          reason: `PO ${po.po_number} receive`,
          reference_type: "purchase_order",
          reference_id: po.id,
          created_by: userId,
        });
      }
    }

    if (!anyReceived) { toast.error("Enter at least one item to receive"); setReceiveSaving(false); return; }

    // Update PO status
    const newStatus = allReceived ? "Received" : "Partially Received";
    await supabase.from("purchase_orders").update({ status: newStatus }).eq("id", po.id);

    toast.success(`PO ${po.po_number} updated to ${newStatus}`);
    setShowReceive(false);
    setReceiveSaving(false);
    fetchData();
  };

  const handleCancelPO = async (po: PurchaseOrderRow) => {
    if (!confirm(`Cancel PO ${po.po_number}?`)) return;
    const { error } = await supabase.from("purchase_orders").update({ status: "Cancelled" }).eq("id", po.id);
    if (error) { toast.error("Failed to cancel"); return; }
    toast.success("PO cancelled");
    fetchData();
  };

  // CSV Export
  const handleExportSuppliers = () => {
    const headers = ["Name", "Contact Person", "Phone", "Email", "Address"];
    const rows = filteredSuppliers.map((s) => [
      s.name, s.contact_person || "", s.phone || "", s.email || "", s.address || "",
    ]);
    downloadCSV(`suppliers-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  const handleExportPOs = () => {
    const headers = ["PO #", "Supplier", "Status", "Amount", "Date"];
    const rows = purchaseOrders.map((po) => [
      po.po_number, po.suppliers?.name || "", po.status,
      (po.total_amount || 0).toString(), formatDate(po.created_at),
    ]);
    downloadCSV(`purchase-orders-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  // Filter suppliers
  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const statusBadge = (status: string | undefined | null) => {
    const map: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
      Pending: "default",
      "Partially Received": "warning",
      Received: "success",
      Cancelled: "destructive",
    };
    return <Badge variant={map[status || ""] || "default"}>{status || "Unknown"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers and purchase orders.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportSuppliers}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          {can(profile?.role, "create") && (
            <Button variant="outline" onClick={() => { setPoItems([]); setPoForm({ supplier_id: "", notes: "" }); setShowPO(true); }}>
              <Plus className="h-4 w-4" /> New PO
            </Button>
          )}
          {can(profile?.role, "create") && (
            <Button variant="gold" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", contact: "", email: "", phone: "", address: "" }); setShowSupplier(true); }}>
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Suppliers */}
      <Card>
        <CardHeader><CardTitle>Suppliers</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No suppliers added yet.</TableCell></TableRow>
              ) : (
                filteredSuppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contact_person || "-"}</TableCell>
                    <TableCell>{s.phone || "-"}</TableCell>
                    <TableCell>{s.email || "-"}</TableCell>
                    <TableCell>
                      {can(profile?.role, "edit") && (
                        <Button variant="ghost" size="icon" onClick={() => openEditSupplier(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Purchase Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Purchase Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleExportPOs}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders yet.</TableCell></TableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.suppliers?.name || "-"}</TableCell>
                    <TableCell>{statusBadge(po.status)}</TableCell>
                    <TableCell>{po.total_amount ? formatCurrency(po.total_amount) : "-"}</TableCell>
                    <TableCell className="text-xs">{formatDate(po.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openPODetails(po)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {can(profile?.role, "edit") && po.status === "Pending" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openReceive(po)}>
                              Receive
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCancelPO(po)}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {can(profile?.role, "edit") && po.status === "Partially Received" && (
                          <Button variant="ghost" size="sm" onClick={() => openReceive(po)}>
                            Receive
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Supplier Dialog */}
      <Dialog open={showSupplier} onOpenChange={setShowSupplier}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Company Name *</Label><Input value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Contact Person</Label><Input value={supplierForm.contact} onChange={(e) => setSupplierForm({...supplierForm, contact: e.target.value})} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSaveSupplier}>{editingSupplier ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO Dialog */}
      <Dialog open={showPO} onOpenChange={setShowPO}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={poForm.supplier_id} onValueChange={(v) => setPoForm({...poForm, supplier_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Input value={poForm.notes} onChange={(e) => setPoForm({...poForm, notes: e.target.value})} /></div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button variant="outline" size="sm" onClick={addPOItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </div>

            {poItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6 space-y-1">
                  <Label className="text-xs">Variant</Label>
                  <Select value={item.variant_id} onValueChange={(v) => updatePOItem(idx, "variant_id", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.products?.name || "Product"} - {v.size_ml}ml
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min={1} className="h-9" value={item.quantity} onChange={(e) => updatePOItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Unit Cost</Label>
                  <Input type="number" step="0.01" className="h-9" value={item.unit_cost} onChange={(e) => updatePOItem(idx, "unit_cost", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" className="h-9" onClick={() => removePOItem(idx)}>
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="text-right font-semibold">
              Total: {formatCurrency(poTotal)}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleCreatePO}>Create PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO Details Dialog */}
      <Dialog open={showPODetails} onOpenChange={setShowPODetails}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>PO Details — {selectedPO?.po_number}</DialogTitle>
            <DialogDescription>{selectedPO?.suppliers?.name} &middot; {statusBadge(selectedPO?.status)}</DialogDescription>
          </DialogHeader>
          {poDetailItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No items.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poDetailItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {item.product_variants?.products?.name || "Item"} ({item.product_variants?.size_ml}ml)
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.received_quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.quantity * item.unit_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            {selectedPO?.status !== "Cancelled" && selectedPO?.status !== "Received" && (
              <Button variant="gold" onClick={() => { if (selectedPO) { setShowPODetails(false); openReceive(selectedPO); } }}>
                <Package className="h-4 w-4 mr-1" /> Receive Items
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Items — {selectedPO?.po_number}</DialogTitle>
            <DialogDescription>Enter quantities to receive.</DialogDescription>
          </DialogHeader>
          {receiveItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No items to receive.</div>
          ) : (
            <div className="space-y-4">
              {receiveItems.map((item, idx) => {
                const remaining = item.quantity - item.received_quantity;
                return (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="flex-1 text-sm">{item.variant_label}</div>
                    <div className="text-xs text-muted-foreground">
                      Ordered: {item.quantity} &middot; Received: {item.received_quantity}
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        value={item.receive_qty}
                        onChange={(e) => {
                          const updated = [...receiveItems];
                          updated[idx].receive_qty = e.target.value;
                          setReceiveItems(updated);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleReceive} disabled={receiveSaving}>
              {receiveSaving ? "Receiving..." : "Receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
