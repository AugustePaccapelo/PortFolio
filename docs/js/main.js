if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onHtmlInitialize);
}
else {
    onHtmlInitialize();
}

async function onHtmlInitialize() {
    try {
        await window.translationReady;
    }
    catch (error) {
        const message = document.createElement("p");
        message.setAttribute("role", "alert");
        message.textContent = "Impossible de charger les textes. Veuillez réessayer.";
        document.body.prepend(message);
        return;
    }
    applyTranslations();
    await renderProjectsPage();
    applyTranslations();
    applyAlternatingPreviewLayout();
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
