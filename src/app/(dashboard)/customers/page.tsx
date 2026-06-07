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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDateFull, downloadCSV } from "@/lib/utils";
import { getMembershipTier, MEMBERSHIP_TIERS } from "@/lib/types";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import type { Customer } from "@/lib/types";
import { Plus, Pencil, Search, Gift, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function CustomersPage() {
  const { profile } = useProfile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<{ id: string; customer_id: string; total: number; paid_amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Details modal
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<{ id: string; invoice_no: string; total: number; payment_status: string; created_at: string; sale_items?: { id: string }[] }[]>([]);
  const [customerLoyalty, setCustomerLoyalty] = useState<{ id: string; type: string; points: number; description: string; created_at: string }[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", barcode_id: "", customer_type: "retail" as "retail" | "wholesale" });
  // Loyalty adjustment
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState("0");
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("sales").select("id, customer_id, total, paid_amount").neq("payment_status", "Paid"),
    ]);
    if (c.data) setCustomers(c.data);
    if (s.data) setSales(s.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", barcode_id: "", customer_type: "retail" });
    setEditing(null);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", barcode_id: c.barcode_id || "", customer_type: c.customer_type || "retail" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Name is required"); return; }

    // Check duplicate email/phone
    if (form.email) {
      const { data: dup } = await supabase.from("customers").select("id").eq("email", form.email).neq("id", editing?.id || "").limit(1);
      if (dup && dup.length > 0) { toast.error("Email already in use"); return; }
    }
    if (form.phone) {
      const { data: dup } = await supabase.from("customers").select("id").eq("phone", form.phone).neq("id", editing?.id || "").limit(1);
      if (dup && dup.length > 0) { toast.error("Phone already in use"); return; }
    }

    setSaving(true);
    const data = { name: form.name, email: form.email || null, phone: form.phone || null, barcode_id: form.barcode_id || null, customer_type: form.customer_type };

    if (editing) {
      const { error } = await supabase.from("customers").update(data).eq("id", editing.id);
      if (error) { toast.error("Failed to update"); setSaving(false); return; }
      toast.success("Customer updated");
    } else {
      const { error } = await supabase.from("customers").insert(data);
      if (error) { toast.error("Failed to create"); setSaving(false); return; }
      toast.success("Customer created");
    }

    setShowDialog(false);
    resetForm();
    fetchData();
    setSaving(false);
  };

  const openDetails = async (c: Customer) => {
    setSelectedCustomer(c);
    setDetailsLoading(true);
    setShowDetails(true);

    const [salesRes, loyaltyRes] = await Promise.all([
      supabase.from("sales").select("*, sale_items(id)").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("loyalty_transactions").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (salesRes.data) setCustomerSales(salesRes.data);
    if (loyaltyRes.data) setCustomerLoyalty(loyaltyRes.data);
    setDetailsLoading(false);
  };

  const handleLoyaltyAdjust = async () => {
    if (!selectedCustomer) return;
    const points = parseInt(loyaltyPoints);
    if (isNaN(points) || points === 0) { toast.error("Enter valid points"); return; }
    setLoyaltySaving(true);

    const { error } = await supabase
      .from("customers")
      .update({ loyalty_points: (selectedCustomer.loyalty_points || 0) + points })
      .eq("id", selectedCustomer.id);

    if (error) { toast.error("Failed to adjust loyalty"); setLoyaltySaving(false); return; }

    await supabase.from("loyalty_transactions").insert({
      customer_id: selectedCustomer.id,
      points,
      type: points > 0 ? "earn" : "burn",
      description: points > 0 ? "Manual adjustment (add)" : "Manual adjustment (deduct)",
    });

    toast.success(`Loyalty points ${points > 0 ? "added" : "deducted"}`);
    setShowLoyalty(false);
    setLoyaltySaving(false);
    fetchData();
    if (selectedCustomer) openDetails(selectedCustomer);
  };

  const getDueAmount = (customerId: string) => {
    return sales
      .filter((s) => s.customer_id === customerId)
      .reduce((sum, s) => sum + Number(s.total || 0) - Number(s.paid_amount || 0), 0);
  };

  const handleExport = () => {
    const headers = ["Name", "Email", "Phone", "Type", "Loyalty Points", "Total Spent", "Due", "Barcode ID"];
    const rows = customers.map((c) => [
      c.name, c.email || "", c.phone || "", c.customer_type || "retail",
      String(c.loyalty_points || 0), String(c.total_spent || 0),
      String(getDueAmount(c.id)), c.barcode_id || "",
    ]);
    downloadCSV(`customers-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  const filtered = customers.filter((c) => {
    if (customerTypeFilter && customerTypeFilter !== "all" && c.customer_type !== customerTypeFilter) return false;
    return c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.barcode_id?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your customer relationships and loyalty.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button variant="gold" onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, phone or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="wholesale">Wholesale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Membership</TableHead>
                <TableHead>Loyalty Points</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No customers found.</TableCell></TableRow>
              ) : (
                filtered.map((c) => {
                  const due = getDueAmount(c.id);
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetails(c)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">{c.email || "-"}</div>
                        <div className="text-xs text-muted-foreground">{c.phone || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.customer_type === "wholesale" ? "gold" : "secondary"}>
                          {c.customer_type || "retail"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          getMembershipTier(c.total_spent) === "VIP" ? "gold" :
                          getMembershipTier(c.total_spent) === "Gold" ? "gold" :
                          getMembershipTier(c.total_spent) === "Silver" ? "secondary" : "outline"
                        }>
                          {getMembershipTier(c.total_spent)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="gold" className="gap-1">
                          <Gift className="h-3 w-3" /> {c.loyalty_points}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(c.total_spent)}</TableCell>
                      <TableCell>
                        {due > 0 ? <span className="text-destructive font-medium">{formatCurrency(due)}</span> : "-"}
                      </TableCell>
                      <TableCell>
                        {can(profile?.role, "edit") && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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

      {/* Customer Dialog */}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Type</Label>
                <Select value={form.customer_type} onValueChange={(v) => setForm({ ...form, customer_type: v as "retail" | "wholesale" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((t) => (<SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Barcode ID (optional, for loyalty scan)</Label>
                <Input value={form.barcode_id} onChange={(e) => setForm({ ...form, barcode_id: e.target.value })} placeholder="E.g. CST-0001" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.email || "No email"} &middot; {selectedCustomer?.phone || "No phone"}
              &middot; <Badge variant="gold" className="gap-1"><Gift className="h-3 w-3" /> {selectedCustomer?.loyalty_points || 0} pts</Badge>
              &middot; Total spent: {formatCurrency(selectedCustomer?.total_spent || 0)}
              &middot; {selectedCustomer && <Badge variant="outline">{getMembershipTier(selectedCustomer.total_spent)}</Badge>}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid gap-4">
              <div className="flex gap-2">
                {can(profile?.role, "edit") && (
                  <Button variant="outline" size="sm" onClick={() => { setLoyaltyPoints("0"); setShowLoyalty(true); }}>
                    <Gift className="h-4 w-4 mr-1" /> Adjust Loyalty
                  </Button>
                )}
              </div>

              {/* Membership Progress */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Membership Progress</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {MEMBERSHIP_TIERS.map((tier, idx) => {
                      const isUnlocked = (selectedCustomer?.total_spent || 0) >= tier.minSpent;
                      const nextTier = MEMBERSHIP_TIERS[idx + 1];
                      const progress = nextTier
                        ? Math.min(100, ((selectedCustomer?.total_spent || 0) - tier.minSpent) / (nextTier.minSpent - tier.minSpent) * 100)
                        : 100;
                      return (
                        <div key={tier.name} className="flex items-center gap-3 text-sm">
                          <Badge variant={isUnlocked ? "gold" : "outline"} className="w-16">{tier.name}</Badge>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isUnlocked ? "bg-gold" : "bg-muted-foreground/20"}`}
                              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {nextTier ? `৳${(nextTier.minSpent - (selectedCustomer?.total_spent || 0)).toLocaleString()} to ${nextTier.name}` : "Max tier"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Separator />
              <CardTitle className="text-sm">Purchase History</CardTitle>
              {customerSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchases yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerSales.map((sale: { id: string; invoice_no: string; total: number; payment_status: string; created_at: string; sale_items?: { id: string }[] }) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs">{sale.invoice_no}</TableCell>
                        <TableCell className="text-xs">{formatDateFull(sale.created_at)}</TableCell>
                        <TableCell>{sale.sale_items?.length || "-"}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(sale.total)}</TableCell>
                        <TableCell>
                          <Badge variant={sale.payment_status === "Paid" ? "success" : sale.payment_status === "Partial" ? "warning" : "destructive"}>
                            {sale.payment_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <Separator />
              <CardTitle className="text-sm">Loyalty History</CardTitle>
              {customerLoyalty.length === 0 ? (
                <p className="text-sm text-muted-foreground">No loyalty transactions.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerLoyalty.map((tx: { id: string; type: string; points: number; description: string; created_at: string }) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">{formatDateFull(tx.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === "earn" ? "success" : "destructive"}>
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={tx.points > 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                          {tx.points > 0 ? "+" : ""}{tx.points}
                        </TableCell>
                        <TableCell className="text-xs">{tx.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loyalty Adjustment Dialog */}
      <Dialog open={showLoyalty} onOpenChange={setShowLoyalty}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Loyalty Points</DialogTitle>
            <DialogDescription>{selectedCustomer?.name} — Current: {selectedCustomer?.loyalty_points || 0} pts</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Points (positive to add, negative to deduct)</Label>
            <Input type="number" value={loyaltyPoints} onChange={(e) => setLoyaltyPoints(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleLoyaltyAdjust} disabled={loyaltySaving}>
              {loyaltySaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
