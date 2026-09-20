const root = new URL("../", document.currentScript.src).href;
window.ROOT = root;

loadScript("js/translations.js");
loadScript("js/projects.js");
loadScript("js/project-sections.js");
loadScript("js/commons.js");
loadScript("js/main.js");

loadStyle("css/variables.css");
loadStyle("css/reset.css");
loadStyle("css/style.css");

function loadStyle(path) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = root + path;
    document.head.appendChild(link);
}

function loadScript(path) {
    const script = document.createElement("script");
    script.src = root + path;
    script.async = false;
    document.head.appendChild(script);
}
