const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/js/translations.js'), 'utf8');
const actualCsv = fs.readFileSync(path.join(root, 'docs/data/translations.csv'), 'utf8');
const actualLinks = JSON.parse(fs.readFileSync(path.join(root, 'docs/data/links.json'), 'utf8'));

function load(csv = actualCsv, search = '', status = 200) {
    const context = vm.createContext({
        URL, URLSearchParams,
        ROOT: 'https://example.com/portfolio/',
        window: { location: { search, href: 'https://example.com/portfolio/contact/' + search } },
        console: { error() {} },
        fetch: async url => ({
            ok: status === 200, status,
            text: async () => csv,
            json: async () => actualLinks
        })
    });
    vm.runInContext(source, context);
    return context;
}

test('CSV quoting preserves commas, quotes, line breaks, Unicode and empty trailing fields', async () => {
    const context = load();
    await context.window.translationReady;
    const rows = context.parseTranslationCsv('\uFEFF"key","fr","en"\r\n"intro","Bonjour, ""été""\r\nDeuxième ligne",""');
    assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
        ['key', 'fr', 'en'], ['intro', 'Bonjour, "été"\r\nDeuxième ligne', '']
    ]);
    assert.throws(() => context.parseTranslationCsv('key,fr\na,"unfinished'));
    assert.throws(() => context.parseTranslationCsv('key,fr\na,"closed"extra'));
});

test('language selection follows CSV order and falls back for missing or unsupported parameters', async () => {
    for (const [query, expected] of [['', 'fr'], ['?lang=', 'fr'], ['?lang=de', 'fr'], ['?lang=en', 'en']]) {
        const context = load('key,fr,en\nhello,Bonjour,Hello', query);
        assert.equal((await context.window.translationReady).language, expected);
    }
    assert.equal((await load('key,en,fr\nhello,Hello,Bonjour').window.translationReady).language, 'en');
});

test('blank translations use the first language and unknown keys use their supplied fallback', async () => {
    const context = load('key,fr,en\nhello,Bonjour,\nother,Autre,Other', '?lang=en');
    await context.window.translationReady;
    assert.equal(context.translateText('hello'), 'Bonjour');
    assert.equal(context.translateText('other'), 'Other');
    assert.equal(context.translateText('unknown', 'Original'), 'Original');
});

test('rejects invalid catalogues and failed fetches', async () => {
    for (const csv of ['', 'key', 'key,fr,', 'key,fr,fr', 'id,fr', 'key,fr\na,Un\na,Deux', 'key,fr\na,Un,Extra']) {
        await assert.rejects(load(csv).window.translationReady);
    }
    await assert.rejects(load(actualCsv, '', 404).window.translationReady);
});

test('language persists in site page links without changing downloads or external links', async () => {
    const context = load('key,fr,en\nhello,Bonjour,Hello', '?lang=en');
    await context.window.translationReady;
    assert.equal(context.translatedPageUrl('../index.html?sort=date#projects'),
        'https://example.com/portfolio/index.html?sort=date&lang=en#projects');
    for (const url of ['https://external.com/', 'https://example.com/other/', 'https://example.com/portfolio/cv.pdf', 'mailto:hello@example.com']) {
        assert.equal(context.translatedPageUrl(url), url);
    }
    assert.equal(context.escapeTranslationText('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('every static page translation key exists in the real CSV', async () => {
    const settings = await load().window.translationReady;
    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (entry.name.endsWith('.html')) {
                const html = fs.readFileSync(file, 'utf8');
                for (const match of html.matchAll(/data-i18n(?:-(?:alt|title|aria-label|placeholder))?="([^"]+)"/g)) {
                    assert.ok(settings.translations.has(match[1]), file + ': ' + match[1]);
                }
            }
        }
    }
    visit(path.join(root, 'docs'));
    for (const key of Object.keys(actualLinks)) assert.ok(settings.translations.has(key), key);
});
