let translationSettings;

window.translationReady = loadTranslationSettings();
window.translationReady.catch(error => console.error("Unable to initialize translations.", error));

async function loadTranslationSettings() {
    const [csvResponse, linksResponse] = await Promise.all([
        fetch(new URL("data/translations.csv", ROOT)),
        fetch(new URL("data/links.json", ROOT))
    ]);
    if (!csvResponse.ok || !linksResponse.ok) {
        throw new Error("Unable to load translations.csv or links.json.");
    }
    const catalogue = readTranslationCatalogue(await csvResponse.text());
    const { availableLanguages, translations } = catalogue;
    const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
    const language = availableLanguages.includes(requestedLanguage) ? requestedLanguage : availableLanguages[0];
    translationSettings = {
        availableLanguages, language, translations,
        languageIndex: availableLanguages.indexOf(language),
        links: await linksResponse.json(),
        projects: new Map()
    };
    return translationSettings;
}

function readTranslationCatalogue(csv) {
    const rows = parseTranslationCsv(csv);
    const headers = (rows.shift() || []).map(header => header.trim());
    if (headers[0] !== "key") throw new Error('The first CSV column must be "key".');
    const availableLanguages = headers.slice(1);
    if (!availableLanguages.length || availableLanguages.some(language => !language) ||
        new Set(availableLanguages).size !== availableLanguages.length) {
        throw new Error("The CSV must contain unique, named language columns.");
    }
    const translations = new Map();
    for (const row of rows) {
        if (row.every(value => value === "")) continue;
        if (row.length !== headers.length || !row[0] || translations.has(row[0])) {
            throw new Error("Invalid or duplicate translation row: " + row[0]);
        }
        translations.set(row[0], row.slice(1));
    }
    return { availableLanguages, translations };
}

async function loadProjectTranslations(project) {
    const base = new URL(project.assets_path, ROOT);
    const [csvResponse, linksResponse] = await Promise.all([
        fetch(new URL("translations.csv", base)),
        fetch(new URL("links.json", base))
    ]);
    if (!csvResponse.ok || !linksResponse.ok) {
        throw new Error(`Unable to load translations or links for ${project.id}.`);
    }
    registerProjectTranslations(
        project.id,
        readTranslationCatalogue(await csvResponse.text()),
        await linksResponse.json(),
        new URL(project.link, ROOT).href
    );
}

function registerProjectTranslations(projectId, catalogue, links, pageUrl) {
    const settings = translationSettings;
    const defaultLanguage = settings.availableLanguages[0];
    if (!catalogue.availableLanguages.includes(defaultLanguage)) {
        throw new Error(`Project translations must include the default language: ${defaultLanguage}.`);
    }
    // Match column names, not positions: project files can omit languages or
    // arrange their columns differently from the shared catalogue.
    if (settings.projects.has(projectId)) throw new Error(`Duplicate project catalogue: ${projectId}`);
    for (const key of Object.keys(links)) {
        if (!catalogue.translations.has(key)) {
            throw new Error(`Invalid or duplicate project link key: ${key}`);
        }
    }
    const translations = new Map();
    for (const [key, values] of catalogue.translations) {
        translations.set(key, settings.availableLanguages.map(language => {
            const index = catalogue.availableLanguages.indexOf(language);
            return index === -1 ? "" : values[index];
        }));
    }
    settings.projects.set(projectId, { translations, links, pageUrl });
}

// Quoted fields may contain commas, doubled quotes, and multiple lines.
function parseTranslationCsv(csv) {
    const text = csv.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], value = "", quoted = false, closedQuote = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') { value += '"'; index++; }
                else { quoted = false; closedQuote = true; }
            }
            else value += character;
        }
        else if (character === "," || character === "\r" || character === "\n") {
            row.push(value); value = ""; closedQuote = false;
            if (character !== ",") {
                rows.push(row); row = [];
                if (character === "\r" && text[index + 1] === "\n") index++;
            }
        }
        else if (character === '"' && value === "" && !closedQuote) quoted = true;
        else {
            if (closedQuote || character === '"') throw new Error("Malformed CSV quoting.");
            value += character;
        }
    }
    if (quoted) throw new Error("Unterminated quoted CSV field.");
    if (value !== "" || row.length || closedQuote) { row.push(value); rows.push(row); }
    return rows;
}

function getTranslationCatalogue(key, projectId = globalThis.document?.body?.dataset.projectId) {
    const project = translationSettings?.projects.get(projectId);
    return project?.translations.has(key) ? project : translationSettings;
}

function translateText(key, fallback = key, projectId = globalThis.document?.body?.dataset.projectId) {
    const values = getTranslationCatalogue(key, projectId)?.translations.get(key);
    if (!values) return fallback;
    // Blank cells fall back to the first language, allowing gradual translation.
    return values[translationSettings.languageIndex] || values[0] || fallback;
}

function escapeTranslationText(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function translationHtml(key) {
    return escapeTranslationText(translateText(key));
}

function translatedPageUrl(href) {
    const url = new URL(href, window.location.href);
    const site = new URL(ROOT);
    if (translationSettings && url.origin === site.origin && url.pathname.startsWith(site.pathname) &&
        (url.pathname.endsWith("/") || url.pathname.endsWith(".html"))) {
        url.searchParams.set("lang", translationSettings.language);
    }
    return url.href;
}

// CSV content never becomes unrestricted innerHTML. Only formatting tags and
// link names declared for this key are interpreted; everything else is text.
function translationFragment(key) {
    const fragment = document.createDocumentFragment();
    const stack = [{ name: "", node: fragment }];
    const catalogue = getTranslationCatalogue(key);
    const links = catalogue.links[key] || {};
    const parts = translateText(key).replace(/\r\n?/g, "\n").split(/(<\/?[a-z][a-z0-9_]*>|\n)/gi);
    for (const part of parts) {
        if (!part) continue;
        const parent = stack[stack.length - 1].node;
        if (part === "\n" || part === "<br>") { parent.append(document.createElement("br")); continue; }
        const match = /^<(\/)?([a-z][a-z0-9_]*)>$/i.exec(part);
        const name = match?.[2];
        if (match && match[1] && stack.length > 1 && stack[stack.length - 1].name === name) {
            stack.pop(); continue;
        }
        if (match && !match[1]) {
            let element;
            if (["strong", "em", "b", "i", "code"].includes(name)) element = document.createElement(name);
            else if (Object.hasOwn(links, name)) {
                const definition = links[name];
                const url = new URL(definition.href, catalogue.pageUrl || window.location.href);
                if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
                    element = document.createElement("a");
                    element.href = translatedPageUrl(url.href);
                    if (definition.target === "_blank") {
                        element.target = "_blank";
                        element.rel = "noopener noreferrer";
                    }
                }
            }
            if (element) { parent.append(element); stack.push({ name, node: element }); continue; }
        }
        parent.append(document.createTextNode(part));
    }
    return fragment;
}

function applyTranslations(scope = document) {
    if (!translationSettings) return;
    document.documentElement.lang = translationSettings.language;
    scope.querySelectorAll("[data-i18n]").forEach(element => {
        element.replaceChildren(translationFragment(element.dataset.i18n));
    });
    for (const attribute of ["alt", "title", "aria-label", "placeholder"]) {
        scope.querySelectorAll("[data-i18n-" + attribute + "]").forEach(element => {
            element.setAttribute(attribute, translateText(element.getAttribute("data-i18n-" + attribute)));
        });
    }
    scope.querySelectorAll("a[href]").forEach(link => {
        if (!link.getAttribute("href").startsWith("#")) link.href = translatedPageUrl(link.href);
    });
}
