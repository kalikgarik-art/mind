/* Mind · profile page + developer panel */
(async function () {
  "use strict";
  const { $, $$, api, toast, copyText, fmtDate, isActive, planText, esc } = window.Mind;
  let me = null;
  let revealed = false;

  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M20 6 9 17l-5-5"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  const WRENCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

  /* ---------------- render ---------------- */
  function paint() {
    $("#u-avatar").textContent = me.name.charAt(0).toUpperCase();
    $("#u-name").textContent = me.name;
    $("#u-email").textContent = me.email;
    const role = $("#u-role");
    if (api.isAdmin(me)) {
      role.textContent = "DEVELOPER";
      role.className = "chip chip-amber";
    } else if (isActive(me)) {
      role.textContent = "PRO";
      role.className = "chip chip-green";
    } else {
      role.textContent = "FREE";
      role.className = "chip chip-dim";
    }

    const active = isActive(me);
    $("#sub-dot").className = "h-2 w-2 rounded-full " + (active ? "anim-pulse-dot bg-emerald-400" : "bg-rose-400");
    $("#sub-status").textContent = active ? "Active" : "Inactive";
    $("#sub-status").className = "text-lg font-extrabold " + (active ? "text-emerald-300" : "text-rose-300");
    $("#sub-plan").textContent = me.license_key ? planText(me) : "";
    $("#sub-exp").textContent = active
      ? me.expires_at
        ? "1 Month Access · expires " + fmtDate(me.expires_at)
        : "Lifetime access"
      : "No active subscription — buy a key to unlock.";
    const daysLeft = active && me.expires_at ? Math.max(0, Math.ceil((new Date(me.expires_at).getTime() - Date.now()) / 864e5)) : 0;
    $("#sub-bar-wrap").classList.toggle("hidden", !(active && me.expires_at));
    $("#sub-bar-wrap").classList.toggle("block", !!(active && me.expires_at));
    if (active && me.expires_at) $("#sub-bar").style.width = Math.min(100, (daysLeft / 30) * 100) + "%";
    $("#buy-btn").classList.toggle("hidden", active);

    // key
    const hasKey = !!me.license_key;
    $("#key-box").classList.toggle("hidden", !hasKey);
    $("#key-box").classList.toggle("flex", hasKey);
    $("#key-empty").classList.toggle("hidden", hasKey);
    if (hasKey) {
      $("#key-field").textContent = revealed ? me.license_key : "MIND-••••-••••-••••";
      $("#key-meta").classList.remove("hidden");
      $("#key-meta").textContent = `status: ${me.license_key && (!me.expires_at || new Date(me.expires_at) > new Date()) ? "active" : "expired"} · keep it private`;
    } else {
      $("#key-meta").classList.add("hidden");
    }

    // hwid
    const bound = !!me.hwid;
    $("#hwid-dot").className = "h-2 w-2 rounded-full " + (bound ? "anim-pulse-dot bg-emerald-400" : "bg-white/20");
    $("#hwid-val").textContent = bound ? me.hwid : "Not bound";
    $("#hwid-device").textContent = bound ? "DESKTOP-WIN11 · Windows 11 x64" : "Device binds automatically on first client launch";
    $("#hwid-reset").disabled = !bound;

    // download gating
    const dl = $("#dl-profile");
    dl.disabled = !active;
    dl.className =
      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all duration-300 " +
      (active
        ? "bg-gradient-to-r from-accent to-aqua text-white shadow-[0_12px_36px_-12px_rgba(139,92,246,0.9)] hover:brightness-110 active:scale-[0.99]"
        : "cursor-not-allowed border border-white/10 text-white/30");
    $("#dl-profile-label").textContent = active ? "Download Client" : "Locked — key required";

    // admin
    $("#admin").classList.toggle("hidden", !api.isAdmin(me));
    if (api.isAdmin(me)) loadKeys();
  }

  /* ---------------- keys table (admin) ---------------- */
  async function loadKeys() {
    const body = $("#keys-body");
    body.innerHTML = `<tr><td colspan="4" class="mono px-4 py-6 text-center text-[11px] text-white/25">Loading…</td></tr>`;
    try {
      const keys = await api.listKeys();
      $("#keys-count").textContent = keys.length + " keys";
      if (!keys.length) {
        body.innerHTML = `<tr><td colspan="4" class="mono px-4 py-8 text-center text-[11px] text-white/25">No keys yet — generate the first one.</td></tr>`;
        return;
      }
      body.innerHTML = keys.map((k) => {
        const term = k.duration_days == null ? "Lifetime" : k.duration_days + "d";
        const used = !!k.is_used;
        const ref = k.used_by ? String(k.used_by).slice(0, api.live ? 8 : 64) : "";
        return `
        <tr class="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
          <td class="mono px-4 py-3 text-[11px] font-bold text-white/80">${esc(k.key_code)}</td>
          <td class="mono px-2 py-3 text-[10px] text-white/40">${term}</td>
          <td class="px-2 py-3">
            <span class="chip ${used ? "chip-red" : "chip-green"} !px-2 !py-0.5 !text-[8.5px]">${used ? "Активирован" : "Свободен"}</span>
            ${used ? `<div class="mono mt-1 text-[8.5px] text-white/25">${esc(ref)}${api.live ? "…" : ""}</div>` : ""}
          </td>
          <td class="px-4 py-3">
            <div class="flex justify-end gap-1.5">
              <button data-copy="${esc(k.key_code)}" title="Copy" class="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/40 transition hover:border-white/25 hover:text-white">${COPY}</button>
              ${used && k.used_by ? `<button data-reset="${esc(k.used_by)}" title="Reset user's HWID" class="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/40 transition hover:border-amber-400/40 hover:text-amber-300">${WRENCH}</button>` : ""}
              <button data-del="${k.id}" title="Delete key" class="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/40 transition hover:border-rose-400/40 hover:text-rose-300">${TRASH}</button>
            </div>
          </td>
        </tr>`;
      }).join("");

      $$("[data-copy]", body).forEach((b) =>
        b.addEventListener("click", async () => {
          const ok = await copyText(b.dataset.copy);
          toast({ title: ok ? "Key copied" : "Copy failed", desc: ok ? b.dataset.copy : "", tone: ok ? "success" : "error" });
        })
      );
      $$("[data-del]", body).forEach((b) =>
        b.addEventListener("click", async () => {
          try {
            await api.deleteKey(Number(b.dataset.del));
            toast({ title: "Key deleted", tone: "info" });
            loadKeys();
          } catch (e) {
            toast({ title: "Delete failed", desc: e.message, tone: "error" });
          }
        })
      );
      $$("[data-reset]", body).forEach((b) =>
        b.addEventListener("click", async () => {
          try {
            await api.resetHwidFor(b.dataset.reset);
            toast({ title: "HWID reset", desc: "User can bind a new device on next launch.", tone: "success" });
          } catch (e) {
            toast({ title: "Reset failed", desc: e.message, tone: "error" });
          }
        })
      );
    } catch (e) {
      body.innerHTML = `<tr><td colspan="4" class="mono px-4 py-6 text-center text-[11px] text-rose-300/70">${esc(e.message)}</td></tr>`;
    }
  }

  /* ---------------- actions ---------------- */
  $("#key-reveal").addEventListener("click", (e) => {
    revealed = !revealed;
    $("#key-field").textContent = revealed ? me.license_key : "MIND-••••-••••-••••";
    e.currentTarget.innerHTML = revealed ? EYE_OFF : EYE;
  });
  $("#key-copy").addEventListener("click", async (e) => {
    if (!me.license_key) return;
    const ok = await copyText(me.license_key);
    const btn = e.currentTarget;
    btn.innerHTML = ok ? CHECK : COPY;
    btn.className =
      "grid h-7 w-7 shrink-0 place-items-center rounded-md transition-all duration-300 " +
      (ok ? "bg-emerald-400/15 text-emerald-300" : "text-white/40 hover:bg-white/5 hover:text-white");
    setTimeout(() => { btn.innerHTML = COPY; btn.className = "grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/40 transition hover:bg-white/5 hover:text-white"; }, 1600);
    if (ok) toast({ title: "License key copied", tone: "success" });
  });

  $("#hwid-reset").addEventListener("click", async () => {
    try {
      await api.setHwid(null);
      me.hwid = null;
      paint();
      toast({ title: "HWID reset", desc: "A new device will bind on next launch.", tone: "success" });
    } catch (e) {
      toast({ title: "Reset failed", desc: e.message, tone: "error" });
    }
  });

  $("#buy-btn").addEventListener("click", () =>
    window.Mind.openCheckout(async () => {
      me = await api.me();
      revealed = false;
      paint();
    })
  );

  $("#dl-profile").addEventListener("click", () => {
    if (!isActive(me)) return;
    toast({ title: "Web demo", desc: "No installer is shipped from this site — UI concept build.", tone: "info" });
  });

  $("#logout-btn").addEventListener("click", async () => {
    await api.signOut();
    toast({ title: "Signed out", tone: "info" });
    setTimeout(() => (location.href = "index.html"), 500);
  });

  /* admin actions */
  $("#gen-btn").addEventListener("click", async () => {
    const v = $("#gen-days").value;
    const days = v === "lifetime" ? null : Number(v);
    try {
      const row = await api.generateKey(days);
      toast({ title: "Key generated", desc: row.key_code, tone: "success" });
      loadKeys();
    } catch (e) {
      toast({ title: "Generate failed", desc: e.message, tone: "error" });
    }
  });

  $("#keys-refresh").addEventListener("click", loadKeys);

  $("#grant-btn").addEventListener("click", async () => {
    const email = $("#grant-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", desc: "Enter the user's account email.", tone: "error" });
      return;
    }
    const v = $("#grant-days").value;
    const days = v === "lifetime" ? null : Number(v);
    try {
      const key = await api.grantByEmail(email, days);
      $("#grant-email").value = "";
      toast({ title: "Access granted", desc: `${key} → ${email}`, tone: "success" });
      loadKeys();
    } catch (e) {
      toast({ title: "Grant failed", desc: e.message, tone: "error" });
    }
  });

  /* ---------------- boot ---------------- */
  $("#backend-badge").innerHTML = api.live
    ? '<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>LIVE · SUPABASE'
    : '<span class="h-1.5 w-1.5 rounded-full bg-amber-400/80"></span>DEMO · LOCAL';
  $("#backend-note").textContent = api.live
    ? "Backend: Supabase · row level security enabled"
    : "Demo backend · localStorage · add Supabase keys in assets/config.js";

  me = await api.me();
  if (!me) {
    $("#gate").classList.remove("hidden");
  } else {
    $("#app").classList.remove("hidden");
    paint();
  }
  if (window.lucide) lucide.createIcons();
})();
