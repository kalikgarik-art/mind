/* ============================================================
   Mind · license plans
   ------------------------------------------------------------
   Single source of truth for the purchase UI. Prepared for
   Supabase management: replace this array with a fetch from a
   `plans` table later — the shape of each item is the contract:
     { id, title, duration_days, priceUSD, badge, note, default }
   ============================================================ */
window.MIND_PLANS = [
  {
    id: "week",
    title: "1 Week",
    duration_days: 7,
    priceUSD: 2.99,
    badge: null,
    note: "Short access · 7 days",
  },
  {
    id: "month",
    title: "1 Month",
    duration_days: 30,
    priceUSD: 5.99,
    badge: "Popular",
    note: "Most chosen · 30 days",
    default: true,
  },
  {
    id: "year",
    title: "1 Year",
    duration_days: 365,
    priceUSD: 42.99,
    badge: "Best Value",
    note: "Save ~40% vs monthly",
  },
];
