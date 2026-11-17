/* Mind · production profile: @username, discord, licenses, developer panel */
(async function () {
  "use strict";
  const { $, $$, api, toast, copyText, fmtDate, isActive, planText, esc } = window.Mind;
  let me = null;
  let revealed = false;
  let allUsers = [];
  let pendingRemove = null;

  /* ambient effects (respect prefers-reduced-motion inside Mind helpers) */
  void window.Mind.startRain(document.getElementById("rain"));
  void window.Mind.playIntro();

  const COOLDOWN_DAYS = 14;
  const COOLDOWN_HWID_DAYS = 7;
  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M20 6 9 17l-5-5"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  const WRENCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

  /* ================= admin tabs ================= */
  function setAdminTab(tab) {
    $("#admin-management").classList.toggle("hidden", tab !== "management");
    $("#admin-users").classList.toggle("hidden", tab !== "users");
    $("#admin-docs").classList.toggle("hidden", tab !== "docs");
    [
      ["#admin-tab-management", "management"],
      ["#admin-tab-users", "users"],
      ["#admin-tab-docs", "docs"],
    ].forEach(([sel, id]) => {
      const button = $(sel);
      const on = tab === id;
      button.className =
        "admin-tab flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-bold transition " +
        (on
          ? "bg-gradient-to-r from-accent/80 to-aqua/80 text-white"
          : "text-white/45 hover:bg-white/[0.05] hover:text-white");
    });
    if (tab === "users") void loadUsers();
  }

  /* ================= @username cooldown ================= */
  function usernameCooldown(user) {
    if (!user.username_updated_at) return { ready: true, daysLeft: 0, date: null };
    const changed = new Date(user.username_updated_at).getTime();
    const total = COOLDOWN_DAYS * 864e5;
    const elapsed = Date.now() - changed;
    if (elapsed >= total) return { ready: true, daysLeft: 0, date: null };
    return {
      ready: false,
      daysLeft: Math.ceil((total - elapsed) / 864e5),
      date: new Date(changed + total).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }

  function paintUsernameCard() {
    const current = $("#uname-current");
    const state = $("#uname-state");
    const hint = $("#uname-hint");
    const input = $("#uname-input");
    const save = $("#uname-save");

    const chip = $("#u-username");
    if (me.username) {
      chip.textContent = "@" + me.username;
      chip.classList.remove("hidden");
    } else {
      chip.classList.add("hidden");
    }

    current.textContent = me.username ? "@" + me.username : "—";
    const cd = usernameCooldown(me);

    if (!me.username) {
      state.textContent = "not set";
      state.className = "chip chip-amber";
      hint.textContent = "Set an @username — it becomes your public identifier.";
      hint.className = "mt-2 text-[10.5px] leading-relaxed text-white/35";
      input.disabled = false;
      save.disabled = false;
      save.classList.remove("opacity-50", "cursor-not-allowed");
    } else if (cd.ready) {
      state.textContent = "available";
      state.className = "chip chip-green";
      hint.textContent = me.username_updated_at
        ? `Usernames can be changed once every ${COOLDOWN_DAYS} days. You can change it now.`
        : `Usernames can be changed once every ${COOLDOWN_DAYS} days.`;
      hint.className = "mt-2 text-[10.5px] leading-relaxed text-emerald-300/80";
      input.disabled = false;
      save.disabled = false;
      save.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      state.textContent = "cooldown";
      state.className = "chip chip-amber";
      hint.innerHTML = `Usernames can be changed once every ${COOLDOWN_DAYS} days. <strong class="text-white/75">Next change available in: ${cd.daysLeft}d.</strong>${cd.date ? `<br>Available again on ${cd.date}` : ""}`;
      hint.className = "mt-2 text-[10.5px] leading-relaxed text-amber-200/80";
      input.disabled = true;
      save.disabled = true;
      save.classList.add("opacity-50", "cursor-not-allowed");
    }
  }

  /* ================= HWID reset cooldown (7 days) ================= */
  function hwidCooldownInfo(user) {
    if (!user.hwid_reset_at) return { ready: true, text: "" };
    const next = new Date(user.hwid_reset_at).getTime() + COOLDOWN_HWID_DAYS * 864e5;
    const left = next - Date.now();
    if (left <= 0) return { ready: true, text: "" };
    const d = Math.floor(left / 864e5);
    const h = Math.floor((left % 864e5) / 36e5);
    const m = Math.floor((left % 36e5) / 6e4);
    return { ready: false, text: d > 0 ? `${d}d ${h}h` : `${h}h ${m}m` };
  }

  /* ================= discord card ================= */
  function avatarFallback(name) {
    const letter = String(name || "D").charAt(0).toUpperCase();
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='#8b5cf6'/><stop offset='1' stop-color='#06b6d4'/>` +
      `</linearGradient></defs>` +
      `<rect width='64' height='64' rx='32' fill='url(#g)'/>` +
      `<text x='32' y='43' font-size='30' font-family='sans-serif' font-weight='700' fill='white' text-anchor='middle'>${letter}</text></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function paintDiscordCard() {
    const linked = Boolean(me.discord_id);
    $("#discord-on").classList.toggle("hidden", !linked);
    $("#discord-on").classList.toggle("flex", linked);
    $("#discord-off").classList.toggle("hidden", linked);
    $("#discord-link").classList.toggle("hidden", linked);
    $("#discord-unlink").classList.toggle("hidden", !linked);
    if (linked) {
      $("#discord-name").textContent = me.discord_username
        ? "@" + me.discord_username
        : "Discord account";
      $("#discord-avatar").src = me.discord_avatar || avatarFallback(me.discord_username);
    }
  }

  /* ================= paint profile ================= */
  function paint() {
    $("#u-avatar").textContent = me.name.charAt(0).toUpperCase();
    $("#u-name").textContent = me.name;
    $("#u-email").textContent = me.email;

    const active = isActive(me);
    const role = $("#u-role");
    if (api.isAdmin(me)) {
      role.textContent = "DEVELOPER";
      role.className = "chip chip-amber";
    } else if (active) {
      role.textContent = "PRO";
      role.className = "chip chip-green";
    } else {
      role.textContent = "FREE";
      role.className = "chip chip-dim";
    }

    /* subscription */
    $("#sub-dot").className = "h-2 w-2 rounded-full " + (active ? "anim-pulse-dot bg-emerald-400" : "bg-rose-400");
    $("#sub-status").textContent = active ? "Active" : "Inactive";
    $("#sub-status").className = "text-lg font-extrabold " + (active ? "text-emerald-300" : "text-rose-300");
    $("#sub-plan").textContent = me.license_key ? planText(me) : "";
    $("#sub-exp").textContent = active
      ? me.expires_at
        ? `Access expires ${fmtDate(me.expires_at)}`
        : "Lifetime access"
      : "Activate a valid unused key to unlock access.";

    const daysLeft = active && me.expires_at
      ? Math.max(0, Math.ceil((new Date(me.expires_at).getTime() - Date.now()) / 864e5))
      : 0;
    $("#sub-bar-wrap").classList.toggle("hidden", !(active && me.expires_at));
    if (active && me.expires_at) $("#sub-bar").style.width = Math.min(100, (daysLeft / 30) * 100) + "%";
    $("#activate-wrap").classList.toggle("hidden", active);

    /* license key */
    const hasKey = Boolean(me.license_key);
    $("#key-box").classList.toggle("hidden", !hasKey);
    $("#key-box").classList.toggle("flex", hasKey);
    $("#key-empty").classList.toggle("hidden", hasKey);
    if (hasKey) {
      $("#key-field").textContent = revealed ? me.license_key : "MIND-••••-••••-••••";
      $("#key-meta").classList.remove("hidden");
      $("#key-meta").textContent =
        `server status: ${active ? "active" : "expired"}` +
        (me.license_activated_at ? ` · activated ${fmtDate(me.license_activated_at)}` : "") +
        " · keep this key private";
    } else {
      $("#key-meta").classList.add("hidden");
    }

    /* hwid */
    const bound = Boolean(me.hwid);
    const hcd = hwidCooldownInfo(me);
    $("#hwid-dot").className = "h-2 w-2 rounded-full " + (bound ? "anim-pulse-dot bg-emerald-400" : "bg-white/20");
    $("#hwid-val").textContent = bound ? me.hwid : "Not bound";
    $("#hwid-device").textContent = bound ? "Device stored in Supabase" : "Device binds on the first client launch";
    $("#hwid-reset").disabled = !bound || !hcd.ready;
    $("#hwid-reset-hint").textContent = hcd.ready
      ? "HWID resets are limited to once every 7 days."
      : `HWID reset is available once every 7 days. Next reset available in: ${hcd.text}`;
    $("#hwid-reset-hint").className =
      "mt-2 text-[10.5px] leading-relaxed " + (hcd.ready ? "text-white/35" : "text-amber-200/80");

    /* download gating */
    const dl = $("#dl-profile");
    dl.disabled = !active;
    dl.className =
      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all duration-300 " +
      (active
        ? "bg-gradient-to-r from-accent to-aqua text-white shadow-[0_12px_36px_-12px_rgba(139,92,246,0.9)] hover:brightness-110 active:scale-[0.99]"
        : "cursor-not-allowed border border-white/10 text-white/30");
    $("#dl-profile-label").textContent = active ? "Download Client" : "Locked — key required";

    /* username + discord */
    paintUsernameCard();
    paintDiscordCard();

    /* admin */
    const admin = api.isAdmin(me);
    $("#admin").classList.toggle("hidden", !admin);
    if (admin) {
      setAdminTab("management");
      void loadKeys();
    }
  }

  /* ================= keys tab ================= */
  async function loadKeys() {
    const body = $("#keys-body");
    body.innerHTML = '<tr><td colspan="4" class="mono px-4 py-6 text-center text-[11px] text-white/25">Loading from Supabase…</td></tr>';
    try {
      const keys = await api.listKeys();
      $("#keys-count").textContent = `${keys.length} keys`;
      if (!keys.length) {
        body.innerHTML = '<tr><td colspan="4" class="mono px-4 py-8 text-center text-[11px] text-white/25">No keys yet — generate the first one.</td></tr>';
        return;
      }
      body.innerHTML = keys.map((k) => {
        const term = k.duration_days == null ? "Lifetime" : `${k.duration_days}d`;
        return `
          <tr class="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
            <td class="mono px-4 py-3 text-[10px] font-bold text-white/80 sm:text-[11px]">${esc(k.key_code)}</td>
            <td class="mono px-2 py-3 text-[10px] text-white/40">${term}</td>
            <td class="px-2 py-3"><span class="chip ${k.is_used ? "chip-red" : "chip-green"} !px-2 !py-0.5 !text-[8.5px]">${k.is_used ? "Used" : "Available"}</span></td>
            <td class="px-4 py-3"><div class="flex justify-end gap-1.5">
              <button data-copy="${esc(k.key_code)}" title="Copy" class="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/40 transition hover:border-white/25 hover:text-white">${COPY}</button>
              <button data-del="${k.id}" title="Delete" class="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/40 transition hover:border-rose-400/40 hover:text-rose-300">${TRASH}</button>
            </div></td>
          </tr>`;
      }).join("");

      $$("[data-copy]", body).forEach((button) => button.addEventListener("click", async () => {
        const ok = await copyText(button.dataset.copy);
        toast({ title: ok ? "Key copied" : "Copy failed", desc: ok ? button.dataset.copy : "", tone: ok ? "success" : "error" });
      }));
      $$("[data-del]", body).forEach((button) => button.addEventListener("click", async () => {
        try {
          await api.deleteKey(Number(button.dataset.del));
          toast({ title: "Key deleted", tone: "info" });
          await loadKeys();
        } catch (error) {
          toast({ title: "Delete failed", desc: error.message, tone: "error" });
        }
      }));
    } catch (error) {
      body.innerHTML = `<tr><td colspan="4" class="mono px-4 py-6 text-center text-[11px] text-rose-300/70">${esc(error.message)}</td></tr>`;
    }
  }

  /* ================= users tab (search + manage) ================= */
  async function loadUsers() {
    const list = $("#users-list");
    list.innerHTML = '<div class="mono rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-6 text-center text-[11px] text-white/25">Loading users from Supabase…</div>';
    try {
      allUsers = await api.listUsers();
      pendingRemove = null;
      renderUsers();
    } catch (error) {
      list.innerHTML = `<div class="mono rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-6 text-center text-[11px] text-rose-300/70">${esc(error.message)}</div>`;
    }
  }

  function renderUsers() {
    const list = $("#users-list");
    const field = $("#user-search-field").value;
    const q = $("#user-search").value.trim().toLowerCase();

    let filtered = allUsers;
    if (q) {
      filtered = allUsers.filter((u) => {
        if (field === "username") return String(u.username || "").includes(q);
        if (field === "email") return String(u.email || "").toLowerCase().includes(q);
        return String(u.license_key || "").toLowerCase().includes(q);
      });
    }

    $("#users-count").textContent = `Showing ${filtered.length} of ${allUsers.length} · empty query = all accounts`;

    if (!filtered.length) {
      list.innerHTML = '<div class="mono rounded-2xl border border-dashed border-white/12 bg-black/25 px-4 py-8 text-center text-[11px] text-white/30">No users found</div>';
      return;
    }

    list.innerHTML = filtered.map((u) => {
      const active = isActive(u);
      const confirming = pendingRemove === u.id;
      const canReset = Boolean(u.hwid);
      const hasLicense = Boolean(u.license_key);
      return `
        <div class="user-card rounded-2xl border border-white/[0.08] bg-black/25 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[13px] font-bold text-white">${u.username ? "@" + esc(u.username) : '<span class="text-white/35">no @username</span>'}</p>
              <p class="mono truncate text-[10.5px] text-white/40">${esc(u.email)}</p>
            </div>
            <span class="chip ${active ? "chip-green" : "chip-dim"}">${active ? esc(planText(u)) : "No license"}</span>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2.5 rounded-xl border border-white/[0.06] bg-black/30 p-3 sm:grid-cols-3">
            <div class="min-w-0">
              <p class="mono text-[8.5px] uppercase tracking-[0.18em] text-white/25">Key</p>
              <p class="mono mt-0.5 truncate text-[10px] font-bold ${hasLicense ? "text-white/75" : "text-white/30"}">${hasLicense ? esc(u.license_key) : "No license"}</p>
            </div>
            <div class="min-w-0">
              <p class="mono text-[8.5px] uppercase tracking-[0.18em] text-white/25">Registered</p>
              <p class="mono mt-0.5 truncate text-[10px] text-white/60">${fmtDate(u.created_at)}</p>
            </div>
            <div class="min-w-0">
              <p class="mono text-[8.5px] uppercase tracking-[0.18em] text-white/25">Activated</p>
              <p class="mono mt-0.5 truncate text-[10px] text-white/60">${u.license_activated_at ? fmtDate(u.license_activated_at) : "—"}</p>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="chip ${u.hwid ? "chip-green" : "chip-dim"} !px-2.5 !py-1 !text-[8.5px]">${u.hwid ? "HWID · bound" : "HWID · not bound"}</span>
            <span class="chip ${u.discord_username ? "chip-accent" : "chip-dim"} !px-2.5 !py-1 !text-[8.5px]">${u.discord_username ? "Discord · @" + esc(u.discord_username) : "Discord · —"}</span>
            <span class="mono ml-auto text-[8.5px] text-white/20">id ${esc(String(u.id).slice(0, 8))}…</span>
          </div>

          <div class="mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-3">
            ${confirming
              ? `<span class="mr-auto text-[11px] font-bold text-rose-300">Remove license and HWID for ${u.username ? "@" + esc(u.username) : esc(u.email)}?</span>
                 <button data-rm-no class="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white/50 transition hover:text-white">Cancel</button>
                 <button data-rm-yes="${u.id}" class="rounded-lg bg-rose-500/90 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-rose-500">Yes, remove</button>`
              : `${canReset ? `<button data-reset-hwid="${u.id}" class="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white/45 transition hover:border-amber-400/40 hover:text-amber-300">${WRENCH} Reset HWID</button>` : ""}
                 ${hasLicense ? `<button data-rm="${u.id}" class="flex items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-400/10 px-3 py-1.5 text-[10px] font-bold text-rose-300 transition hover:border-rose-400/70 hover:bg-rose-400/20 hover:text-white">${TRASH} Remove License</button>` : ""}`}
          </div>
        </div>`;
    }).join("");

    $$("[data-reset-hwid]", list).forEach((button) =>
      button.addEventListener("click", async () => {
        try {
          await api.resetHwidFor(button.dataset.resetHwid);
          toast({ title: "HWID reset", desc: "The user can bind a new device.", tone: "success" });
          await loadUsers();
        } catch (error) {
          toast({ title: "Reset failed", desc: error.message, tone: "error" });
        }
      })
    );
    $$("[data-rm]", list).forEach((button) =>
      button.addEventListener("click", () => {
        pendingRemove = button.dataset.rm;
        renderUsers();
      })
    );
    $$("[data-rm-no]", list).forEach((button) =>
      button.addEventListener("click", () => {
        pendingRemove = null;
        renderUsers();
      })
    );
    $$("[data-rm-yes]", list).forEach((button) =>
      button.addEventListener("click", async () => {
        try {
          await api.removeLicense(button.dataset.rmYes);
          toast({ title: "License removed", desc: "License, expiry and HWID were cleared.", tone: "success" });
          pendingRemove = null;
          await loadUsers();
          me = await api.me();
          paint();
        } catch (error) {
          toast({ title: "Remove failed", desc: error.message, tone: "error" });
        }
      })
    );
  }

  /* ================= activation / key box ================= */
  $("#activate-key").addEventListener("input", (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  });
  $("#activate-key").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("#activate-btn").click();
  });
  $("#activate-btn").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const value = $("#activate-key").value.trim();
    button.disabled = true;
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 anim-spin"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>Activating…';
    try {
      const result = await api.activateKey(value);
      me = await api.me();
      revealed = false;
      $("#activate-key").value = "";
      paint();
      toast({
        title: "License activated",
        desc: result.duration_days == null ? "Lifetime access enabled." : `${result.duration_days} days of access enabled.`,
        tone: "success",
      });
    } catch (error) {
      toast({ title: "Activation failed", desc: error.message, tone: "error" });
    } finally {
      button.disabled = false;
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>Activate';
    }
  });

  $("#key-reveal").addEventListener("click", (event) => {
    revealed = !revealed;
    $("#key-field").textContent = revealed ? me.license_key : "MIND-••••-••••-••••";
    event.currentTarget.innerHTML = revealed ? EYE_OFF : EYE;
  });
  $("#key-copy").addEventListener("click", async (event) => {
    if (!me.license_key) return;
    const ok = await copyText(me.license_key);
    event.currentTarget.innerHTML = ok ? CHECK : COPY;
    setTimeout(() => (event.currentTarget.innerHTML = COPY), 1600);
    toast({ title: ok ? "License key copied" : "Copy failed", tone: ok ? "success" : "error" });
  });

  /* ================= @username change ================= */
  $("#uname-input").addEventListener("input", (event) => {
    event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  });
  $("#uname-save").addEventListener("click", async () => {
    const input = $("#uname-input");
    const value = input.value.trim().toLowerCase();
    if (!USERNAME_RE.test(value)) {
      toast({ title: "Invalid format", desc: "3–20 characters: latin letters, numbers and _", tone: "error" });
      return;
    }
    const cd = usernameCooldown(me);
    if (!cd.ready) {
      toast({
        title: `You can change your username once every ${COOLDOWN_DAYS} days`,
        desc: `Next change available in: ${cd.daysLeft}d`,
        tone: "info",
      });
      paintUsernameCard();
      return;
    }
    try {
      await api.changeUsername(value);
      me = await api.me();
      input.value = "";
      paint();
      toast({ title: "@username updated", desc: `You are now @${value}`, tone: "success" });
    } catch (error) {
      toast({ title: "Change failed", desc: error.message, tone: "error" });
    }
  });

  /* ================= discord ================= */
  $("#discord-link").addEventListener("click", async () => {
    if (!api.configured) {
      toast({ title: "Supabase not configured", desc: "Add your keys in assets/config.js first.", tone: "error" });
      return;
    }
    try {
      await api.linkDiscord();
      toast({ title: "Redirecting to Discord…", desc: "Come back to your profile after authorizing.", tone: "info" });
    } catch (error) {
      toast({ title: "Discord link failed", desc: error.message, tone: "error" });
    }
  });
  $("#discord-unlink").addEventListener("click", async () => {
    try {
      await api.unlinkDiscord();
      me = await api.me();
      paint();
      toast({ title: "Discord unlinked", tone: "success" });
    } catch (error) {
      toast({ title: "Unlink failed", desc: error.message, tone: "error" });
    }
  });

  /* ================= hwid / download / logout ================= */
  $("#hwid-reset").addEventListener("click", async () => {
    try {
      await api.resetOwnHwid();
      me = await api.me();
      paint();
      toast({ title: "HWID reset", desc: "A new device can be bound on next launch.", tone: "success" });
    } catch (error) {
      toast({ title: "Reset failed", desc: error.message, tone: "error" });
    }
  });

  $("#dl-profile").addEventListener("click", () => {
    if (!isActive(me)) return;
    toast({ title: "Client URL not configured", desc: "Add your signed client download URL before publishing.", tone: "info" });
  });

  $("#logout-btn").addEventListener("click", async () => {
    try {
      await api.signOut();
      location.href = "index.html";
    } catch (error) {
      toast({ title: "Logout failed", desc: error.message, tone: "error" });
    }
  });

  /* ================= admin controls ================= */
  $("#admin-tab-management").addEventListener("click", () => setAdminTab("management"));
  $("#admin-tab-users").addEventListener("click", () => setAdminTab("users"));
  $("#admin-tab-docs").addEventListener("click", () => setAdminTab("docs"));
  $("#keys-refresh").addEventListener("click", () => void loadKeys());
  $("#users-refresh").addEventListener("click", () => void loadUsers());
  $("#user-search").addEventListener("input", () => renderUsers());
  $("#user-search-field").addEventListener("change", () => renderUsers());
  $("#gen-btn").addEventListener("click", async () => {
    const value = $("#gen-days").value;
    const days = value === "lifetime" ? null : Number(value);
    try {
      const key = await api.generateKey(days);
      toast({ title: "Real key generated", desc: key.key_code, tone: "success" });
      await loadKeys();
    } catch (error) {
      toast({ title: "Generation failed", desc: error.message, tone: "error" });
    }
  });

  /* ================= boot =================
     Render the static shell first; every Supabase call runs afterwards
     (4.5s timeout inside api.me()/api.syncDiscord()). */
  const boot = async () => {
  $("#admin-backend").innerHTML = api.configured
    ? '<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>SUPABASE · CONNECTED'
    : '<span class="h-1.5 w-1.5 rounded-full bg-rose-400"></span>SETUP REQUIRED';
  $("#backend-note").textContent = api.configured
    ? "Backend: Supabase Auth + Postgres · Row Level Security enabled"
    : "Supabase setup required · add public credentials in assets/config.js";

  if (!api.configured) {
    $("#gate").classList.remove("hidden");
    $("#gate h1").textContent = "Supabase setup required";
    $("#gate p").textContent = "Add SUPABASE_URL and SUPABASE_ANON_KEY in assets/config.js, then run supabase-setup.sql.";
    $("#gate a").textContent = "Read setup instructions";
    $("#gate a").href = "supabase-setup.sql";
  } else {
    /* sync discord identity after an OAuth round-trip (idempotent) */
    try {
      await api.syncDiscord();
    } catch {
      /* not signed in / provider not linked — ignored */
    }
    try {
      me = await api.me();
    } catch (error) {
      me = null;
      $("#gate").classList.remove("hidden");
      $("#gate h1").textContent = "Database setup error";
      $("#gate p").textContent = error.message;
    }
    if (me) {
      $("#app").classList.remove("hidden");
      paint();
    } else if ($("#gate").classList.contains("hidden")) {
      $("#gate").classList.remove("hidden");
    }
  }
  if (window.lucide) lucide.createIcons();
  };
  /* yield to the renderer so the first paint happens before any network I/O */
  requestAnimationFrame(() => setTimeout(boot, 0));
})();
