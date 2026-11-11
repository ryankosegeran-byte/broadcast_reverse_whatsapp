# Implementation Plan — About Modal

Spec: `docs/superpowers/specs/2026-11-11-about-modal-design.md`
Branch: `feat/labels-variables-contact-import`

Independent of the labels feature plan. Can be done before, after, or between its phases.
Run `npm run build` at the end; unit tests are unaffected (still run `npm run test` before
committing).

Follow existing patterns: Svelte 5 runes, all user-facing text via `t('key')`, EN + ID in
`src/lib/i18n.svelte.js`, modal structure copied from `src/lib/HelpModal.svelte`.

---

## Task 1 — `src/lib/Icon.svelte`: add `info`

Inside the `{#if ...}{:else if ...}` chain, add one branch before the closing `{/if}`:

```svelte
    {:else if name === 'info'}
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
```

(Place it next to the `help` branch for readability.)

---

## Task 2 — `src/lib/AboutModal.svelte` (new file)

Create with this exact content:

```svelte
<script>
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import pkg from '../../package.json'

  let { t, onClose } = $props()

  let dialogEl = $state(null)
  const year = new Date().getFullYear()
  const version = pkg?.version ?? ''

  onMount(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  })

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="about-dialog-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="about-dialog-title" class="modal-title">{t('aboutTitle')}</h2>
        <p class="modal-desc">
          {t('appTitle')} · {t('aboutVersion', { v: version })} · {year}
        </p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="modal-body">
      <p>{t('tagline')}</p>

      <h3 class="about-heading">{t('aboutFeaturesTitle')}</h3>
      <ul class="about-list">
        {#each t('aboutFeatures') as item}
          <li>{item}</li>
        {/each}
      </ul>

      <p class="about-meta">{t('aboutTech')}</p>
      <p class="about-meta">{t('aboutDisclaimer')}</p>

      <div class="about-card">
        <span class="about-label">{t('aboutCreatorTitle')}</span>
        <span class="about-name">{t('aboutCreatorName')}</span>
        <div class="about-links">
          <a
            class="btn secondary sm"
            href="https://github.com/ryankosegeran-byte/broadcast_reverse_whatsapp"
            target="_blank"
            rel="noopener"
          >
            <Icon name="external" size={14} />
            <span>{t('aboutGithub')}</span>
          </a>
          <a class="btn secondary sm" href="mailto:ryankosegeran2@gmail.com">
            <Icon name="external" size={14} />
            <span>{t('aboutEmail')}</span>
          </a>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn primary" type="button" onclick={onClose}>{t('close')}</button>
      </div>
    </div>
  </div>
</div>
```

Notes:

- `t('aboutFeatures')` returns an array (see Task 4); `{#each}` over it works because `t()`
  returns the raw value when no `params` are passed.
- If the `package.json` import fails in dev/build, use the plan's fallback: add
  `define: { __APP_VERSION__: JSON.stringify(require('./package.json').version) }` in
  `vite.config.js` (convert to ESM import there) and replace `version` with
  `__APP_VERSION__`. Only do this if the plain import errors.

---

## Task 3 — `src/App.svelte` wiring

1. Import next to the other modal imports:

```js
  import AboutModal from './lib/AboutModal.svelte'
```

2. State next to `showHelp`:

```js
  let showAbout = $state(false)
```

3. Desktop toolbar: add after the Help button in `.toolbar`:

```svelte
      <button class="btn secondary sm" type="button" onclick={() => (showAbout = true)}>
        <Icon name="info" size={15} />
        <span>{t('about')}</span>
      </button>
```

4. Mobile menu: add one item inside `.mobile-menu-actions`, after the Help item:

```svelte
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showAbout = true
          }}
        >
          <Icon name="info" size={16} />
          <span>{t('about')}</span>
        </button>
```

5. Render at the bottom, next to the other modals:

```svelte
{#if showAbout}
  <AboutModal {t} onClose={() => (showAbout = false)} />
{/if}
```

---

## Task 4 — `src/lib/i18n.svelte.js`

