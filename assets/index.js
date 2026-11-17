/* Mind · SPA shell: tabs, intro, rain, auth (OTP) and checkout */
(async function () {
  "use strict";
  const { $, $$, api, toast, copyText, renderMockup, THEMES, isActive } = window.Mind;
  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  let me = null;
  let payBusy = false;
  let giftMode = false;
  let pendingRecipient = null;

  /* ================= boot: rain + intro ================= */
  void window.Mind.startRain(document.getElementById("rain"));
  void window.Mind.playIntro();

  /* ================= SPA tab navigation ================= */
  const TABS = ["home", "features", "showcase", "license", "faq", "discord"];
  const LEGACY_HASH = { access: "license", pricing: "license", community: "discord" };

  function currentHash() {
    const raw = location.hash.replace("#", "");
    return TABS.includes(raw) ? raw : LEGACY_HASH[raw] || "home";
  }

  function closeMobileMenu() {
    const menu = $("#nav-mobile");
    if (menu) menu.classList.remove("is-open");
    if (window.Mind) window.Mind.syncRainPause();
  }

  function switchTab(id, push = true) {
    if (!TABS.includes(id)) id = "home";
    $$(".tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === id));
    $$(".nav-tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === id));
    if (push && location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: "auto" });

    /* reveal content of the newly opened tab with a soft stagger */
    const panel = $(`#panel-${id}`);
    if (panel) {
      $$(".reveal", panel).forEach((el, i) => {
        if (el.classList.contains("visible")) return;
        el.style.transitionDelay = `${Math.min(i * 70, 420)}ms`;
        requestAnimationFrame(() => el.classList.add("visible"));
      });
    }
    /* icons are converted once at boot — no DOM re-scan here */
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-tab]");
    if (!trigger) return;
    e.preventDefault();
    switchTab(trigger.dataset.tab || "home");
  });
  window.addEventListener("popstate", () => switchTab(currentHash(), false));

  /* ================= mobile menu ================= */
  $$("#nav-mobile button").forEach((b) => b.addEventListener("click", closeMobileMenu));

  /* ================= marquee ================= */
  const ITEMS = [
    "Universal ESP", "Aim Assist", "Script Hub", "UI Library", "Auto Updates",
    "Lua 5.4 Runtime", "Cloud Profiles", "Speed Hub", "Anti-AFK",
  ];
  $("#marquee").innerHTML = [...ITEMS, ...ITEMS]
    .map(
      (s) => `<span class="flex items-center gap-10"><span class="mono text-[11px] font-medium tracking-[0.35em] whitespace-nowrap text-white/30 uppercase">${s}</span><span class="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-accent to-aqua"></span></span>`
    )
    .join("");

  /* ================= features ================= */
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

  /* ================= FAQ ================= */
  const FAQ = [
    ["What are the system requirements?", "Mind runs on Windows 10 and 11 (64-bit): 4 GB of RAM, ~40 MB of disk space and an up-to-date WebView2 runtime. No administrator rights are required after the first setup."],
    ["How do I get access?", "Open the License tab, pick a plan and pay with the method you like. Your MIND-XXXX-XXXX-XXXX key is issued automatically and saved to your profile — activate it there."],
    ["How do I install Mind?", "Download the build, run it once — Mind places a portable install in your user folder. Open your game, press Attach, and you're in. Under 60 seconds: no drivers, no restarts."],
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
  $$("[data-faq]").forEach((item) => {
    const btn = $("button", item), panel = $(".acc-panel", item), ico = $(".faq-ico", item);
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

  /* ================= mockups + themes ================= */
  renderMockup($("#hero-mockup"));
  const showMockup = renderMockup($("#showcase-mockup"));
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

  /* ================= hero tilt + cursor glow ================= */
  const hero = $("#hero"), glow = $("#cursor-glow"), tilt = $("#tilt-inner");
  if (hero && glow && tilt) {
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
  }

  /* ================= auth modal (sign in / register / OTP) ================= */
  const modal = $("#modal-auth");
  let mode = "signin", screen = "auth", otpPurpose = "signup", otpEmail = "";
  let busy = false, resendLeft = 0, resendInt = null;

  const err = (boxId, msg) => {
    const box = $(boxId);
    box.classList.toggle("hidden", !msg);
    box.classList.toggle("flex", !!msg);
    if (msg) box.textContent = msg;
  };

  function showScreen(name) {
    screen = name;
    $("#scr-auth").classList.toggle("hidden", name !== "auth");
    $("#scr-otp").classList.toggle("hidden", name !== "otp");
    $("#scr-newpw").classList.toggle("hidden", name !== "newpw");
    $("#auth-tabs").classList.toggle("hidden", name !== "auth");

    const titles = {
      auth: mode === "signin" ? ["Welcome back", "Sign in to manage your license & HWID."] : ["Create your account", "Register to receive and activate keys."],
      otp: otpPurpose === "signup" ? ["Confirm your email", "We sent a 6-digit code to your inbox."] : ["Reset your password", "Enter the 6-digit code from the email."],
      newpw: ["New password", "Set a new password for your account."],
    };
    $("#auth-title").textContent = titles[name][0];
    $("#auth-sub").textContent = titles[name][1];
  }

  function setMode(m) {
    mode = m;
    $("#auth-name-wrap").classList.toggle("hidden", m === "signin");
    $("#auth-name-wrap").classList.toggle("block", m === "signup");
    $("#auth-username-wrap").classList.toggle("hidden", m === "signin");
    $("#auth-username-wrap").classList.toggle("block", m === "signup");
    $("#auth-tab-in").className =
      "rounded-lg py-2 text-[13px] font-bold transition " +
      (m === "signin" ? "bg-gradient-to-r from-accent/80 to-aqua/80 text-white" : "text-white/40 hover:text-white/70");
    $("#auth-tab-up").className =
      "rounded-lg py-2 text-[13px] font-bold transition " +
      (m === "signup" ? "bg-gradient-to-r from-accent/80 to-aqua/80 text-white" : "text-white/40 hover:text-white/70");
    showScreen("auth");
    err("#auth-error", null);
  }

  function startResend(seconds = 60) {
    const btn = $("#otp-resend"), label = $("#otp-timer");
    clearInterval(resendInt);
    resendLeft = seconds;
    btn.disabled = true;
    btn.classList.add("opacity-50", "cursor-not-allowed");
    label.textContent = `(${resendLeft}s)`;
    resendInt = setInterval(() => {
      resendLeft--;
      if (resendLeft <= 0) {
        clearInterval(resendInt);
        label.textContent = "";
        btn.disabled = false;
        btn.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        label.textContent = `(${resendLeft}s)`;
      }
    }, 1000);
  }

  function openAuth() {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    showScreen("auth");
  }
  function closeAuth() {
    if (busy) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
    clearInterval(resendInt);
  }

  $("#auth-close").addEventListener("click", closeAuth);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeAuth(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeAuth(); closeSuccess(); closeGiftConfirm(); } });
  $("#auth-tab-in").addEventListener("click", () => setMode("signin"));
  $("#auth-tab-up").addEventListener("click", () => setMode("signup"));
  $("#auth-toggle-pw").addEventListener("click", () => {
    const p = $("#auth-pass");
    p.type = p.type === "password" ? "text" : "password";
  });

  /* live @username check (server-side via check_username RPC) */
  let usernameTimer = null;
  $("#auth-username").addEventListener("input", (e) => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    const hint = $("#auth-username-hint");
    const v = e.target.value;
    clearTimeout(usernameTimer);
    if (v.length < 3) {
      hint.textContent = "3–20 символов: латиница, цифры и _";
      hint.className = "mt-1.5 block text-[10.5px] text-white/35";
      return;
    }
    if (!USERNAME_RE.test(v)) {
      hint.textContent = "Только латиница, цифры и _";
      hint.className = "mt-1.5 block text-[10.5px] text-rose-300";
      return;
    }
    hint.textContent = "Проверяем доступность...";
    hint.className = "mt-1.5 block text-[10.5px] text-white/35";
    usernameTimer = setTimeout(async () => {
      if (!api.configured) return;
      try {
        const res = await api.checkUsername(v);
        if (!res || !res.valid || (res.exists && !res.is_own)) {
          hint.textContent = "Этот юзернейм уже занят";
          hint.className = "mt-1.5 block text-[10.5px] font-bold text-rose-300";
        } else {
          hint.textContent = `@${v} — свободен`;
          hint.className = "mt-1.5 block text-[10.5px] font-bold text-emerald-300";
        }
      } catch {
        hint.textContent = "Проверим при регистрации";
        hint.className = "mt-1.5 block text-[10.5px] text-white/35";
      }
    }, 350);
  });

  function setBusy(button, label, isBusy) {
    busy = isBusy;
    button.disabled = isBusy;
    button.classList.toggle("opacity-70", isBusy);
    button.classList.toggle("cursor-wait", isBusy);
    if (isBusy) button.dataset.prev = button.innerHTML;
    button.innerHTML = isBusy
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 anim-spin"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg> ${label}`
      : button.dataset.prev || button.innerHTML;
  }

  async function finishAuth() {
    closeAuth();
    setTimeout(() => (location.href = api.profileUrl()), 500);
  }

  async function submitAuth() {
    if (busy) return;
    const name = $("#auth-name").value, email = $("#auth-email").value, password = $("#auth-pass").value;
    err("#auth-error", null);
    if (mode === "signup" && name.trim().length < 2) return err("#auth-error", "Please enter your name (2+ characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("#auth-error", "Please enter a valid email address.");
    if (mode === "signup") {
      const uname = $("#auth-username").value.trim().toLowerCase();
      if (!USERNAME_RE.test(uname)) {
        return err("#auth-error", "Введите @username: 3–20 символов, латиница, цифры и _");
      }
      if (api.configured) {
        try {
          const res = await api.checkUsername(uname);
          if (res && res.valid && res.exists && !res.is_own) {
            return err("#auth-error", "Этот юзернейм уже занят");
          }
        } catch {
          /* fall through — the unique index rejects duplicates on the server */
        }
      }
    }
    if (password.length < 6) return err("#auth-error", "Password must be at least 6 characters.");
    if (!api.configured) return err("#auth-error", "Supabase is not configured yet — see DEVELOPER_DOCS.md.");

    const btn = $("#auth-submit");
    setBusy(btn, mode === "signin" ? "Signing in…" : "Creating account…", true);
    try {
      if (mode === "signin") {
        me = await api.signIn(email, password);
        toast({ title: `Welcome back, ${me.name}`, tone: "success" });
        setBusy(btn, "", false);
        await finishAuth();
        return;
      }
      const res = await api.signUp(name, email, password, $("#auth-username").value);
      if (res && res.pendingConfirm) {
        otpPurpose = "signup";
        otpEmail = email.trim().toLowerCase();
        $("#otp-email").textContent = otpEmail;
        $("#otp-label").textContent = "We sent a 6-digit code to your email. Enter it below.";
        err("#otp-error", null);
        $("#otp-input").value = "";
        setBusy(btn, "", false);
        showScreen("otp");
        startResend(60);
        toast({ title: "Confirmation code sent", desc: `Check ${otpEmail} for a 6-digit code.`, tone: "info" });
        return;
      }
      me = res.user;
      toast({ title: "Account created", desc: `Welcome to Mind, ${me.name}.`, tone: "success" });
      setBusy(btn, "", false);
      await finishAuth();
    } catch (e) {
      setBusy(btn, "", false);
      err("#auth-error", e.message);
    }
  }
  $("#auth-submit").addEventListener("click", submitAuth);
  $("#auth-pass").addEventListener("keydown", (e) => e.key === "Enter" && submitAuth());

  /* forgot password → recovery OTP → new password */
  $("#auth-forgot").addEventListener("click", async () => {
    if (busy) return;
    const email = $("#auth-email").value;
    err("#auth-error", null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("#auth-error", "Enter your email first, then press Forgot password.");
    if (!api.configured) return err("#auth-error", "Supabase is not configured yet — see DEVELOPER_DOCS.md.");
    const btn = $("#auth-submit");
    setBusy(btn, "Sending code…", true);
    try {
      await api.resetPasswordForEmail(email);
      otpPurpose = "recovery";
      otpEmail = email.trim().toLowerCase();
      $("#otp-email").textContent = otpEmail;
      $("#otp-label").textContent = "We sent a 6-digit recovery code. Enter it below.";
      err("#otp-error", null);
      $("#otp-input").value = "";
      setBusy(btn, "", false);
      showScreen("otp");
      startResend(60);
      toast({ title: "Recovery code sent", desc: `Check ${otpEmail}.`, tone: "info" });
    } catch (e) {
      setBusy(btn, "", false);
      err("#auth-error", e.message);
    }
  });

  $("#otp-back").addEventListener("click", () => { clearInterval(resendInt); showScreen("auth"); });
  $("#np-back").addEventListener("click", () => showScreen("auth"));

  async function verifyOtp() {
    if (busy) return;
    const token = $("#otp-input").value.replace(/\D/g, "");
    err("#otp-error", null);
    if (token.length !== 6) return err("#otp-error", "Enter the 6-digit code from your email.");
    const btn = $("#otp-verify");
    setBusy(btn, "Confirming…", true);
    try {
      await api.verifyOtp(otpEmail, token, otpPurpose);
      setBusy(btn, "", false);
      if (otpPurpose === "signup") {
        me = await api.me();
        toast({ title: "Email confirmed", desc: "Your account is ready.", tone: "success" });
        await finishAuth();
      } else {
        showScreen("newpw");
        $("#np-pass").focus();
      }
    } catch (e) {
      setBusy(btn, "", false);
      err("#otp-error", e.message);
    }
  }
  $("#otp-verify").addEventListener("click", verifyOtp);
  $("#otp-input").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  });
  $("#otp-input").addEventListener("keydown", (e) => e.key === "Enter" && verifyOtp());

  $("#otp-resend").addEventListener("click", async () => {
    if (busy || resendLeft > 0) return;
    busy = true;
    try {
      await api.sendOtp(otpEmail, otpPurpose);
      startResend(60);
      toast({ title: "Code resent", desc: `A new code was sent to ${otpEmail}.`, tone: "info" });
    } catch (e) {
      toast({ title: "Could not resend", desc: e.message, tone: "error" });
    } finally {
      busy = false;
    }
  });

  async function savePassword() {
    if (busy) return;
    const p1 = $("#np-pass").value, p2 = $("#np-pass2").value;
    err("#np-error", null);
    if (p1.length < 6) return err("#np-error", "Password must be at least 6 characters.");
    if (p1 !== p2) return err("#np-error", "Passwords do not match.");
    const btn = $("#np-submit");
    setBusy(btn, "Saving…", true);
    try {
      await api.updatePassword(p1);
      setBusy(btn, "", false);
      me = await api.me();
      toast({ title: "Password updated", desc: "You are signed in.", tone: "success" });
      await finishAuth();
    } catch (e) {
      setBusy(btn, "", false);
      err("#np-error", e.message);
    }
  }
  $("#np-submit").addEventListener("click", savePassword);
  $("#np-pass2").addEventListener("keydown", (e) => e.key === "Enter" && savePassword());

  /* ================= license: plans + payment ================= */
  const plans = window.MIND_PLANS || [];
  const methods = window.MIND_PAYMENT_METHODS || [];
  let selPlan = plans.find((p) => p.default) || plans[1] || plans[0];
  let selMethod = methods[0];

  function paintPlans() {
    $("#plan-grid").innerHTML = plans
      .map((p) => {
        const on = selPlan && p.id === selPlan.id;
        return `
        <button data-plan="${p.id}" class="plan-card relative overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-xl ${on ? "is-selected" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]"}">
          ${p.badge ? `<span class="mono absolute top-3 right-3 rounded-full bg-gradient-to-r from-accent to-aqua px-2.5 py-1 text-[9px] font-bold tracking-wider text-white uppercase shadow-lg">${p.badge}</span>` : ""}
          <p class="mono text-[10px] font-semibold tracking-[0.24em] text-white/40 uppercase">${p.title}</p>
          <p class="mt-3 text-3xl font-extrabold tracking-tight text-white">$${p.priceUSD.toFixed(2)}</p>
          <p class="mt-1.5 text-[11.5px] ${on ? "text-white/60" : "text-white/35"}">${p.note}</p>
          <span class="mt-4 flex items-center gap-2 text-[11px] font-bold ${on ? "text-accent" : "text-white/35"}">
            <span class="grid h-4 w-4 place-items-center rounded-full border ${on ? "border-accent bg-accent/20" : "border-white/25"}">${on ? '<span class="h-2 w-2 rounded-full bg-accent"></span>' : ""}</span>
            ${on ? "Selected" : "Select"}
          </span>
        </button>`;
      })
      .join("");
    $$("#plan-grid [data-plan]").forEach((b) =>
      b.addEventListener("click", () => {
        selPlan = plans.find((p) => p.id === b.dataset.plan) || selPlan;
        paintPlans();
        paintPayLabel();
      })
    );
  }

  function paintPayLabel() {
    if (selPlan) $("#pay-label").textContent = `Pay $${selPlan.priceUSD.toFixed(2)} & Get Key`;
  }

  function paintMethods() {
    $("#pay-grid").innerHTML = methods
      .map((m) => {
        const on = selMethod && m.id === selMethod.id;
        return `
        <button data-method="${m.id}" class="pay-card flex flex-col gap-1.5 rounded-2xl border p-4 text-left backdrop-blur-xl transition-all duration-300 ${on ? "is-selected" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]"}">
          <span class="flex items-center justify-between">
            <i data-lucide="${m.icon}" class="h-5 w-5 ${on ? "text-aqua" : "text-white/40"}"></i>
            <span class="grid h-4 w-4 place-items-center rounded-full border ${on ? "border-aqua bg-aqua/20" : "border-white/25"}">${on ? '<span class="h-2 w-2 rounded-full bg-aqua"></span>' : ""}</span>
          </span>
          <span class="mt-1 text-[13.5px] font-bold text-white">${m.title}</span>
          <span class="mono text-[9.5px] tracking-wider text-white/35">${m.brands}</span>
        </button>`;
      })
      .join("");
    $$("#pay-grid [data-method]").forEach((b) =>
      b.addEventListener("click", () => {
        selMethod = methods.find((m) => m.id === b.dataset.method) || selMethod;
        paintMethods();
        if (window.lucide) lucide.createIcons();
      })
    );
    if (window.lucide) lucide.createIcons();
  }

  function openSuccess(result) {
    $("#succ-key").textContent = result.key;
    $("#succ-plan").textContent = `${result.plan.title} · $${result.plan.priceUSD.toFixed(2)}`;
    $("#succ-method").textContent = result.method.title;
    $("#succ-sub").textContent =
      result.mode === "gift"
        ? `Ключ выдан пользователю @${result.recipient}.`
        : result.mode === "developer"
          ? "Developer-mode checkout — the key was issued directly to your profile."
          : "Your license key is ready and saved to your profile.";
    $("#modal-success").classList.remove("hidden");
    $("#modal-success").classList.add("flex");
    document.body.style.overflow = "hidden";
    if (window.lucide) lucide.createIcons();
  }
  function closeSuccess() {
    const m = $("#modal-success");
    if (!m || m.classList.contains("hidden")) return;
    m.classList.add("hidden");
    m.classList.remove("flex");
    document.body.style.overflow = "";
  }
  $("#succ-close").addEventListener("click", closeSuccess);
  $("#modal-success").addEventListener("click", (e) => { if (e.target.id === "modal-success") closeSuccess(); });
  $("#succ-profile").addEventListener("click", () => (location.href = api.profileUrl()));
  $("#succ-copy").addEventListener("click", async () => {
    const ok = await copyText($("#succ-key").textContent);
    toast({ title: ok ? "Key copied" : "Copy failed", tone: ok ? "success" : "error" });
  });

  /* ---- gift purchase flow ---- */
  function paintGift() {
    const btn = $("#gift-toggle"), knob = $("#gift-knob"), box = $("#gift-recipient");
    btn.setAttribute("aria-checked", String(giftMode));
    btn.className =
      "relative h-7 w-12 shrink-0 rounded-full border transition-all duration-300 " +
      (giftMode
        ? "border-aqua/60 bg-gradient-to-r from-accent to-aqua shadow-[0_0_18px_-4px_rgba(6,182,212,0.7)]"
        : "border-white/15 bg-white/[0.06]");
    knob.className =
      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 " +
      (giftMode ? "left-[26px]" : "left-0.5");
    box.classList.toggle("hidden", !giftMode);
    paintPurchaseState();
  }

  function selfBlocked() {
    return !giftMode && Boolean(me && isActive(me));
  }

  function paintPurchaseState() {
    const pay = $("#pay-btn");
    const blocked = selfBlocked();
    $("#self-block").classList.toggle("hidden", !blocked);
    pay.disabled = blocked;
    pay.classList.toggle("opacity-50", blocked);
    pay.classList.toggle("cursor-not-allowed", blocked);
    pay.title = blocked
      ? "Активная лицензия уже есть — подарите ключ другому"
      : "";
  }

  function openGiftConfirm(username, hasLicense) {
    pendingRecipient = username;
    $("#gift-confirm-name").textContent = "@" + username;
    $("#gift-confirm-warn").classList.toggle("hidden", !hasLicense);
    $("#modal-gift").classList.remove("hidden");
    $("#modal-gift").classList.add("flex");
    document.body.style.overflow = "hidden";
    if (window.lucide) lucide.createIcons();
  }

  function closeGiftConfirm() {
    const m = $("#modal-gift");
    if (!m || m.classList.contains("hidden")) return;
    m.classList.add("hidden");
    m.classList.remove("flex");
    document.body.style.overflow = "";
    pendingRecipient = null;
  }

  $("#gift-toggle").addEventListener("click", () => {
    giftMode = !giftMode;
    paintGift();
    if (giftMode) $("#gift-username").focus();
  });

  $("#gift-username").addEventListener("input", (e) => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    $("#gift-hint").textContent = "Подарок можно купить даже при активной лицензии";
    $("#gift-hint").className = "mt-1.5 text-[10.5px] text-white/35";
  });

  $("#gift-no").addEventListener("click", closeGiftConfirm);
  $("#modal-gift").addEventListener("click", (e) => {
    if (e.target.id === "modal-gift") closeGiftConfirm();
  });
  $("#gift-yes").addEventListener("click", () => {
    const recipient = pendingRecipient;
    closeGiftConfirm();
    void runCheckout(recipient);
  });

  async function runCheckout(recipient) {
    if (payBusy) return;
    if (!api.configured) {
      toast({ title: "Supabase not configured", desc: "Add your keys in assets/config.js first.", tone: "error" });
      return;
    }
    if (!me) {
      openAuth();
      toast({ title: "Sign in first", desc: "Your key must be bound to an account.", tone: "info" });
      return;
    }
    if (!recipient && isActive(me)) {
      toast({
        title: "У вас уже есть активная лицензия",
        desc: "Вы можете приобрести ключ в подарок другому пользователю",
        tone: "info",
      });
      paintPurchaseState();
      return;
    }
    payBusy = true;
    const btn = $("#pay-btn"), label = $("#pay-label");
    const prev = label.textContent;
    btn.disabled = true;
    label.textContent = "Processing payment…";
    try {
      const result = await window.MindCheckout.handleCheckout({
        planId: selPlan.id,
        paymentMethodId: selMethod.id,
        recipientUsername: recipient || null,
      });
      me = await api.me();
      paintButtons();
      openSuccess(result);
      toast({
        title: "Payment confirmed",
        desc: recipient ? `Ключ выдан @${recipient}.` : "License key issued.",
        tone: "success",
      });
    } catch (e) {
      toast({ title: "Checkout failed", desc: e.message, tone: "error" });
    } finally {
      payBusy = false;
      btn.disabled = false;
      label.textContent = prev;
      paintPurchaseState();
    }
  }

  $("#pay-btn").addEventListener("click", async () => {
    if (payBusy) return;
    if (selfBlocked()) {
      toast({
        title: "У вас уже есть активная лицензия",
        desc: "Вы можете приобрести ключ в подарок другому пользователю",
        tone: "info",
      });
      return;
    }
    if (giftMode) {
      const u = $("#gift-username").value.trim().toLowerCase();
      if (!USERNAME_RE.test(u)) {
        toast({ title: "Неверный @username", desc: "3–20 символов: латиница, цифры и _", tone: "error" });
        return;
      }
      if (!api.configured) {
        toast({ title: "Supabase not configured", desc: "Add your keys in assets/config.js first.", tone: "error" });
        return;
      }
      if (!me) {
        openAuth();
        return;
      }
      try {
        const res = await api.checkUsername(u);
        if (!res || res.valid === false || !res.exists || res.is_own) {
          $("#gift-hint").textContent = "Пользователь с таким юзернеймом не найден";
          $("#gift-hint").className = "mt-1.5 text-[10.5px] font-bold text-rose-300";
          toast({ title: "Пользователь с таким юзернеймом не найден", tone: "error" });
          return;
        }
        openGiftConfirm(u, res.has_active_license);
      } catch (e) {
        toast({ title: "Ошибка проверки получателя", desc: e.message, tone: "error" });
      }
      return;
    }
    await runCheckout(null);
  });

  /* ================= account buttons ================= */
  function paintButtons() {
    $$("[data-get-started]").forEach((b) => {
      b.textContent = me ? "Profile" : "Get Started";
      b.onclick = () => (me ? (location.href = api.profileUrl()) : openAuth());
    });
    $$("[data-profile]").forEach((b) => (b.onclick = () => {
      if (me) return (location.href = api.profileUrl());
      openAuth();
      toast({ title: "Sign in to open your profile", tone: "info" });
    }));
    paintPurchaseState();
    $$("[data-download]").forEach((b) => (b.onclick = () => {
      if (!me) return openAuth();
      location.href = api.profileUrl();
    }));
  }

  /* ================= boot ================= */
  /* 1) paint the whole interface first — the UI never waits for the network */
  paintPlans();
  paintPayLabel();
  paintMethods();
  paintGift();
  paintButtons();
  switchTab(currentHash(), false);
  if (location.hash === "#auth") openAuth();
  if (window.lucide) lucide.createIcons();

  /* 2) session/profile check runs in the background with a 4.5s timeout */
  if (api.configured) {
    api
      .me()
      .then((u) => {
        me = u;
        paintButtons();
        paintPurchaseState();
      })
      .catch(() => {});
  }
})();
