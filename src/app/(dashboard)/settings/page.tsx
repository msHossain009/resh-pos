"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";
import { useTheme } from "next-themes";
import { Moon, Sun, Save } from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [business, setBusiness] = useState({
    name: APP_NAME,
    tagline: "SCENT YOUR WAY TO UNFORGETTABLE",
    taxRate: "5",
    currency: "BDT",
    receiptFooter: "Thank you for choosing Resh Perfumes!",
  });

  useEffect(() => { setMounted(true); }, []);

  const handleSave = () => {
    localStorage.setItem("resh-pos-settings", JSON.stringify(business));
    toast.success("Settings saved");
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your business preferences.</p>
      </div>

      {/* Business Info */}
      <Card>
        <CardHeader><CardTitle>Business Information</CardTitle><CardDescription>Details shown on receipts and reports.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
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
            <Input value={business.receiptFooter} onChange={(e) => setBusiness({ ...business, receiptFooter: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Tax */}
      <Card>
        <CardHeader><CardTitle>Tax Settings</CardTitle><CardDescription>Default tax rate for sales.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input type="number" step="0.1" value={business.taxRate} onChange={(e) => setBusiness({ ...business, taxRate: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Toggle between light and dark mode.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
              className="gap-2"
            >
              <Sun className="h-4 w-4" /> Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
              className="gap-2"
            >
              <Moon className="h-4 w-4" /> Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button variant="gold" className="gap-2" onClick={handleSave}>
        <Save className="h-4 w-4" /> Save Settings
      </Button>
    </div>
  );
}
