"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  Truck,
  BarChart3,
  Settings,
  Menu,
  X,
  Receipt,
  FileText,
  Undo2,
  Shield,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/products", icon: Package, label: "Products" },
  { href: "/inventory", icon: Warehouse, label: "Inventory" },
  { href: "/sales", icon: ShoppingCart, label: "Sales" },
  { href: "/invoices", icon: FileText, label: "Invoices" },
  { href: "/stock-returns", icon: Undo2, label: "Returns" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/expenses", icon: Receipt, label: "Expenses" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/admin/users", icon: Shield, label: "Admin" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-md bg-sidebar text-sidebar-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-accent/20">
          <Link href="/" className="flex items-center" onClick={() => setOpen(false)}>
            <Image
              src="/resh-logo.png"
              alt="Resh Logo"
              width={110}
              height={36}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-accent/20">
          <p className="text-xs text-sidebar-foreground/40 text-center">
            &copy; 2026 Resh Perfumes
          </p>
        </div>
      </aside>
    </>
  );
}
