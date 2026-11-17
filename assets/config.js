/* ============================================================
   Mind · site config
   ------------------------------------------------------------
   HOW TO GO LIVE:
   1) Create a free project → https://supabase.com
   2) Project Settings → API → copy "Project URL" and
      the anon/publishable key
   3) Paste them below and save. The site intentionally refuses
      authentication until real Supabase credentials are configured.

   OPTIONAL — auto key issuing after payment:
   Set CHECKOUT_ENDPOINT to your Supabase Edge Function URL
   (see DEVELOPER_DOCS.md → "Architecture of auto-issuing keys").
   While it is empty, checkout falls back to developer-mode issuing
   and regular users see a clear "provider not connected" notice.
   ============================================================ */
window.__MIND_CONFIG__ = {
  SUPABASE_URL: "https://pfmiafdsbiaszmbmbsgd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Cemb2DdskUpgRBlkL7Og6w_HUS4-2EH",

  /* Developer account — gets the admin panel automatically */
  OWNER_EMAIL: "kalikgarik@mail.ru",

  /* Supabase Edge Function / payment gateway endpoint (optional) */
  CHECKOUT_ENDPOINT: "",
};