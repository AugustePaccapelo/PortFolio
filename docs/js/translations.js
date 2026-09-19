// Resolves when the CSV languages and the requested language are available.
// Later translation steps can await window.translationReady.
window.translationReady = loadTranslationSettings();
window.translationReady.catch(error => {
    console.error("Unable to initialize translations.", error);
});

async function loadTranslationSettings() {
    const response = await fetch(new URL("data/translations.csv", ROOT));
    if (!response.ok) {
        throw new Error(`Unable to load translations.csv (${response.status}).`);
    }

    const csv = await response.text();
    const headers = readTranslationCsvHeader(csv);
    if (headers[0] !== "key") {
        throw new Error('The first translations.csv column must be "key".');
    }

    const availableLanguages = headers.slice(1);
    if (availableLanguages.length === 0 || availableLanguages.some(language => language === "")) {
        throw new Error("translations.csv must contain named language columns.");
    }
    if (new Set(availableLanguages).size !== availableLanguages.length) {
        throw new Error("translations.csv contains duplicate language columns.");
    }

    const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
    const language = availableLanguages.includes(requestedLanguage)
        ? requestedLanguage
        : availableLanguages[0];

    return { availableLanguages, language };
}

// Read only the first CSV record. Handle the UTF-8 BOM, quoted headers and
// escaped quotes without splitting commas that belong inside a quoted field.
function readTranslationCsvHeader(csv) {
    const text = csv.replace(/^\uFEFF/, "");
    const headers = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === '"') {
            if (quoted && text[index + 1] === '"') {
                value += '"';
                index++;
            }
            else {
                quoted = !quoted;
            }
        }
        else if (!quoted && character === ",") {
            headers.push(value.trim());
            value = "";
        }
        else if (!quoted && (character === "\r" || character === "\n")) {
            headers.push(value.trim());
            return headers;
        }
        else {
            value += character;
        }
    }

    if (quoted) {
        throw new Error("translations.csv has an unterminated quoted header.");
    }
    headers.push(value.trim());
    return headers;
}
