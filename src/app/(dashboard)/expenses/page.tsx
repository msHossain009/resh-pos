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
import { formatCurrency, formatDate, downloadCSV } from "@/lib/utils";
import { getCurrentUserId, can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import type { Expense } from "@/lib/types";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import toast from "react-hot-toast";

const EXPENSE_CATEGORIES = ["Rent", "Salary", "Marketing", "Packaging", "Delivery", "Utility", "Misc"] as const;
const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Card", "Bank Transfer"] as const;

export default function ExpensesPage() {
  const { profile } = useProfile();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "",
    notes: "",
  });

  const fetchExpenses = async () => {
    setLoading(true);
    let query = supabase.from("expenses").select("*").order("date", { ascending: false });

    if (filterCategory) query = query.eq("category", filterCategory);
    if (filterPayment) query = query.eq("payment_method", filterPayment);
    if (filterDateFrom) query = query.gte("date", filterDateFrom);
    if (filterDateTo) query = query.lte("date", filterDateTo);

    const { data } = await query;
    if (data) setExpenses(data);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExpenses();
  }, [filterCategory, filterPayment, filterDateFrom, filterDateTo]);

  const resetForm = () => {
    setForm({
      description: "",
      amount: "",
      category: "",
      date: new Date().toISOString().split("T")[0],
      payment_method: "",
      notes: "",
    });
    setEditing(null);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category || "",
      date: expense.date?.split("T")[0] || new Date().toISOString().split("T")[0],
      payment_method: expense.payment_method || "",
      notes: expense.notes || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) {
      toast.error("Description and amount are required");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }

    setSaving(true);
    const userId = await getCurrentUserId();

    const payload = {
      description: form.description,
      amount,
      category: form.category || null,
      date: form.date,
      payment_method: form.payment_method || null,
      notes: form.notes || null,
      created_by: userId,
    };

    if (editing) {
      const { error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editing.id);
      if (error) { toast.error("Failed to update"); setSaving(false); return; }
      toast.success("Expense updated");
    } else {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) { toast.error("Failed to create"); setSaving(false); return; }
      toast.success("Expense added");
    }

    setShowDialog(false);
    resetForm();
    fetchExpenses();
    setSaving(false);
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Delete expense "${expense.description}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Expense deleted");
    fetchExpenses();
  };

  const handleExport = () => {
    const headers = ["Date", "Description", "Category", "Amount", "Payment Method", "Notes"];
    const rows = filtered.map((e) => [
      e.date, e.description, e.category || "", e.amount.toString(), e.payment_method || "", e.notes || "",
    ]);
    downloadCSV(`expenses-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast.success("CSV exported");
  };

  const monthlyTotal = expenses
    .filter((e) => {
      const expenseMonth = e.date?.substring(0, 7);
      const currentMonth = new Date().toISOString().substring(0, 7);
      return expenseMonth === currentMonth;
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const filtered = expenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.category?.toLowerCase().includes(search.toLowerCase())
  );

  const clearFilters = () => {
    setFilterCategory("");
    setFilterPayment("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track your business expenses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        {can(profile?.role, "create") && (
          <Button variant="gold" onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        )}
        </div>
      </div>

      {/* Monthly Total */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">This Month Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-destructive">{formatCurrency(monthlyTotal)}</p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9 w-40" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-40" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm" className="h-9" onClick={fetchExpenses}>
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No expenses found.</TableCell></TableRow>
              ) : (
                filtered.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-xs">{formatDate(expense.date)}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.category || "-"}</TableCell>
                    <TableCell className="text-xs">{expense.payment_method || "-"}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{formatCurrency(Number(expense.amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {can(profile?.role, "edit") && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(expense)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {can(profile?.role, "delete") && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(expense)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Expense Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>Record a business expense.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="E.g. Office rent" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (৳) *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
