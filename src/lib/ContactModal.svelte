<script>
  import { onMount } from 'svelte'
  import { normalizePhone, isValidPhone } from './wa.js'
  import { render, resolve, templateVarKeys, varLabel } from './vars.js'
  import { formatAutoDate, isAutoPreset } from './dates.js'
  import Icon from './Icon.svelte'
  import Preview from './Preview.svelte'

  let {
    contact,
    template = null,
    vars = [],
    allContacts = [],
    labelPool = [],
    navList = [],
    lang = undefined,
    t,
    onSelectContact,
    onOpen,
    onDelete,
    onClose,
  } = $props()

  let dialogEl = $state(null)
  let phoneDraft = $state('')
  let phoneError = $state('')
  let labelDraft = $state('')
  let confirmDelete = $state(false)

  $effect(() => {
    const id = contact?.id
    if (!id) return
    phoneDraft = contact.phone ?? ''
    phoneError = ''
    labelDraft = ''
    confirmDelete = false
  })

  let navIndex = $derived(navList.findIndex((c) => c.id === contact?.id))
  let allKeys = $derived(template ? templateVarKeys(template) : [])
  let missingKeys = $derived(
    template && contact ? allKeys.filter((k) => !resolve(k, contact, template, lang)) : []
  )
  let isSent = $derived(Boolean(template && contact?.sentAt?.[template.id]))
  let availableLabels = $derived(
    labelPool.filter((l) => !(contact?.labels ?? []).includes(l))
  )

  onMount(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (confirmDelete) {
          confirmDelete = false
          return
        }
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogEl) {
        const focusables = [
          ...dialogEl.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
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
    if (e.target === e.currentTarget) {
      if (phoneDraft === contact.phone || commitPhone()) onClose()
    }
  }

  function commitPhone() {
    const norm = normalizePhone(phoneDraft)
    if (!isValidPhone(norm)) {
      phoneError = t('badPhone')
      return false
    }
    if (allContacts.some((c) => c.id !== contact.id && c.phone === norm)) {
      phoneError = t('dupPhone')
      return false
    }
    contact.phone = norm
    phoneDraft = norm
    phoneError = ''
    return true
  }

  function labelHue(name) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
    return h
  }

  function addLabel(raw) {
    const text = String(raw ?? '').trim()
    if (!text) return
    contact.labels ??= []
    for (const part of text.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)) {
      if (!contact.labels.includes(part)) contact.labels.push(part)
    }
  }

  function commitLabelDraft() {
    if (!labelDraft.trim()) return
    addLabel(labelDraft)
    labelDraft = ''
  }

  function removeLabel(label) {
    contact.labels = (contact.labels ?? []).filter((l) => l !== label)
  }

  function setVarValue(key, value) {
    if (!template) return
    contact.values ??= {}
    contact.values[template.id] ??= {}
    if (value === '') {
      delete contact.values[template.id][key]
    } else {
      contact.values[template.id][key] = value
    }
  }

  function stepNav(delta) {
    if (navIndex < 0) return
    const next = navList[navIndex + delta]
    if (!next) return
    if (!commitPhone()) return
    onSelectContact?.(next.id)
  }

  function handleDone() {
    if (!commitPhone()) return
    onClose()
  }

  function handleOpenWa() {
    if (!commitPhone()) return
    onOpen?.(contact)
  }

  function handleDelete() {
    const idx = navIndex
    const next = navList[idx + 1] ?? navList[idx - 1] ?? null
    onDelete?.(contact)
    if (next && next.id !== contact.id) {
      onSelectContact?.(next.id)
    } else {
      onClose()
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card modal-contact"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="contact-modal-title"
  >
    <div class="modal-header">
      <div class="cmodal-head-info">
        <div class="cmodal-title-row">
          <h2 id="contact-modal-title" class="modal-title">
            {contact.name || contact.phone}
          </h2>
          {#if template}
            {#if isSent}
              <span class="badge success sm">
                <span class="badge-dot" aria-hidden="true"></span>
                {t('opened')}
              </span>
            {:else if missingKeys.length}
              <span class="badge warn sm">{t('missingCount', { n: missingKeys.length })}</span>
            {:else}
              <span class="badge neutral sm">{t('readyBadge')}</span>
            {/if}
          {/if}
        </div>
        <p class="modal-desc mono">{contact.phone}</p>
      </div>

      <div class="cmodal-head-controls">
        {#if navList.length > 1 && navIndex >= 0}
          <div class="cmodal-stepper">
            <button
              class="btn icon-btn secondary sm"
              type="button"
              disabled={navIndex <= 0}
              aria-label={t('prevContact')}
              title={t('prevContact')}
              onclick={() => stepNav(-1)}
            >
              <Icon name="chevron-left" size={15} />
            </button>
            <span class="cmodal-counter tabular">
              {t('counterOf', { current: navIndex + 1, total: navList.length })}
            </span>
            <button
              class="btn icon-btn secondary sm"
              type="button"
              disabled={navIndex >= navList.length - 1}
              aria-label={t('nextContact')}
              title={t('nextContact')}
              onclick={() => stepNav(1)}
            >
              <Icon name="chevron-right" size={15} />
            </button>
          </div>
        {/if}
        <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>

    <div class="modal-body cmodal-body">
      <div class="cmodal-sections">
        <section class="cmodal-section">
          <header class="cmodal-section-head">
            <span class="cmodal-section-num tabular">1</span>
            <h3>{t('contactSectionInfo')}</h3>
          </header>
          <div class="cmodal-grid-2">
            <label class="field">
              <span class="field-label">{t('phone')}</span>
              <input
                class="input mono"
                class:input-error={Boolean(phoneError)}
                value={phoneDraft}
                placeholder="0896..."
                oninput={(e) => {
                  phoneDraft = e.currentTarget.value
                  phoneError = ''
                }}
                onblur={commitPhone}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitPhone()
                  }
                }}
              />
              {#if phoneError}
                <span class="cmodal-error">{phoneError}</span>
              {/if}
            </label>
            <label class="field">
              <span class="field-label">{t('name')}</span>
              <input
                class="input"
                value={contact.name}
                placeholder="-"
                oninput={(e) => (contact.name = e.currentTarget.value)}
              />
            </label>
          </div>
        </section>

        <section class="cmodal-section">
          <header class="cmodal-section-head">
            <span class="cmodal-section-num tabular">2</span>
            <h3>{t('contactSectionLabels')}</h3>
          </header>
          {#if (contact.labels ?? []).length}
            <div class="cmodal-labels-current">
              {#each contact.labels ?? [] as label (label)}
                <span class="label-chip" style="--label-hue:{labelHue(label)}">
                  {label}
                  <button
                    class="label-chip-x"
                    type="button"
                    aria-label={t('removeLabel')}
                    onclick={() => removeLabel(label)}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </span>
              {/each}
            </div>
          {/if}
          <form
            class="cmodal-label-form"
            onsubmit={(e) => {
              e.preventDefault()
              commitLabelDraft()
            }}
          >
            <input
              class="input"
              bind:value={labelDraft}
              placeholder="+ {t('labelPlaceholder')}"
              aria-label={t('addLabel')}
            />
            <button class="btn secondary sm" type="submit" disabled={!labelDraft.trim()}>
              <Icon name="plus" size={14} />
              <span>{t('add')}</span>
            </button>
          </form>
          {#if availableLabels.length}
            <div class="cmodal-label-pool">
              <span class="hint">{t('quickAddLabels')}:</span>
              {#each availableLabels as label (label)}
                <button
                  type="button"
                  class="cmodal-label-pick"
                  onclick={() => addLabel(label)}
                >
                  + {label}
                </button>
              {/each}
            </div>
          {/if}
        </section>

        <section class="cmodal-section">
          <header class="cmodal-section-head">
            <span class="cmodal-section-num tabular">3</span>
            <h3>{t('contactSectionVars')}</h3>
            {#if template}
              <span class="cmodal-tpl-tag">{template.name || t('untitled')}</span>
            {/if}
          </header>

          {#if !template}
            <p class="hint">{t('contactNoTemplateYet')}</p>
          {:else if vars.length === 0}
            <p class="hint">{t('contactNoExtraVars')}</p>
          {:else}
            <div class="cmodal-vars">
              {#each vars as v (v)}
                {@const ownVal = contact.values?.[template.id]?.[v] ?? ''}
                {@const autoPreset = template?.auto?.[v]}
                {@const defaultVal = isAutoPreset(autoPreset)
                  ? formatAutoDate(autoPreset, new Date(), lang)
                  : (template?.globals?.[v] ?? '')}
                {@const isBlank = !resolve(v, contact, template, lang)}
                <div class="cmodal-var-field" class:blank={isBlank}>
                  <div class="cmodal-var-head">
                    <label class="field-label" for="cvar-{v}">
                      {varLabel(template, v)}
                    </label>
                    <div class="cmodal-var-meta">
                      {#if ownVal && defaultVal}
                        <button
                          class="cmodal-reset-btn"
                          type="button"
                          onclick={() => setVarValue(v, '')}
                        >
                          {t('resetToDefault')}
                        </button>
                      {/if}
                      <code class="cmodal-varkey">{'{{' + v + '}}'}</code>
                    </div>
                  </div>
                  <input
                    id="cvar-{v}"
                    class="input"
                    value={ownVal}
                    placeholder={defaultVal || '-'}
                    oninput={(e) => setVarValue(v, e.currentTarget.value)}
                  />
                  {#if !ownVal && defaultVal}
                    <span class="hint">{t('usingDefault', { val: defaultVal })}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </div>

      <aside class="cmodal-preview-col">
        <Preview
          text={template ? render(template.body, contact, template, lang) : ''}
          emptyLabel={template ? t('previewBodyEmpty') : t('noTemplatesDesc')}
          contactLabel={template ? (contact.name || contact.phone) : ''}
          {t}
        />
        {#if missingKeys.length}
          <div class="inline-alert warning">
            <Icon name="alert" size={15} />
            <span>{t('emptyValueWarn')}</span>
          </div>
        {/if}
      </aside>
    </div>

    <div class="modal-footer cmodal-footer">
      <div class="cmodal-footer-left">
        {#if confirmDelete}
          <div class="confirm-pill" role="group" aria-label={t('confirmDeletePrompt')}>
            <span class="confirm-prompt">{t('confirmDeletePrompt')}</span>
            <button class="confirm-btn" type="button" onclick={() => (confirmDelete = false)}>
              {t('cancel')}
            </button>
            <button class="confirm-btn danger" type="button" onclick={handleDelete}>
              {t('delete')}
            </button>
          </div>
        {:else}
          <button
            class="btn danger-ghost sm"
            type="button"
            onclick={() => (confirmDelete = true)}
          >
            <Icon name="trash" size={14} />
            <span>{t('delete')}</span>
          </button>
        {/if}
      </div>

      <div class="modal-actions">
        {#if template}
          <button class="btn wa" type="button" onclick={handleOpenWa}>
            <Icon name="external" size={15} />
            <span>{isSent ? t('openAgainWa') : t('openWa')}</span>
          </button>
        {/if}
        <button class="btn primary" type="button" onclick={handleDone}>
          {t('done')}
        </button>
      </div>
    </div>
  </div>
</div>
