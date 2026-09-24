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
            json: async () => JSON.parse(JSON.stringify(actualLinks))
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

test('every static page key exists in the shared or project catalogues', async () => {
    const context = load();
    const settings = await context.window.translationReady;
    const projects = JSON.parse(fs.readFileSync(path.join(root, 'docs/data/projects.json'), 'utf8'));
    for (const entry of projects) {
        assert.deepEqual(Object.keys(entry).sort(), ['assets_path', 'id']);
        const folder = path.join(root, 'docs', entry.assets_path);
        const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'project.json'), 'utf8'));
        const catalogue = context.readTranslationCatalogue(fs.readFileSync(path.join(folder, 'translations.csv'), 'utf8'));
        for (const key of catalogue.translations.keys()) {
            assert.match(key, /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/);
        }
        const links = JSON.parse(fs.readFileSync(path.join(folder, 'links.json'), 'utf8'));
        context.registerProjectTranslations(entry.id, catalogue, links, new URL(metadata.link, context.ROOT).href);
        assert.ok(metadata.title);
        assert.ok(metadata.job);
        assert.equal(metadata.title_key, undefined);
        assert.equal(metadata.job_key, undefined);
        assert.ok([...catalogue.translations.keys()].every(key => !/\.project\.(title|job)$/.test(key)));
        assert.ok(fs.existsSync(path.join(folder, metadata.thumbnail)));
        assert.ok(fs.existsSync(path.join(root, 'docs', metadata.link, 'index.html')));
        const pageHtml = fs.readFileSync(path.join(root, 'docs', metadata.link, 'index.html'), 'utf8');
        function checkText(key) {
            assert.ok(catalogue.translations.has(key), entry.id + ': ' + key);
        }
        function checkMedia(media) {
            assert.ok(['image', 'video', 'embed'].includes(media.type));
            if (media.label) checkText(media.label);
            if (media.type === 'embed') assert.equal(new URL(media.src).protocol, 'https:');
            else assert.ok(fs.existsSync(path.join(folder, media.src)), media.src);
        }
        function checkSections(sections) {
            assert.ok(Array.isArray(sections));
            for (const section of sections) {
                assert.ok(['text', 'preview', 'gallery', 'media', 'group', 'custom'].includes(section.type));
                if (section.heading) checkText(section.heading);
                for (const key of section.paragraphs || []) checkText(key);
                if (section.media) checkMedia(section.media);
                if (section.type === 'gallery') {
                    for (const item of section.items) {
                        checkMedia(item.media);
                        if (item.caption) checkText(item.caption);
                    }
                }
                if (section.type === 'group') checkSections(section.sections);
                if (section.type === 'custom') assert.ok(pageHtml.includes(`<template id="${section.template}">`));
            }
        }
        checkSections(metadata.sections);
    }
    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (entry.name.endsWith('.html')) {
                const html = fs.readFileSync(file, 'utf8');
                const projectId = html.match(/data-project-id="([^"]+)"/)?.[1];
                if (/<!DOCTYPE html>/i.test(html)) {
                    assert.match(html, /<title>[^<]+<\/title>/, file);
                    assert.match(html, /<meta name="description" content="[^"]+">/, file);
                    assert.match(html, /<meta property="og:title" content="[^"]+">/, file);
                    assert.match(html, /<meta property="og:image" content="https:\/\/augustepaccapelo\.github\.io\/PortFolio\/assets\/misc\/social-preview\.jpg">/, file);
                    assert.match(html, /<meta property="og:image:width" content="1200">/, file);
                    assert.match(html, /<meta property="og:image:height" content="627">/, file);
                    assert.match(html, /<link rel="icon" href="[^"]+"[^>]*>/, file);
                }
                for (const match of html.matchAll(/data-i18n(?:-(?:alt|title|aria-label|placeholder))?="([^"]+)"/g)) {
                    assert.ok(context.getTranslationCatalogue(match[1], projectId).translations.has(match[1]), file + ': ' + match[1]);
                }
            }
        }
    }
    assert.ok(fs.existsSync(path.join(root, 'docs/assets/misc/social-preview.jpg')));
    visit(path.join(root, 'docs'));
    for (const key of settings.translations.keys()) {
        assert.match(key, /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/);
    }
    for (const file of fs.readdirSync(path.join(root, 'docs/js'))) {
        if (!file.endsWith('.js')) continue;
        const js = fs.readFileSync(path.join(root, 'docs/js', file), 'utf8');
        for (const match of js.matchAll(/["'](shared\.[a-zA-Z0-9_.]+)["']/g)) {
            assert.ok(settings.translations.has(match[1]), file + ': ' + match[1]);
        }
    }
    for (const key of Object.keys(actualLinks)) assert.ok(settings.translations.has(key), key);
});

