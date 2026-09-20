let projectData;

const PROJECT_DATE_CONFIG = {
    monthFormat: { month: "long", year: "numeric" },
    maxDaysBeforeWeeks: 6,
    maxWeeksBeforeMonths: 3,
    daysPerWeek: 7,
    averageDaysPerMonth: 30.4375,
    labels: {
        day: {
            singular: "shared.duration.day.singular",
            plural: "shared.duration.day.plural"
        },
        week: {
            singular: "shared.duration.week.singular",
            plural: "shared.duration.week.plural"
        },
        month: {
            singular: "shared.duration.month.singular",
            plural: "shared.duration.month.plural"
        }
    }
};

const PROJECT_SEARCH_CONFIG = {
    defaultSort: "rank",
    defaultLimit: "all",
    sortOptions: [
        { value: "rank", label: "shared.search.sort.rank" },
        { value: "rank_desc", label: "shared.search.sort.rank_desc" },
        { value: "date_desc", label: "shared.search.sort.date_desc" },
        { value: "date_asc", label: "shared.search.sort.date_asc" }
    ],
    labels: {
        controlsTitle: "shared.search.controls_title",
        limit: "shared.search.limit",
        sort: "shared.search.sort",
        categories: "shared.search.categories",
        allCategories: "shared.search.all_categories",
        addFilter: "shared.search.add_filter",
        noResult: "shared.search.no_results"
    }
};

async function fetchJson(path) {
    const response = await fetch(root + path);
    if (!response.ok) throw new Error(`Unable to load ${path} (${response.status}).`);
    return response.json();
}

async function getProjectData() {
    // Cache the promise immediately so navigation and page rendering share
    // the same in-flight requests as well as the finished result.
    if (projectData === undefined) {
        projectData = loadProjectData();
    }
    return projectData;
}

async function loadProjectData() {
    await window.translationReady;
    const [index, categories, projectOrder] = await Promise.all([
        fetchJson("data/projects.json"),
        fetchJson("data/categories.json"),
        fetchJson("data/project_order.json")
    ]);

    const ids = new Set();
    for (const entry of index) {
        if (!entry.id || !entry.assets_path || ids.has(entry.id)) {
            throw new Error(`Invalid or duplicate project ID: ${entry.id}`);
        }
        ids.add(entry.id);
    }
    const projects = await Promise.all(index.map(async entry => {
        const metadata = await fetchJson(entry.assets_path + "project.json");
        const project = { ...metadata, id: entry.id, assets_path: entry.assets_path };
        await loadProjectTranslations(project);
        for (const field of ["title", "job"]) {
            if (typeof project[field] !== "string" || !project[field].trim()) {
                throw new Error(`Missing ${field} for project ${project.id}.`);
            }
        }
        return project;
    }));
    for (const categoryId of Object.keys(categories)) {
        categories[categoryId] = translateText(`shared.categories.${categoryId}`, categories[categoryId]);
    }
    return { projects, categories, projectOrder };
}

