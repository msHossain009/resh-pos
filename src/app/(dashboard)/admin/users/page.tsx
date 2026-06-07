"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { can } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import { Shield, Loader2, Save, X } from "lucide-react";
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
  const supabase = createClient();

  useEffect(() => {
    (async () => {
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
    })();
  }, [supabase]);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">Manage user roles and permissions.</p>
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
                        {editingId === user.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="gold" className="gap-1" onClick={() => handleSaveRole(user.id)} disabled={savingId === user.id}>
                              {savingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingId(user.id); setEditRole(user.role); }}
                            disabled={user.id === currentProfile?.id}
                          >
                            Change Role
                          </Button>
                        )}
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
    </div>
  );
}
