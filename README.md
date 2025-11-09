# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Documentation

- [Authentication overview](./auth.md)

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Rapporter

### Klientrapport

- **UI:** `Rapporter → Klienter`
- **Endpoint:** `GET /api/reports/client-summary?active=all|active|inactive`
- **Export:** `GET /api/reports/client-summary/export` (same filter params)
- **Filter:** Visa alla, endast aktiva eller endast inaktiva klienter. Fritextsökning på namn, e-post, tränare, kund m.m.
- **Kolumner:** Bokningsstatistik (totalt, 90 d, 30 d), paketstatus, utnyttjade/återstående pass, kopplade kunder, första/senaste/nästa bokning m.m.
- **Summeringar:** Kort som visar antal klienter baserat på aktuellt filter samt totalöversikt för hela databasen med tidstämpel.

> Excel-exporten innehåller samma kolumner som den webbaserade tabellen samt en totalsummering längst ned.
