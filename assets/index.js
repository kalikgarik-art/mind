/* Mind · landing page logic */
(async function () {
  "use strict";
  const { $, $$, api, toast, renderMockup, THEMES } = window.Mind;
  let me = null;

  /* ---------- mobile menu: close on link tap ---------- */
  $$("#nav-mobile a").forEach((a) => a.addEventListener("click", () => $("#nav-mobile").classList.add("hidden")));

  /* ---------- marquee ---------- */
  const ITEMS = ["Universal ESP", "Aim Assist", "Script Hub", "UI Library", "Auto Updates", "Lua 5.4 Runtime", "Cloud Profiles", "Speed Hub", "Anti-AFK"];
  $("#marquee").innerHTML = [...ITEMS, ...ITEMS]
    .map((s) => `<span class="flex items-center gap-10"><span class="mono text-[11px] font-medium uppercase tracking-[0.35em] whitespace-nowrap text-white/30">${s}</span><span class="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-accent to-aqua"></span></span>`)
    .join("");

  /* ---------- features grid (mouse spotlight cards) ---------- */
  const FEATURES = [
    ["zap", "High Performance", "A rewritten execution core with zero-allocation hot paths. Fast attach, zero frame-steal.", "#8b5cf6"],
    ["palette", "Custom UI & Themes", "Every pixel is yours. Restyle tabs, accents, blur and motion — or one-click community themes.", "#06b6d4"],
    ["library-big", "Script Hub", "Curated, auto-verified modules one click away. Search, favorite and pin without leaving the overlay.", "#a855f7"],
    ["refresh-cw", "Auto-Updates", "The runtime patches itself on launch. No reinstalls, no version hell.", "#22d3ee"],
    ["shield-check", "Stability", "Sandboxed modules and a watchdog that freezes a bad script before it can freeze your game.", "#8b5cf6"],
    ["headset", "24/7 Support", "Real humans on Discord around the clock, plus an always-on community sharing configs and fixes.", "#06b6d4"],
  ];
  $("#features-grid").innerHTML = FEATURES.map(
    ([icon, title, desc, tint], i) => `
    <div class="reveal h-full" style="transition-delay:${(i % 3) * 90}ms">
      <div data-spot class="group relative h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-7 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 hover:border-white/[0.18]">
        <div class="spot pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style="background:radial-gradient(340px circle at var(--sx,50%) var(--sy,50%), ${tint}22, transparent 68%)"></div>
        <span class="mono absolute top-5 right-6 text-xs font-semibold text-white/[0.09] transition-colors duration-500 group-hover:text-white/20">0${i + 1}</span>
        <div class="relative">
          <div class="grid h-12 w-12 place-items-center rounded-xl border border-white/10 transition-all duration-500 group-hover:scale-110 group-hover:border-white/20" style="background:linear-gradient(135deg, ${tint}2b, transparent 65%)">
            <i data-lucide="${icon}" class="h-5 w-5 transition-all duration-500" style="color:${tint}"></i>
          </div>
          <h3 class="mt-6 text-[17px] font-bold text-white">${title}</h3>
          <p class="mt-2.5 text-[13.5px] leading-relaxed text-white/50">${desc}</p>
        </div>
      </div>
    </div>`
  ).join("");
  $$("[data-spot]").forEach((card) =>
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--sx", e.clientX - r.left + "px");
      card.style.setProperty("--sy", e.clientY - r.top + "px");
    })
  );

  /* ---------- FAQ ---------- */
  const FAQ = [
    ["What are the system requirements?", "Mind runs on Windows 10 and 11 (64-bit): 4 GB of RAM, ~40 MB of disk space and an up-to-date WebView2 runtime. No administrator rights are required after the first setup."],
    ["How do I install Mind?", "Download the build, run it once — Mind places a portable install in your user folder. Open your game, press Attach, and you're in. Under 60 seconds: no drivers, no restarts."],
    ["How do I get access?", "Create an account, contact Faraonov and receive a real key. Enter it in Profile. The server accepts only an existing, unused key and binds it to your Supabase account."],
    ["Where can I get support?", "Discord is staffed around the clock by the developer and community. Average first response is fast, and every release gets a dedicated feedback channel."],
  ];
  $("#faq-list").innerHTML = FAQ.map(
    ([q, a], i) => `
    <div class="reveal" style="transition-delay:${i * 70}ms">
      <div data-faq class="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl transition-all duration-500 hover:border-white/[0.16]">
        <button class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
          <span class="text-[15px] font-bold text-white sm:text-base">${q}</span>
          <span class="faq-ico grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-white/50 transition-all duration-500"><i data-lucide="plus" class="h-4 w-4"></i></span>
        </button>
        <div class="acc-panel"><div><p class="px-6 pb-6 text-sm leading-relaxed text-white/55">${a}</p></div></div>
      </div>
    </div>`
  ).join("");
  $$("[data-faq]").forEach((item, idx) => {
    const btn = $("button", item), panel = $(".acc-panel", item), ico = $(".faq-ico", item);
    if (idx === 0) {
      panel.classList.add("open");
      ico.className = ico.className.replace("border-white/15 text-white/50", "rotate-45 border-transparent bg-gradient-to-br from-accent to-aqua text-white");
      item.classList.add("border-accent/35", "bg-white/[0.05]");
    }
    btn.addEventListener("click", () => {
      const open = panel.classList.toggle("open");
      ico.classList.toggle("rotate-45", open);
      ico.classList.toggle("border-transparent", open);
      ico.classList.toggle("bg-gradient-to-br", open);
      ico.classList.toggle("from-accent", open);
      ico.classList.toggle("to-aqua", open);
      ico.classList.toggle("text-white", open);
      item.classList.toggle("border-accent/35", open);
      item.classList.toggle("bg-white/[0.05]", open);
    });
  });

  /* ---------- mockups ---------- */
  const heroMockup = renderMockup($("#hero-mockup"));
  const showMockup = renderMockup($("#showcase-mockup"));

  /* ---------- showcase themes ---------- */
  const THEME_DEFS = [
    ["midnight", "Midnight", "The signature dark"],
    ["neon", "Neon Purple", "Violet–magenta glow"],
    ["cyber", "Cyber Blue", "Cold electric ice"],
  ];
  let activeTheme = "midnight";
  function paintThemeList() {
    $("#theme-list").innerHTML = THEME_DEFS.map(([key, label, sub]) => {
      const t = THEMES[key], on = key === activeTheme;
      return `
        <button data-th="${key}" class="group flex w-full items-center gap-4 rounded-2xl border p-4 text-left backdrop-blur-xl transition-all duration-300 sm:p-5 ${on ? "border-white/25 bg-white/[0.06]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]"}">
          <span class="h-9 w-9 shrink-0 rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-110" style="background:linear-gradient(135deg,${t.a1},${t.a2});${on ? `box-shadow:0 8px 24px -6px ${t.glow}` : ""}"></span>
          <span class="flex-1"><span class="block text-[15px] font-bold text-white">${label}</span><span class="mt-0.5 block text-xs text-white/40">${sub}</span></span>
          <span class="grid h-6 w-6 place-items-center rounded-full border transition-all duration-300 ${on ? "border-transparent text-white" : "border-white/15 text-transparent"}" ${on ? `style="background:linear-gradient(135deg,${t.a1},${t.a2})"` : ""}><i data-lucide="check" class="h-3.5 w-3.5"></i></span>
        </button>`;
    }).join("");
    $$("#theme-list [data-th]").forEach((b) =>
      b.addEventListener("click", () => {
        activeTheme = b.dataset.th;
        showMockup.setTheme(THEMES[activeTheme]);
        $("#theme-caption").textContent = `"${activeTheme}"`;
        $("#theme-caption").style.color = THEMES[activeTheme].a2;
        paintThemeList();
        if (window.lucide) lucide.createIcons();
      })
    );
    if (window.lucide) lucide.createIcons();
  }
  paintThemeList();

  /* ---------- hero tilt + cursor glow ---------- */
  const hero = $("#hero"), glow = $("#cursor-glow"), tilt = $("#tilt-inner");
  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    glow.style.background = `radial-gradient(620px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(139,92,246,0.08), transparent 72%)`;
    if (window.innerWidth < 1024) return;
    const tr = tilt.getBoundingClientRect();
    const px = (e.clientX - tr.left) / tr.width - 0.5;
    const py = (e.clientY - tr.top) / tr.height - 0.5;
    tilt.style.animation = "none";
    tilt.style.transition = "transform 160ms ease-out";
    tilt.style.transform = `rotateX(${(-py * 5.5).toFixed(2)}deg) rotateY(${(px * 7.5).toFixed(2)}deg)`;
  });
  hero.addEventListener("mouseleave", () => {
    glow.style.background = "transparent";
    tilt.style.transition = "transform 900ms cubic-bezier(.22,1,.36,1)";
    tilt.style.transform = "rotateX(0deg) rotateY(0deg)";
    setTimeout(() => (tilt.style.animation = ""), 900);
  });

  /* ---------- auth modal ---------- */
  const modal = $("#modal-auth");
  let mode = "signin", busy = false;
  const openAuth = () => { modal.classList.remove("hidden"); modal.classList.add("flex"); document.body.style.overflow = "hidden"; };
  const closeAuth = () => { if (busy) return; modal.classList.add("hidden"); modal.classList.remove("flex"); document.body.style.overflow = ""; };
  $("#auth-close").addEventListener("click", closeAuth);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeAuth(); });
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeAuth());

  function setMode(m) {
    mode = m;
    $("#auth-title").textContent = m === "signin" ? "Welcome back" : "Create your account";
    $("#auth-submit").textContent = m === "signin" ? "Sign In" : "Create Account";
    $("#auth-name-wrap").classList.toggle("hidden", m === "signin");
    $("#auth-name-wrap").classList.toggle("block", m === "signup");
    $("#auth-tab-in").className = "rounded-lg py-2 text-[13px] font-bold transition " + (m === "signin" ? "bg-gradient-to-r from-accent/80 to-aqua/80 text-white" : "text-white/40 hover:text-white/70");
    $("#auth-tab-up").className = "rounded-lg py-2 text-[13px] font-bold transition " + (m === "signup" ? "bg-gradient-to-r from-accent/80 to-aqua/80 text-white" : "text-white/40 hover:text-white/70");
    err(null);
  }
  $("#auth-tab-in").addEventListener("click", () => setMode("signin"));
  $("#auth-tab-up").addEventListener("click", () => setMode("signup"));

  $("#auth-toggle-pw").addEventListener("click", () => {
    const p = $("#auth-pass");
    p.type = p.type === "password" ? "text" : "password";
  });

  const err = (msg) => {
    const box = $("#auth-error");
    box.classList.toggle("hidden", !msg);
    box.classList.toggle("flex", !!msg);
    if (msg) box.textContent = msg;
  };

  async function submitAuth() {
    if (busy) return;
    const name = $("#auth-name").value, email = $("#auth-email").value, password = $("#auth-pass").value;
    err(null);
    if (mode === "signup" && name.trim().length < 2) return err("Please enter your name (2+ characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Please enter a valid email address.");
    if (password.length < 6) return err("Password must be at least 6 characters.");
    busy = true;
    const btn = $("#auth-submit");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 anim-spin"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg> Working…`;
    try {
      if (mode === "signin") {
        me = await api.signIn(email, password);
        toast({ title: `Welcome back, ${me.name}`, tone: "success" });
      } else {
        const res = await api.signUp(name, email, password);
        if (res && res.pendingConfirm) {
          err("Account created! Check your email to confirm, then sign in.");
          btn.textContent = "Create Account";
          busy = false;
          return;
        }
        me = res.user;
        toast({ title: "Account created", desc: `Welcome to Mind, ${me.name}.`, tone: "success" });
      }
      busy = false;
      closeAuth();
      setTimeout(() => (location.href = api.profileUrl()), 650);
    } catch (e) {
      err(e.message);
      btn.textContent = mode === "signin" ? "Sign In" : "Create Account";
      busy = false;
    }
  }
  $("#auth-submit").addEventListener("click", submitAuth);
  $("#auth-pass").addEventListener("keydown", (e) => e.key === "Enter" && submitAuth());

  /* ---------- account / download buttons ---------- */
  function paintButtons() {
    $$("[data-get-started]").forEach((b) => {
      b.textContent = me ? "Profile" : "Get Started";
      b.onclick = () => (me ? (location.href = api.profileUrl()) : openAuth());
    });
    $$("[data-download]").forEach((b) => (b.onclick = () => {
      if (!me) return openAuth();
      location.href = api.profileUrl();
    }));
  }

  /* ---------- boot ---------- */
  $("#auth-note").textContent = api.configured
    ? "Production authentication: your password is sent directly to Supabase Auth and is never stored by this website."
    : "Setup required: add SUPABASE_URL and SUPABASE_ANON_KEY in assets/config.js.";
  $("#backend-badge").innerHTML = api.configured
    ? '<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>SUPABASE · CONNECTED'
    : '<span class="h-1.5 w-1.5 rounded-full bg-rose-400"></span>SETUP REQUIRED';

  if (api.configured) me = await api.me();
  paintButtons();
  if (location.hash === "#auth") openAuth();
  if (window.lucide) lucide.createIcons();
})();
