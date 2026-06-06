import { createClient } from "./supabase/client";
import type { BusinessSettings, UserProfile } from "./types";

export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .single();
  return data;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Add demo data to the system. Returns number of records added. */
export async function addDemoData(): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const userId = user.id;

  try {
    // 1. Categories
    const cats = ["Floral", "Oriental", "Woody", "Fresh", "Oud", "Citrus"];
    const { data: catData } = await supabase.from("categories").insert(
      cats.map((c) => ({ name: c })),
    ).select();
    if (!catData) throw new Error("Failed to create categories");

    // 2. Products with variants
    const demoProducts = [
      { name: "Rose Oud", description: "A luxurious blend of rose and oud", category_id: catData.find(c => c.name === "Floral")?.id || null, category: "Floral" },
      { name: "Musk Al Tahara", description: "Pure white musk fragrance", category_id: catData.find(c => c.name === "Fresh")?.id || null, category: "Fresh" },
      { name: "Black Opium", description: "Intense oriental vanilla coffee", category_id: catData.find(c => c.name === "Oriental")?.id || null, category: "Oriental" },
      { name: "Santal 33", description: "Sandlewood and cedar masterpiece", category_id: catData.find(c => c.name === "Woody")?.id || null, category: "Woody" },
      { name: "Oud Wood", description: "Premium agarwood oil", category_id: catData.find(c => c.name === "Oud")?.id || null, category: "Oud" },
      { name: "Aqua Di Gio", description: "Fresh aquatic citrus", category_id: catData.find(c => c.name === "Citrus")?.id || null, category: "Citrus" },
      { name: "Mystic Oud", description: "Dark resinous oud with spice", category_id: catData.find(c => c.name === "Oud")?.id || null, category: "Oud" },
    ];

    const sizes = [6, 15, 30, 50, 100];
    const concentrations = ["EDP", "EDT", "Parfum", "EDP", "Extrait"];

    for (const prod of demoProducts) {
      const { data: newProd } = await supabase.from("products").insert({
        name: prod.name, description: prod.description, category: prod.category,
        category_id: prod.category_id, active: true, status: "active", is_demo: true,
      }).select().single();
      if (!newProd) continue;

      const variants = sizes.map((size, idx) => {
        const basePrice = 300 + Math.floor(Math.random() * 700);
        const multiplier = size / 50;
        const wholesalePerMl = parseFloat(((basePrice / 50) * 0.7).toFixed(2));
        return {
          product_id: newProd.id,
          size_ml: size,
          concentration: concentrations[idx % concentrations.length],
          price: Math.round(basePrice * multiplier),
          cost: Math.round(basePrice * 0.5 * multiplier),
          retail_price: Math.round(basePrice * multiplier),
          retail_cost: Math.round(basePrice * 0.5 * multiplier),
          wholesale_price_per_ml: wholesalePerMl,
          wholesale_cost_per_ml: parseFloat((wholesalePerMl * 0.7).toFixed(2)),
          stock_ml: Math.floor(Math.random() * 500) + 50,
          stock_quantity: Math.floor(Math.random() * 500) + 50,
          bottle_stock_qty: Math.floor(Math.random() * 30) + 5,
          low_stock_ml_threshold: 100,
          low_bottle_threshold: 10,
          sku: `${prod.name.substring(0, 3).toUpperCase()}-${size}ml`,
          barcode: `DEMO${String(Math.floor(100000 + Math.random() * 900000))}`,
          active: true,
          status: "active",
          is_demo: true,
        };
      });
      await supabase.from("product_variants").insert(variants);
    }

    // 3. Customers
    const demoCustomers = [
      { name: "Fatima Begum", phone: "01711-111111", customer_type: "retail", loyalty_points: 150, total_spent: 12500, is_demo: true },
      { name: "Rahul Ahmed", phone: "01722-222222", customer_type: "wholesale", loyalty_points: 500, total_spent: 85000, is_demo: true },
      { name: "Nasrin Sultana", phone: "01733-333333", customer_type: "retail", loyalty_points: 75, total_spent: 5400, is_demo: true },
      { name: "Karim Traders", phone: "01744-444444", customer_type: "wholesale", loyalty_points: 1200, total_spent: 245000, is_demo: true },
      { name: "Shamim Hossain", phone: "01755-555555", customer_type: "retail", loyalty_points: 30, total_spent: 3200, is_demo: true },
    ];
    await supabase.from("customers").insert(demoCustomers);

    // 4. Suppliers
    const demoSup = [
      { name: "Al Haramain Perfumes", contact_person: "Mr. Khalid", phone: "01611-111111", email: "info@haramain.com", is_demo: true },
      { name: "Ajmal Perfumes", contact_person: "Mr. Rashid", phone: "01622-222222", email: "info@ajmal.com", is_demo: true },
      { name: "Swiss Arabian", contact_person: "Mr. Hassan", phone: "01633-333333", email: "info@swissarabian.com", is_demo: true },
    ];
    await supabase.from("suppliers").insert(demoSup);

    // 5. Expenses
    const today = new Date().toISOString().split("T")[0];
    const demoExpenses = [
      { description: "Shop rent - May 2026", amount: 35000, category: "Rent", date: today, payment_method: "Cash", is_demo: true, created_by: userId },
      { description: "Staff salaries - May 2026", amount: 45000, category: "Salary", date: today, payment_method: "Bank Transfer", is_demo: true, created_by: userId },
      { description: "Facebook ads campaign", amount: 5000, category: "Marketing", date: today, payment_method: "bKash", is_demo: true, created_by: userId },
      { description: "Packaging supplies", amount: 3200, category: "Packaging", date: today, payment_method: "Cash", is_demo: true, created_by: userId },
      { description: "Delivery fees", amount: 1800, category: "Delivery", date: today, payment_method: "Nagad", is_demo: true, created_by: userId },
      { description: "Electricity bill", amount: 4200, category: "Utility", date: today, payment_method: "bKash", is_demo: true, created_by: userId },
    ];
    await supabase.from("expenses").insert(demoExpenses);

    return { success: true, message: "Demo data added: 7 products (35 variants), 5 customers, 3 suppliers, 6 expenses" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: msg };
  }
}

/** Remove all demo data safely (only records with is_demo = true) */
export async function removeDemoData(): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  try {
    const tables = ["sale_items", "sales", "expenses", "purchase_order_items", "purchase_orders", "product_variants", "products", "customers", "suppliers", "categories"];
    for (const table of tables) {
      await supabase.from(table as never).delete().eq("is_demo", true);
    }
    return { success: true, message: "All demo data removed successfully" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: msg };
  }
}

/** Check if a role has permission for an action */
export function can(role: string | undefined, action: "create" | "edit" | "delete" | "view_reports" | "manage_settings"): boolean {
  switch (action) {
    case "create":
      return role === "admin" || role === "manager" || role === "cashier";
    case "edit":
      return role === "admin" || role === "manager";
    case "delete":
      return role === "admin";
    case "view_reports":
      return role === "admin" || role === "manager";
    case "manage_settings":
      return role === "admin";
    default:
      return false;
  }
}
