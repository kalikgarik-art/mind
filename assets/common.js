/* ============================================================
   Mind · shared core (vanilla, no build step)
   - Backend adapter: Supabase (live) ⇄ localStorage (demo)
   - Toasts, helpers, interactive executor mockup, checkout
   ============================================================ */
(function () {
  "use strict";

  const CFG = window.__MIND_CONFIG__ || {};
  const OWNER = String(CFG.OWNER_EMAIL || "").trim().toLowerCase();
  const norm = (e) => String(e || "").trim().toLowerCase();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n = 4) => {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
  };
  const genKey = () => `MIND-${seg()}-${seg()}-${seg()}`;
  const genHwid = () => `HWID-${seg()}-${seg()}`;

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch {}
      ta.remove();
      return ok;
    }
  }

  /* ---------------- toasts ---------------- */
  const TONE = {
    success: ["#34d399", "M20 6 9 17l-5-5"],
    info: ["#22d3ee", "M12 8v5m0 3.5h.01"],
    error: ["#fb7185", "M12 8v5m0 3.5h.01"],
  };
  function toast({ title, desc = "", tone = "info", action = null }) {
    let host = $("#toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "toasts";
      host.className = "fixed bottom-4 right-4 z-[130] flex w-[330px] max-w-[calc(100vw-2rem)] flex-col gap-2.5";
      document.body.appendChild(host);
    }
    while (host.children.length > 3) host.firstChild.remove();
    const [color, path] = TONE[tone] || TONE.info;
    const el = document.createElement("div");
    el.className = "relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e13]/95 p-3.5 pr-9 shadow-2xl backdrop-blur-xl";
    el.style.animation = "modalIn .35s cubic-bezier(.22,1,.36,1) both";
    const circle = tone === "info" || tone === "error" ? `<circle cx="12" cy="12" r="9"/>` : "";
    el.innerHTML = `
      <span class="absolute inset-y-0 left-0 w-[3px]" style="background:${color}"></span>
      <div class="flex items-start gap-3">
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style="background:${color}1f;color:${color}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5">${circle}<path d="${path}"/></svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-bold text-white">${esc(title)}</p>
          ${desc ? `<p class="mt-0.5 text-[11.5px] leading-snug text-white/50">${esc(desc)}</p>` : ""}
          ${action ? `<button data-act class="mt-1.5 text-[11px] font-bold text-cyan-400 hover:underline">${esc(action.label)}</button>` : ""}
        </div>
      </div>
      <button data-x aria-label="Dismiss" class="absolute top-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-md text-white/30 transition hover:bg-white/5 hover:text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-3.5 w-3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>`;
    const kill = () => el.remove();
    $("[data-x]", el).addEventListener("click", kill);
    if (action) $("[data-act]", el).addEventListener("click", () => { action.onClick(); kill(); });
    host.appendChild(el);
    setTimeout(kill, tone === "error" ? 5200 : 4200);
  }

  /* ---------------- backend adapter ---------------- */
  const DS = { users: "mind.demo.users", session: "mind.demo.session", profiles: "mind.demo.profiles", keys: "mind.demo.keys" };
  const lsRead = (k, f) => { try { return JSON.parse(localStorage.getItem(k) ?? "null") ?? f; } catch { return f; } };
  const lsWrite = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const SB_READY =
    CFG.SUPABASE_URL && !String(CFG.SUPABASE_URL).includes("YOUR_") &&
    CFG.SUPABASE_ANON_KEY && !String(CFG.SUPABASE_ANON_KEY).includes("YOUR_") &&
    !!window.supabase;
  const sb = SB_READY ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const localize = (email, p) => ({
    license_key: p.license_key || null,
    hwid: p.hwid || null,
    expires_at: p.expires_at || null,
    role: norm(email) === OWNER ? "developer" : (p.role || "user"),
  });

  const api = {
    live: !!sb,
    backendName: () => (sb ? "Supabase · live" : "Local demo · localStorage"),
    profileUrl() {
      const base = location.pathname.endsWith("/") ? location.pathname : location.pathname.replace(/[^/]*$/, "");
      return location.origin + base + "profile.html";
    },

    isAdmin(user) {
      return !!user && (user.role === "developer" || norm(user.email) === OWNER);
    },

    async me() {
      if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        const email = session.user.email || "";
        return {
          id: session.user.id,
          email,
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || email.split("@")[0],
          ...localize(email, p || {}),
        };
      }
      const email = localStorage.getItem(DS.session);
      if (!email) return null;
      const u = lsRead(DS.users, {})[email];
      if (!u) return null;
      const p = lsRead(DS.profiles, {})[email] || {};
      return { id: "demo-" + email, email, name: u.name, ...localize(email, p) };
    },

    async signUp(name, email, password) {
      if (sb) {
        const { data, error } = await sb.auth.signUp({ email: norm(email), password, options: { data: { name: name.trim() } } });
        if (error) throw new Error(error.message);
        if (!data.session) return { pendingConfirm: true };
        return { user: await api.me() };
      }
      await wait(800);
      const key = norm(email);
      const users = lsRead(DS.users, {});
      if (users[key]) throw new Error("An account with this email already exists.");
      users[key] = { name: name.trim(), email: key, password, createdAt: Date.now() };
      const profiles = lsRead(DS.profiles, {});
      profiles[key] = { email: key, role: "user", license_key: null, hwid: null, expires_at: null };
      lsWrite(DS.users, users); lsWrite(DS.profiles, profiles);
      localStorage.setItem(DS.session, key);
      return { user: await api.me() };
    },

    async signIn(email, password) {
      if (sb) {
        const { error } = await sb.auth.signInWithPassword({ email: norm(email), password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Invalid email or password." : error.message);
        return api.me();
      }
      await wait(800);
      const key = norm(email);
      const u = lsRead(DS.users, {})[key];
      if (!u || u.password !== password) throw new Error("Invalid email or password.");
      localStorage.setItem(DS.session, key);
      return api.me();
    },

    async google() {
      if (sb) {
        await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: api.profileUrl() } });
        return null; // browser navigates away
      }
      await wait(700);
      const key = "demo.user@gmail.com";
      const users = lsRead(DS.users, {});
      if (!users[key]) users[key] = { name: "Demo User", email: key, createdAt: Date.now() };
      const profiles = lsRead(DS.profiles, {});
      if (!profiles[key]) profiles[key] = { email: key, role: "user", license_key: null, hwid: null, expires_at: null };
      lsWrite(DS.users, users); lsWrite(DS.profiles, profiles);
      localStorage.setItem(DS.session, key);
      return api.me();
    },

    async signOut() {
      if (sb) await sb.auth.signOut();
      else localStorage.removeItem(DS.session);
    },

    async setHwid(value) {
      if (sb) {
        const me = await api.me();
        const { error } = await sb.from("profiles").update({ hwid: value }).eq("id", me.id);
        if (error) throw new Error(error.message);
        return;
      }
      await wait(500);
      const email = localStorage.getItem(DS.session);
      const profiles = lsRead(DS.profiles, {});
      if (profiles[email]) { profiles[email].hwid = value; lsWrite(DS.profiles, profiles); }
    },

    /* "purchase": takes one free key and assigns it to the caller */
    async claimKey() {
      if (sb) {
        const { data, error } = await sb.rpc("claim_key");
        if (error) throw new Error(error.message);
        return data; // null = out of stock
      }
      await wait(600);
      const email = localStorage.getItem(DS.session);
      const keys = lsRead(DS.keys, []);
      let k = keys.find((x) => !x.is_used);
      if (!k) { // demo keeps itself stocked
        k = { id: Date.now(), key_code: genKey(), duration_days: CFG.PLAN_DAYS || 30, is_used: false, used_by: null, created_at: new Date().toISOString() };
        keys.unshift(k);
      }
      k.is_used = true; k.used_by = email;
      const profiles = lsRead(DS.profiles, {});
      const p = profiles[email] || { email, role: "user" };
      p.license_key = k.key_code;
      p.expires_at = k.duration_days == null ? null : new Date(Date.now() + k.duration_days * 864e5).toISOString();
      profiles[email] = p;
      lsWrite(DS.keys, keys); lsWrite(DS.profiles, profiles);
      return k.key_code;
    },

    /* ---- admin only (enforced by RLS in live mode) ---- */
    async listKeys() {
      if (sb) {
        const { data, error } = await sb.from("keys").select("*").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data;
      }
      await wait(300);
      return lsRead(DS.keys, []);
    },

    async generateKey(durationDays) {
      const row = { key_code: genKey(), duration_days: durationDays };
      if (sb) {
        const { error } = await sb.from("keys").insert(row);
        if (error) throw new Error(error.message);
        return row;
      }
      await wait(300);
      const keys = lsRead(DS.keys, []);
      keys.unshift({ id: Date.now(), ...row, is_used: false, used_by: null, created_at: new Date().toISOString() });
      lsWrite(DS.keys, keys);
      return row;
    },

    async deleteKey(id) {
      if (sb) {
        const { error } = await sb.from("keys").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      await wait(200);
      lsWrite(DS.keys, lsRead(DS.keys, []).filter((k) => k.id !== id));
    },

    async resetHwidFor(ref) {
      if (sb) {
        const { error } = await sb.from("profiles").update({ hwid: null }).eq("id", ref);
        if (error) throw new Error(error.message);
        return;
      }
      await wait(300);
      const profiles = lsRead(DS.profiles, {});
      if (profiles[ref]) { profiles[ref].hwid = null; lsWrite(DS.profiles, profiles); }
    },

    async grantByEmail(email, durationDays) {
      const target = norm(email);
      const key = genKey();
      const expires = durationDays == null ? null : new Date(Date.now() + durationDays * 864e5).toISOString();
      if (sb) {
        const { data: p, error: e1 } = await sb.from("profiles").select("id,email").eq("email", target).maybeSingle();
        if (e1) throw new Error(e1.message);
        if (!p) throw new Error("No user with this email. Ask them to register first.");
        const { error: e2 } = await sb.from("keys").insert({ key_code: key, duration_days: durationDays, is_used: true, used_by: p.id });
        if (e2) throw new Error(e2.message);
        const { error: e3 } = await sb.from("profiles").update({ license_key: key, expires_at: expires }).eq("id", p.id);
        if (e3) throw new Error(e3.message);
        return key;
      }
      await wait(500);
      const users = lsRead(DS.users, {});
      if (!users[target]) throw new Error("No user with this email. Ask them to register first.");
      const keys = lsRead(DS.keys, []);
      keys.unshift({ id: Date.now(), key_code: key, duration_days: durationDays, is_used: true, used_by: target, created_at: new Date().toISOString() });
      const profiles = lsRead(DS.profiles, {});
      profiles[target] = { ...(profiles[target] || { email: target, role: "user" }), license_key: key, expires_at: expires };
      lsWrite(DS.keys, keys); lsWrite(DS.profiles, profiles);
      return key;
    },
  };

  /* ---------------- formatting helpers ---------------- */
  const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
  const isActive = (u) => !!(u && u.license_key && (!u.expires_at || new Date(u.expires_at).getTime() > Date.now()));
  const planText = (u) => {
    if (!u || !u.license_key) return "—";
    if (!u.expires_at) return "Lifetime";
    const d = Math.max(0, Math.ceil((new Date(u.expires_at).getTime() - Date.now()) / 864e5));
    return d > 0 ? `${d} days left` : "Expired";
  };

  /* ---------------- shell: navbar / reveal ---------------- */
  function initShell() {
    const nav = $("#nav");
    if (nav) {
      const onScroll = () => nav.classList.toggle("nav-scrolled", window.scrollY > 14);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    const burger = $("#nav-burger"), mobile = $("#nav-mobile");
    if (burger && mobile) burger.addEventListener("click", () => mobile.classList.toggle("hidden"));
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------------- icon set (inline svg) ---------------- */
  const ic = (p, cls = "h-4 w-4") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${p}</svg>`;
  const IC = {
    play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>',
    plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    lib: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    term: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    act: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    spin: '<path d="M21 12a9 9 0 1 1-6.2-8.56"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  };

  /* ---------------- Lua mockup ---------------- */
  const CM = "var(--m-cm)";
  const RULES = [
    [/^--.*$/, CM], [/^"[^"\n]*"/, "var(--m-str)"],
    [/^(?:local|function|end|if|then|return|not|self|nil|true|false|do|in|for|while)\b/, "var(--m-kw)"],
    [/^[A-Za-z_][\w.:]*(?=\s*\()/, "var(--m-fn)"],
    [/^\d+(?:\.\d+)?/, "var(--m-num)"], [/^\s+/, ""], [/^[A-Za-z_][\w.]*/, ""], [/^./, ""],
  ];
  function tokenize(line) {
    if (!line) return [{ t: " ", c: "" }];
    const out = [];
    let s = line, g = 0;
    while (s.length && g++ < 200) {
      for (const [re, c] of RULES) {
        const m = re.exec(s);
        if (m) { out.push({ t: m[0], c }); s = s.slice(m[0].length); break; }
      }
    }
    return out;
  }

  const SNIPPETS = {
    "esp.lua": `-- universal esp · mind hub
local Mind   = require("mind.core")
local Player = game:GetService("Players").LocalPlayer

local ESP = Mind.Module.new("PlayerESP", {
    Color   = Color3.fromRGB(139, 92, 246),
    Refresh = 144,          -- frames per second
})

function ESP:OnAttach(target)
    self.Box = Instance.new("Highlight", target.Character)
    self.Box.FillColor = self.Color
end
Mind.Attach(function() ESP:Enable() end)`,
    "aimassist.lua": `-- smooth aim assist · fov ring
local Aim = Mind.Module.new("AimAssist", {
    Fov    = 120,
    Smooth = 0.18,          -- lower = snappier
    Key    = Enum.KeyCode.RButton,
})

function Aim:Step(dt)
    local target = self:ClosestToCursor()
    if not target then return end
    local head = target.Head.Position
    Camera.CFrame = Camera.CFrame:Lerp(head, self.Smooth)
end
Mind.RenderStep(Aim)`,
    "ui_theme.lua": `-- mind ui · custom window
local UI = Mind.UI.new({
    Title = "Mind // Player Tools",
    Theme = Mind.Themes.NeonPurple,
    Size  = UDim2.fromOffset(560, 420),
})

local move = UI:Tab("Movement")
move:Slider("WalkSpeed", 16, 250, 72, function(v)
    Player.Character.Humanoid.WalkSpeed = v
end)
move:Toggle("Fly", false, function(on) Fly.Toggle(on) end)
UI:Mount()`,
  };

  const POPULAR = [["Universal Hub", "42.1k"], ["Infinite Yield", "38.7k"], ["Owl Hub", "31.2k"], ["Speed Run X", "12.8k"]];
  const TAGC = { MIND: "var(--m-a2)", NET: "#38bdf8", OK: "#34d399", ERR: "#fb7185", EXEC: "var(--m-a1)", SYS: "#fbbf24" };

  const THEMES = {
    midnight: { a1: "#8b5cf6", a2: "#06b6d4", glow: "rgba(139,92,246,0.38)", kw: "#c084fc", fn: "#67e8f9", str: "#4ade80", num: "#fbbf24" },
    neon: { a1: "#a855f7", a2: "#ec4899", glow: "rgba(168,85,247,0.42)", kw: "#e879f9", fn: "#f0abfc", str: "#c4b5fd", num: "#fda4af" },
    cyber: { a1: "#06b6d4", a2: "#3b82f6", glow: "rgba(6,182,212,0.42)", kw: "#67e8f9", fn: "#93c5fd", str: "#34d399", num: "#fde047" },
  };

  function renderMockup(root) {
    const docs = { ...SNIPPETS };
    let file = Object.keys(docs)[0];
    let attached = false, attaching = false;
    const log = [
      { tag: "MIND", msg: "runtime v3.2.1 initialized — lua 5.4" },
      { tag: "NET", msg: "script hub connected (demo workspace)" },
      { tag: "SYS", msg: "idle — press Attach to link the runtime" },
    ];

    root.innerHTML = `
      <div class="absolute -inset-8 -z-10 rounded-[2.5rem] opacity-80 blur-3xl transition-all duration-700" data-glow></div>
      <div data-win class="relative overflow-hidden rounded-2xl border border-white/10 backdrop-blur-2xl" style="background:linear-gradient(180deg,rgba(21,21,30,.92),rgba(11,11,16,.96));transition:box-shadow .7s">
        <div class="hairline"></div>
        <div class="flex h-11 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/90"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-[#febc2e]/90"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-[#28c840]/90"></span>
            </div>
            <span class="mono hidden text-[10.5px] text-white/35 sm:block">Mind — workspace</span>
          </div>
          <div class="flex items-center gap-1 text-white/25">
            <button data-open title="Open file" class="grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/[0.07] hover:text-white/80">${ic(IC.folder, "h-3.5 w-3.5")}</button>
            <button data-save title="Save file" class="grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/[0.07] hover:text-white/80">${ic(IC.save, "h-3.5 w-3.5")}</button>
            <span data-badge class="mono mx-2 hidden rounded border px-1.5 py-0.5 text-[9px] font-semibold sm:block">Lua 5.4</span>
            <span class="ml-1">${ic(IC.minus, "h-3.5 w-3.5")}</span>
            <span class="ml-2">${ic(IC.square, "h-3 w-3")}</span>
            <span class="ml-2 transition hover:text-white/60">${ic(IC.x, "h-3.5 w-3.5")}</span>
          </div>
        </div>
        <div data-tabs class="flex items-end gap-1 overflow-x-auto border-b border-white/[0.06] bg-black/25 px-3 pt-2"></div>
        <div class="flex">
          <aside class="hidden w-40 shrink-0 flex-col border-r border-white/[0.06] bg-black/25 p-3 md:flex xl:w-44">
            <div class="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5">
              <span class="text-white/30">${ic(IC.search, "h-3 w-3")}</span>
              <span class="mono text-[10px] text-white/30">Search scripts</span>
            </div>
            <nav class="mt-3 space-y-0.5">
              <span data-navhub class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-all duration-500">
                <span data-hubic>${ic(IC.lib, "h-3.5 w-3.5")}</span> Script Hub
              </span>
              ${[["Editor", IC.code], ["Console", IC.term], ["Settings", IC.gear]].map(([l, i]) => `
                <span class="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/40 transition hover:bg-white/[0.05] hover:text-white/80">${ic(i, "h-3.5 w-3.5")} ${l}</span>`).join("")}
            </nav>
            <p class="mono mt-4 px-2 text-[8.5px] uppercase tracking-[0.25em] text-white/25">Popular</p>
            <div class="mt-1.5 space-y-0.5">
              ${POPULAR.map(([n, c]) => `
                <span class="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition hover:bg-white/[0.04]">
                  <span class="flex items-center gap-2"><span data-dot class="h-1 w-1 rounded-full"></span><span class="text-[10.5px] text-white/50">${n}</span></span>
                  <span class="mono text-[9px] text-white/25">${c}</span>
                </span>`).join("")}
            </div>
          </aside>
          <div class="min-w-0 flex-1">
            <div data-editor class="min-h-[290px] overflow-x-auto bg-black/20 px-4 py-3.5 [scrollbar-width:thin]"></div>
            <div data-console class="flex h-[86px] flex-col justify-end gap-[3px] overflow-hidden border-t border-white/[0.06] bg-black/40 px-4 py-2.5"></div>
          </div>
        </div>
        <div class="flex h-[52px] items-center gap-2 overflow-x-auto border-t border-white/[0.06] bg-white/[0.02] px-3 [scrollbar-width:none] sm:gap-2.5 sm:px-4">
          <button data-status class="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 transition hover:border-white/25">
            <span data-sdot class="h-1.5 w-1.5 rounded-full transition-colors duration-500"></span>
            <span data-stext class="text-[10.5px] font-bold transition-colors duration-500"></span>
          </button>
          <span class="mono hidden items-center gap-1.5 text-[9.5px] text-white/35 sm:flex">
            <span data-actic>${ic(IC.act, "h-3 w-3")}</span><span data-lat>idle</span>
          </span>
          <span class="flex-1"></span>
          <button data-clear class="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/55 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white sm:px-3.5">${ic(IC.eraser, "h-3.5 w-3.5")}<span class="hidden sm:inline">Clear</span></button>
          <button data-attach class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all duration-500 hover:scale-[1.03] active:scale-95 sm:px-3.5"></button>
          <button data-exec class="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-bold text-white transition-all duration-300 hover:scale-[1.05] hover:brightness-110 active:scale-95">${ic(IC.play, "h-3.5 w-3.5")} Execute</button>
        </div>
      </div>`;

    const q = (s) => $(s, root);
    const push = (tag, msg) => { log.push({ tag, msg }); log.splice(0, log.length - 4); paintConsole(); };

    function paintConsole() {
      q("[data-console]").innerHTML = log.map((l) => `
        <p class="mono flex items-baseline gap-2 text-[10px] leading-relaxed">
          <span class="shrink-0 font-bold" style="color:${TAGC[l.tag]}">[${l.tag}]</span>
          <span class="truncate text-white/45">${esc(l.msg)}</span>
        </p>`).join("");
    }

    function paintTabs() {
      const host = q("[data-tabs]");
      host.innerHTML = Object.keys(docs).map((f) => `
        <button data-tab="${esc(f)}" class="mono flex shrink-0 items-center gap-2 rounded-t-lg border-t-2 px-3.5 py-2 text-[10.5px] whitespace-nowrap transition-all duration-300 ${f === file ? "bg-[#15151f] text-white" : "border-transparent text-white/35 hover:text-white/70"}" ${f === file ? `style="border-color:${root._t.a1}"` : ""}>
          <span class="h-1.5 w-1.5 rounded-full transition-colors duration-500" style="background:${f === file ? root._t.a2 : "rgba(255,255,255,.15)"}"></span>${esc(f)}
        </button>`).join("") + `
        <button data-newtab title="New script" class="mb-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/30 transition hover:bg-white/5 hover:text-white/70">${ic(IC.plus, "h-3.5 w-3.5")}</button>`;
      $$("[data-tab]", host).forEach((b) => b.addEventListener("click", () => { file = b.dataset.tab; paintTabs(); paintEditor(); }));
      $("[data-newtab]", host).addEventListener("click", openFile);
    }

    function paintEditor() {
      const inner = q("[data-editor]");
      const src = docs[file] ?? "";
      inner.innerHTML = `<div>${
        src.split("\n").map((line, i, arr) => `
          <div class="mono flex text-[10.5px] leading-[1.75] sm:text-[11.5px]">
            <span class="w-7 shrink-0 select-none pr-3 text-right text-white/[0.14]">${i + 1}</span>
            <span class="flex-1 whitespace-pre text-white/80">${tokenize(line).map((tk) =>
              `<span class="transition-colors duration-700 ${tk.c === CM ? "italic" : ""}" ${tk.c ? `style="color:${tk.c}"` : ""}>${esc(tk.t)}</span>`).join("")}${i === arr.length - 1 ? `<span class="anim-blink ml-0.5 inline-block h-[12px] w-[7px] translate-y-[2px]" style="background:${root._t.a1}"></span>` : ""}</span>
          </div>`).join("")
      }</div>`;
      const a = inner.firstChild;
      a.style.animation = "riseIn .45s cubic-bezier(.22,1,.36,1)";
    }

    function paintStatus() {
      const t = root._t;
      const dot = q("[data-sdot]"), txt = q("[data-stext]"), lat = q("[data-lat]"), btn = q("[data-attach]");
      dot.className = "h-1.5 w-1.5 rounded-full transition-colors duration-500 " + (attached ? "anim-pulse-dot bg-emerald-400" : attaching ? "animate-pulse bg-amber-400" : "bg-amber-400/70");
      txt.className = "text-[10.5px] font-bold transition-colors duration-500 " + (attached ? "text-emerald-300" : "text-amber-200/80");
      txt.textContent = attached ? "Attached" : attaching ? "Attaching…" : "Not Attached";
      lat.textContent = attached ? "avg 0.4ms" : "idle";
      btn.style.cssText = `border-color:${t.a2}66;color:${t.a2};background:${t.a2}14`;
      btn.innerHTML = (attaching ? ic(IC.spin, "h-3.5 w-3.5 anim-spin") : ic(IC.plug, "h-3.5 w-3.5")) + `<span class="hidden sm:inline">${attached ? "Detach" : attaching ? "Injecting" : "Attach"}</span>`;
    }

    function paintTheme() {
      const t = root._t;
      root.style.cssText += "";
      root.style.setProperty("--m-a1", t.a1); root.style.setProperty("--m-a2", t.a2);
      root.style.setProperty("--m-kw", t.kw); root.style.setProperty("--m-fn", t.fn);
      root.style.setProperty("--m-str", t.str); root.style.setProperty("--m-num", t.num);
      root.style.setProperty("--m-cm", "#5b6379");
      q("[data-glow]").style.background = `radial-gradient(55% 55% at 50% 45%, ${t.glow}, transparent 75%)`;
      q("[data-win]").style.boxShadow = `0 34px 90px -22px ${t.glow}, 0 0 0 1px rgba(255,255,255,.03)`;
      q("[data-badge]").style.color = t.a2;
      q("[data-badge]").style.borderColor = t.a2 + "44";
      q("[data-navhub]").style.background = `linear-gradient(90deg,${t.a1}2e,transparent)`;
      q("[data-hubic]").style.color = t.a1;
      q("[data-actic]").style.color = t.a2;
      $$("[data-dot]", root).forEach((d) => (d.style.background = t.a2));
      q("[data-exec]").style.cssText = `background:linear-gradient(120deg,${t.a1},${t.a2});box-shadow:0 8px 26px -8px ${t.glow}`;
      paintTabs(); paintStatus();
    }

    function attach() {
      if (attaching) return;
      if (attached) {
        attached = false; paintStatus();
        push("SYS", "detached from process #4521");
        toast({ title: "Detached", desc: "Runtime link closed.", tone: "info" });
        return;
      }
      attaching = true; paintStatus();
      push("SYS", "scanning process list…");
      setTimeout(() => {
        push("OK", "attached to GameClient.exe (pid 4521) in 0.83ms");
        attaching = false; attached = true; paintStatus();
        toast({ title: "Attached", desc: "Runtime injected — ready to execute.", tone: "success" });
      }, 1100);
    }

    function execute() {
      if (attaching) return;
      if (!attached) {
        push("ERR", "attach required — press Attach first");
        toast({ title: "Not attached", desc: "Press Attach to link the runtime first.", tone: "error" });
        return;
      }
      if (!(docs[file] || "").trim()) {
        push("ERR", "nothing to execute — editor is empty");
        toast({ title: "Editor is empty", desc: "Open a file or undo the clear.", tone: "error" });
        return;
      }
      push("EXEC", `${file} → ok (${(0.18 + Math.random() * 0.6).toFixed(2)}ms)`);
    }

    function clear() {
      const src = docs[file];
      if (!src) { push("SYS", "editor is already empty"); return; }
      docs[file] = ""; paintEditor();
      push("SYS", `${file} cleared`);
      toast({
        title: "Editor cleared", desc: `${file} emptied`, tone: "info",
        action: { label: "Undo", onClick: () => { docs[file] = src; paintEditor(); push("SYS", `${file} restored`); } },
      });
    }

    function openFile() {
      let k = 1;
      while (docs[`script_${k}.lua`]) k++;
      const name = `script_${k}.lua`;
      docs[name] = `-- ${name} · new script\nlocal Mind = require("mind.core")\n\nprint("hello from ${name}")`;
      file = name;
      paintTabs(); paintEditor();
      push("SYS", `opened ${name}`);
      toast({ title: "File opened", desc: `${name} loaded into the workspace.`, tone: "info" });
    }

    function saveFile() {
      push("SYS", `saved ${file} → ~/Mind/workspace`);
      toast({ title: "File saved", desc: `~/Mind/workspace/${file}`, tone: "success" });
    }

    q("[data-attach]").addEventListener("click", attach);
    q("[data-status]").addEventListener("click", attach);
    q("[data-exec]").addEventListener("click", execute);
    q("[data-clear]").addEventListener("click", clear);
    q("[data-open]").addEventListener("click", openFile);
    q("[data-save]").addEventListener("click", saveFile);

    root._t = THEMES.midnight;
    paintTheme(); paintConsole(); paintEditor();

    return { setTheme: (theme) => { root._t = theme; paintTheme(); paintEditor(); } };
  }

  /* ---------------- checkout (shared modal) ---------------- */
  function initCheckout() {
    const modal = $("#modal-checkout");
    if (!modal) return;
    let method = "card", busy = false, onDone = null;

    const step = (name) => ["method", "details", "success"].forEach((n) => $("#co-" + n).classList.toggle("hidden", n !== name));
    const open = (cb) => {
      onDone = cb || null; busy = false; step("method");
      document.body.style.overflow = "hidden";
      modal.classList.remove("hidden");
    };
    const close = () => { if (busy) return; modal.classList.add("hidden"); document.body.style.overflow = ""; };

    $$(".co-method", modal).forEach((b) =>
      b.addEventListener("click", () => {
        method = b.dataset.method;
        $$(".co-method", modal).forEach((x) => {
          const on = x.dataset.method === method;
          x.className = "co-method flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-300 " +
            (on ? "border-accent/50 bg-accent/[0.09] shadow-lg" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20");
        });
      })
    );
    $("#co-continue").addEventListener("click", () => {
      $("#co-card-form").classList.toggle("hidden", method !== "card");
      $("#co-crypto-form").classList.toggle("hidden", method !== "crypto");
      $("#co-pay").textContent = method === "card" ? `Pay $${(CFG.PRICE_USD || 2.99).toFixed(2)}` : "I've sent the payment";
      step("details");
    });
    $("#co-back").addEventListener("click", () => step("method"));
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    $("#co-close").addEventListener("click", close);

    $("#co-pay-wrap").addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      const btn = $("#co-pay-wrap");
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 anim-spin"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg> Processing payment…`;
      try {
        await wait(1500); // gateway simulation
        const key = await api.claimKey();
        if (!key) throw new Error("Key store is empty — ask the developer (Faraonov) to generate keys.");
        $("#co-key").textContent = key;
        step("success");
        toast({ title: "Payment confirmed", desc: "License key issued for your account.", tone: "success" });
      } catch (e) {
        toast({ title: "Payment failed", desc: e.message, tone: "error" });
      } finally {
        busy = false;
        btn.innerHTML = `<span id="co-pay">Pay $${(CFG.PRICE_USD || 2.99).toFixed(2)}</span>`;
      }
    });

    $("#co-copy").addEventListener("click", async (e) => {
      const ok = await copyText($("#co-key").textContent);
      e.currentTarget.innerHTML = ok
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M20 6 9 17l-5-5"/></svg>'
        : e.currentTarget.innerHTML;
      toast({ title: ok ? "Key copied" : "Copy failed", tone: ok ? "success" : "error" });
    });

    $("#co-done").addEventListener("click", () => {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
      if (onDone) onDone();
    });

    Mind.openCheckout = open;
  }

  /* exports */
  window.Mind = {
    CFG, OWNER, api, toast, copyText, genKey, genHwid, wait, $, $$, esc,
    fmtDate, isActive, planText, initShell, renderMockup, THEMES, initCheckout,
    openCheckout: () => initCheckoutNotReady(),
  };
  function initCheckoutNotReady() {}
  document.addEventListener("DOMContentLoaded", () => { initShell(); initCheckout(); });
})();
