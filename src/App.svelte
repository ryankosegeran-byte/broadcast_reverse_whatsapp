<script>
  import { onMount, tick } from 'svelte'
  import * as store from './lib/storage.js'
  import { detectVariables, render, resolve } from './lib/vars.js'
  import { normalizePhone, isValidPhone, buildWaUrl } from './lib/wa.js'
  import { t, lang, setLang, applyLang } from './lib/i18n.svelte.js'
  import Preview from './lib/Preview.svelte'
  import RecipientTable from './lib/RecipientTable.svelte'
  import ImportDialog from './lib/ImportDialog.svelte'
  import HelpModal from './lib/HelpModal.svelte'

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
  let form = $state({ phone: '', name: '', values: {} })

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

  $effect(() => {
    JSON.stringify(data)
    store.scheduleSave(data)
  })

  onMount(() => {
    applyLang()
    store.setSaveErrorHandler(() => notify(t('storageFull')))
    if (boot.warning) notify(warningText(boot.warning))
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

  function newTemplate() {
    const now = new Date().toISOString()
    const tpl = { id: store.uid('tpl'), name: '', body: '', globals: {}, createdAt: now, updatedAt: now }
    data.templates.push(tpl)
    activeId = tpl.id
    previewId = null
    tick().then(() => nameEl?.focus())
  }

  function deleteTemplate(id) {
    if (!confirm(t('confirmDeleteTemplate'))) return
    data.templates = data.templates.filter((x) => x.id !== id)
    for (const contact of data.contacts) {
      delete contact.values[id]
      delete contact.sentAt[id]
    }
    if (activeId === id) activeId = data.templates[0]?.id ?? null
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
    if (!confirm(t('confirmDeleteContact'))) return
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

  async function copyPreview() {
    if (!previewText) return
    try {
      await navigator.clipboard.writeText(previewText)
    } catch {
      const area = document.createElement('textarea')
      area.value = previewText
      document.body.append(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    notify(t('copied'))
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
</script>

<header class="topbar">
  <div class="brand">
    <div class="logo" aria-hidden="true">💬</div>
    <div>
      <h1>{t('appTitle')}</h1>
      <p class="muted small">{t('tagline')}</p>
    </div>
  </div>
  <div class="row gap wrap">
    <select
      class="input lang"
      value={lang()}
      onchange={(e) => setLang(e.currentTarget.value)}
      aria-label={t('language')}
    >
      <option value="en">English</option>
      <option value="id">Indonesia</option>
    </select>
    <button class="btn ghost" type="button" onclick={() => (showHelp = true)}>{t('help')}</button>
    <button class="btn ghost" type="button" onclick={exportAll}>{t('export')}</button>
    <button class="btn ghost" type="button" onclick={() => fileEl?.click()}>{t('import')}</button>
    <input bind:this={fileEl} type="file" accept=".json,application/json" hidden onchange={onImportFile} />
  </div>
</header>

{#if notice}
  <div class="notice" role="status">
    {notice}
    {#if blockedUrl}
      <a href={blockedUrl} target="_blank" rel="noopener">{blockedUrl.slice(0, 60)}…</a>
    {/if}
  </div>
{/if}

<main class="layout" class:single={!active}>
  <aside class="panel sidebar">
    <div class="panel-head">
      <h2>{t('templates')}</h2>
      <button class="btn primary small" type="button" onclick={newTemplate}>+ {t('newTemplate')}</button>
    </div>
    {#if data.templates.length === 0}
      <p class="muted small">{t('noTemplates')}</p>
    {:else}
      <ul class="tpl-list">
        {#each data.templates as tpl (tpl.id)}
          <li class:active={tpl.id === activeId}>
            <button class="tpl-name" type="button" onclick={() => (activeId = tpl.id)}>
              {tpl.name || t('untitled')}
            </button>
            <button
              class="tpl-del"
              type="button"
              title={t('delete')}
              aria-label={t('delete')}
              onclick={() => deleteTemplate(tpl.id)}>×</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </aside>

  {#if active}
    <section class="panel editor">
      <label class="field">
        <span>{t('templateName')}</span>
        <input class="input" bind:this={nameEl} bind:value={active.name} placeholder={t('namePlaceholder')} />
      </label>

      <label class="field">
        <span>{t('messageBody')}</span>
        <textarea
          class="input body"
          bind:this={bodyEl}
          bind:value={active.body}
          rows="12"
          placeholder={t('bodyPlaceholder')}
        ></textarea>
      </label>

      <div class="field">
        <span class="label-text">{t('variables')}</span>
        <form class="var-add" onsubmit={addVariable}>
          <input
            class="input"
            bind:value={newVar}
            placeholder={t('varNamePlaceholder')}
            aria-label={t('addVariable')}
          />
          <button class="btn primary small" type="submit">+ {t('addVariable')}</button>
        </form>
        <div class="chips">
          <button class="chip" type="button" onclick={() => insertVar('nama')}>+ {'{{nama}}'}</button>
          {#each valueVars as v (v)}
            <button class="chip" type="button" onclick={() => insertVar(v)}>+ {'{{' + v + '}}'}</button>
          {/each}
        </div>
        <p class="muted tiny">{t('insertHint')}</p>
        <p class="muted tiny">{t('nameBuiltinHint')}</p>
      </div>

      {#if valueVars.length}
        <div class="field">
          <span class="label-text">{t('globalValues')}</span>
          <p class="muted tiny">{t('globalHint')}</p>
          <div class="globals">
            {#each valueVars as v (v)}
              <label class="global-row">
                <span class="tiny muted">{v}</span>
                <input
                  class="input"
                  value={active.globals[v] ?? ''}
                  placeholder="—"
                  oninput={(e) => (active.globals[v] = e.currentTarget.value)}
                />
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <aside class="panel preview">
      <div class="panel-head">
        <h2>{t('preview')}</h2>
        <button class="btn ghost small" type="button" onclick={copyPreview}>{t('copy')}</button>
      </div>
      <Preview text={previewText} emptyLabel={t('selectTemplate')} />
      {#if previewMissing.length}
        <p class="muted tiny">{t('emptyValueWarn')}</p>
      {/if}
    </aside>
  {:else}
    <section class="panel empty">
      <p>{t('selectTemplate')}</p>
      <div class="row gap">
        <button class="btn primary" type="button" onclick={newTemplate}>+ {t('newTemplate')}</button>
        <button class="btn ghost" type="button" onclick={() => (showHelp = true)}>{t('help')}</button>
      </div>
    </section>
  {/if}
</main>

{#if active}
  <section class="panel recipients">
    <div class="panel-head wrap">
      <h2>{t('recipients')}</h2>
      <div class="row gap wrap">
        <button class="btn ghost small" type="button" onclick={() => (showPaste = !showPaste)}>
          {t('pasteRows')}
        </button>
        <button class="btn primary small" type="button" onclick={() => (showAdd = !showAdd)}>
          + {t('addContact')}
        </button>
      </div>
    </div>

    {#if showPaste}
      <div class="subpanel">
        <p class="muted tiny">{t('pasteHelp')}</p>
        <textarea class="input mono" rows="4" bind:value={pasteText} placeholder={t('pastePlaceholder')}></textarea>
        <div class="row gap">
          <button class="btn primary small" type="button" onclick={addPasted} disabled={!pasteText.trim()}>
            {t('add')}
          </button>
          <button class="btn ghost small" type="button" onclick={() => (showPaste = false)}>{t('cancel')}</button>
        </div>
      </div>
    {/if}

    {#if showAdd}
      <form class="subpanel" onsubmit={addManual}>
        <div class="add-grid">
          <label class="field">
            <span>{t('phone')}</span>
            <input class="input" bind:value={form.phone} placeholder="0896..." required />
          </label>
          <label class="field">
            <span>{t('name')}</span>
            <input class="input" bind:value={form.name} placeholder="—" />
          </label>
          {#each valueVars as v (v)}
            <label class="field">
              <span>{v}</span>
              <input
                class="input"
                value={form.values[v] ?? ''}
                placeholder="—"
                oninput={(e) => (form.values[v] = e.currentTarget.value)}
              />
            </label>
          {/each}
        </div>
        <div class="row gap">
          <button class="btn primary small" type="submit">{t('add')}</button>
          <button class="btn ghost small" type="button" onclick={() => (showAdd = false)}>{t('cancel')}</button>
        </div>
      </form>
    {/if}

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
