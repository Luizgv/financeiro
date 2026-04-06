/**
 * Global categories seeded once per database (householdId null).
 */
export const PREDEFINED_CATEGORIES = [
  { name: "Renda fixa", slug: "income-fixed", icon: "wallet", color: "#22c55e" },
  { name: "Transporte", slug: "transport", icon: "car", color: "#3b82f6" },
  { name: "Pets", slug: "pets", icon: "paw", color: "#f97316" },
  { name: "Alimentação", slug: "food", icon: "utensils", color: "#eab308" },
  { name: "Moradia", slug: "housing", icon: "home", color: "#a855f7" },
  {
    name: "Apartamento",
    slug: "apartamento",
    icon: "building-2",
    color: "#0d9488",
  },
  { name: "Contas", slug: "utilities", icon: "bolt", color: "#06b6d4" },
  { name: "Saúde", slug: "health", icon: "heart-pulse", color: "#ef4444" },
  {
    name: "Cuidados pessoais",
    slug: "personal-care",
    icon: "sparkles",
    color: "#db2777",
  },
  { name: "Lazer", slug: "entertainment", icon: "film", color: "#ec4899" },
  { name: "Compras", slug: "shopping", icon: "shopping-bag", color: "#6366f1" },
  { name: "Casa", slug: "casa", icon: "lamp", color: "#c2410c" },
  { name: "Educação", slug: "education", icon: "book", color: "#14b8a6" },
  { name: "Outros", slug: "other", icon: "circle", color: "#64748b" },
] as const;
