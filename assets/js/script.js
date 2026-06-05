"use strict";

//
// --- CORE FUNCTIONALITY (Runs on all pages) ---
//

// Element toggle function
const elementToggleFunc = function (elem) {
  elem.classList.toggle("active");
};

// Sidebar toggle for mobile
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// The sidebar button might not exist on all layouts, so we check for it.
if (sidebar && sidebarBtn) {
  sidebarBtn.addEventListener("click", function () {
    elementToggleFunc(sidebar);
  });
}

//
// --- PAGE-SPECIFIC FUNCTIONALITY ---
//

// --- Testimonials Modal (Only runs if modal elements are on the page, e.g., index.html) ---
const testimonialsItem = document.querySelectorAll("[data-testimonials-item]");
const modalContainer = document.querySelector("[data-modal-container]");

if (modalContainer && testimonialsItem.length > 0) {
  const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
  const overlay = document.querySelector("[data-overlay]");
  const modalImg = document.querySelector("[data-modal-img]");
  const modalTitle = document.querySelector("[data-modal-title]");
  const modalText = document.querySelector("[data-modal-text]");

  const testimonialsModalFunc = function () {
    modalContainer.classList.toggle("active");
    overlay.classList.toggle("active");
  };

  // Add click event to all modal items
  for (let i = 0; i < testimonialsItem.length; i++) {
    testimonialsItem[i].addEventListener("click", function () {
      modalImg.src = this.querySelector("[data-testimonials-avatar]").src;
      modalImg.alt = this.querySelector("[data-testimonials-avatar]").alt;
      modalTitle.innerHTML = this.querySelector(
        "[data-testimonials-title]"
      ).innerHTML;
      modalText.innerHTML = this.querySelector(
        "[data-testimonials-text]"
      ).innerHTML;
      testimonialsModalFunc();
    });
  }

  // Add click event to modal close button and overlay
  modalCloseBtn.addEventListener("click", testimonialsModalFunc);
  overlay.addEventListener("click", testimonialsModalFunc);
}

// --- Projects Filter & dynamic GitHub repos loading (Only runs if project-list exists) ---
const projectListContainer = document.querySelector(".project-list");

function getCategory(repo) {
  const name = repo.name.toLowerCase();
  const desc = (repo.description || '').toLowerCase();
  const topics = (repo.topics || []).map(t => t.toLowerCase());

  const hasKeyword = (word) => {
    return name.includes(word) || desc.includes(word) || topics.includes(word);
  };

  if (hasKeyword('selenium')) return 'selenium testing';
  if (hasKeyword('playwright')) return 'playwright testing';
  if (hasKeyword('cypress')) return 'cypress testing';
  if (hasKeyword('api') || hasKeyword('postman') || hasKeyword('karate') || hasKeyword('rest-assured')) return 'api testing';
  if (hasKeyword('load-testing') || hasKeyword('k6') || hasKeyword('jmeter')) return 'load-testing';
  if (hasKeyword('performance') || hasKeyword('lighthouse')) return 'performance testing';
  if (hasKeyword('visual') || hasKeyword('pixel') || hasKeyword('resemble') || hasKeyword('percy') || hasKeyword('applitools')) return 'visual testing';
  if (hasKeyword('database') || hasKeyword('sql') || hasKeyword('mongo') || hasKeyword('db-testing')) return 'database testing';
  if (hasKeyword('accessibility') || hasKeyword('a11y') || hasKeyword('axe')) return 'accessibility testing';
  
  return 'web applications';
}

function initFiltering() {
  const select = document.querySelector("[data-select]");
  if (!select) return;

  const selectItems = document.querySelectorAll("[data-select-item]");
  const selectValue = document.querySelector("[data-selecct-value]");
  const filterBtn = document.querySelectorAll("[data-filter-btn]");
  const filterItems = document.querySelectorAll("[data-filter-item]");

  select.onclick = function () {
    elementToggleFunc(this);
  };

  for (let i = 0; i < selectItems.length; i++) {
    selectItems[i].onclick = function () {
      let selectedValue = this.innerText.toLowerCase();
      selectValue.innerText = this.innerText;
      elementToggleFunc(select);
      filterFunc(selectedValue);
    };
  }

  const filterFunc = function (selectedValue) {
    for (let i = 0; i < filterItems.length; i++) {
      if (
        selectedValue === "all" ||
        selectedValue === filterItems[i].dataset.category
      ) {
        filterItems[i].classList.add("active");
      } else {
        filterItems[i].classList.remove("active");
      }
    }
  };

  let lastClickedBtn = filterBtn[0];
  for (let i = 0; i < filterBtn.length; i++) {
    filterBtn[i].onclick = function () {
      let selectedValue = this.innerText.toLowerCase();
      selectValue.innerText = this.innerText;
      filterFunc(selectedValue);

      if (lastClickedBtn) {
        lastClickedBtn.classList.remove("active");
      }
      this.classList.add("active");
      lastClickedBtn = this;
    };
  }
}

