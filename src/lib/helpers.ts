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
    const { data: catData, error: catError } = await supabase.from("categories").insert(
      cats.map((c) => ({ name: c })),
    ).select();
    if (catError || !catData) throw new Error("Failed to create categories: " + (catError?.message || "unknown error"));

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
        category_id: prod.category_id, active: true,
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
        };
      });
      await supabase.from("product_variants").insert(variants);
    }

    // 3. Customers
    const demoCustomers = [
      { name: "Fatima Begum", phone: "01711-111111", customer_type: "retail", loyalty_points: 150, total_spent: 12500 },
      { name: "Rahul Ahmed", phone: "01722-222222", customer_type: "wholesale", loyalty_points: 500, total_spent: 85000 },
      { name: "Nasrin Sultana", phone: "01733-333333", customer_type: "retail", loyalty_points: 75, total_spent: 5400 },
      { name: "Karim Traders", phone: "01744-444444", customer_type: "wholesale", loyalty_points: 1200, total_spent: 245000 },
      { name: "Shamim Hossain", phone: "01755-555555", customer_type: "retail", loyalty_points: 30, total_spent: 3200 },
    ];
    const { data: custData } = await supabase.from("customers").insert(demoCustomers).select();
    if (!custData) throw new Error("Failed to create customers");

    // 4. Suppliers
    const demoSup = [
      { name: "Al Haramain Perfumes", contact_person: "Mr. Khalid", phone: "01611-111111", email: "info@haramain.com" },
      { name: "Ajmal Perfumes", contact_person: "Mr. Rashid", phone: "01622-222222", email: "info@ajmal.com" },
      { name: "Swiss Arabian", contact_person: "Mr. Hassan", phone: "01633-333333", email: "info@swissarabian.com" },
    ];
    const { data: supData } = await supabase.from("suppliers").insert(demoSup).select();
    if (!supData) throw new Error("Failed to create suppliers");

    // 5. Expenses
    const today = new Date().toISOString().split("T")[0];
    const demoExpenses = [
      { description: "[Demo] Shop rent", amount: 35000, category: "Rent", date: today, payment_method: "Cash", created_by: userId },
      { description: "[Demo] Staff salaries", amount: 45000, category: "Salary", date: today, payment_method: "Bank Transfer", created_by: userId },
      { description: "[Demo] Facebook ads", amount: 5000, category: "Marketing", date: today, payment_method: "bKash", created_by: userId },
      { description: "[Demo] Packaging supplies", amount: 3200, category: "Packaging", date: today, payment_method: "Cash", created_by: userId },
      { description: "[Demo] Delivery fees", amount: 1800, category: "Delivery", date: today, payment_method: "Nagad", created_by: userId },
      { description: "[Demo] Electricity bill", amount: 4200, category: "Utility", date: today, payment_method: "bKash", created_by: userId },
    ];
    await supabase.from("expenses").insert(demoExpenses);

    // 6. Fetch demo variants for later use — match by product names
    const prodNames = demoProducts.map(p => p.name);
    const { data: createdProds } = await supabase.from("products").select("id").in("name", prodNames);
    const createdProdIds = (createdProds || []).map(p => p.id);
    if (createdProdIds.length === 0) throw new Error("No demo products found");

    const { data: allVariants } = await supabase
      .from("product_variants")
      .select("*, products!inner(name, category)")
      .in("product_id", createdProdIds);
    if (!allVariants || allVariants.length === 0) throw new Error("No demo variants found");

    // 7. Demo Purchase Orders
    const retailCust = custData.filter((c) => c.customer_type === "retail");
    const wsCust = custData.filter((c) => c.customer_type === "wholesale");
    const poDates = [
      new Date(Date.now() - 14 * 86400000).toISOString(),
      new Date(Date.now() - 7 * 86400000).toISOString(),
      new Date(Date.now() - 3 * 86400000).toISOString(),
    ];

    for (let pi = 0; pi < supData.length; pi++) {
      const supplier = supData[pi];
      const poVariants = allVariants.slice(pi * 10, pi * 10 + 8);
      if (poVariants.length === 0) continue;

      const poItems = poVariants.map((v) => ({
        variant_id: v.id,
        quantity: Math.floor(Math.random() * 20) + 5,
        unit_cost: Number(v.cost) || 50,
        received_quantity: pi < 2 ? Math.floor(Math.random() * 10) + 3 : 0,
      }));

      const poTotal = poItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const isReceived = pi < 2;

      const { data: po } = await supabase.from("purchase_orders").insert({
        supplier_id: supplier.id,
        status: isReceived ? "Received" : "Pending",
        total_amount: poTotal,
        notes: `Demo PO for ${supplier.name}`,
        created_by: userId,
        created_at: poDates[pi] || new Date().toISOString(),
      }).select().single();
      if (!po) continue;

      await supabase.from("purchase_order_items").insert(
        poItems.map((i) => ({ ...i, po_id: po.id }))
      );

      // Record stock movements for received items
      if (isReceived) {
        for (const item of poItems) {
          const v = poVariants.find((pv) => pv.id === item.variant_id);
          if (!v) continue;
          const receiveMl = item.received_quantity * (v.size_ml || 0);
          await supabase.from("stock_movements").insert({
            variant_id: item.variant_id,
            type: "purchase_receive",
            quantity_change: item.received_quantity,
            previous_quantity: Math.round((v.stock_ml || 0) - receiveMl),
            new_quantity: Math.round(v.stock_ml || 0),
            perfume_ml_change: receiveMl,
            bottle_qty_change: item.received_quantity,
            previous_perfume_ml: (v.stock_ml || 0) - receiveMl,
            new_perfume_ml: v.stock_ml || 0,
            previous_bottle_qty: (v.bottle_stock_qty || 0) - item.received_quantity,
            new_bottle_qty: v.bottle_stock_qty || 0,
            reason: `PO ${po.po_number} receive (demo)`,
            reference_type: "purchase_order",
            reference_id: po.id,
            created_by: userId,
            created_at: poDates[pi],
          });

          // Update variant stock
          const newMl = (v.stock_ml || 0) + receiveMl;
          const newBottle = (v.bottle_stock_qty || 0) + item.received_quantity;
          await supabase.from("product_variants").update({
            stock_ml: newMl,
            stock_quantity: Math.round(newMl),
            bottle_stock_qty: newBottle,
          }).eq("id", item.variant_id);
          v.stock_ml = newMl;
          v.bottle_stock_qty = newBottle;
        }
      }
    }

    // 8. Demo Sales with items
    const saleDates = [
      new Date(Date.now() - 10 * 86400000).toISOString(),
      new Date(Date.now() - 8 * 86400000).toISOString(),
      new Date(Date.now() - 5 * 86400000).toISOString(),
      new Date(Date.now() - 3 * 86400000).toISOString(),
      new Date(Date.now() - 1 * 86400000).toISOString(),
      new Date().toISOString(),
    ];

    const paymentMethods = ["Cash", "bKash", "Nagad", "Card"] as const;
    const allDemoSales: { sale: { id: string; invoice_no: string; total: number }; items: { variant_id: string; quantity: number; perfume_ml: number; bottle_qty: number }[] }[] = [];

    for (let si = 0; si < 6; si++) {
      const isRetail = si < 4;
      const customer = si < 3 ? retailCust[si % retailCust.length] : (si < 5 ? wsCust[si % wsCust.length] : null);
      const saleVariants = allVariants.slice((si * 3) % allVariants.length, ((si * 3 + 4) % allVariants.length) || allVariants.length);
      if (saleVariants.length === 0) continue;

      const items = saleVariants.map((v) => {
        const qty = Math.floor(Math.random() * 2) + 1;
        const mlUsed = isRetail ? qty * (v.size_ml || 0) : Math.floor(Math.random() * 50) + 10;
        const bottleUsed = isRetail ? qty : Math.ceil(mlUsed / (v.size_ml || 1));
        const unitPrice = isRetail ? (v.retail_price ?? v.price ?? 0) : (v.wholesale_price_per_ml ?? 0);
        const unitCost = isRetail ? (v.retail_cost ?? v.cost ?? 0) : (v.wholesale_cost_per_ml ?? 0);
        const lineTotal = isRetail ? qty * unitPrice : mlUsed * unitPrice;
        const lineCost = isRetail ? qty * unitCost : mlUsed * unitCost;
        return {
          variant_id: v.id,
          quantity: isRetail ? qty : Math.ceil(mlUsed / (v.size_ml || 1)),
          unit_price: unitPrice,
          unit_cost: unitCost,
          line_cost: lineCost,
          line_profit: lineTotal - lineCost,
          subtotal: lineTotal,
          perfume_ml_sold: mlUsed,
          bottle_qty_sold: bottleUsed,
          product_name_snapshot: (v as unknown as { products?: { name: string } }).products?.name || "Demo Product",
          variant_size_ml_snapshot: v.size_ml || 0,
          wholesale_ml_sold: isRetail ? 0 : mlUsed,
        };
      });

      const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
      const discount = si === 3 ? Math.round(subtotal * 0.05) : 0;
      const total = subtotal - discount;
      const isPartial = si === 2;

      const { data: sale } = await supabase.from("sales").insert({
        customer_id: customer?.id || null,
        subtotal,
        discount,
        total,
        payment_method: paymentMethods[si % paymentMethods.length],
        payment_status: isPartial ? "Partial" : "Paid",
        order_type: si < 3 ? "Offline" : "Online",
        sale_type: isRetail ? "retail" : "wholesale",
        paid_amount: isPartial ? Math.round(total * 0.5) : total,
        due_amount: isPartial ? Math.round(total * 0.5) : 0,
        notes: `Demo sale #${si + 1}`,
        created_by: userId,
        created_at: saleDates[si],
      }).select().single();
      if (!sale) continue;

      await supabase.from("sale_items").insert(
        items.map((i) => ({ ...i, sale_id: sale.id }))
      );

      allDemoSales.push({
        sale: { id: sale.id, invoice_no: sale.invoice_no, total: sale.total },
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity, perfume_ml: i.perfume_ml_sold, bottle_qty: i.bottle_qty_sold })),
      });

      // Stock movements + deductions for each sale
      for (const item of items) {
        const v = allVariants.find((av) => av.id === item.variant_id);
        if (!v) continue;

        const prevMl = v.stock_ml || 0;
        const newMl = Math.max(0, prevMl - item.perfume_ml_sold);
        const prevBottle = v.bottle_stock_qty || 0;
        const newBottle = Math.max(0, prevBottle - item.bottle_qty_sold);

        await supabase.from("product_variants").update({
          stock_ml: newMl,
          stock_quantity: Math.round(newMl),
          bottle_stock_qty: newBottle,
        }).eq("id", item.variant_id);

        // Update in-memory variant for subsequent sales
        v.stock_ml = newMl;
        v.bottle_stock_qty = newBottle;

        await supabase.from("stock_movements").insert({
          variant_id: item.variant_id,
          type: "sale",
          quantity_change: -item.quantity,
          previous_quantity: Math.round(prevMl),
          new_quantity: Math.round(newMl),
          perfume_ml_change: -item.perfume_ml_sold,
          bottle_qty_change: -item.bottle_qty_sold,
          previous_perfume_ml: prevMl,
          new_perfume_ml: newMl,
          previous_bottle_qty: prevBottle,
          new_bottle_qty: newBottle,
          reason: `Sale ${sale.invoice_no} (demo)`,
          reference_type: "sale",
          reference_id: sale.id,
          created_by: userId,
          created_at: saleDates[si],
        });
      }

      // Loyalty points for retail customers
      if (customer && isRetail) {
        const earnPoints = Math.floor(total / 100);
        await supabase.from("customers").update({
          loyalty_points: (customer.loyalty_points || 0) + earnPoints,
          total_spent: (customer.total_spent || 0) + total,
        }).eq("id", customer.id);

        await supabase.from("loyalty_transactions").insert({
          customer_id: customer.id,
          points: earnPoints,
          type: "earn",
          reference_type: "sale",
          reference_id: sale.id,
          description: `Points earned on sale ${sale.invoice_no} (demo)`,
          created_at: saleDates[si],
        });
      }
    }

    return { success: true, message: `Demo data added: 7 products (35 variants), 5 customers, 3 suppliers, 6 expenses, ${supData.length} purchase orders, ${allDemoSales.length} sales` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: msg };
  }
}

