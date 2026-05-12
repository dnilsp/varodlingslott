# Vår Odlingslott

En minimal hemsida för att dela bilder och YouTube-videor från kolonilotten med familj och vänner.

## Teknikstack

- **Frontend:** HTML + CSS + vanilla JS (ingen byggsteg)
- **Hosting:** GitHub Pages (gratis)
- **Backend:** Supabase (gratis tier — databas + bildlagring)

## Setup

### 1. Supabase

Projektet är redan skapat på Supabase. Kör SQL-migreringen:

1. Gå till [Supabase Dashboard](https://supabase.com/dashboard)
2. Öppna **SQL Editor**
3. Klistra in innehållet från `setup.sql`
4. Klicka **Run**

### 2. Konfigurera appen

Öppna `app.js` och ändra dessa värden (högst upp i filen):

```js
const SUPABASE_URL = 'din-supabase-url';
const SUPABASE_KEY = 'din-publishable-key';
const SITE_PASSWORD = 'ditt-lösenord';
```

### 3. GitHub Pages

1. Skapa ett nytt repo på GitHub
2. Pusha alla filer
3. Gå till **Settings → Pages**
4. Välj branch `main` och mapp `/` (root)
5. Sidan är live på `dittanvändarnamn.github.io/reponamn`

### 4. Anpassad domän (valfritt)

Om du har köpt en domän (t.ex. `varodlingslott.se`):

1. I Loopia DNS: lägg till en **CNAME-post** som pekar på `dittanvändarnamn.github.io`
2. I GitHub repo Settings → Pages → Custom domain: ange `varodlingslott.se`
3. Kryssa i "Enforce HTTPS"

## Ändra lösenord

Öppna `app.js` och ändra `SITE_PASSWORD` till det nya lösenordet.

## Kostnader

| Tjänst | Kostnad |
|--------|---------|
| GitHub Pages | Gratis |
| Supabase (Free tier) | Gratis |
| Domän (varodlingslott.se) | ~100-200 SEK/år |