async function loadGitHubRepos() {
  if (!projectListContainer) return;

  // Show loading state
  projectListContainer.innerHTML = `
    <li class="loading-item" style="grid-column: 1 / -1; text-align: center; color: var(--light-gray-70); padding: 40px 0;">
      <ion-icon name="sync-outline" style="font-size: 30px; display: inline-block; animation: spin 1.5s linear infinite; margin-bottom: 10px;"></ion-icon>
      <p>Loading projects from GitHub...</p>
    </li>
  `;

  if (!document.getElementById("spin-keyframes")) {
    const style = document.createElement("style");
    style.id = "spin-keyframes";
    style.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  try {
    let repos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/users/Arghajit47/repos?per_page=${perPage}&page=${page}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (!data || data.length === 0) break;

      repos = repos.concat(data);
      if (data.length < perPage) break;
      page++;
    }

    // Filter out "assessment", "assignment" and "payever" repos (case-insensitive name check)
    const filteredRepos = repos.filter(
      (repo) =>
        !repo.name.toLowerCase().includes("assessment") &&
        !repo.name.toLowerCase().includes("assignment") &&
        !repo.name.toLowerCase().includes("payever"),
    );

    if (filteredRepos.length === 0) {
      projectListContainer.innerHTML = `
        <li style="grid-column: 1 / -1; text-align: center; color: var(--light-gray-70); padding: 40px 0;">
          <p>No repositories found.</p>
        </li>
      `;
      return;
    }

    const languageColors = {
      JavaScript: "#f1e05a",
      TypeScript: "#3178c6",
      HTML: "#e34c26",
      CSS: "#563d7c",
      Python: "#3572A5",
      Java: "#b07219",
      Shell: "#89e051",
      default: "#8b949e",
    };

    const repoHTML = filteredRepos
      .map((repo) => {
        const category = getCategory(repo);
        const langColor =
          languageColors[repo.language] || languageColors.default;
        const formattedDate = new Date(repo.updated_at).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        );
        const description = repo.description || "No description provided.";

        const topics = (repo.topics || []).slice(0, 3);
        const topicsHTML = topics
          .map((t) => `<span class="repo-topic-badge">${t}</span>`)
          .join("");

        return `
        <li class="project-item active" data-filter-item data-category="${category}">
          <a href="${repo.html_url}" target="_blank" class="repo-card">
            <div class="repo-header">
              <div class="repo-title-wrapper">
                <ion-icon name="logo-github" class="repo-icon"></ion-icon>
                <h3 class="h3 project-title" title="${repo.name}">${repo.name}</h3>
              </div>
              <span class="repo-visibility">${repo.visibility || "public"}</span>
            </div>
            
            <p class="project-description">${description}</p>
            
            ${topics.length > 0 ? `<div class="repo-topics">${topicsHTML}</div>` : ""}
            
            <div class="repo-meta">
              <div class="repo-language">
                <span class="lang-color" style="background-color: ${langColor}"></span>
                <span class="project-category">${repo.language || "Plain Text"}</span>
              </div>
              <div class="repo-stars">
                <ion-icon name="star-outline"></ion-icon>
                <span>${repo.stargazers_count}</span>
              </div>
              <div class="repo-updated">
                <span>Updated ${formattedDate}</span>
              </div>
            </div>
          </a>
        </li>
      `;
      })
      .join("");

    projectListContainer.innerHTML = repoHTML;
    initFiltering();
  } catch (error) {
    console.error("Error fetching repositories:", error);
    projectListContainer.innerHTML = `
      <li style="grid-column: 1 / -1; text-align: center; color: var(--light-gray-70); padding: 40px 0;">
        <ion-icon name="alert-circle-outline" style="font-size: 30px; color: var(--orange-yellow-crayola); margin-bottom: 10px;"></ion-icon>
        <p>Could not load repositories from GitHub.</p>
        <a href="https://github.com/Arghajit47" target="_blank" class="text-link" style="display: inline-block; margin-top: 10px;">Visit my GitHub profile</a>
      </li>
    `;
  }
}

if (projectListContainer) {
  loadGitHubRepos();
}

// --- Contact Form (Only runs if the form is on the page, e.g., contact.html) ---
const form = document.querySelector("[data-form]");

if (form) {
  const formInputs = document.querySelectorAll("[data-form-input]");
  const formBtn = document.querySelector("[data-form-btn]");

  // Add event to all form input fields
  for (let i = 0; i < formInputs.length; i++) {
    formInputs[i].addEventListener("input", function () {
      // Check form validation
      if (form.checkValidity()) {
        formBtn.removeAttribute("disabled");
      } else {
        formBtn.setAttribute("disabled", "");
      }
    });
  }
}
