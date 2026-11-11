<script>
  import { onMount, tick } from 'svelte'
  import * as store from './lib/storage.js'
  import { detectVariables, render, resolve } from './lib/vars.js'
  import { normalizePhone, isValidPhone, buildWaUrl } from './lib/wa.js'
  import { wrapMarker } from './lib/waFormat.js'
  import { t, lang, setLang, applyLang } from './lib/i18n.svelte.js'
  import Icon from './lib/Icon.svelte'
  import Preview from './lib/Preview.svelte'
  import RecipientTable from './lib/RecipientTable.svelte'
  import ImportDialog from './lib/ImportDialog.svelte'
  import HelpModal from './lib/HelpModal.svelte'

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
  let form = $state({ phone: '', name: '', values: {} })
  let theme = $state(readTheme())

  let nameEl = $state(null)
  let bodyEl = $state(null)
  let fileEl = $state(null)
  let noticeTimer

  let active = $derived(data.templates.find((x) => x.id === activeId) ?? null)
  let vars = $derived(active ? detectVariables(active.body) : [])
  let valueVars = $derived(vars.filter((v) => v !== 'nama'))
  let previewContact = $derived(
    data.contacts.find((c) => c.id === previewId) ?? data.contacts[0] ?? null
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

  onMount(() => {
    applyLang()
    applyThemeAttr(theme)
    store.setSaveErrorHandler(() => notify(t('storageFull')))
    if (boot.warning) notify(warningText(boot.warning))

    const onPointerDown = (e) => {
      if (confirmTplId && confirmTplEl && !confirmTplEl.contains(e.target)) {
        confirmTplId = null
      }
    }
    const onKeyDown = (e) => {
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

  function newTemplate() {
    const now = new Date().toISOString()
    const tpl = { id: store.uid('tpl'), name: '', body: '', globals: {}, createdAt: now, updatedAt: now }
    data.templates.push(tpl)
    activeId = tpl.id
    previewId = null
    confirmTplId = null
    tick().then(() => nameEl?.focus())
  }

  function confirmDeleteTemplate(id) {
    confirmTplId = null
    data.templates = data.templates.filter((x) => x.id !== id)
    for (const contact of data.contacts) {
      delete contact.values[id]
      delete contact.sentAt[id]
    }
    if (activeId === id) activeId = data.templates[0]?.id ?? null
  }

  async function applyFormat(marker) {
    if (!active || !bodyEl) return
    const start = bodyEl.selectionStart ?? active.body.length
    const end = bodyEl.selectionEnd ?? start
    const next = wrapMarker(active.body, start, end, marker)
    active.body = next.text
    await tick()
    bodyEl.focus()
    bodyEl.selectionStart = next.start
    bodyEl.selectionEnd = next.end
  }

  async function insertVar(key) {
    if (!active || !bodyEl) return
    const token = `{{${key}}}`
    const start = bodyEl.selectionStart ?? active.body.length
    const end = bodyEl.selectionEnd ?? start
    active.body = active.body.slice(0, start) + token + active.body.slice(end)
    await tick()
    bodyEl.focus()
    bodyEl.selectionStart = bodyEl.selectionEnd = start + token.length
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

<div class="page">
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
  </header>

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
                <button class="tpl-name" type="button" onclick={() => (activeId = tpl.id)}>
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
            </div>
          </div>
          <textarea
            id="msg-body"
            class="input body"
            bind:this={bodyEl}
            bind:value={active.body}
            rows="11"
            placeholder={t('bodyPlaceholder')}
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
      <div class="panel-head wrap">
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
            <div class="row gap">
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
                  <span class="field-label">{v}</span>
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
            <div class="row gap">
              <button class="btn primary sm" type="submit" disabled={!showAdd}>{t('add')}</button>
              <button class="btn ghost sm" type="button" onclick={() => (showAdd = false)}>
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <RecipientTable
        contacts={data.contacts}
        template={active}
        vars={valueVars}
        {t}
        onOpen={openWa}
        onDelete={deleteContact}
        onFocus={(contact) => (previewId = contact.id)}
      />
    </section>
  {/if}
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
