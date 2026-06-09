"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import { Shield, Loader2, Save, X, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import type { UserProfile } from "@/lib/types";

const roleOptions: { value: UserProfile["role"]; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "viewer", label: "Viewer" },
];

const roleBadgeVariant: Record<string, "default" | "gold" | "secondary" | "outline"> = {
  admin: "gold",
  manager: "default",
  cashier: "secondary",
  viewer: "outline",
};

export default function AdminUsersPage() {
  const { profile: currentProfile } = useProfile();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserProfile["role"]>("cashier");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", password: "", full_name: "", role: "cashier" as UserProfile["role"] });
  const [adding, setAdding] = useState(false);
  const supabase = createClient();

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load users");
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSaveRole = async (userId: string) => {
    setSavingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: editRole })
      .eq("id", userId);
    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: editRole } : u)));
      toast.success("Role updated");
    }
    setSavingId(null);
    setEditingId(null);
  };

  const handleToggleActive = async (user: UserProfile) => {
    const newActive = !user.active;
    const { error } = await supabase
      .from("profiles")
      .update({ active: newActive })
      .eq("id", user.id);
    if (error) {
      toast.error("Failed to toggle status: " + error.message);
    } else {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active: newActive } : u)));
      toast.success(newActive ? "User activated" : "User deactivated");
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Delete user "${user.full_name || user.email}" permanently? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to delete user"); return; }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("User deleted");
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  const handleAddUser = async () => {
    if (!addForm.email || !addForm.password || !addForm.full_name) {
      toast.error("All fields are required"); return;
    }
    if (addForm.password.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create user"); setAdding(false); return; }
      toast.success("User created");
      setShowAddDialog(false);
      setAddForm({ email: "", password: "", full_name: "", role: "cashier" });
      loadUsers();
    } catch (err) {
      toast.error("Failed to create user");
    } finally {
      setAdding(false);
    }
  };

  const isAdmin = can(currentProfile?.role, "manage_settings");

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">You don&apos;t have permission to manage users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage user roles and permissions.</p>
        </div>
        <Button variant="gold" onClick={() => { setAddForm({ email: "", password: "", full_name: "", role: "cashier" }); setShowAddDialog(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{users.length} user{users.length !== 1 ? "s" : ""} registered</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-accent/5">
                      <td className="px-4 py-3">{user.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email || "—"}</td>
                      <td className="px-4 py-3">
                        {editingId === user.id ? (
                          <Select value={editRole} onValueChange={(v) => setEditRole(v as UserProfile["role"])}>
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={roleBadgeVariant[user.role] || "secondary"}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.active ? "success" : "destructive"}>
                          {user.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {editingId === user.id ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="gold" className="gap-1" onClick={() => handleSaveRole(user.id)} disabled={savingId === user.id}>
                                {savingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleToggleActive(user)} title={user.active ? "Deactivate" : "Activate"}>
                                {user.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingId(user.id); setEditRole(user.role); }} disabled={user.id === currentProfile?.id}>
                                Change Role
                              </Button>
                              {user.id !== currentProfile?.id && (
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(user)} title="Delete user">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Role Permissions</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Action</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Admin</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Manager</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Cashier</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Viewer</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { action: "Create records", a: true, m: true, c: true, v: false },
                  { action: "Edit records", a: true, m: true, c: false, v: false },
                  { action: "Delete records", a: true, m: false, c: false, v: false },
                  { action: "View reports", a: true, m: true, c: false, v: false },
                  { action: "Manage settings", a: true, m: false, c: false, v: false },
                  { action: "Manage users", a: true, m: false, c: false, v: false },
                ].map((row) => (
                  <tr key={row.action} className="border-b border-border/50">
                    <td className="px-3 py-2">{row.action}</td>
                    {[row.a, row.m, row.c, row.v].map((allowed, i) => (
                      <td key={i} className="px-3 py-2 text-center">
                        {allowed ? <span className="text-green-600 font-bold">&#10003;</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v as UserProfile["role"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="gold" onClick={handleAddUser} disabled={adding}>
              {adding ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
