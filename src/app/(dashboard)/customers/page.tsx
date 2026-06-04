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
import { Plus, Pencil, Search, Gift } from "lucide-react";
import toast from "react-hot-toast";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  barcode_id: string | null;
  loyalty_points: number;
  total_spent: number;
  created_at: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const supabase = createClient();

  const [form, setForm] = useState({ name: "", email: "", phone: "", barcode_id: "" });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCustomers(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", barcode_id: "" });
    setEditing(null);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", barcode_id: c.barcode_id || "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Name is required"); return; }

    if (editing) {
      const { error } = await supabase
        .from("customers")
        .update({ name: form.name, email: form.email, phone: form.phone, barcode_id: form.barcode_id })
        .eq("id", editing.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Customer updated");
    } else {
      const { error } = await supabase
        .from("customers")
        .insert({ name: form.name, email: form.email, phone: form.phone, barcode_id: form.barcode_id });
      if (error) { toast.error("Failed to create"); return; }
      toast.success("Customer created");
    }

    setShowDialog(false);
    resetForm();
    loadCustomers();
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your customer relationships and loyalty.</p>
        </div>
        <Button variant="gold" onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Loyalty Points</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers found.</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{c.email || "-"}</div>
                      <div className="text-xs text-muted-foreground">{c.phone || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="gold" className="gap-1">
                        <Gift className="h-3 w-3" /> {c.loyalty_points}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(c.total_spent)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(c.created_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>Enter customer details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Barcode ID (optional, for loyalty scan)</Label>
              <Input value={form.barcode_id} onChange={(e) => setForm({ ...form, barcode_id: e.target.value })} placeholder="E.g. CST-0001" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
