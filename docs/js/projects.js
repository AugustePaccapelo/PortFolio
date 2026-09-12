let projectData;

async function fetchJson(path) {
    const response = await fetch(root + path);
    return response.json();
}

async function getProjectData() {
    if (projectData !== undefined) {
        return projectData;
    }

    const [projects, categories, projectOrder] = await Promise.all([
        fetchJson("data/projects.json"),
        fetchJson("data/categories.json"),
        fetchJson("data/project_order.json")
    ]);

    projectData = { projects, categories, projectOrder };
    return projectData;
}

function getProjectOrderIndex(project, projectOrder) {
    const index = projectOrder.indexOf(project.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getOrderedProjects(projects, projectOrder) {
    return [...projects].sort((a, b) => getProjectOrderIndex(a, projectOrder) - getProjectOrderIndex(b, projectOrder));
}

function getProjectsByCategory(projects, category) {
    if (category === undefined) {
        return projects;
    }

    return projects.filter(project => project.categories.includes(category));
}

function getBestOrderedProjects(projects, projectOrder, category, limit) {
    let selectedProjects = getProjectsByCategory(projects, category);
    selectedProjects = getOrderedProjects(selectedProjects, projectOrder);

    if (limit !== undefined) {
        selectedProjects = selectedProjects.slice(0, Number(limit));
    }

    return selectedProjects;
}

function createProjectPreview(project, categories) {
    const thumbnailPath = `${root}${project.assets_path}${project.thumbnail}`;
    const thumbnailExtension = project.thumbnail.split(".").pop().toLowerCase();
    const isVideoThumbnail = ["mp4", "webm", "ogg"].includes(thumbnailExtension);
    const thumbnailElement = isVideoThumbnail
        ? `<video src="${thumbnailPath}" autoplay loop muted playsinline aria-label="${project.title}"></video>`
        : `<img src="${thumbnailPath}" alt="${project.title}">`;

    return `
        <a class="preview project" href="${root}${project.link}">
            ${thumbnailElement}
            <div class="preview-text">
                <h2>${project.title}</h2>
                <p>${project.date} - ${createCategoryLabel(project.categories, categories)} - ${project.duration}</p>
                <h3>${project.job}</h3>
            </div>
        </a>

        <div class="divider"></div>
    `;
}

function createCategoryLabel(projectCategories, categories) {
    return projectCategories.map(categoryId => {
        return `${categories[categoryId]}`;
    }).join(" - ");
}

function getProjectAsset(project, fileName) {
    return root + project.assets_path + fileName;
}

function getFileLabel(fileName) {
    const nameWithoutExtension = fileName.split(".").slice(0, -1).join(".");
    const readableName = nameWithoutExtension || fileName;
    return readableName
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function renderProjectHeader(element, project, categories) {
    element.innerHTML += `
        <h1>${project.title}</h1>
        <h3>${project.date} - ${createCategoryLabel(project.categories, categories)} - ${project.duration}</h3>
        <h1>${project.job}</h1>
    `;
}

function renderProjectPreviews(container, projects, categories) {
    container.innerHTML = projects.map(project => createProjectPreview(project, categories)).join("");
}

function loadProjectAssets(project) {
    document.querySelectorAll("[data-src]").forEach(element => {
        const fileName = element.dataset.src;
        const assetPath = getProjectAsset(project, fileName);
        element.src = assetPath;

        const fileLabel = getFileLabel(fileName);
        if (element.tagName === "IMG" && (!element.hasAttribute("alt") || element.alt.trim() === "")) {
            element.alt = fileLabel;
        }

        const video = element.closest("video");
        if (video) {
            video.title = fileLabel;
            video.setAttribute("aria-label", fileLabel);
            video.load();
        }
    });
}

function getCurrentProject(projects) {
    const projectId = document.body.dataset.projectId;
    if (projectId === undefined) {
        return undefined;
    }

    return projects.find(project => project.id === projectId);
}

async function renderProjectsPage() {
    const container = document.getElementById("projects_container");
    const currentProjectId = document.body.dataset.projectId;
    if (container === null && currentProjectId === undefined) {
        return;
    }

    const { projects, categories, projectOrder } = await getProjectData();

    if (container !== null) {
        const projectsToDisplay = getBestOrderedProjects(
            projects,
            projectOrder,
            container.dataset.category,
            container.dataset.projectLimit
        );

        renderProjectPreviews(container, projectsToDisplay, categories);
    }

    const currentProject = getCurrentProject(projects);
    if (currentProject !== undefined) {
        const headPage = document.querySelector(".head-page");
        renderProjectHeader(headPage, currentProject, categories);
        loadProjectAssets(currentProject);
    }
}