function getProjectOrderIndex(project, projectOrder) {
    const index = projectOrder.indexOf(project.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getOrderedProjects(projects, projectOrder, sortMode = PROJECT_SEARCH_CONFIG.defaultSort) {
    return [...projects].sort((a, b) => compareProjects(a, b, projectOrder, sortMode));
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

function compareProjects(projectA, projectB, projectOrder, sortMode) {
    if (sortMode === "rank_desc") {
        return getProjectOrderIndex(projectB, projectOrder) - getProjectOrderIndex(projectA, projectOrder);
    }

    if (sortMode === "date_desc") {
        return getProjectTime(projectB) - getProjectTime(projectA);
    }

    if (sortMode === "date_asc") {
        return getProjectTime(projectA) - getProjectTime(projectB);
    }

    return getProjectOrderIndex(projectA, projectOrder) - getProjectOrderIndex(projectB, projectOrder);
}

function getProjectTime(project) {
    const startDate = parseProjectDate(project.start_date);
    return startDate === undefined ? 0 : startDate.getTime();
}

function createProjectPreview(project, categories) {
    const thumbnailPath = `${root}${project.assets_path}${project.thumbnail}`;
    const thumbnailExtension = project.thumbnail.split(".").pop().toLowerCase();
    const isVideoThumbnail = ["mp4", "webm", "ogg"].includes(thumbnailExtension);
    const thumbnailElement = isVideoThumbnail
        ? `<video src="${thumbnailPath}" autoplay loop muted playsinline aria-label="${escapeTranslationText(project.title)}"></video>`
        : `<img src="${thumbnailPath}" alt="${escapeTranslationText(project.title)}">`;

    return `
        <a class="preview project" href="${escapeTranslationText(translatedPageUrl(root + project.link))}">
            ${thumbnailElement}
            <div class="preview-text">
                <h2>${escapeTranslationText(project.title)}</h2>
                <p>${escapeTranslationText(createProjectMetadata(project, categories))}</p>
                <h3>${escapeTranslationText(project.job)}</h3>
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

function createProjectMetadata(project, categories) {
    return `${createProjectDateLabel(project)} - ${createCategoryLabel(project.categories, categories)} - ${createProjectDurationLabel(project)}`;
}

function createProjectDateLabel(project) {
    const startDate = parseProjectDate(project.start_date);
    const endDate = parseProjectDate(project.end_date);

    if (startDate === undefined || endDate === undefined) {
        return project.date;
    }

    const locale = translationSettings.language;
    const startMonth = startDate.toLocaleDateString(locale, PROJECT_DATE_CONFIG.monthFormat);
    const endMonth = endDate.toLocaleDateString(locale, PROJECT_DATE_CONFIG.monthFormat);

    if (startMonth === endMonth) {
        return capitalizeFirstLetter(startMonth);
    }

    return `${capitalizeFirstLetter(startMonth)} - ${capitalizeFirstLetter(endMonth)}`;
}

function createProjectDurationLabel(project) {
    const startDate = parseProjectDate(project.start_date);
    const endDate = parseProjectDate(project.end_date);

    if (startDate === undefined || endDate === undefined) {
        return project.duration;
    }

    const durationDays = getInclusiveDurationInDays(startDate, endDate);

    if (durationDays <= PROJECT_DATE_CONFIG.maxDaysBeforeWeeks) {
        return createDurationUnitLabel(durationDays, PROJECT_DATE_CONFIG.labels.day);
    }

    const weeks = Math.max(1, Math.round(durationDays / PROJECT_DATE_CONFIG.daysPerWeek));
    if (weeks <= PROJECT_DATE_CONFIG.maxWeeksBeforeMonths) {
        return createDurationUnitLabel(weeks, PROJECT_DATE_CONFIG.labels.week);
    }

    const months = Math.max(1, Math.round(durationDays / PROJECT_DATE_CONFIG.averageDaysPerMonth));
    return createDurationUnitLabel(months, PROJECT_DATE_CONFIG.labels.month);
}

function parseProjectDate(date) {
    if (date === undefined) {
        return undefined;
    }

    const parsedDate = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function getInclusiveDurationInDays(startDate, endDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((endDate - startDate) / millisecondsPerDay) + 1;
}

function createDurationUnitLabel(value, unitLabels) {
    return `${value} ${translateText(value === 1 ? unitLabels.singular : unitLabels.plural)}`;
}

function capitalizeFirstLetter(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
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
        <h1>${escapeTranslationText(project.title)}</h1>
        <h3>${escapeTranslationText(createProjectMetadata(project, categories))}</h3>
        <h1>${escapeTranslationText(project.job)}</h1>
    `;
}

function renderProjectPreviews(container, projects, categories) {
    if (projects.length === 0) {
        container.innerHTML = `<p class="project-search-empty">${translationHtml(PROJECT_SEARCH_CONFIG.labels.noResult)}</p>`;
        return;
    }

    container.innerHTML = projects.map(project => createProjectPreview(project, categories)).join("");
}

function getProjectSearchState(controls) {
    const limitControl = controls.querySelector("[data-project-limit-control]");
    const sortControl = controls.querySelector("[data-project-sort-control]");
    const selectedCategories = [...controls.querySelectorAll("[data-project-filter]")]
        .map(element => element.dataset.category);

    return {
        limit: limitControl.value.trim(),
        sortMode: sortControl.value,
        selectedCategories
    };
}

function getSearchedProjects(projects, projectOrder, baseCategory, searchState) {
    let selectedProjects = getProjectsByCategory(projects, baseCategory);

    selectedProjects = selectedProjects.filter(project => {
        return searchState.selectedCategories.every(category => project.categories.includes(category));
    });

    selectedProjects = getOrderedProjects(selectedProjects, projectOrder, searchState.sortMode);

    const projectLimit = Number(searchState.limit);
    if (Number.isInteger(projectLimit) && projectLimit > 0) {
        selectedProjects = selectedProjects.slice(0, projectLimit);
    }

    return selectedProjects;
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
        if (video && !video.hasAttribute("data-i18n-title")) {
            video.title = fileLabel;
            video.setAttribute("aria-label", fileLabel);
            video.load();
        }
        else if (video) {
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
        const controls = createProjectSearchControls(container, categories);

        const updateProjectResults = () => {
            const searchState = getProjectSearchState(controls);
            const projectsToDisplay = getSearchedProjects(
                projects,
                projectOrder,
                container.dataset.category,
                searchState
            );

            renderProjectPreviews(container, projectsToDisplay, categories);
            applyAlternatingPreviewLayout();
        };

        controls.addEventListener("change", updateProjectResults);
        controls.querySelector("[data-project-limit-control]").addEventListener("input", updateProjectResults);
        controls.querySelector("[data-project-add-filter]").addEventListener("click", () => {
            if (addProjectFilter(controls, categories)) {
                updateProjectResults();
            }
        });
        controls.querySelector("[data-project-selected-filters]").addEventListener("click", event => {
            const filterButton = event.target.closest("[data-project-filter]");

            if (filterButton !== null) {
                removeProjectFilter(filterButton);
                updateProjectResults();
            }
        });
        updateProjectResults();
    }

    const currentProject = getCurrentProject(projects);
    if (currentProject !== undefined) {
        const headPage = document.querySelector(".head-page");
        renderProjectHeader(headPage, currentProject, categories);
        renderProjectSections(currentProject);
        loadProjectAssets(currentProject);
    }
}
