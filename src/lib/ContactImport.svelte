<script>
  import { onMount } from 'svelte'
  import { parseCsv, parseVcf, guessMapping, mapRows } from './contacts.js'
  import { uid } from './storage.js'
  import { varLabel } from './vars.js'
  import Icon from './Icon.svelte'
  import Select from './Select.svelte'

  let { template = null, templateId = null, varKeys = [], t, onImport, onCancel } = $props()

  let dialogEl = $state(null)
  let fileInputEl = $state(null)
  let dragging = $state(false)
  let fileName = $state('')
  let error = $state('')
  let headers = $state([])
  let dataRows = $state([])
  let mapping = $state({ phone: -1, name: -1, label: -1, vars: {} })

  let previewRows = $derived(dataRows.length ? mapRows(dataRows.slice(0, 10), mapping, varKeys) : [])
  let columnOptions = $derived([
    { value: -1, label: t('importMapIgnore'), muted: true, dividerAfter: headers.length > 0 },
    ...headers.map((h, idx) => {
      const fallback = t('importMapColumn', { n: idx + 1 })
      const label = h || fallback
      return {
        value: idx,
        label,
        meta: label !== fallback ? `#${idx + 1}` : '',
      }
    }),
  ])

  onMount(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'Tab' && dialogEl) {
        const focusables = [
          ...dialogEl.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
          ),
        ]
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  })

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  async function loadFile(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      error = t('importBadFile')
      return
    }
    error = ''
    fileName = file.name
    let text
    try {
      text = await file.text()
    } catch {
      error = t('importBadFile')
      return
    }

    const isVcf = /\.vcf$/i.test(file.name) || /^\s*BEGIN:VCARD/im.test(text)
    if (isVcf) {
      const cards = parseVcf(text)
      if (!cards.length) {
        headers = []
        dataRows = []
        error = t('importFileEmpty')
        return
      }
      headers = [t('importMapPhone'), t('importMapName')]
      dataRows = cards.map((c) => [c.phone, c.name])
      mapping = {
        phone: 0,
        name: 1,
        label: -1,
        vars: Object.fromEntries(varKeys.map((k) => [k, -1])),
      }
      return
    }

    const parsed = parseCsv(text)
    if (!parsed.length) {
      headers = []
      dataRows = []
      error = t('importFileEmpty')
      return
    }

    const firstGuess = guessMapping(parsed[0], varKeys)
    const hasHeader =
      firstGuess.phone >= 0 ||
      firstGuess.name >= 0 ||
      firstGuess.label >= 0 ||
      Object.values(firstGuess.vars).some((i) => i >= 0)

    if (hasHeader) {
      headers = parsed[0]
      dataRows = parsed.slice(1)
      mapping = firstGuess
    } else {
      const colCount = Math.max(...parsed.map((r) => r.length))
      headers = Array.from({ length: colCount }, (_, i) => t('importMapColumn', { n: i + 1 }))
      dataRows = parsed
      mapping = guessMapping(headers, varKeys)
    }
    if (!dataRows.length) error = t('importFileEmpty')
  }

  function onFileChange(e) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    loadFile(file)
  }

  function onDrop(e) {
    e.preventDefault()
    dragging = false
    const file = e.dataTransfer?.files?.[0]
    loadFile(file)
  }

  function submit() {
    if (!dataRows.length || mapping.phone < 0) return
    const mapped = mapRows(dataRows, mapping, varKeys)
    const contacts = mapped
      .filter((r) => r.valid)
      .map((r) => ({
        id: uid('c'),
        phone: r.phone,
        name: r.name,
        labels: r.labels,
        values: templateId && Object.keys(r.values).length ? { [templateId]: r.values } : {},
        sentAt: {},
      }))
    onImport(contacts, { ok: contacts.length, bad: mapped.length - contacts.length })
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card modal-wide"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="contact-import-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="contact-import-title" class="modal-title">{t('importContactsTitle')}</h2>
        {#if fileName}
          <p class="modal-desc">{fileName}</p>
        {/if}
      </div>
      <button class="modal-close" type="button" onclick={onCancel} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="modal-body">
      <div
        class="import-drop"
        class:dragging
        ondragover={(e) => {
          e.preventDefault()
          dragging = true
        }}
        ondragleave={() => (dragging = false)}
        ondrop={onDrop}
      >
        <input
          bind:this={fileInputEl}
          type="file"
          accept=".csv,.vcf,text/csv,text/vcard"
          hidden
          onchange={onFileChange}
        />
        <button class="btn secondary sm" type="button" onclick={() => fileInputEl?.click()}>
          <Icon name="upload" size={14} />
          <span>{t('importChooseFile')}</span>
        </button>
        <span class="hint">{t('importLabelHint')}</span>
      </div>

      {#if error}
        <div class="inline-alert warning">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      {/if}

      {#if dataRows.length}
        <div class="import-section">
          <h3 class="field-label">{t('importMapTitle')}</h3>
          <div class="import-map-grid">
            <div class="field">
              <span class="field-label">{t('importMapPhone')}</span>
              <Select
                ariaLabel={t('importMapPhone')}
                value={mapping.phone}
                options={columnOptions}
                onChange={(val) => (mapping.phone = val)}
              />
            </div>

            <div class="field">
              <span class="field-label">{t('importMapName')}</span>
              <Select
                ariaLabel={t('importMapName')}
                value={mapping.name}
                options={columnOptions}
                onChange={(val) => (mapping.name = val)}
              />
            </div>

            <div class="field">
              <span class="field-label">{t('importMapLabel')}</span>
              <Select
                ariaLabel={t('importMapLabel')}
                value={mapping.label}
                options={columnOptions}
                onChange={(val) => (mapping.label = val)}
              />
            </div>

            {#each varKeys as key (key)}
              {@const fieldLabel = template ? varLabel(template, key) : key}
              <div class="field">
                <span class="field-label" title={key}>{fieldLabel}</span>
                <Select
                  ariaLabel={fieldLabel}
                  value={mapping.vars[key] ?? -1}
                  options={columnOptions}
                  onChange={(val) => (mapping.vars[key] = val)}
                />
              </div>
            {/each}
          </div>
        </div>

        {#if mapping.phone < 0}
          <div class="inline-alert warning">
            <Icon name="alert" size={16} />
            <span>{t('importNeedPhone')}</span>
          </div>
        {/if}

        <div class="import-section">
          <div class="row gap" style="justify-content: space-between">
            <h3 class="field-label">{t('importPreview')}</h3>
            <span class="badge neutral sm tabular">{t('rows', { n: dataRows.length })}</span>
          </div>
          <div class="table-wrap import-preview-wrap">
            <table class="import-preview-table">
              <thead>
                <tr>
                  <th>{t('importMapPhone')}</th>
                  <th>{t('importMapName')}</th>
                  <th>{t('importMapLabel')}</th>
                  {#each varKeys as key (key)}
                    <th title={key}>{template ? varLabel(template, key) : key}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each previewRows as row, idx (idx)}
                  <tr>
                    <td class="phone tabular" class:invalid-cell={!row.valid}>
                      {row.phone || '-'}
                    </td>
                    <td>{row.name || '-'}</td>
                    <td>{row.labels.join(', ') || '-'}</td>
                    {#each varKeys as key (key)}
                      <td>{row.values[key] || '-'}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <div class="modal-actions">
        <button
          class="btn primary"
          type="button"
          disabled={!dataRows.length || mapping.phone < 0}
          onclick={submit}
        >
          {t('importContactsAction')}
        </button>
        <button class="btn ghost" type="button" onclick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  </div>
</div>