test('project columns are matched by language name and missing languages fall back to French', async () => {
    const context = load('key,fr,en,es\nshared,Commun,Shared,', '?lang=en');
    const settings = await context.window.translationReady;
    context.registerProjectTranslations('first', context.readTranslationCatalogue('key,en,fr\nheading,Title,Titre\nbody,,Texte'), {}, context.ROOT);
    context.registerProjectTranslations('second', context.readTranslationCatalogue('key,fr\nheading,Autre'), {}, context.ROOT);
    assert.equal(context.translateText('heading', undefined, 'first'), 'Title');
    assert.equal(context.translateText('body', undefined, 'first'), 'Texte');
    assert.equal(context.translateText('heading', undefined, 'second'), 'Autre');
    context.document = { body: { dataset: { projectId: 'first' } } };
    assert.equal(context.translateText('heading'), 'Title');
    context.document.body.dataset.projectId = 'second';
    assert.equal(context.translateText('heading'), 'Autre');
    assert.equal(context.translateText('shared'), 'Shared');
    settings.languageIndex = 2;
    assert.equal(context.translateText('heading', undefined, 'first'), 'Titre');
    assert.throws(() => context.registerProjectTranslations('first', context.readTranslationCatalogue('key,fr\nheading,Doublon'), {}, context.ROOT));
    assert.throws(() => context.registerProjectTranslations('third', context.readTranslationCatalogue('key,en\nx,Text'), {}, context.ROOT));
});

test('project data loads once and only fetches translations for the current project', async () => {
    const context = load();
    await context.window.translationReady;
    context.document = { body: { dataset: { projectId: 'color_survivor' } } };
    const requests = new Map();
    context.root = context.ROOT;
    context.fetch = async input => {
        const url = new URL(input);
        const relative = url.pathname.replace('/portfolio/', '');
        requests.set(relative, (requests.get(relative) || 0) + 1);
        const file = path.join(root, 'docs', relative);
        return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404,
            text: async () => fs.readFileSync(file, 'utf8'),
            json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
    };
    vm.runInContext(fs.readFileSync(path.join(root, 'docs/js/projects.js'), 'utf8'), context);
    const [a, b] = await Promise.all([context.getProjectData(), context.getProjectData()]);
    assert.equal(a, b);
    assert.equal(a.projects.length, 11);
    const horse = a.projects.find(p => p.id === 'horse_gamble');
    assert.equal(horse.title, 'Horse Gamble Ultimate Race');
    assert.equal(horse.job, 'Game Programmer');
    assert.equal(horse.title_key, undefined);
    assert.ok([...requests.values()].every(count => count === 1));
    assert.ok(requests.has('assets/projects/school/iim/second_year/color_survivor/translations.csv'));
    assert.ok(!requests.has('assets/projects/game_jams/godmofather/horse_gamble/translations.csv'));
    const settingsForLanguage = await context.window.translationReady;
    settingsForLanguage.language = 'en';
    settingsForLanguage.languageIndex = 1;
    vm.runInContext('projectData = undefined;', context);
    // Simulate a fresh page: project translations have already been checked above.
    context.loadProjectTranslations = async () => {};
    const english = await context.getProjectData();
    assert.deepEqual(JSON.parse(JSON.stringify(english.projects.map(p => [p.id, p.title, p.job]))),
        JSON.parse(JSON.stringify(a.projects.map(p => [p.id, p.title, p.job]))));
    const settings = await context.window.translationReady;
    const key = 'lightning.paragraph_1';
    const catalogue = settings.projects.get('color_survivor');
    assert.equal(new URL(catalogue.links[key].sokovolt.href, catalogue.pageUrl).href,
        'https://example.com/portfolio/school_projects/isart_digital/sokovolt/');
});