/** Remove all demo data safely using known names/patterns (no is_demo column dependency) */
export async function removeDemoData(): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  try {
    const demoProdNames = ["Rose Oud", "Musk Al Tahara", "Black Opium", "Santal 33", "Oud Wood", "Aqua Di Gio", "Mystic Oud"];
    const demoCatNames = ["Floral", "Oriental", "Woody", "Fresh", "Oud", "Citrus"];
    const demoCustPhones = ["01711-111111", "01722-222222", "01733-333333", "01744-444444", "01755-555555"];
    const demoSupNames = ["Al Haramain Perfumes", "Ajmal Perfumes", "Swiss Arabian"];
    const demoExpDescPrefix = "[Demo]";

    // 1. Collect IDs by known patterns
    const { data: products } = await supabase.from("products").select("id, category_id").in("name", demoProdNames);
    const prodIds = (products || []).map(p => p.id);
    const catIds = [...new Set((products || []).map(p => p.category_id).filter(Boolean))];
    const { data: variants } = prodIds.length > 0 ? await supabase.from("product_variants").select("id").in("product_id", prodIds) : { data: [] };
    const varIds = (variants || []).map(v => v.id);
    const { data: customers } = await supabase.from("customers").select("id").in("phone", demoCustPhones);
    const custIds = (customers || []).map(c => c.id);
    const { data: suppliers } = await supabase.from("suppliers").select("id").in("name", demoSupNames);
    const supIds = (suppliers || []).map(s => s.id);
    const { data: categories } = await supabase.from("categories").select("id").in("name", demoCatNames);
    const allCatIds = [...new Set([...catIds, ...(categories || []).map(c => c.id)])];

    // 2. Collect sales linked to demo customers or demo variants
    let saleIds: string[] = [];
    if (custIds.length > 0) {
      const { data: salesByCust } = await supabase.from("sales").select("id").in("customer_id", custIds);
      saleIds = (salesByCust || []).map(s => s.id);
    }
    if (varIds.length > 0) {
      const { data: salesByVar } = await supabase.from("sale_items").select("sale_id").in("variant_id", varIds);
      const moreIds = [...new Set((salesByVar || []).map(s => s.sale_id).filter(Boolean))];
      saleIds = [...new Set([...saleIds, ...moreIds])];
    }

    // 3. Collect POs linked to demo suppliers
    let poIds: string[] = [];
    if (supIds.length > 0) {
      const { data: pos } = await supabase.from("purchase_orders").select("id").in("supplier_id", supIds);
      poIds = (pos || []).map(p => p.id);
    }

    // 4. Collect expenses by description prefix
    const { data: expenses } = await supabase.from("expenses").select("id").ilike("description", `${demoExpDescPrefix}%`);
    const expIds = (expenses || []).map(e => e.id);

    // 5. Collect loyalty transactions linked to demo customers
    let loyaltyIds: string[] = [];
    if (custIds.length > 0) {
      const { data: loyalty } = await supabase.from("loyalty_transactions").select("id").in("customer_id", custIds);
      loyaltyIds = (loyalty || []).map(l => l.id);
    }
    // Also collect by reference to demo sales
    if (saleIds.length > 0) {
      const { data: loyaltyBySale } = await supabase.from("loyalty_transactions").select("id").in("reference_id", saleIds);
      const moreLoyalty = (loyaltyBySale || []).map(l => l.id);
      loyaltyIds = [...new Set([...loyaltyIds, ...moreLoyalty])];
    }

    // 6. Collect stock movements linked to demo variants, sales, or POs
    let stockIds: string[] = [];
    if (varIds.length > 0) {
      const { data: sm } = await supabase.from("stock_movements").select("id").in("variant_id", varIds);
      stockIds = (sm || []).map(s => s.id);
    }
    if (saleIds.length > 0) {
      const { data: smBySale } = await supabase.from("stock_movements").select("id").in("reference_id", saleIds).eq("reference_type", "sale");
      const moreSm = (smBySale || []).map(s => s.id);
      stockIds = [...new Set([...stockIds, ...moreSm])];
    }
    if (poIds.length > 0) {
      const { data: smByPO } = await supabase.from("stock_movements").select("id").in("reference_id", poIds).eq("reference_type", "purchase_order");
      const moreSm = (smByPO || []).map(s => s.id);
      stockIds = [...new Set([...stockIds, ...moreSm])];
    }

    // 7. Delete in FK-safe order
    if (stockIds.length > 0) await supabase.from("stock_movements").delete().in("id", stockIds);
    if (loyaltyIds.length > 0) await supabase.from("loyalty_transactions").delete().in("id", loyaltyIds);
    if (saleIds.length > 0) {
      await supabase.from("sale_items").delete().in("sale_id", saleIds);
      await supabase.from("sales").delete().in("id", saleIds);
    }
    if (poIds.length > 0) {
      await supabase.from("purchase_order_items").delete().in("po_id", poIds);
      await supabase.from("purchase_orders").delete().in("id", poIds);
    }
    if (expIds.length > 0) await supabase.from("expenses").delete().in("id", expIds);
    if (varIds.length > 0) await supabase.from("product_variants").delete().in("id", varIds);
    if (prodIds.length > 0) await supabase.from("products").delete().in("id", prodIds);
    if (custIds.length > 0) await supabase.from("customers").delete().in("id", custIds);
    if (supIds.length > 0) await supabase.from("suppliers").delete().in("id", supIds);
    if (allCatIds.length > 0) await supabase.from("categories").delete().in("id", allCatIds);

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
