/* Mind · production profile + RLS-protected developer panel */
(async function () {
  "use strict";
  const { $, $$, api, toast, copyText, fmtDate, isActive, planText, esc } = window.Mind;
  let me = null;

  /* ambient effects (respect prefers-reduced-motion inside Mind helpers) */
  void window.Mind.startRain(document.getElementById("rain"));
  void window.Mind.playIntro();
  let revealed = false;

  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M20 6 9 17l-5-5"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  const WRENCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

  function setAdminTab(tab) {
    const management = tab === "management";
    $("#admin-management").classList.toggle("hidden", !management);
    $("#admin-docs").classList.toggle("hidden", management);
    [
      [$("#admin-tab-management"), management],
      [$("#admin-tab-docs"), !management],
    ].forEach(([button, active]) => {
      button.className =
        "admin-tab flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-bold transition " +
        (active
          ? "bg-gradient-to-r from-accent/80 to-aqua/80 text-white"
          : "text-white/45 hover:bg-white/[0.05] hover:text-white");
    });
  }

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

    $("#sub-dot").className = "h-2 w-2 rounded-full " + (active ? "anim-pulse-dot bg-emerald-400" : "bg-rose-400");
    $("#sub-status").textContent = active ? "Active" : "Inactive";
    $("#sub-status").className = "text-lg font-extrabold " + (active ? "text-emerald-300" : "text-rose-300");
    $("#sub-plan").textContent = me.license_key ? planText(me) : "";
    $("#sub-exp").textContent = active
      ? me.expires_at
        ? "Access expires " + fmtDate(me.expires_at)
        : "Lifetime access"
      : "Activate a valid unused key to unlock access.";

    const daysLeft = active && me.expires_at
      ? Math.max(0, Math.ceil((new Date(me.expires_at).getTime() - Date.now()) / 864e5))
      : 0;
    $("#sub-bar-wrap").classList.toggle("hidden", !(active && me.expires_at));
    if (active && me.expires_at) $("#sub-bar").style.width = Math.min(100, (daysLeft / 30) * 100) + "%";
    $("#activate-wrap").classList.toggle("hidden", active);

    const hasKey = Boolean(me.license_key);
    $("#key-box").classList.toggle("hidden", !hasKey);
    $("#key-box").classList.toggle("flex", hasKey);
    $("#key-empty").classList.toggle("hidden", hasKey);
    if (hasKey) {
      $("#key-field").textContent = revealed ? me.license_key : "MIND-••••-••••-••••";
      $("#key-meta").classList.remove("hidden");
      $("#key-meta").textContent = `server status: ${active ? "active" : "expired"} · keep this key private`;
    } else {
      $("#key-meta").classList.add("hidden");
    }

    const bound = Boolean(me.hwid);
    $("#hwid-dot").className = "h-2 w-2 rounded-full " + (bound ? "anim-pulse-dot bg-emerald-400" : "bg-white/20");
    $("#hwid-val").textContent = bound ? me.hwid : "Not bound";
    $("#hwid-device").textContent = bound ? "Device stored in Supabase" : "Device binds on the first client launch";
    $("#hwid-reset").disabled = !bound;

    const dl = $("#dl-profile");
    dl.disabled = !active;
    dl.className =
      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all duration-300 " +
      (active
        ? "bg-gradient-to-r from-accent to-aqua text-white shadow-[0_12px_36px_-12px_rgba(139,92,246,0.9)] hover:brightness-110 active:scale-[0.99]"
        : "cursor-not-allowed border border-white/10 text-white/30");
    $("#dl-profile-label").textContent = active ? "Download Client" : "Locked — key required";

    const admin = api.isAdmin(me);
    $("#admin").classList.toggle("hidden", !admin);
    if (admin) {
      setAdminTab("management");
      void Promise.all([loadKeys(), loadUsers()]);
    }
  }

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
            <td class="px-2 py-3"><span class="chip ${k.is_used ? "chip-red" : "chip-green"} !px-2 !py-0.5 !text-[8.5px]">${k.is_used ? "Активирован" : "Свободен"}</span></td>
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

  async function loadUsers() {
    const body = $("#users-body");
    body.innerHTML = '<tr><td colspan="4" class="mono px-4 py-6 text-center text-[11px] text-white/25">Loading from Supabase…</td></tr>';
    try {
      const users = await api.listUsers();
      body.innerHTML = users.map((user) => {
        const active = isActive(user);
        return `
          <tr class="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
            <td class="px-4 py-3"><p class="text-[11px] font-bold text-white/75">${esc(user.email)}</p><p class="mono mt-0.5 text-[8.5px] text-white/25">${esc(user.role)}</p></td>
            <td class="px-2 py-3"><span class="chip ${active ? "chip-green" : "chip-dim"} !px-2 !py-0.5 !text-[8.5px]">${active ? planText(user) : "Inactive"}</span></td>
            <td class="mono max-w-[150px] truncate px-2 py-3 text-[9px] text-white/35">${user.hwid ? esc(user.hwid) : "Not bound"}</td>
            <td class="px-4 py-3 text-right"><button data-user-reset="${user.id}" ${user.hwid ? "" : "disabled"} title="Reset HWID" class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-bold text-white/45 transition hover:border-amber-400/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-30">${WRENCH} Reset</button></td>
          </tr>`;
      }).join("") || '<tr><td colspan="4" class="mono px-4 py-8 text-center text-[11px] text-white/25">No users found.</td></tr>';

      $$("[data-user-reset]", body).forEach((button) => button.addEventListener("click", async () => {
        try {
          await api.resetHwidFor(button.dataset.userReset);
          toast({ title: "HWID reset", desc: "The user can bind a new device.", tone: "success" });
          await loadUsers();
        } catch (error) {
          toast({ title: "Reset failed", desc: error.message, tone: "error" });
        }
      }));
    } catch (error) {
      body.innerHTML = `<tr><td colspan="4" class="mono px-4 py-6 text-center text-[11px] text-rose-300/70">${esc(error.message)}</td></tr>`;
    }
  }

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

  $("#hwid-reset").addEventListener("click", async () => {
    try {
      await api.setHwid(null);
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

  $("#admin-tab-management").addEventListener("click", () => setAdminTab("management"));
  $("#admin-tab-docs").addEventListener("click", () => setAdminTab("docs"));
  $("#keys-refresh").addEventListener("click", () => void loadKeys());
  $("#users-refresh").addEventListener("click", () => void loadUsers());
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

  /* Boot: this page intentionally has no local/offline authentication. */
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
    try {
      me = await api.me();
      if (!me) {
        $("#gate").classList.remove("hidden");
      } else {
        $("#app").classList.remove("hidden");
        paint();
      }
    } catch (error) {
      $("#gate").classList.remove("hidden");
      $("#gate h1").textContent = "Database setup error";
      $("#gate p").textContent = error.message;
    }
  }
  if (window.lucide) lucide.createIcons();
})();