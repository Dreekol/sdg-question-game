# SDG question game

A static web app for the SDG question game. Enter a number or press **Randomize** to show the matching question. It has mobile, tablet and desktop layouts, plus light, dark and match-system themes.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup |
| `styles.css` | Brand tokens, light/dark themes, breakpoints (mobile < 640px, tablet 640–1023px, desktop ≥ 1024px) |
| `app.js` | Number lookup, random picker, history, theme switch, shortcuts |
| `questions/part-1.txt` … `part-3.txt` | The 3,000 questions, 1,000 per file — **edit these to change the questions** |
| `vercel.json` | Vercel config (static, no build step) |
| `assets/sdg-logo-mark.png` | Round SDG logo mark (also the browser-tab and home-screen icon) |

## Editing the questions

The questions are split across `questions/part-1.txt` (#1–1000), `part-2.txt` (#1001–2000) and `part-3.txt` (#2001–3000). Each file has one question per line, in order. To add more, append lines to `part-3.txt` or add a `part-4.txt` and list it in `PARTS` in `app.js`. Each line starts with a theme number, then a `|`, then the question:

```
1|What's your go-to comfort food?
3|Would you rather be able to fly or be invisible?
```

Theme numbers: 0 Work life · 1 Food & drink · 2 Travel & places · 3 Would you rather · 4 Hypotheticals · 5 Favorites · 6 Throwbacks · 7 Hobbies & fun · 8 Tech & tools · 9 Movies, music & books. The names live in `THEMES` at the top of `app.js`.

The app picks up the new count on its own. Keep questions work-safe: no politics, religion, dating, money, health or anything that pressures people to share private details.

## Deploy to Vercel

**Option A — dashboard:** push this folder to a GitHub repo, then in Vercel choose *Add New → Project*, import the repo, set Framework Preset to **Other**, and deploy. You don't need a build command.

**Option B — CLI:**

```bash
npm i -g vercel
cd sdg-questions
vercel        # first run links the project
vercel --prod
```

## Features

- Look up any question by number, with validation for out-of-range input
- Theme selector: numbers and Randomize use only the themes you turn on (all themes = 1–3000, one theme = 1–300). The selection is remembered per browser. Shared links always open the same question.
- Cryptographically random picks, with an optional "skip questions already asked" mode
- History of asked questions (saved in the browser) and a reset button
- Previous/next buttons and a shareable link for each question (`/#42`)
- Keyboard shortcuts: `R` random, `←` / `→` previous/next
- Light, dark and system themes; the choice is remembered per browser
- SDG brand colors, Trade Gothic LT → Arial font stack, and Phosphor icons (Regular style, Light weight; Fill style for the active theme)

## Local preview

```bash
npx serve .
```

Open the URL it prints. Opening `index.html` directly from disk won't load the question files, because browsers block that request.
