/* ============================================================
   Mind · checkout — the single entry point for payments.
   ------------------------------------------------------------
   handleCheckout({ planId, paymentMethodId }) is intentionally
   abstract:

   1) If config.CHECKOUT_ENDPOINT is set, the payload is sent to
      your Supabase Edge Function / payment gateway and the
      response must contain { key: "MIND-XXXX-XXXX-XXXX" }.
      This is the production auto-issue path (webhook → insert key
      → bind to profile). See DEVELOPER_DOCS.md.

   2) If no endpoint is configured yet, the developer account can
      issue a test key locally through the RLS-protected
      issue_license_key RPC. Regular users get a clear message —
      no fake purchases are ever simulated.
   ============================================================ */
(function () {
  "use strict";

  async function handleCheckout({ planId, paymentMethodId }) {
    const cfg = window.__MIND_CONFIG__ || {};
    const { api, genKey } = window.Mind;
    const plans = window.MIND_PLANS || [];
    const methods = window.MIND_PAYMENT_METHODS || [];

    const plan = plans.find((p) => p.id === planId);
    const method = methods.find((m) => m.id === paymentMethodId);
    if (!plan) throw new Error("Choose a plan first.");
    if (!method) throw new Error("Choose a payment method first.");
    if (!api.configured) {
      throw new Error("Supabase is not configured — add your keys in assets/config.js first.");
    }

    const user = await api.me();
    if (!user) {
      throw new Error("Sign in before checkout — your key must be bound to an account.");
    }

    /* 1) Real payment provider / Edge Function */
    if (cfg.CHECKOUT_ENDPOINT) {
      const response = await fetch(cfg.CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          durationDays: plan.duration_days,
          priceUSD: plan.priceUSD,
          paymentMethodId: method.id,
          paymentProvider: method.provider,
          email: user.email,
          userId: user.id,
        }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || !payload.key) {
        throw new Error(
          (payload && payload.error) || `Payment gateway error (${response.status}).`
        );
      }
      return {
        key: payload.key,
        plan,
        method,
        mode: "provider",
        expiresAt: payload.expiresAt || null,
      };
    }

    /* 2) Gateway not deployed yet */
    if (api.isAdmin(user)) {
      const key = genKey();
      const issued = await api.issueLicenseKey(user.email, key, plan.duration_days);
      return {
        key: (issued && issued.key_code) || key,
        plan,
        method,
        mode: "developer",
        expiresAt: (issued && issued.expires_at) || null,
      };
    }

    throw new Error(
      "The payment provider is not connected yet — your key will be issued automatically right after payment goes live."
    );
  }

  window.MindCheckout = { handleCheckout };
})();
