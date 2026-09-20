// Project page layouts are declared in project.json. All section types share
// the same media object, including each item inside a gallery.
function createSectionText(tag, key) {
    const element = document.createElement(tag);
    element.dataset.i18n = key;
    element.textContent = key;
    return element;
}

function appendSectionText(container, section, defaultHeadingLevel = 1) {
    if (section.heading) {
        const level = section.heading_level ?? defaultHeadingLevel;
        if (!Number.isInteger(level) || level < 1 || level > 6) {
            throw new Error(`Invalid heading level for ${section.heading}.`);
        }
        container.append(createSectionText(`h${level}`, section.heading));
    }
    for (const key of section.paragraphs || []) {
        container.append(createSectionText("p", key));
    }
}

function createProjectMedia(media, project) {
    if (!media?.src) throw new Error(`Missing media source for ${project.id}.`);
    let element;
    if (media.type === "image") {
        element = document.createElement("img");
        element.src = getProjectAsset(project, media.src);
        element.alt = media.label ? translateText(media.label) : getFileLabel(media.src);
        if (media.label) element.setAttribute("data-i18n-alt", media.label);
    }
    else if (media.type === "video") {
        element = document.createElement("video");
        const playback = media.playback || {};
        element.controls = playback.controls ?? true;
        element.autoplay = playback.autoplay ?? false;
        element.loop = playback.loop ?? false;
        element.muted = playback.muted ?? false;
        element.playsInline = playback.plays_inline ?? true;
        const source = document.createElement("source");
        source.src = getProjectAsset(project, media.src);
        if (media.mime_type) source.type = media.mime_type;
        element.append(source);
    }
    else if (media.type === "embed") {
        const url = new URL(media.src);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Unsupported embed URL.");
        element = document.createElement("iframe");
        element.src = url.href;
        element.setAttribute("frameborder", "0");
        if (media.allow) element.setAttribute("allow", media.allow);
    }
    else throw new Error(`Unknown media type: ${media.type}`);

    if (media.type !== "image" && media.label) {
        element.setAttribute("data-i18n-title", media.label);
        element.title = translateText(media.label);
        if (media.type === "video") {
            element.setAttribute("data-i18n-aria-label", media.label);
            element.setAttribute("aria-label", translateText(media.label));
        }
    }
    return element;
}

function appendProjectSections(container, sections, project) {
    sections.forEach((section, index) => {
        if (index > 0) {
            const divider = document.createElement("div");
            divider.className = "divider";
            container.append(divider);
        }
        container.append(createProjectSection(section, project));
    });
}

function createProjectSection(section, project) {
    const element = document.createElement("div");
    switch (section.type) {
        case "text":
            element.className = "text-div";
            appendSectionText(element, section);
            break;
        case "preview": {
            element.className = "preview";
            const text = document.createElement("div");
            text.className = "preview-text";
            appendSectionText(text, section, 3);
            const media = createProjectMedia(section.media, project);
            if (section.media_position === "after") element.append(text, media);
            else element.append(media, text);
            break;
        }
        case "gallery": {
            const text = document.createElement("div");
            text.className = "text-div";
            appendSectionText(text, section);
            const gallery = document.createElement("div");
            gallery.className = "media-gallery";
            for (const item of section.items) {
                const entry = document.createElement("div");
                entry.className = "media-item";
                entry.append(createProjectMedia(item.media, project));
                if (item.caption) entry.append(createSectionText("p", item.caption));
                gallery.append(entry);
            }
            element.append(text, gallery);
            break;
        }
        case "media":
            if (section.layout !== "plain") element.className = "video-div";
            appendSectionText(element, section);
            element.append(createProjectMedia(section.media, project));
            break;
        case "group":
            element.className = "my-works";
            appendSectionText(element, section);
            appendProjectSections(element, section.sections, project);
            break;
        case "custom": {
            const template = document.getElementById(section.template);
            if (!(template instanceof HTMLTemplateElement)) {
                throw new Error(`Missing project template: ${section.template}`);
            }
            return template.content.cloneNode(true);
        }
        default:
            throw new Error(`Unknown section type: ${section.type}`);
    }
    return element;
}

function renderProjectSections(project) {
    const container = document.querySelector("[data-project-sections]");
    if (!container) return; // Handwritten project pages are still supported.
    if (!Array.isArray(project.sections)) throw new Error(`Missing sections for ${project.id}.`);
    const content = document.createDocumentFragment();
    appendProjectSections(content, project.sections, project);
    container.replaceChildren(content);
}
