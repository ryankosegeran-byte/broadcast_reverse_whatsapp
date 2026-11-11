<script>
  import { onMount, tick } from 'svelte'
  import * as store from './lib/storage.js'
  import { render, resolve, templateVarKeys, varLabel } from './lib/vars.js'
  import { normalizePhone, isValidPhone, buildWaUrl } from './lib/wa.js'
  import { wrapMarker } from './lib/waFormat.js'
  import { t, lang, setLang, applyLang } from './lib/i18n.svelte.js'
  import Icon from './lib/Icon.svelte'
  import Preview from './lib/Preview.svelte'
  import RecipientTable from './lib/RecipientTable.svelte'
  import ImportDialog from './lib/ImportDialog.svelte'
  import HelpModal from './lib/HelpModal.svelte'
  import EmojiPicker from './lib/EmojiPicker.svelte'

  const THEME_KEY = 'wa-broadcast:theme'
  const boot = store.loadState()

  let data = $state(boot.state)
  let activeId = $state(boot.state.templates[0]?.id ?? null)
  let previewId = $state(null)
  let notice = $state('')
  let blockedUrl = $state('')
  let showHelp = $state(false)
  let showPaste = $state(false)
  let showAdd = $state(false)
  let pasteText = $state('')
  let newVar = $state('')
  let showImport = $state(false)
  let importData = $state(null)
  let importInfo = $state(null)
  let confirmTplId = $state(null)
  let confirmTplEl = $state(null)
  let showEmoji = $state(false)
  let mobileTab = $state('compose')
  let showMobileMenu = $state(false)
  let form = $state({ phone: '', name: '', values: {} })
  let theme = $state(readTheme())
  let labelFilter = $state([])

  let nameEl = $state(null)
  let bodyEl = $state(null)
  let emojiBtnEl = $state(null)
  let mobileMenuEl = $state(null)
  let mobileMenuBtnEl = $state(null)
  let viewportEl = $state(null)
  let fileEl = $state(null)
  let bodyCursor = null
  let noticeTimer

  function uniqueLabels(contacts) {
    const set = new Set()
    for (const c of contacts) for (const l of c.labels ?? []) if (l) set.add(l)
    return [...set].sort((a, b) => a.localeCompare(b))
  }

  let active = $derived(data.templates.find((x) => x.id === activeId) ?? null)
  let vars = $derived(active ? templateVarKeys(active) : [])
  let valueVars = $derived(vars.filter((v) => v !== 'nama'))
  let labelPool = $derived(uniqueLabels(data.contacts))
  let filteredContacts = $derived(
    labelFilter.length === 0
      ? data.contacts
      : data.contacts.filter((c) => labelFilter.some((l) => (c.labels ?? []).includes(l)))
  )
  let previewContact = $derived(
    filteredContacts.find((c) => c.id === previewId) ?? filteredContacts[0] ?? null
  )
  let previewText = $derived(
    !active ? '' : previewContact ? render(active.body, previewContact, active) : active.body
  )
  let previewMissing = $derived(
    active && previewContact ? vars.filter((v) => !resolve(v, previewContact, active)) : []
  )

  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }

  function applyThemeAttr(next) {
    const root = document.documentElement
    if (next === 'dark') {
      root.setAttribute('data-theme', 'dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#141414')
    } else {
      root.removeAttribute('data-theme')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fcfcfc')
    }
  }

  function toggleTheme(event) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const commit = () => {
      theme = next
      applyThemeAttr(next)
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* storage blocked */
      }
    }

    if (reduce || !document.startViewTransition) {
      commit()
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--vt-x', `${Math.round(rect.left + rect.width / 2)}px`)
    root.style.setProperty('--vt-y', `${Math.round(rect.top + rect.height / 2)}px`)
    root.dataset.vt = 'theme'

    const vt = document.startViewTransition(commit)
    vt.finished.finally(() => {
      delete root.dataset.vt
    })
  }

  $effect(() => {
    JSON.stringify(data)
    store.scheduleSave(data)
  })

  $effect(() => {
    if (labelFilter.length === 0) return
    const pool = new Set(labelPool)
    if (labelFilter.some((l) => !pool.has(l))) {
      labelFilter = labelFilter.filter((l) => pool.has(l))
    }
  })

  onMount(() => {
    applyLang()
    applyThemeAttr(theme)
    store.setSaveErrorHandler(() => notify(t('storageFull')))
    if (boot.warning) notify(warningText(boot.warning))

    const onPointerDown = (e) => {
      if (confirmTplId && confirmTplEl && !confirmTplEl.contains(e.target)) {
        confirmTplId = null
      }
      if (
        showMobileMenu &&
        mobileMenuEl &&
        !mobileMenuEl.contains(e.target) &&
        (!mobileMenuBtnEl || !mobileMenuBtnEl.contains(e.target))
      ) {
        showMobileMenu = false
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showMobileMenu) {
        e.preventDefault()
        closeMobileMenu(true)
        return
      }
      if (e.key === 'Escape' && confirmTplId) {
        confirmTplId = null
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function warningText(kind) {
    if (kind === 'newer') return t('warnNewer')
    if (kind === 'corrupt') return t('warnCorrupt')
    return t('warnStorage')
  }

  function notify(message) {
    notice = message
    blockedUrl = ''
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = ''), 6000)
  }

  function clearNotice() {
    clearTimeout(noticeTimer)
    notice = ''
    blockedUrl = ''
  }

  function switchMobileTab(tab) {
    mobileTab = tab
    showEmoji = false
    showMobileMenu = false
    tick().then(() => viewportEl?.scrollTo(0, 0))
  }

  function closeMobileMenu(restoreFocus = false) {
    showMobileMenu = false
    if (restoreFocus) tick().then(() => mobileMenuBtnEl?.focus())
  }

  function newTemplate() {
    const now = new Date().toISOString()
    const tpl = { id: store.uid('tpl'), name: '', body: '', vars: [], globals: {}, createdAt: now, updatedAt: now }
    data.templates.push(tpl)
    activeId = tpl.id
    previewId = null
    confirmTplId = null
    showEmoji = false
    showMobileMenu = false
    bodyCursor = null
    if (typeof window !== 'undefined' && window.innerWidth <= 760) {
      mobileTab = 'compose'
      tick().then(() => {
        viewportEl?.scrollTo(0, 0)
        nameEl?.focus()
      })
    } else {
      tick().then(() => nameEl?.focus())
    }
  }

  function selectTemplate(id, fromMobileList = false) {
    activeId = id
    showEmoji = false
    bodyCursor = null
    if (fromMobileList && typeof window !== 'undefined' && window.innerWidth <= 760) {
      switchMobileTab('compose')
    }
  }

  function confirmDeleteTemplate(id) {
    confirmTplId = null
    showEmoji = false
    bodyCursor = null
    data.templates = data.templates.filter((x) => x.id !== id)
    for (const contact of data.contacts) {
      delete contact.values[id]
      delete contact.sentAt[id]
    }
    if (activeId === id) activeId = data.templates[0]?.id ?? null
  }

  function syncBodyCursor() {
    if (!bodyEl) return
    bodyCursor = {
      start: bodyEl.selectionStart ?? bodyEl.value.length,
      end: bodyEl.selectionEnd ?? bodyEl.value.length,
    }
  }

  function toggleEmoji() {
    if (!showEmoji) syncBodyCursor()
    showEmoji = !showEmoji
  }

  function closeEmoji(restoreFocus = false) {
    showEmoji = false
    if (restoreFocus) tick().then(() => emojiBtnEl?.focus())
  }

  async function applyFormat(marker) {
    if (!active || !bodyEl) return
    const start = bodyEl.selectionStart ?? bodyCursor?.start ?? active.body.length
    const end = bodyEl.selectionEnd ?? bodyCursor?.end ?? start
    const next = wrapMarker(active.body, start, end, marker)
    active.body = next.text
    bodyCursor = { start: next.start, end: next.end }
    await tick()
    bodyEl.focus()
    bodyEl.selectionStart = next.start
    bodyEl.selectionEnd = next.end
  }

  async function insertVar(key) {
    if (!active || !bodyEl) return
    const token = `{{${key}}}`
    const start = bodyEl.selectionStart ?? bodyCursor?.start ?? active.body.length
    const end = bodyEl.selectionEnd ?? bodyCursor?.end ?? start
    active.body = active.body.slice(0, start) + token + active.body.slice(end)
    const nextPos = start + token.length
    bodyCursor = { start: nextPos, end: nextPos }
    await tick()
    bodyEl.focus()
    bodyEl.selectionStart = bodyEl.selectionEnd = nextPos
  }

  async function insertEmoji(char) {
    if (!active || !bodyEl) return
    const len = active.body.length
    const hasLiveFocus = document.activeElement === bodyEl
    const rawStart = hasLiveFocus ? bodyEl.selectionStart : (bodyCursor?.start ?? bodyEl.selectionStart ?? len)
    const rawEnd = hasLiveFocus ? bodyEl.selectionEnd : (bodyCursor?.end ?? bodyEl.selectionEnd ?? rawStart)
    const start = Math.max(0, Math.min(rawStart ?? len, len))
    const end = Math.max(start, Math.min(rawEnd ?? start, len))

    active.body = active.body.slice(0, start) + char + active.body.slice(end)
    const nextPos = start + char.length
    bodyCursor = { start: nextPos, end: nextPos }
    await tick()
    bodyEl.selectionStart = bodyEl.selectionEnd = nextPos
  }

  function addVariable(event) {
    event.preventDefault()
    const name = newVar.trim().replace(/^\{\{|\}\}$/g, '').trim()
    if (!/^[\w.-]+$/.test(name)) return notify(t('badVarName'))
    insertVar(name)
    newVar = ''
  }

  function pushContact(rawPhone, rawName, values, quiet = false) {
    const phone = normalizePhone(rawPhone)
    if (!isValidPhone(phone)) {
      if (!quiet) notify(t('badPhone'))
      return false
    }
    if (data.contacts.some((c) => c.phone === phone)) {
      if (!quiet) notify(t('dupPhone'))
      return false
    }
    data.contacts.push({
      id: store.uid('c'),
      phone,
      name: String(rawName ?? '').trim(),
      labels: [],
      values: active ? { [active.id]: values } : {},
      sentAt: {},
    })
    return true
  }

  function addManual(event) {
    event.preventDefault()
    const values = {}
    for (const [key, value] of Object.entries(form.values)) {
      if (value?.trim()) values[key] = value.trim()
    }
    if (pushContact(form.phone, form.name, values)) {
      form = { phone: '', name: '', values: {} }
    }
  }

  function addPasted() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    let ok = 0
    let fail = 0
    for (const line of lines) {
      const sep = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ','
      const cols = line.split(sep).map((cell) => cell.trim())
      const values = {}
      valueVars.forEach((key, index) => {
        const value = cols[2 + index]
        if (value) values[key] = value
      })
      if (pushContact(cols[0], cols[1] ?? '', values, true)) ok++
      else fail++
    }
    if (lines.length) notify(t('pasteResult', { ok, fail }))
    if (ok) {
      pasteText = ''
      showPaste = false
    }
  }

  function toggleLabelFilter(label) {
    labelFilter = labelFilter.includes(label)
      ? labelFilter.filter((l) => l !== label)
      : [...labelFilter, label]
  }

  function deleteContact(contact) {
    data.contacts = data.contacts.filter((c) => c.id !== contact.id)
    if (previewId === contact.id) previewId = null
  }

  function openWa(contact) {
    if (!active) return
    const text = render(active.body, contact, active)
    const url = buildWaUrl(contact.phone, text)
    const win = window.open(url, '_blank', 'noopener')
    if (win) {
      contact.sentAt[active.id] = new Date().toISOString()
    } else {
      blockedUrl = url
      notify(t('popupBlocked'))
    }
    if (url.length > 8000) notify(t('urlTooLong'))
  }

  function exportAll() {
    store.downloadExport(data)
  }

  async function onImportFile(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return notify(t('importBadFile'))

    let parsed
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return notify(t('importNotJson'))
    }

    const result = store.validateState(parsed)
    if (!result.ok) {
      notify(
        result.error === 'newer'
          ? t('importNewer')
          : result.error === 'phone'
            ? t('importPhone')
            : t('importNotJson')
      )
      return
    }
    importData = result.data
    importInfo = result.counts
    showImport = true
  }

  function doReplace() {
    data = importData
    activeId = data.templates[0]?.id ?? null
    previewId = null
    labelFilter = []
    showImport = false
    store.saveNow(data)
    notify(t('importDone'))
  }

  function doMerge() {
    store.mergeStates(data, importData)
    showImport = false
    store.saveNow(data)
    notify(t('importDone'))
  }

  function togglePaste() {
    showPaste = !showPaste
    if (showPaste) showAdd = false
  }

  function toggleAdd() {
    showAdd = !showAdd
    if (showAdd) showPaste = false
  }
