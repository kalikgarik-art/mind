/* ============================================================
   Mind · checkout — the single entry point for payments.
   ------------------------------------------------------------
   handleCheckout({ planId, paymentMethodId, recipientUsername }):

   1) If config.CHECKOUT_ENDPOINT is set, the payload is sent to
      your Supabase Edge Function / payment gateway and the
      response must contain { key: "MIND-XXXX-XXXX-XXXX" }.
      recipientUsername (optional) marks the purchase as a GIFT
      for another @username. See DEVELOPER_DOCS.md.

   2) If no endpoint is configured yet:
      - a user WITHOUT an active license gets a real key via the
        RLS-protected issue_license_key RPC (developer mode);
      - a gift purchase (recipientUsername) is issued to the
        recipient through gift_license_key (developer mode);
      - a user WITH an active license is blocked for self-buy
        and sees a clear message (no fake purchases).
   ============================================================ */
(function () {
  "use strict";

  async function handleCheckout({ planId, paymentMethodId, recipientUsername }) {
    const cfg = window.__MIND_CONFIG__ || {};
    const { api, genKey, isActive } = window.Mind;
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

    const recipient = recipientUsername
      ? String(recipientUsername).trim().toLowerCase()
      : null;

    /* Discord is mandatory for every purchase (self or gift) */
    if (!user.discord_id) {
      throw new Error(
        "Please link your Discord account in your Profile before purchasing a license."
      );
    }

    /* Protection from a second purchase for yourself */
    if (!recipient && isActive(user)) {
      throw new Error(
        "You already have an active license. You can purchase a key as a gift for another user."
      );
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
          recipientUsername: recipient,
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
        recipient,
        mode: "provider",
        expiresAt: payload.expiresAt || null,
      };
    }

    /* 2) Gateway not deployed yet — developer-mode issuing */
    if (api.isAdmin(user)) {
      const key = genKey();
      if (recipient) {
        const gifted = await api.giftLicenseKey(recipient, key, plan.duration_days);
        return {
          key: (gifted && gifted.key_code) || key,
          plan,
          method,
          recipient,
          mode: "gift",
          expiresAt: (gifted && gifted.expires_at) || null,
        };
      }
      const issued = await api.issueLicenseKey(user.email, key, plan.duration_days);
      return {
        key: (issued && issued.key_code) || key,
        plan,
        method,
        recipient: null,
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
