const supabaseUrl = "https://yhipubroumcspclpybxz.supabase.co";
const supabaseKey = "sb_publishable_OvHOiX9o3CPHIRqPEhvLow_JJJkCsPM";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

(function () {
  "use strict";

  // ─── Utilities ────────────────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function debounce(fn, delay = 120) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ─── Year ─────────────────────────────────────────────────────────────────
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ─── Navbar + Back-to-top ─────────────────────────────────────────────────
  const navbar = $("#navbar");
  const backToTop = $("#backToTop");

  function onScroll() {
    const scrolled = window.scrollY > 20;
    navbar?.classList.toggle("scrolled", scrolled);
    backToTop?.classList.toggle("show", window.scrollY > 500);
  }

  window.addEventListener("scroll", debounce(onScroll, 16), { passive: true });
  onScroll();

  backToTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ─── Mobile menu ──────────────────────────────────────────────────────────
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

  // Close menu on Escape or outside click
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // ─── Toast system ─────────────────────────────────────────────────────────
  const toast = $("#toast");
  const toastMsg = toast?.querySelector(".toast-message");
  let toastTimer;

  function showToast(msg, type = "info") {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.dataset.type = type;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-toast]");
    if (el) {
      e.preventDefault();
      showToast(el.getAttribute("data-toast") || "Done!");
    }
  });

  // ─── Modal ────────────────────────────────────────────────────────────────
  const modal = $("#createProjectModal");

  function openModal() {
    modal?.classList.add("open");
    document.body.style.overflow = "hidden";
    // Focus first input for accessibility
    setTimeout(() => $("#projTitle")?.focus(), 80);
  }

  function closeModal() {
    modal?.classList.remove("open");
    document.body.style.overflow = "";
  }

  $$("[data-open-modal]").forEach((btn) => btn.addEventListener("click", openModal));
  $$("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeModal));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Close modal when clicking the backdrop
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ─── Form helpers ─────────────────────────────────────────────────────────
  function setFormLoading(form, isLoading) {
    const submitBtn = form.querySelector('[type="submit"]');
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.setAttribute("aria-busy", String(isLoading));
  }

  function validateProjectForm(data) {
    if (!data.title?.trim()) return "Project title is required.";
    if (data.title.trim().length < 3) return "Title must be at least 3 characters.";
    if (!data.category) return "Please select a category.";
    if (data.team_size < 1 || data.team_size > 50) return "Team size must be between 1 and 50.";
    if (!data.description?.trim()) return "Description is required.";
    if (data.description.trim().length < 20) return "Description should be at least 20 characters.";
    return null;
  }

  // ─── Create Project form ──────────────────────────────────────────────────
  const createProjectForm = $("#createProjectForm");

  if (createProjectForm) {
    createProjectForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = $("#projTitle")?.value?.trim() || "";
      const category = $("#projCategory")?.value || "";
      const team_size = parseInt($("#projTeamSize")?.value, 10) || 1;
      const skills = $("#projSkills")?.value?.trim() || "";
      const description = $("#projDesc")?.value?.trim() || "";

      const payload = { title, category, team_size, skills, description };

      const validationError = validateProjectForm(payload);
      if (validationError) {
        showToast(validationError, "error");
        return;
      }

      setFormLoading(createProjectForm, true);

      try {
        const { error } = await supabaseClient
        .from("projects")
        .insert([payload]);

        if (error) {
          console.error("Insert error:", error);
          showToast(error.message || "Failed to post project.", "error");
          return;
        }

        console.log("Project created:", payload);
        showToast("Project posted successfully! 🎉", "success");
        createProjectForm.reset();
        closeModal();

        // Optionally refresh a projects list if it exists on the page
        if (typeof window.refreshProjects === "function") {
          window.refreshProjects();
        }
      } catch (err) {
  console.error("Unexpected error:", err);
  alert(JSON.stringify(err));
  showToast(err.message || "Something went wrong.", "error");
}
      } finally {
        setFormLoading(createProjectForm, false);
      }
    });
  }

  // ─── FAQ Accordion ────────────────────────────────────────────────────────
  $$(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const ans = item?.querySelector(".faq-answer");
      if (!item || !ans) return;

      const isOpen = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(isOpen));

      // Smooth height animation
      if (isOpen) {
        ans.style.maxHeight = ans.scrollHeight + "px";
        ans.style.opacity = "1";
      } else {
        ans.style.maxHeight = "0";
        ans.style.opacity = "0";
      }

      // Close other open FAQ items (optional accordion behavior)
      $$(".faq-item.open").forEach((other) => {
        if (other !== item) {
          other.classList.remove("open");
          const otherBtn = other.querySelector(".faq-question");
          const otherAns = other.querySelector(".faq-answer");
          otherBtn?.setAttribute("aria-expanded", "false");
          if (otherAns) {
            otherAns.style.maxHeight = "0";
            otherAns.style.opacity = "0";
          }
        }
      });
    });
  });

  // ─── Reveal on scroll ─────────────────────────────────────────────────────
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

  // ─── Optional: live character counter for description ─────────────────────
  const descInput = $("#projDesc");
  const descCounter = $("#descCounter"); // optional element

  if (descInput && descCounter) {
    const updateCounter = () => {
      const len = descInput.value.length;
      descCounter.textContent = `${len} characters`;
      descCounter.classList.toggle("warn", len > 0 && len < 20);
    };
    descInput.addEventListener("input", updateCounter);
    updateCounter();
  }

  // ─── Smooth active nav link highlighting ──────────────────────────────────
  const sections = $$("section[id]");
  const navLinks = $$(".nav-links a, #mobileMenu a");

  function highlightNav() {
    const scrollPos = window.scrollY + 120;
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

  window.addEventListener("scroll", debounce(highlightNav, 50), { passive: true });
  highlightNav();

  // ─── Keyboard accessibility polish ────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    // Quick open create modal with Ctrl/Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openModal();
    }
  });

  // ─── Init complete ────────────────────────────────────────────────────────
  console.log("%cProject Hub ready", "color:#6ee7b7;font-weight:bold");
})();
