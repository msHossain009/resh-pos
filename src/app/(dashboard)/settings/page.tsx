"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { useTheme } from "next-themes";
import { can, addDemoData, removeDemoData } from "@/lib/helpers";
import { useProfile } from "@/lib/profile-context";
import { Moon, Sun, Save, Download, Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const [business, setBusiness] = useState({
    business_name: APP_NAME,
    tagline: "SCENT YOUR WAY TO UNFORGETTABLE",
    tax_rate: "5",
    currency: "BDT",
    receipt_footer: "Thank you for choosing Resh Perfumes!",
    default_low_perfume_threshold: "100",
    default_low_bottle_threshold: "10",
  });

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("business_settings")
          .select("*")
          .limit(1)
          .single();
        if (data && !error) {
          setBusiness({
            business_name: data.business_name || APP_NAME,
            tagline: data.tagline || "SCENT YOUR WAY TO UNFORGETTABLE",
            tax_rate: String(data.tax_rate || 5),
            currency: data.currency || "BDT",
            receipt_footer: data.receipt_footer || "Thank you for choosing Resh Perfumes!",
            default_low_perfume_threshold: String(data.default_low_perfume_threshold ?? 100),
            default_low_bottle_threshold: String(data.default_low_bottle_threshold ?? 10),
          });
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("business_settings")
        .select("id")
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("business_settings")
          .update({
            business_name: business.business_name,
            tagline: business.tagline,
            currency: business.currency,
            tax_rate: parseFloat(business.tax_rate) || 5,
            receipt_footer: business.receipt_footer,
            default_low_perfume_threshold: parseFloat(business.default_low_perfume_threshold) || 100,
            default_low_bottle_threshold: parseInt(business.default_low_bottle_threshold) || 10,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_settings")
          .insert({
            business_name: business.business_name,
            tagline: business.tagline,
            currency: business.currency,
            tax_rate: parseFloat(business.tax_rate) || 5,
            receipt_footer: business.receipt_footer,
            default_low_perfume_threshold: parseFloat(business.default_low_perfume_threshold) || 100,
            default_low_bottle_threshold: parseInt(business.default_low_bottle_threshold) || 10,
          });
        if (error) throw error;
      }
      toast.success("Settings saved to database");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(business, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "resh-pos-settings.json";
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Settings exported");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your business preferences.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Business Information</CardTitle><CardDescription>Details shown on receipts and reports.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={business.business_name} onChange={(e) => setBusiness({ ...business, business_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={business.currency} onChange={(e) => setBusiness({ ...business, currency: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input value={business.tagline} onChange={(e) => setBusiness({ ...business, tagline: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Receipt Footer</Label>
            <Input value={business.receipt_footer} onChange={(e) => setBusiness({ ...business, receipt_footer: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tax Settings</CardTitle><CardDescription>Default tax rate for sales.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input type="number" step="0.1" value={business.tax_rate} onChange={(e) => setBusiness({ ...business, tax_rate: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stock Defaults</CardTitle><CardDescription>Default thresholds for low stock alerts on new variants.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Low Perfume Threshold (ml)</Label>
              <Input type="number" min={0} value={business.default_low_perfume_threshold} onChange={(e) => setBusiness({ ...business, default_low_perfume_threshold: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Default Low Bottle Threshold</Label>
              <Input type="number" min={0} value={business.default_low_bottle_threshold} onChange={(e) => setBusiness({ ...business, default_low_bottle_threshold: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Toggle between light and dark mode.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")} className="gap-2">
              <Sun className="h-4 w-4" /> Light
            </Button>
            <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")} className="gap-2">
              <Moon className="h-4 w-4" /> Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Demo Data */}
      {can(profile?.role, "manage_settings") && (
        <Card>
          <CardHeader><CardTitle>Demo Data</CardTitle>
            <CardDescription>Add sample data for testing and visualization. Safely removable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add sample products (5-7 with variants), customers, suppliers, and expenses to test the app.
              Demo records are marked with <code>is_demo = true</code> and can be safely removed.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={async () => {
                const btn = document.activeElement as HTMLButtonElement;
                btn.disabled = true;
                btn.innerHTML = 'Adding...';
                const result = await addDemoData();
                if (result.success) {
                  toast.success(result.message);
                } else {
                  toast.error(result.message);
                }
                btn.disabled = false;
                btn.innerHTML = '<svg class="h-4 w-4" ...>Add Demo Data';
              }}>
                <Plus className="h-4 w-4" /> Add Demo Data
              </Button>
              <Button variant="gold" className="gap-2" onClick={async () => {
                if (!confirm("Reset all demo data? This will remove and re-add all demo records.")) return;
                const btn = document.activeElement as HTMLButtonElement;
                btn.disabled = true;
                btn.innerHTML = 'Resetting...';
                const remove = await removeDemoData();
                if (!remove.success) {
                  toast.error("Failed to remove existing demo data: " + remove.message);
                  btn.disabled = false;
                  btn.innerHTML = 'Reset Demo Data';
                  return;
                }
                const add = await addDemoData();
                if (add.success) {
                  toast.success("Demo data reset successfully: " + add.message);
                } else {
                  toast.error("Failed to add demo data: " + add.message);
                }
                btn.disabled = false;
              }}>
                <RefreshCw className="h-4 w-4" /> Reset Demo Data
              </Button>
              <Button variant="destructive" className="gap-2" onClick={async () => {
                if (!confirm("Remove ALL demo data? This will delete all records marked as demo data.")) return;
                const btn = document.activeElement as HTMLButtonElement;
                btn.disabled = true;
                const result = await removeDemoData();
                if (result.success) {
                  toast.success(result.message);
                } else {
                  toast.error(result.message);
                }
                btn.disabled = false;
              }}>
                <Trash2 className="h-4 w-4" /> Remove Demo Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {can(profile?.role, "manage_settings") && (
          <Button variant="gold" className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        )}
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>
    </div>
  );
}