Add these keys to **both** the `en` and `id` dicts (put them near the help keys).

English:

```js
    about: 'About',
    aboutTitle: 'About this app',
    aboutVersion: 'Version {v}',
    aboutFeaturesTitle: 'What it does',
    aboutFeatures: [
      'Compose WhatsApp message templates with bold, italic, strikethrough, monospace, and emoji.',
      'Fill variables per contact and set template defaults.',
      'Group contacts with labels, filter, and send per group.',
      'Import contacts from CSV or VCF files.',
      'Open a prefilled WhatsApp chat link, one contact at a time.',
    ],
    aboutTech: 'Built with Svelte and Vite. No backend. All data stays in this browser.',
    aboutDisclaimer: 'Not an official WhatsApp product and not affiliated with WhatsApp or Meta.',
    aboutCreatorTitle: 'Made by',
    aboutCreatorName: 'Ryan Kosegeran',
    aboutGithub: 'GitHub repository',
    aboutEmail: 'Email',
```

Indonesian:

```js
    about: 'Tentang',
    aboutTitle: 'Tentang app ini',
    aboutVersion: 'Versi {v}',
    aboutFeaturesTitle: 'Yang bisa dilakukan',
    aboutFeatures: [
      'Menyusun template pesan WhatsApp dengan tebal, miring, coret, monospace, dan emoji.',
      'Mengisi variabel per kontak dan menetapkan nilai bawaan template.',
      'Mengelompokkan kontak dengan label, memfilter, dan mengirim per grup.',
      'Mengimpor kontak dari file CSV atau VCF.',
      'Membuka link chat WhatsApp yang sudah terisi, satu kontak setiap kali.',
    ],
    aboutTech: 'Dibuat dengan Svelte dan Vite. Tanpa backend. Semua data tersimpan di browser ini.',
    aboutDisclaimer: 'Bukan produk resmi WhatsApp dan tidak berafiliasi dengan WhatsApp atau Meta.',
    aboutCreatorTitle: 'Dibuat oleh',
    aboutCreatorName: 'Ryan Kosegeran',
    aboutGithub: 'Repositori GitHub',
    aboutEmail: 'Email',
```

Do **not** add any of these to `helpItems`.

---

## Task 5 — `src/styles.css`

Add near the help/modal styles:

```css
.about-heading {
  margin: 16px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground, var(--border-strong));
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.about-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  font-size: 13px;
  line-height: 1.55;
}

.about-meta {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--muted-foreground, var(--border-strong));
}

.about-card {
  margin-top: 16px;
  padding: 14px;
  display: grid;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: color-mix(in oklab, var(--accent) 6%, var(--surface));
}

.about-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-foreground, var(--border-strong));
}

.about-name {
  font-size: 15px;
  font-weight: 600;
}

.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.about-links a {
  text-decoration: none;
}
```

Reuse existing `.modal-card` / `.modal-body` sizing; do not add new overlay styles.

---

## Task 6 — `docs/USAGE.md`

Add a short section after the language/theme section:

```md
## Tentang

Tombol **Tentang** di header (dan item **Tentang** di menu mobile) membuka modal berisi:

- Nama app, versi (dari `package.json`), dan tahun.
- Ringkasan fitur.
- Teknologi: Svelte + Vite, tanpa backend, data hanya di browser.
- Catatan bahwa app ini bukan produk resmi WhatsApp.
- Pembuat: nama, link repositori GitHub, dan email.

Tombol **Tutup**, `Escape`, atau klik di luar modal menutupnya.
```

---

## Verification

```bash
npm run test
npm run build
npm run dev
```

Manual checklist:

- Header button opens the modal; mobile menu item opens it too.
- Version and year show correctly (`1.0.0`, current year).
- GitHub link opens the repo in a new tab; email opens a `mailto:`.
- Close button, `Escape`, and backdrop click all close it.
- Focus returns to the trigger after closing.
- Both languages (EN / ID) show translated content.

Commit:

```
Add About modal with app info, version, features, and author
```
