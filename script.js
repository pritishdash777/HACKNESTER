/* ============================================================
   HackNESTER — script.js (production)
   ============================================================ */

const supabaseUrl = "https://yhipubroumcspclpybxz.supabase.co";
const supabaseKey = "sb_publishable_OvHOiX9o3CPHIRqPEhvLow_JJJkCsPM";

// Guard: ensure the Supabase SDK loaded
if (!window.supabase) {
  console.error("[HackNESTER] Supabase SDK failed to load.");
}

const supabaseClient = window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }, // no auth yet
      global: { headers: { "x-client-info": "hacknester-web" } },
    })
  : null;

(function () {
  "use strict";

  // ─── Utilities ──────────────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function debounce(fn, delay = 120) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
async function updateAuthUI() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  const session = data.session;

  const loginBtn = document.getElementById("loginNavBtn");
  const profileBtn = document.getElementById("profileNavBtn");

  if (!loginBtn || !profileBtn) return;

  if (session) {
    loginBtn.style.display = "none";

    profileBtn.style.display = "inline-flex";
    profileBtn.textContent =
      session.user.user_metadata.user_name ||
      session.user.email ||
      "Profile";
  }
}

document.addEventListener("DOMContentLoaded", updateAuthUI);
  // ─── Year ───────────────────────────────────────────────────────────────
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ─── Toast ──────────────────────────────────────────────────────────────
  const toast = $("#toast");
  const toastMsg = toast?.querySelector(".toast-message");
  let toastTimer;

  function showToast(msg, type = "info") {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.dataset.type = type;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
  }

  // ─── Navbar + Back-to-top + Active nav (single scroll handler) ──────────
  const navbar = $("#navbar");
  const backToTop = $("#backToTop");
  const sections = $$("section[id]");
  const navLinks = $$(".nav-links a, #mobileMenu a");

  function onScroll() {
    const y = window.scrollY;
    navbar?.classList.toggle("scrolled", y > 20);
    backToTop?.classList.toggle("show", y > 500);

    // Active nav highlight
    const scrollPos = y + 120;
    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute("id");
      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      }
    });
  }

  window.addEventListener("scroll", debounce(onScroll, 16), { passive: true });
  onScroll();

  backToTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ─── Mobile menu ────────────────────────────────────────────────────────
  const burger = $("#hamburgerBtn");
  const menu = $("#mobileMenu");

  function closeMenu() {
    menu?.classList.remove("open");
    burger?.classList.remove("open");
    burger?.setAttribute("aria-expanded", "false");
  }

  burger?.addEventListener("click", () => {
    const open = menu?.classList.toggle("open");
    burger?.classList.toggle("open", open);
    burger?.setAttribute("aria-expanded", String(!!open));
  });

  menu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));

  // ─── Modal ──────────────────────────────────────────────────────────────
  const modal = $("#createProjectModal");
  let previouslyFocused = null;

  function openModal() {
    if (!modal) return;
    previouslyFocused = document.activeElement;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#projTitle")?.focus(), 60);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    previouslyFocused?.focus?.();
    previouslyFocused = null;
  }

  $$("[data-open-modal]").forEach((btn) => btn.addEventListener("click", openModal));
  $$("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeModal));

  // Backdrop click (correct selector)
  modal?.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("modal-backdrop")) {
      closeModal();
    }
  });

  // ─── Global keyboard shortcuts (single listener) ────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      closeModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openModal();
    }
  });

  // ─── Toast triggers (data-toast) ────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-toast]");
    if (!el) return;
    e.preventDefault();
    showToast(el.getAttribute("data-toast") || "Done!");
  });

  // ─── Form helpers ───────────────────────────────────────────────────────
  function setFormLoading(form, isLoading) {
    const btn = form?.querySelector('[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle("loading", isLoading);
    btn.setAttribute("aria-busy", String(isLoading));
  }

  function mapSupabaseError(error) {
    if (!error) return "Something went wrong.";
    const msg = error.message || "";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return "Network error. Check your connection and try again.";
    }
    if (msg.includes("JWT") || msg.includes("Invalid API key")) {
      return "Configuration error. Please contact support.";
    }
    if (msg.includes("duplicate") || error.code === "23505") {
      return "This entry already exists.";
    }
    if (msg.includes("row-level security") || error.code === "42501") {
      return "Permission denied. Please try again later.";
    }
    return msg || "Request failed. Please try again.";
  }

  // ─── Email forms (waitlist + newsletter) ────────────────────────────────
  async function handleEmailForm(form, table) {
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!supabaseClient) {
        showToast("Service temporarily unavailable.", "error");
        return;
      }

      const input = form.querySelector('input[type="email"]');
      const email = (input?.value || "").trim().toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast("Please enter a valid university email.", "error");
        input?.focus();
        return;
      }

      setFormLoading(form, true);
      try {
        const { error } = await supabaseClient.from(table).insert([{ email }]);
        if (error) throw error;
        showToast("You're on the list! We'll be in touch.", "success");
        form.reset();
      } catch (err) {
        console.error(`[${table}] insert error:`, err);
        showToast(mapSupabaseError(err), "error");
      } finally {
        setFormLoading(form, false);
      }
    });
  }

  // Early Access form → Netlify function (insert + automated emails)
  const waitlistForm = $("#waitlistForm");
  if (waitlistForm) {
    waitlistForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const input = waitlistForm.querySelector('input[type="email"]');
      const email = (input?.value || "").trim().toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast("Please enter a valid university email.", "error");
        input?.focus();
        return;
      }

      setFormLoading(waitlistForm, true);
      try {
        const res = await fetch("/.netlify/functions/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Request failed");
        }

        showToast("You're on the list! Check your inbox for a welcome email.", "success");
        waitlistForm.reset();
      } catch (err) {
        console.error("[waitlist] error:", err);
        showToast(err.message || "Something went wrong. Please try again.", "error");
      } finally {
        setFormLoading(waitlistForm, false);
      }
    });
  }

  // Newsletter stays on direct Supabase insert
  handleEmailForm($("#newsletterForm"), "newsletter");
  // ─── Create Project form ────────────────────────────────────────────────
  const createProjectForm = $("#createProjectForm");

  // Cache inputs once
  const titleEl = $("#projTitle");
  const categoryEl = $("#projCategory");
  const teamSizeEl = $("#projTeamSize");
  const skillsEl = $("#projSkills");
  const descEl = $("#projDesc");

  if (createProjectForm) {
    createProjectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!supabaseClient) {
        showToast("Service temporarily unavailable.", "error");
        return;
      }

      // Fresh values at submit time
      const title = (titleEl?.value || "").trim();
      const category = (categoryEl?.value || "").trim();
      const team_size = Math.min(
        50,
        Math.max(1, parseInt(teamSizeEl?.value, 10) || 1)
      );
      const skills = (skillsEl?.value || "").trim();
      const description = (descEl?.value || "").trim();

      // Hard guards — never insert empties
      if (!title || title.length < 3) {
        showToast("Project title is required (min 3 characters).", "error");
        titleEl?.focus();
        return;
      }
      if (!description || description.length < 20) {
        showToast("Description is required (min 20 characters).", "error");
        descEl?.focus();
        return;
      }
      if (!category) {
        showToast("Please select a category.", "error");
        categoryEl?.focus();
        return;
      }

      const payload = {
        title,
        category,
        team_size,
        skills: skills || null, // store null instead of empty string if preferred
        description,
      };

      setFormLoading(createProjectForm, true);

      try {
        const { data, error } = await supabaseClient
          .from("projects")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        console.log("[projects] created:", data);
        showToast("Project posted successfully! 🎉", "success");
        createProjectForm.reset();
        closeModal();

        if (typeof window.refreshProjects === "function") {
          window.refreshProjects();
        }
      } catch (err) {
        console.error("[projects] insert error:", err);
        showToast(mapSupabaseError(err), "error");
      } finally {
        setFormLoading(createProjectForm, false);
      }
    });
  }

  // ─── FAQ Accordion ──────────────────────────────────────────────────────
  $$(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const ans = item?.querySelector(".faq-answer");
      if (!item || !ans) return;

      const isOpen = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(isOpen));

      if (isOpen) {
        ans.style.maxHeight = ans.scrollHeight + "px";
        ans.style.opacity = "1";
      } else {
        ans.style.maxHeight = "0";
        ans.style.opacity = "0";
      }

      // Close siblings
      $$(".faq-item.open").forEach((other) => {
        if (other === item) return;
        other.classList.remove("open");
        other.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
        const otherAns = other.querySelector(".faq-answer");
        if (otherAns) {
          otherAns.style.maxHeight = "0";
          otherAns.style.opacity = "0";
        }
      });
    });
  });

  // ─── Reveal on scroll ───────────────────────────────────────────────────
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  // ─── Optional character counter ─────────────────────────────────────────
  const descCounter = $("#descCounter");
  if (descEl && descCounter) {
    const update = () => {
      const len = descEl.value.length;
      descCounter.textContent = `${len} characters`;
      descCounter.classList.toggle("warn", len > 0 && len < 20);
    };
    descEl.addEventListener("input", update);
    update();
  }
