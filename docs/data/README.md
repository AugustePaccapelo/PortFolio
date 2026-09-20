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

`project.json` contains `title`, `job`, `categories`, `start_date`, `end_date`, `thumbnail`, and `link`.

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
4. Create its HTML page, set `data-project-id` to that ID, and use matching translation keys.
5. Check both `?lang=fr` and `?lang=en` and run `node --test tests/translations.test.cjs` from the repository root.

The loader fetches project files in parallel and shares in-flight requests between navigation and page rendering. Project metadata and catalogues are currently loaded together on every page. No build step is required; serve `docs/` over HTTP as before.

Only the plural filenames `translations.csv` and `links.json` are loaded. The pre-existing Color Survivor `translation.csv` draft is retained separately and is not used by the site.
