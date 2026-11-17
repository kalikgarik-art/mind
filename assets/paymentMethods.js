/* ============================================================
   Mind · payment methods
   ------------------------------------------------------------
   Prepared for Supabase management: later load these rows from a
   `payment_methods` table (id, title, brands, provider, enabled).
   `provider` is the value sent to handleCheckout() so a backend
   can route to the right gateway.
   ============================================================ */
window.MIND_PAYMENT_METHODS = [
  {
    id: "cards_ru",
    title: "Cards (RU)",
    brands: "МИР · СБП",
    icon: "credit-card",
    provider: "yookassa",
  },
  {
    id: "cards_global",
    title: "Global Cards",
    brands: "VISA · Mastercard",
    icon: "globe",
    provider: "stripe",
  },
  {
    id: "crypto",
    title: "Crypto",
    brands: "USDT · TON · BTC",
    icon: "bitcoin",
    provider: "cryptopay",
  },
];
