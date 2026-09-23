if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onHtmlInitialize);
}
else {
    onHtmlInitialize();
}

async function onHtmlInitialize() {
    try {
        await window.translationReady;
        await getProjectData();
        applyTranslations();
        await renderProjectsPage();
        applyTranslations();
        applyAlternatingPreviewLayout();
    }
    catch (error) {
        showInitializationError(error);
    }
}

function showInitializationError(error) {
    console.error("Unable to initialize the page.", error);
    if (document.querySelector("[data-site-error]")) return;

    const message = document.createElement("p");
    message.dataset.siteError = "";
    message.setAttribute("role", "alert");
    message.textContent = typeof translateText === "function"
        ? translateText("shared.errors.initialization", "Impossible de charger la page. Veuillez réessayer.")
        : "Impossible de charger la page. Veuillez réessayer.";
    document.body.prepend(message);
}

function applyAlternatingPreviewLayout() {
    const previews = document.querySelectorAll(".preview");

    previews.forEach((element, index) => {
        if (index % 2 === 0) {
            element.classList.add("right");
        }
        else {
            element.classList.add("left");
        }
    });
}
