/* ============================================================
   HackNESTER — projects.js
   Fetches projects from Supabase and renders the feed.
   Depends on: supabase-js CDN + script.js (supabaseClient, toast, reveal)
   ============================================================ */

(function () {
  "use strict";

  const feedEl = document.getElementById("projectsFeed");
  const searchEl = document.getElementById("projectSearch");
  const filterBtns = Array.from(document.querySelectorAll(".filter-btn"));

  if (!feedEl) return;

  let allProjects = [];
  let activeFilter = "all";
  let searchQuery = "";

  // Category class mapping (reuse landing styles where possible)
  function categoryClass(cat) {
    if (!cat) return "";
    const c = String(cat).toLowerCase();
    if (c.includes("hackathon")) return "cat-hackathon";
    if (c.includes("startup")) return "cat-startup";
    if (c.includes("research")) return "cat-research";
    if (c.includes("open")) return "cat-opensource";
    if (c.includes("ai") || c.includes("ml")) return "cat-research";
    if (c.includes("web")) return "cat-hackathon";
    if (c.includes("app")) return "cat-startup";
    if (c.includes("block")) return "cat-opensource";
    if (c.includes("cyber") || c.includes("security")) return "cat-startup";
    return "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "Recently";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "Recently";
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  }

  function skillsToTags(skills) {
    if (!skills) return "";
    const list = Array.isArray(skills)
      ? skills
      : String(skills)
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean);
    if (!list.length) return "";
    return (
      '<div class="skill-tags">' +
      list
        .slice(0, 6)
        .map((s) => '<span class="skill-tag">' + escapeHtml(s) + "</span>")
        .join("") +
      "</div>"
    );
  }

  function shortDesc(text, max = 140) {
    const t = String(text || "").trim();
    if (t.length <= max) return t;
    return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
  }

  function matchesFilter(p, filter) {
    if (filter === "all") return true;
    const hay = [
      p.category,
      p.title,
      p.description,
      p.skills,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const f = filter.toLowerCase();
    // flexible match so DB categories like "Hackathon" / "Startup MVP" still work
    if (f === "ai") return /ai|ml|machine learning|artificial/.test(hay);
    if (f === "web dev") return /web|react|node|frontend|backend|full.?stack|javascript|typescript/.test(hay);
    if (f === "app dev") return /app|mobile|android|ios|flutter|react native/.test(hay);
    if (f === "blockchain") return /blockchain|web3|crypto|solidity|ethereum/.test(hay);
    if (f === "cybersecurity") return /cyber|security|pentest|hacking|infosec/.test(hay);
    return hay.includes(f);
  }

  function matchesSearch(p, q) {
    if (!q) return true;
    const hay = [p.title, p.description, p.skills, p.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  function renderCard(p) {
    const title = escapeHtml(p.title || "Untitled project");
    const category = escapeHtml(p.category || "General");
    const catClass = categoryClass(p.category);
    const desc = escapeHtml(shortDesc(p.description));
    const postedBy = escapeHtml(
      p.posted_by || p.author || p.user_name || p.created_by || "Community"
    );
    const date = formatDate(p.created_at || p.posted_at || p.inserted_at);
    const skillsHtml = skillsToTags(p.skills);
    const id = p.id != null ? String(p.id) : "";

    return (
      '<article class="project-card glow-card reveal" data-id="' +
      escapeHtml(id) +
      '">' +
      '<span class="project-category ' +
      catClass +
      '">' +
      category +
      "</span>" +
      '<h3 class="project-title">' +
      title +
      "</h3>" +
      '<p class="project-desc">' +
      desc +
      "</p>" +
      skillsHtml +
      '<div class="project-meta">' +
      "<span>Posted by " +
      postedBy +
      "</span>" +
      "<span>" +
      date +
      "</span>" +
      (p.team_size
        ? "<span>Team size: " + escapeHtml(String(p.team_size)) + "</span>"
        : "") +
      "</div>" +
      '<div class="project-actions">' +
      '<button type="button" class="btn btn-secondary btn-sm view-details-btn" data-id="' +
      escapeHtml(id) +
      '">View Details</button>' +
      "</div>" +
      "</article>"
    );
  }

  function render() {
    const q = searchQuery.trim().toLowerCase();
    const filtered = allProjects.filter(
      (p) => matchesFilter(p, activeFilter) && matchesSearch(p, q)
    );

    if (!filtered.length) {
      feedEl.innerHTML =
        '<div class="projects-empty">' +
        (allProjects.length
          ? "No projects match your search or filter."
          : "No projects posted yet. Be the first!") +
        '<br><a href="index.html" class="btn btn-primary btn-sm" style="margin-top:16px;display:inline-flex">Back to home</a>' +
        "</div>";
      return;
    }

    feedEl.innerHTML = filtered.map(renderCard).join("");

    // Reveal animation (same observer pattern as script.js)
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
    feedEl.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

    // View Details
    feedEl.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const project = allProjects.find((x) => String(x.id) === id);
        if (!project) return;
        const full =
          (project.title || "Project") +
          "\n\n" +
          (project.description || "No description.") +
          "\n\nSkills: " +
          (project.skills || "—") +
          "\nCategory: " +
          (project.category || "—");
        // Prefer toast for short note; alert for full text until detail page exists
        if (typeof window.showToast === "function") {
          // showToast is not global; use data-toast pattern via custom event or alert
        }
        alert(full);
      });
    });
  }

  async function loadProjects() {
    feedEl.innerHTML = '<div class="projects-loading">Loading projects…</div>';

    if (!window.supabaseClient && typeof supabaseClient === "undefined") {
      // script.js defines const supabaseClient in outer scope
    }

    const client =
      typeof supabaseClient !== "undefined"
        ? supabaseClient
        : window.supabaseClient || null;

    if (!client) {
      feedEl.innerHTML =
        '<div class="projects-error">Unable to connect to the database. Please refresh the page.</div>';
      return;
    }

    try {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      allProjects = Array.isArray(data) ? data : [];
      render();
    } catch (err) {
      console.error("[projects] fetch error:", err);
      feedEl.innerHTML =
        '<div class="projects-error">Could not load projects. Please try again later.</div>';
    }
  }

  // Search (debounced)
  let searchTimer;
  searchEl?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value || "";
      render();
    }, 180);
  });

  // Filters
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.getAttribute("data-filter") || "all";
      render();
    });
  });

  // Allow landing page create-form to refresh this list if open in same tab later
  window.refreshProjects = loadProjects;

  loadProjects();
})();
