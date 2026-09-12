class SiteHeader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <header>
            <nav>
                <ul class="nav-bar">
                    <h4><a href="${ROOT}">Accueil</a></h4>
                    <li class="nav-dropdown">
                        <h4><a href="${ROOT}personal_projects/">Projets personnels</a></h4>
                        <ul class="nav-dropdown-content" data-nav-category="personal"></ul>
                    </li>
                    <li class="nav-dropdown">
                        <h4><a href="${ROOT}school_projects/">Projets d'école</a></h4>
                        <ul class="nav-dropdown-content" data-nav-category="school"></ul>
                    </li>
                    <li class="nav-dropdown">
                        <h4><a href="${ROOT}game_jams/">Game Jams</a></h4>
                        <ul class="nav-dropdown-content" data-nav-category="jam"></ul>
                    </li>
                    <h4><a href="${ROOT}contact/">Contact & CV</a></h4>
                </ul>
            </nav>
        </header>
        `;

        loadProjectNavLinks();
    }
}

class SiteFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer>
            <div class="footer-txt">
                <p>Auguste Paccapelo</p>
            </div>

            <div class="footer-img-container">
                <a href="https://github.com/AugustePaccapelo" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_github.png"></a>
                <a href="https://www.linkedin.com/in/auguste-paccapelo-2b9b23350/" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_linkedin.png"></a>
                <a href="https://augustepaccapelo.itch.io/" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_itch.png"></a>
                <a href="mailto:paccapelo.auguste@gmail.com" target="_blank" rel="noopener noreferrer"><img src="${ROOT}assets/misc/logo_mail.png"></a>
            </div>

            <div class="footer-txt">
                <p>Game programmer</p>
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
                <li><h4><a href="${ROOT}${project.link}">${project.title}</a></h4></li>
            `).join("");
        });
    }
    catch (error) {
        console.error("Unable to load project navigation links.", error);
    }

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
