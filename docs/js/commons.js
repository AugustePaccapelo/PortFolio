class SiteHeader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <header>
            <nav>
                <ul class="nav-bar">
                    <li><h4><a href="${ROOT}" data-i18n="shared.navigation.home">shared.navigation.home</a></h4></li>
                    <li class="nav-dropdown">
                        <div class="nav-dropdown-label">
                            <h4><a href="${ROOT}personal_projects/" data-i18n="shared.navigation.personal_projects">shared.navigation.personal_projects</a></h4>
                            <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-controls="personal-project-links" data-i18n-aria-label="shared.navigation.toggle_submenu">+</button>
                        </div>
                        <ul class="nav-dropdown-content" id="personal-project-links" data-nav-category="personal"></ul>
                    </li>
                    <li class="nav-dropdown">
                        <div class="nav-dropdown-label">
                            <h4><a href="${ROOT}school_projects/" data-i18n="shared.navigation.school_projects">shared.navigation.school_projects</a></h4>
                            <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-controls="school-project-links" data-i18n-aria-label="shared.navigation.toggle_submenu">+</button>
                        </div>
                        <ul class="nav-dropdown-content" id="school-project-links" data-nav-category="school"></ul>
                    </li>
                    <li class="nav-dropdown">
                        <div class="nav-dropdown-label">
                            <h4><a href="${ROOT}game_jams/" data-i18n="shared.navigation.game_jams">shared.navigation.game_jams</a></h4>
                            <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-controls="game-jam-links" data-i18n-aria-label="shared.navigation.toggle_submenu">+</button>
                        </div>
                        <ul class="nav-dropdown-content" id="game-jam-links" data-nav-category="jam"></ul>
                    </li>
                    <li><h4><a href="${ROOT}contact/" data-i18n="shared.navigation.contact_cv">shared.navigation.contact_cv</a></h4></li>
                </ul>
                <select class="language-select" aria-label="Language" disabled></select>
            </nav>
        </header>
        `;

        loadProjectNavLinks();
        initializeDropdownNavigation(this);
        initializeLanguageSelector(this.querySelector(".language-select"));
    }
}

function initializeDropdownNavigation(header) {
    const dropdowns = [...header.querySelectorAll(".nav-dropdown")];

    const closeDropdown = dropdown => {
        dropdown.classList.remove("open");
        dropdown.querySelector(".nav-dropdown-toggle").setAttribute("aria-expanded", "false");
    };

    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector(".nav-dropdown-toggle");
        toggle.addEventListener("click", () => {
            const shouldOpen = !dropdown.classList.contains("open");
            dropdowns.forEach(closeDropdown);
            if (shouldOpen) {
                dropdown.classList.add("open");
                toggle.setAttribute("aria-expanded", "true");
            }
        });
    });

    header.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            const openToggle = header.querySelector(".nav-dropdown-toggle[aria-expanded='true']");
            dropdowns.forEach(closeDropdown);
            openToggle?.focus();
        }
    });
}

async function initializeLanguageSelector(select) {
    try {
        const { availableLanguages, language } = await window.translationReady;
        select.replaceChildren(...availableLanguages.map(code => {
            const option = document.createElement("option");
            option.value = code;
            option.lang = code;
            let name = code;
            try {
                name = new Intl.DisplayNames([code], { type: "language" }).of(code) || code;
            }
            catch { /* Unknown language codes remain usable as labels. */ }
            option.textContent = name.charAt(0).toLocaleUpperCase() + name.slice(1);
            return option;
        }));
        select.value = language;
        select.setAttribute("aria-label", translateText("shared.navigation.language", "Language"));
        select.disabled = false;
        select.addEventListener("change", () => {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", select.value);
            window.location.assign(url.href);
        });
    }
    catch (error) {
        console.error("Unable to initialize the language selector.", error);
    }
}

class SiteFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer>
            <div class="footer-txt">
                <p data-i18n="shared.footer.author">shared.footer.author</p>
            </div>

            <div class="footer-img-container">
                <a href="https://github.com/AugustePaccapelo" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_github.png"></a>
                <a href="https://www.linkedin.com/in/auguste-paccapelo-2b9b23350/" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_linkedin.png"></a>
                <a href="https://augustepaccapelo.itch.io/" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_itch.png"></a>
                <a href="mailto:paccapelo.auguste@gmail.com" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_mail.png"></a>
            </div>

            <div class="footer-txt">
                <p data-i18n="shared.footer.game_programmer">shared.footer.game_programmer</p>
            </div>
        </footer>
        `;
    }
}