/* ============================================================
   AI CHATBOT
============================================================ */
(function () {
  "use strict";

  const toggleBtn   = document.getElementById("hn-chat-toggle");
  const chatWindow  = document.getElementById("hn-chat-window");
  const closeBtn    = document.getElementById("hn-chat-close");
  const messagesEl  = document.getElementById("hn-chat-messages");
  const form        = document.getElementById("hn-chat-form");
  const input       = document.getElementById("hn-chat-input");
  const sendBtn     = document.getElementById("hn-chat-send");

  if (!toggleBtn || !chatWindow || !form) return;

  // Session history (kept only in memory for this tab)
  let history = [];

  // Welcome message
  function addWelcome() {
    if (messagesEl.children.length > 0) return;
    appendMessage(
      "bot",
      "Hey! I'm the HackNester AI. Ask me about finding teammates, hackathons, startups, tech careers, or anything related to building cool stuff with other students. What's on your mind?"
    );
  }

  function openChat() {
    chatWindow.hidden = false;
    // Force reflow then open for animation
    requestAnimationFrame(() => {
      chatWindow.classList.add("open");
      toggleBtn.classList.add("open");
      toggleBtn.setAttribute("aria-expanded", "true");
    });
    addWelcome();
    setTimeout(() => input.focus(), 280);
  }

  function closeChat() {
    chatWindow.classList.remove("open");
    toggleBtn.classList.remove("open");
    toggleBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      chatWindow.hidden = true;
    }, 250);
  }

  toggleBtn.addEventListener("click", () => {
    if (chatWindow.classList.contains("open")) closeChat();
    else openChat();
  });
  closeBtn.addEventListener("click", closeChat);

  // Escape closes chat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chatWindow.classList.contains("open")) {
      closeChat();
    }
  });

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `hn-msg hn-msg-${role === "user" ? "user" : "bot"}`;
    // Simple linkify + preserve newlines
    div.innerHTML = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "hn-typing";
    el.id = "hn-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    document.getElementById("hn-typing")?.remove();
  }

  function showError(msg) {
    const div = document.createElement("div");
    div.className = "hn-msg hn-msg-error";
    div.textContent = msg;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (input.value || "").trim();
    if (!text) return;

    // UI lock
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    appendMessage("user", text);
    history.push({ role: "user", content: text });

    showTyping();

    try {
      const res = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();

      hideTyping();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      const reply = data.reply || "Hmm, I got an empty response. Try again?";
      appendMessage("bot", reply);
      history.push({ role: "assistant", content: reply });

      // Keep history reasonable (last 12 messages)
      if (history.length > 12) {
        history = history.slice(-12);
      }
    } catch (err) {
      hideTyping();
      console.error("[HackNester Chat]", err);
      showError("Couldn't reach the AI right now. Check your connection or try again in a moment.");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();
  // ─── Init ───────────────────────────────────────────────────────────────
  console.log(
    "%cHackNESTER ready",
    "color:#34E5A8;font-weight:bold;font-size:12px"
  );
})();