</script>

<div class="page" data-mobile-tab={mobileTab}>
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <Icon name="wa" size={24} />
      </span>
      <div class="brand-copy">
        <h1>{t('appTitle')}</h1>
        <p class="subtitle">{t('tagline')}</p>
      </div>
    </div>

    <div class="toolbar">
      <div
        class="segmented"
        role="group"
        aria-label={t('language')}
        style="--seg-idx: {lang() === 'id' ? 1 : 0}"
      >
        <span class="segmented-thumb" aria-hidden="true"></span>
        <button
          type="button"
          class="segmented-btn"
          aria-pressed={lang() === 'en'}
          onclick={() => setLang('en')}
        >
          EN
        </button>
        <button
          type="button"
          class="segmented-btn"
          aria-pressed={lang() === 'id'}
          onclick={() => setLang('id')}
        >
          ID
        </button>
      </div>

      <button
        class="btn icon-btn secondary sm"
        type="button"
        onclick={toggleTheme}
        aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
        title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>

      <button class="btn secondary sm" type="button" onclick={() => (showHelp = true)}>
        <Icon name="help" size={15} />
        <span>{t('help')}</span>
      </button>

      <button class="btn secondary sm" type="button" onclick={exportAll}>
        <Icon name="download" size={15} />
        <span>{t('export')}</span>
      </button>

      <button class="btn secondary sm" type="button" onclick={() => fileEl?.click()}>
        <Icon name="upload" size={15} />
        <span>{t('import')}</span>
      </button>
      <input bind:this={fileEl} type="file" accept=".json,application/json" hidden onchange={onImportFile} />
    </div>

    <div class="mobile-header-actions">
      <button
        class="btn icon-btn secondary sm"
        type="button"
        onclick={toggleTheme}
        aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
        title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>
      <button
        bind:this={mobileMenuBtnEl}
        class="btn secondary sm mobile-menu-btn"
        class:active-toggle={showMobileMenu}
        type="button"
        aria-expanded={showMobileMenu}
        aria-haspopup="dialog"
        aria-label={showMobileMenu ? t('closeMenu') : t('menu')}
        onclick={() => (showMobileMenu = !showMobileMenu)}
      >
        <Icon name={showMobileMenu ? 'x' : 'menu'} size={16} />
        <span class="mobile-menu-btn-label">{t('menu')}</span>
      </button>
    </div>
  </header>

  {#if showMobileMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mobile-menu-backdrop" onclick={() => closeMobileMenu(false)}></div>
    <div
      class="mobile-menu"
      bind:this={mobileMenuEl}
      role="dialog"
      aria-label={t('menu')}
    >
      <div class="mobile-menu-intro">
        <p class="mobile-menu-tagline">{t('tagline')}</p>
        <p class="hint">{t('devicesNote')}</p>
      </div>

      <div class="mobile-menu-row">
        <span class="mobile-menu-label">{t('language')}</span>
        <div
          class="segmented"
          role="group"
          aria-label={t('language')}
          style="--seg-idx: {lang() === 'id' ? 1 : 0}"
        >
          <span class="segmented-thumb" aria-hidden="true"></span>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={lang() === 'en'}
            onclick={() => setLang('en')}
          >
            EN
          </button>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={lang() === 'id'}
            onclick={() => setLang('id')}
          >
            ID
          </button>
        </div>
      </div>

      <div class="mobile-menu-row">
        <span class="mobile-menu-label">{t('themeLabel')}</span>
        <button
          class="btn secondary sm"
          type="button"
          onclick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          <span>{theme === 'dark' ? t('themeDark') : t('themeLight')}</span>
        </button>
      </div>

      <div class="mobile-menu-actions">
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            exportAll()
          }}
        >
          <Icon name="download" size={16} />
          <span>{t('export')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            fileEl?.click()
          }}
        >
          <Icon name="upload" size={16} />
          <span>{t('import')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showHelp = true
          }}
        >
          <Icon name="help" size={16} />
          <span>{t('help')}</span>
        </button>
      </div>
    </div>
  {/if}

  {#if notice}
    <div class="alert-banner" role="status" aria-live="polite">
      <span class="alert-icon" aria-hidden="true">
        <Icon name="alert" size={16} />
      </span>
      <div class="alert-body">
        <span>{notice}</span>
        {#if blockedUrl}
          <a class="alert-link" href={blockedUrl} target="_blank" rel="noopener">
            {blockedUrl.slice(0, 64)}…
          </a>
        {/if}
      </div>
      <button class="alert-dismiss" type="button" onclick={clearNotice} aria-label={t('dismiss')}>
        <Icon name="x" size={14} />
      </button>
    </div>
  {/if}

  <div class="mobile-viewport" bind:this={viewportEl}>
  <main class="workspace" class:single={!active}>
    <aside class="panel sidebar" aria-label={t('templates')}>
      <div class="panel-head">
        <h2>{t('templates')}</h2>
        <button
          class="btn sm {data.templates.length === 0 ? 'primary' : 'secondary'}"
          type="button"
          onclick={newTemplate}
        >
          <Icon name="plus" size={14} />
          <span>{t('newTemplate')}</span>
        </button>
      </div>

      {#if data.templates.length === 0}
        <p class="muted small sidebar-empty">{t('noTemplatesDesc')}</p>
      {:else}
        <ul class="tpl-list">
          {#each data.templates as tpl (tpl.id)}
            <li class="tpl-item" class:active={tpl.id === activeId}>
              {#if confirmTplId === tpl.id}
                <div class="tpl-confirm" bind:this={confirmTplEl} role="group" aria-label={t('confirmDeleteTemplatePrompt')}>
                  <span class="tpl-confirm-label">{t('confirmDeleteTemplatePrompt')}</span>
                  <div class="tpl-confirm-actions">
                    <button class="confirm-btn" type="button" onclick={() => (confirmTplId = null)}>
                      {t('cancel')}
                    </button>
                    <button class="confirm-btn danger" type="button" onclick={() => confirmDeleteTemplate(tpl.id)}>
                      {t('delete')}
                    </button>
                  </div>
                </div>
              {:else}
                <button class="tpl-name" type="button" onclick={() => selectTemplate(tpl.id, true)}>
                  {tpl.name || t('untitled')}
                </button>
                <button
                  class="tpl-del"
                  type="button"
                  title={t('delete')}
                  aria-label={t('deleteTemplateAria', { name: tpl.name || t('untitled') })}
                  onclick={() => (confirmTplId = tpl.id)}
                >
                  <Icon name="x" size={14} />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    {#if active}
      <section class="panel editor" aria-label={t('messageBody')}>
        <div class="mobile-tpl-bar">
          <label class="mobile-tpl-picker">
            <span class="mobile-tpl-caption">{t('activeTemplate')}</span>
            <select
              class="input mobile-tpl-select"
              value={activeId}
              aria-label={t('activeTemplate')}
              onchange={(e) => selectTemplate(e.currentTarget.value)}
            >
              {#each data.templates as tpl (tpl.id)}
                <option value={tpl.id}>{tpl.name || t('untitled')}</option>
              {/each}
            </select>
          </label>
          <button
            class="btn icon-btn secondary sm"
            type="button"
            title={t('newTemplate')}
            aria-label={t('newTemplate')}
            onclick={newTemplate}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        <label class="field">
          <span class="field-label">{t('templateName')}</span>
          <input class="input" bind:this={nameEl} bind:value={active.name} placeholder={t('namePlaceholder')} />
        </label>

        <div class="field">
          <div class="field-head">
            <label class="field-label" for="msg-body">{t('messageBody')}</label>
            <div class="format-bar" role="toolbar" aria-label={t('messageBody')}>
              <button
                class="format-btn"
                type="button"
                title={t('formatBold')}
                aria-label={t('formatBold')}
                onclick={() => applyFormat('*')}
              >
                <Icon name="bold" size={14} />
              </button>
              <button
                class="format-btn"
                type="button"
                title={t('formatItalic')}
                aria-label={t('formatItalic')}
                onclick={() => applyFormat('_')}
              >
                <Icon name="italic" size={14} />
              </button>
              <button
                class="format-btn"
                type="button"
                title={t('formatStrike')}
                aria-label={t('formatStrike')}
                onclick={() => applyFormat('~')}
              >
                <Icon name="strike" size={14} />
              </button>
              <button
                class="format-btn"
                type="button"
                title={t('formatMono')}
                aria-label={t('formatMono')}
                onclick={() => applyFormat('`')}
              >
                <Icon name="code" size={14} />
              </button>
              <span class="format-sep" aria-hidden="true"></span>
              <button
                bind:this={emojiBtnEl}
                class="format-btn"
                class:active={showEmoji}
                type="button"
                title={t('emojiPicker')}
                aria-label={t('emojiPicker')}
                aria-expanded={showEmoji}
                aria-haspopup="dialog"
                onclick={toggleEmoji}
              >
                <Icon name="smile" size={15} />
              </button>
            </div>
            {#if showEmoji}
              <EmojiPicker
                {t}
                anchorEl={emojiBtnEl}
                onPick={insertEmoji}
                onClose={closeEmoji}
              />
            {/if}
          </div>
          <textarea
            id="msg-body"
            class="input body"
            bind:this={bodyEl}
            bind:value={active.body}
            rows="11"
            placeholder={t('bodyPlaceholder')}
            onkeyup={syncBodyCursor}
            onmouseup={syncBodyCursor}
            onselect={syncBodyCursor}
            oninput={syncBodyCursor}
          ></textarea>
        </div>

        <div class="field">
          <span class="field-label">{t('variables')}</span>
          <form class="var-add" onsubmit={addVariable}>
            <input
              class="input"
              bind:value={newVar}
              placeholder={t('varNamePlaceholder')}
              aria-label={t('addVariable')}
            />
            <button class="btn secondary sm" type="submit">
              <Icon name="plus" size={14} />
              <span>{t('addVariable')}</span>
            </button>
          </form>
          <div class="chips">
            <button class="chip" type="button" onclick={() => insertVar('nama')}>+ {'{{nama}}'}</button>
            {#each valueVars as v (v)}
              <button class="chip" type="button" onclick={() => insertVar(v)}>+ {'{{' + v + '}}'}</button>
            {/each}
          </div>
          <p class="hint">{t('insertHint')}</p>
          <p class="hint">{t('nameBuiltinHint')}</p>
        </div>

        {#if valueVars.length}
          <div class="field globals-block">
            <span class="field-label">{t('globalValues')}</span>
            <p class="hint">{t('globalHint')}</p>
            <div class="globals">
              {#each valueVars as v (v)}
                <label class="global-row">
                  <span class="global-key">{v}</span>
                  <input
                    class="input"
                    value={active.globals[v] ?? ''}
                    placeholder="-"
                    oninput={(e) => (active.globals[v] = e.currentTarget.value)}
                  />
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <aside class="panel preview-panel" aria-label={t('preview')}>
        {#if filteredContacts.length > 1}
          <label class="mobile-preview-picker">
            <span class="mobile-tpl-caption">{t('recipients')}</span>
            <select
              class="input mobile-tpl-select"
              value={previewContact?.id ?? ''}
              aria-label={t('recipients')}
              onchange={(e) => (previewId = e.currentTarget.value)}
            >
              {#each filteredContacts as c (c.id)}
                <option value={c.id}>{c.name ? `${c.name} (${c.phone})` : c.phone}</option>
              {/each}
            </select>
          </label>
        {/if}
        <Preview
          text={previewText}
          emptyLabel={t('previewEmpty')}
          contactLabel={previewContact ? (previewContact.name || previewContact.phone) : ''}
          {t}
        />
        {#if previewMissing.length}
          <div class="inline-alert warning preview-warn">
            <Icon name="alert" size={15} />
            <span>{t('emptyValueWarn')}</span>
          </div>
        {/if}
        <div class="mobile-preview-actions">
          {#if previewContact}
            <button class="btn wa sm rcard-send" type="button" onclick={() => openWa(previewContact)}>
              <Icon name="external" size={14} />
              <span>{t('openWa')}</span>
            </button>
          {/if}
          <button class="btn secondary sm" type="button" onclick={() => switchMobileTab('send')}>
            <Icon name="send" size={14} />
            <span>{t('goToSend')}</span>
          </button>
        </div>
      </aside>
    {:else}
      <section class="panel empty-panel">
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">
            <Icon name="file" size={22} />
          </div>
          <h3>{t('noTemplates')}</h3>
          <p>{t('selectTemplateDesc')}</p>
          <div class="empty-actions">
            <button class="btn primary" type="button" onclick={newTemplate}>
              <Icon name="plus" size={15} />
              <span>{t('newTemplate')}</span>
            </button>
            <button class="btn secondary" type="button" onclick={() => (showHelp = true)}>
              <Icon name="help" size={15} />
              <span>{t('help')}</span>
            </button>
          </div>
        </div>
      </section>
    {/if}
  </main>

  {#if active}
    <section class="panel recipients" aria-label={t('recipients')}>
      <div class="mobile-tpl-bar">
        <label class="mobile-tpl-picker">
          <span class="mobile-tpl-caption">{t('activeTemplate')}</span>
          <select
            class="input mobile-tpl-select"
            value={activeId}
            aria-label={t('activeTemplate')}
            onchange={(e) => selectTemplate(e.currentTarget.value)}
          >
            {#each data.templates as tpl (tpl.id)}
              <option value={tpl.id}>{tpl.name || t('untitled')}</option>
            {/each}
          </select>
        </label>
        <button
          class="btn secondary sm"
          type="button"
          onclick={() => switchMobileTab('compose')}
        >
          <Icon name="edit" size={14} />
          <span>{t('navCompose')}</span>
        </button>
      </div>

      <div class="panel-head">
        <h2>{t('recipients')}</h2>
        <div class="row gap wrap">
          <button
            class="btn sm {showPaste ? 'active-toggle' : 'secondary'}"
            type="button"
            aria-expanded={showPaste}
            onclick={togglePaste}
          >
            <Icon name="clipboard" size={14} />
            <span>{t('pasteRows')}</span>
          </button>
          <button
            class="btn sm {showAdd ? 'active-toggle' : 'primary'}"
            type="button"
            aria-expanded={showAdd}
            onclick={toggleAdd}
          >
            <Icon name="plus" size={14} />
            <span>{t('addContact')}</span>
          </button>
        </div>
      </div>

      <div class="collapsible" data-open={showPaste ? 'true' : 'false'} inert={!showPaste}>
        <div class="collapsible-inner">
          <div class="subpanel">
            <p class="hint">{t('pasteHelp')}</p>
            <textarea
              class="input mono"
              rows="4"
              bind:value={pasteText}
              placeholder={t('pastePlaceholder')}
              disabled={!showPaste}
            ></textarea>
            <div class="row gap wrap">
              <button
                class="btn primary sm"
                type="button"
                onclick={addPasted}
                disabled={!showPaste || !pasteText.trim()}
              >
                {t('addContactsAction')}
              </button>
              <button class="btn ghost sm" type="button" onclick={() => (showPaste = false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="collapsible" data-open={showAdd ? 'true' : 'false'} inert={!showAdd}>
        <div class="collapsible-inner">
          <form class="subpanel" onsubmit={addManual}>
            <div class="add-grid">
              <label class="field">
                <span class="field-label">{t('phone')}</span>
                <input
                  class="input"
                  bind:value={form.phone}
                  placeholder="0896..."
                  required
                  disabled={!showAdd}
                />
              </label>
              <label class="field">
                <span class="field-label">{t('name')}</span>
                <input
                  class="input"
                  bind:value={form.name}
                  placeholder="-"
                  disabled={!showAdd}
                />
              </label>
              {#each valueVars as v (v)}
                <label class="field">
                  <span class="field-label" title={v}>{varLabel(active, v)}</span>
                  <input
                    class="input"
                    value={form.values[v] ?? ''}
                    placeholder="-"
                    disabled={!showAdd}
                    oninput={(e) => (form.values[v] = e.currentTarget.value)}
                  />
                </label>
              {/each}
            </div>
            <div class="row gap wrap">
              <button class="btn primary sm" type="submit" disabled={!showAdd}>{t('add')}</button>
              <button class="btn ghost sm" type="button" onclick={() => (showAdd = false)}>
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <RecipientTable
        contacts={filteredContacts}
        totalCount={data.contacts.length}
        template={active}
        vars={valueVars}
        {labelPool}
        {labelFilter}
        onToggleLabelFilter={toggleLabelFilter}
        onClearLabelFilter={() => (labelFilter = [])}
        focusedId={previewContact?.id ?? null}
        {t}
        onOpen={openWa}
        onDelete={deleteContact}
        onFocus={(contact) => (previewId = contact.id)}
      />
    </section>
  {/if}
  </div>

  <nav class="mobile-nav" aria-label={t('navLabel')}>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'templates'}
      aria-current={mobileTab === 'templates' ? 'page' : undefined}
      onclick={() => switchMobileTab('templates')}
    >
      <Icon name="file" size={18} />
      <span class="mobile-nav-label">{t('navTemplates')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'compose'}
      aria-current={mobileTab === 'compose' ? 'page' : undefined}
      onclick={() => switchMobileTab('compose')}
    >
      <Icon name="edit" size={18} />
      <span class="mobile-nav-label">{t('navCompose')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'preview'}
      aria-current={mobileTab === 'preview' ? 'page' : undefined}
      onclick={() => switchMobileTab('preview')}
    >
      <Icon name="eye" size={18} />
      <span class="mobile-nav-label">{t('navPreview')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'send'}
      aria-current={mobileTab === 'send' ? 'page' : undefined}
      onclick={() => switchMobileTab('send')}
    >
      <span class="mobile-nav-icon-wrap">
        <Icon name="send" size={18} />
        {#if data.contacts.length > 0}
          <span class="mobile-nav-count tabular">{data.contacts.length}</span>
        {/if}
      </span>
      <span class="mobile-nav-label">{t('navSend')}</span>
    </button>
  </nav>
</div>

{#if showHelp}
  <HelpModal {t} onClose={() => (showHelp = false)} />
{/if}

{#if showImport && importInfo}
  <ImportDialog
    info={importInfo}
    {t}
    onReplace={doReplace}
    onMerge={doMerge}
    onExportFirst={exportAll}
    onCancel={() => (showImport = false)}
  />
{/if}
