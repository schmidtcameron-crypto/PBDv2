# Personal Budget Dashboard

A standalone, no-build monthly budget dashboard for GitHub Pages. It uses only `index.html`, `styles.css`, `app.js`, and `manifest.json`.

## What It Does

- Tracks monthly average income, weekly average income, and optional extra income.
- Calculates total available monthly money in the browser.
- Includes default budget buckets for bills, debt, savings, and spending.
- Shows budgeted amount, actual/spent amount, remaining amount, status, and progress for every bucket.
- Saves automatically with `localStorage`.
- Exports a JSON backup and imports pasted JSON backups.
- Works as a static site with no backend, no build step, and no framework.

## Local Use

Open `index.html` in a browser. Your data stays in that browser's local storage. Use the export button when you want a backup that can be restored later.

## Deploy To GitHub Pages

This app should be deployed as its own separate GitHub Pages repository. Do not copy these files into an existing live budget app or another production repository.

1. Create a new GitHub repository, such as `personal-budget-dashboard`.
2. Add these files to the root of that new repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `README.md`
3. Commit and push the files to the new repository.
4. In GitHub, open the new repository's Settings.
5. Go to Pages.
6. Under Build and deployment, choose Deploy from a branch.
7. Select the `main` branch and the root folder.
8. Save the Pages settings.

GitHub will publish the app at the Pages URL shown in that repository's Pages settings.

## Data And Privacy

Budget data is stored locally in the browser using `localStorage`. There is no backend, account system, analytics script, or network storage. Clearing browser data can remove the saved budget, so use Export Data before switching devices or clearing site data.

## Resetting

Use Reset Defaults inside the app to restore the original income fields and default bucket list.