customElements.define("site-header", SiteHeader);
customElements.define("site-footer", SiteFooter);

async function loadProjectNavLinks() {
    const navLists = document.querySelectorAll("[data-nav-category]");
    if (navLists.length === 0) {
        setActivePageInNav();
        return;
    }

    try {
        const { projects, projectOrder } = await getProjectData();

        navLists.forEach(list => {
            const projectsInCategory = getBestOrderedProjects(projects, projectOrder, list.dataset.navCategory, 4);

            list.innerHTML = projectsInCategory.map(project => `
                <li><h4><a href="${ROOT}${project.link}">${escapeTranslationText(project.title)}</a></h4></li>
            `).join("");
        });
    }
    catch (error) {
        console.error("Unable to load project navigation links.", error);
    }

    applyTranslations();
    setActivePageInNav();
}

function setActivePageInNav() {
    const currentPage = normalizePath(window.location.pathname);
    const homePage = normalizePath(new URL(ROOT).pathname);

    document.querySelectorAll("header a").forEach(function(link) {
        const linkPath = normalizePath(new URL(link.href).pathname);
        const isHomeLink = linkPath === homePage;

        if (currentPage === linkPath) {
            link.classList.add("active");
        }
        else if (!isHomeLink && linkPath.endsWith("index.html")) {
            const linkDir = linkPath.replace("index.html", "");

            const isDirValid = linkDir !== "/";

            if (isDirValid && currentPage.startsWith(linkDir)) {
                link.classList.add("active");
            }
        }
    })
}

function normalizePath(path) {
    let normalizedPath = path.replace(/\/$/, "/index.html");

    if (!normalizedPath.endsWith(".html")) {
        normalizedPath = `${normalizedPath}/index.html`;
    }

    return normalizedPath.replace(/\/+/g, "/");
}

function createProjectSearchControls(container, categories) {
    const controls = document.createElement("div");
    controls.className = "project-search";

    const baseCategory = container.dataset.category;
    const categoryOptions = Object.entries(categories)
        .filter(([categoryId]) => categoryId !== baseCategory)
        .map(([categoryId, categoryLabel]) => `<option value="${categoryId}">${escapeTranslationText(categoryLabel)}</option>`)
        .join("");

    controls.innerHTML = `
        <h2>${translationHtml(PROJECT_SEARCH_CONFIG.labels.controlsTitle)}</h2>

        <div class="project-search-row">
            <label>
                ${translationHtml(PROJECT_SEARCH_CONFIG.labels.limit)}
                <input
                    type="number"
                    min="1"
                    step="1"
                    value="${container.dataset.projectLimit || ""}"
                    placeholder="${translationHtml('shared.search.placeholder')}"
                    data-project-limit-control>
            </label>

            <label>
                ${translationHtml(PROJECT_SEARCH_CONFIG.labels.sort)}
                <select data-project-sort-control>
                    ${PROJECT_SEARCH_CONFIG.sortOptions.map(option => `
                        <option value="${option.value}" ${option.value === PROJECT_SEARCH_CONFIG.defaultSort ? "selected" : ""}>${translationHtml(option.label)}</option>
                    `).join("")}
                </select>
            </label>
        </div>

        <fieldset class="project-search-categories">
            <legend>${translationHtml(PROJECT_SEARCH_CONFIG.labels.categories)}</legend>
            <div class="project-search-category-row">
                <select data-project-filter-select>
                    <option value="">${translationHtml(PROJECT_SEARCH_CONFIG.labels.allCategories)}</option>
                    ${categoryOptions}
                </select>
                <button type="button" data-project-add-filter>${translationHtml(PROJECT_SEARCH_CONFIG.labels.addFilter)}</button>
            </div>
            <div class="project-search-filters" data-project-selected-filters>
            </div>
        </fieldset>

        <div class="divider"></div>
    `;

    container.before(controls);
    return controls;
}

function addProjectFilter(controls, categories) {
    const select = controls.querySelector("[data-project-filter-select]");
    const selectedFilters = controls.querySelector("[data-project-selected-filters]");
    const categoryId = select.value;

    if (categoryId === "" || selectedFilters.querySelector(`[data-category="${categoryId}"]`) !== null) {
        return false;
    }

    selectedFilters.innerHTML += `
        <button type="button" class="project-search-filter" data-project-filter data-category="${categoryId}">
            ${escapeTranslationText(categories[categoryId])}
        </button>
    `;

    select.value = "";
    return true;
}

function removeProjectFilter(filterButton) {
    filterButton.remove();
}
