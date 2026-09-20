# Portfolio content

## Shared files

- `projects.json` is the project index. Each entry contains only `id` and `assets_path`.
- `project_order.json` lists project IDs in preferred order.
- `categories.json` defines category IDs and their default labels.
- `translations.csv` contains navigation, filters, categories, and general pages such as Home and Contact.
- `links.json` contains named links used by those shared translations.

Paths in the index are relative to `docs/`. Keep the trailing slash on `assets_path`.

## Each project folder

The folder referenced by `assets_path` contains its media and three content files:

```text
zero_paws/
  project.json
  translations.csv
  links.json
  icon.png
  Soap.gif
  ...
```

`project.json` contains `title`, `job`, `categories`, `start_date`, `end_date`, `thumbnail`, `link`, and `sections`.

- `title` is the original project name and `job` is the English role name. Both stay the same in every language; edit them directly in metadata, not in the CSV.
- Dates use `YYYY-MM-DD`.
- Category IDs refer to the shared `categories.json`.
- `thumbnail` is relative to the project's assets folder.
- `link` is the page URL relative to `docs/`, with a trailing slash.
- The ID and assets path come from the index; do not duplicate them in metadata.

## Translation files

All CSV files use a `key` column followed by language columns, such as `fr,en`.
Project keys are local to their folder, such as `context.heading` or `pitch.paragraph_1`. They must be unique within that project's CSV, but different projects can reuse the same keys.
Use English names with lowercase `snake_case` segments separated by dots: `my_work.heading`, `instrument_placement.paragraph_1`, or `media.stunned_enemy.label`. Media keys describe the content rather than its filename or extension; the actual asset filenames stay unchanged.
HTML uses `data-i18n="context.heading"`. The page's `data-project-id` selects the correct project catalogue automatically. Shared keys keep their prefixes and are looked up in the shared catalogue when no local key matches.

The **shared CSV** defines the languages shown in the selector and the default language (its first language column).
Project columns are matched by name, so their order can differ. Every project CSV must include the shared default language.
An omitted language column or an empty translated cell falls back to the default language.
To introduce a language, add its column to the shared CSV, then add translations to each project's CSV as they become ready.

Keep `<strong>`, other supported formatting tags, and named link markers when translating. Line breaks inside cells become line breaks on the page. Use a proper CSV editor/exporter to preserve quoting.

## Links

A translation such as `Download it from <itch>itch.io</itch>.` uses the matching key in that project's `links.json`:

```json
{
  "download.paragraph_1": {
    "itch": {
      "href": "https://blueprint-trifi.itch.io/zero-paws",
      "target": "_blank",
      "rel": "noopener noreferrer"
    }
  }
}
```

Relative project links resolve against the project's **page URL** (`link` in `project.json`), not its assets folder or the page currently displaying it. Shared relative links continue to resolve against the current page. Use an empty JSON object `{}` when a project has no named links.

## Adding a project

1. Create its assets folder with media and the three content files above.
2. Add its ID and folder path to `projects.json`.
3. Add the ID to `project_order.json` in the desired position.
4. Copy a project page shell, set `data-project-id` to that ID, and adjust its `js/paths.js` script path for the page's folder depth. Keep `<div class="main-content" data-project-sections></div>` as the content placeholder. Describe its content in `project.json` using the section types below.
5. Check both `?lang=fr` and `?lang=en` and run `node --test tests/translations.test.cjs` from the repository root.

The loader fetches project files in parallel and shares in-flight requests between navigation and page rendering. Project metadata and catalogues are currently loaded together on every page. No build step is required; serve `docs/` over HTTP as before.

Only the plural filenames `translations.csv` and `links.json` are loaded. The pre-existing Color Survivor `translation.csv` draft is retained separately and is not used by the site.

## CV language files

The contact page uses `assets/misc/CV_fr.pdf` and `CV_fr.png` for French, and `CV_en.pdf` and `CV_en.png` for English. The English files currently duplicate the French CV. Replace both English files when the translated CV is ready (the PNG is the page preview; the PDF is opened/downloaded).

The contact section's `data-cv-base` controls the path prefix; `data-cv-languages="fr en"` lists available CV versions. A site language without its own CV uses the first listed version. Add another language code and its PDF/PNG pair to support it. The original `CV_Auguste_Paccapelo` files are retained but no longer used by this page.

## Project sections

The `sections` array determines page order. The renderer uses the existing CSS classes, inserts dividers between sections, and retains alternating preview layouts. Reorder array entries to reorder the page. No HTML changes are needed for ordinary sections.

Supported types:

- `text`: `heading` and `paragraphs` (translation keys).
- `preview`: text plus one `media` object. Headings default to level 3. Use `media_position: "after"` when the media should follow the text in the markup; otherwise it comes first.
- `gallery`: optional heading and paragraphs, then an `items` array. Each item contains the **same `media` object** used by previews, plus an optional `caption` translation key.
- `media`: a heading and standalone media, using the existing video layout. Set `layout: "plain"` for the normal full-width section wrapper instead.
- `group`: a heading and a nested `sections` array, wrapped in the existing `my-works` container.
- `custom`: a `template` ID referencing an HTML `<template>` in that project page. Use this for unusual layouts, such as Dragon's Cadence's download section. The renderer clones it; translations and `data-src` media paths work as before. Raw HTML is not stored in JSON.

Except for `custom`, text-bearing types accept `heading`, optional `heading_level` (1–6), and `paragraphs`. Headings default to level 1 outside previews. These fields contain local translation keys, not display text.

Example with both a preview and a gallery:

```json
"sections": [
  {
    "type": "text",
    "heading": "context.heading",
    "paragraphs": ["context.paragraph_1"]
  },
  {
    "type": "group",
    "heading": "usage.heading",
    "sections": [
      {
        "type": "preview",
        "heading": "finite_animation.heading",
        "paragraphs": ["finite_animation.paragraph_1"],
        "media": {
          "type": "video",
          "src": "simple_drop_anim.mp4",
          "label": "media.simple_drop_animation.label",
          "playback": { "controls": true, "autoplay": true, "loop": true, "muted": true }
        }
      },
      {
        "type": "gallery",
        "heading": "example.heading",
        "items": [
          {
            "media": { "type": "image", "src": "draw_anim.gif", "label": "media.card_dealing_animation.label" },
            "caption": "example.paragraph_2"
          },
          {
            "media": { "type": "video", "src": "simple_drop_anim.mp4", "label": "media.simple_drop_animation.label" }
          }
        ]
      }
    ]
  }
]
```

### Media objects

- `type`: `image`, `video`, or `embed` (an iframe).
- `src`: a path relative to the project's assets folder for images/videos; an absolute HTTP(S) embed URL for iframes.
- `label`: a translation key for the image's alternative text or the video/embed's title. Add this for accessibility.
- Videos optionally accept `mime_type` and `playback` with `controls`, `autoplay`, `loop`, `muted`, and `plays_inline`. Defaults are controls and inline playback enabled; autoplay, loop, and mute disabled. Autoplay videos should be muted.
- Embeds optionally accept `allow`, for example `"autoplay"`. Embed-specific playback options belong in the embed URL.

Handwritten pages remain supported: omit `data-project-sections` to keep their HTML content. CSS layout settings remain in `variables.css`; this change adds no mobile layout rules.
