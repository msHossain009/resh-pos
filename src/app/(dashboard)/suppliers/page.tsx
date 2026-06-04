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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Pencil, Search, Truck } from "lucide-react";
import toast from "react-hot-toast";

type Supplier = {
  id: string; name: string; contact_person: string | null;
  email: string | null; phone: string | null; address: string | null;
  created_at: string;
};

type PurchaseOrder = {
  id: string; po_number: string; supplier_id: string;
  status: string; total_amount: number; created_at: string;
  suppliers: { name: string } | null;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSupplier, setShowSupplier] = useState(false);
  const [showPO, setShowPO] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const supabase = createClient();

  const [supplierForm, setSupplierForm] = useState({ name: "", contact: "", email: "", phone: "", address: "" });
  const [poForm, setPoForm] = useState({ supplier_id: "", notes: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [s, po] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    if (s.data) setSuppliers(s.data);
    if (po.data) setPurchaseOrders(po.data);
    setLoading(false);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) { toast.error("Supplier name required"); return; }
    const data = {
      name: supplierForm.name,
      contact_person: supplierForm.contact,
      email: supplierForm.email,
      phone: supplierForm.phone,
      address: supplierForm.address,
    };

    if (editingSupplier) {
      await supabase.from("suppliers").update(data).eq("id", editingSupplier.id);
      toast.success("Supplier updated");
    } else {
      await supabase.from("suppliers").insert(data);
      toast.success("Supplier added");
    }
    setShowSupplier(false);
    setSupplierForm({ name: "", contact: "", email: "", phone: "", address: "" });
    setEditingSupplier(null);
    loadData();
  };

  const handleCreatePO = async () => {
    if (!poForm.supplier_id) { toast.error("Select a supplier"); return; }
    const poNumber = `PO-${String(Date.now()).slice(-4)}`;
    const { error } = await supabase.from("purchase_orders").insert({
      po_number: poNumber,
      supplier_id: poForm.supplier_id,
      status: "Pending",
      notes: poForm.notes,
    });
    if (error) { toast.error("Failed to create PO"); return; }
    toast.success(`Purchase order ${poNumber} created`);
    setShowPO(false);
    setPoForm({ supplier_id: "", notes: "" });
    loadData();
  };

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "success" | "warning" | "destructive"> = {
      Pending: "default",
      "Partially Received": "warning",
      Received: "success",
      Cancelled: "destructive",
    };
    return <Badge variant={map[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers and purchase orders.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPO(true)}>
            <Plus className="h-4 w-4" /> New PO
          </Button>
          <Button variant="gold" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", contact: "", email: "", phone: "", address: "" }); setShowSupplier(true); }}>
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        </div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No suppliers added yet.</TableCell></TableRow>
              ) : (
                suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contact_person || "-"}</TableCell>
                    <TableCell>{s.phone || "-"}</TableCell>
                    <TableCell>{s.email || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Purchase Orders */}
      <Card>
        <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No purchase orders yet.</TableCell></TableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.suppliers?.name || "-"}</TableCell>
                    <TableCell>{statusBadge(po.status)}</TableCell>
                    <TableCell>{po.total_amount ? formatCurrency(po.total_amount) : "-"}</TableCell>
                    <TableCell className="text-xs">{formatDate(po.created_at)}</TableCell>
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
        <DialogContent>
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
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleCreatePO}>Create PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
