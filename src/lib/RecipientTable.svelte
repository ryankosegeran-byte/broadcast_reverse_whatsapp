<script>
  import { onMount } from 'svelte'
  import { detectVariables, render, resolve } from './vars.js'
  import Icon from './Icon.svelte'
  import Preview from './Preview.svelte'

  let { contacts, template, vars, focusedId = null, t, onOpen, onDelete, onFocus } = $props()

  let query = $state('')
  let confirmId = $state(null)
  let sendMode = $state('list')
  let expandedId = $state(null)

  let allVars = $derived(detectVariables(template.body))

  let shown = $derived(
    contacts.filter((c) => {
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q)
    })
  )

  let sentCount = $derived(contacts.filter((c) => c.sentAt?.[template.id]).length)

  let focusIndex = $derived.by(() => {
    if (!shown.length) return -1
    const idx = focusedId ? shown.findIndex((c) => c.id === focusedId) : -1
    return idx >= 0 ? idx : 0
  })

  let focusContact = $derived(focusIndex >= 0 ? shown[focusIndex] : null)

  onMount(() => {
    const onPointerDown = (e) => {
      if (confirmId && !e.target?.closest?.(`[data-confirm-id="${confirmId}"]`)) {
        confirmId = null
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && confirmId) {
        e.stopPropagation()
        confirmId = null
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function setValue(contact, key, value) {
    contact.values[template.id] ??= {}
    contact.values[template.id][key] = value
  }

  function hasMissing(contact) {
    return allVars.some((v) => !resolve(v, contact, template))
  }

  function confirmRemove(contact) {
    confirmId = null
    if (expandedId === contact.id) expandedId = null
    onDelete(contact)
  }

  function toggleCardPreview(contact) {
    if (expandedId === contact.id) {
      expandedId = null
    } else {
      expandedId = contact.id
      onFocus?.(contact)
    }
  }

  function enterFocus(contact) {
    onFocus?.(contact)
    sendMode = 'focus'
  }

  function stepFocus(delta) {
    if (!shown.length) return
    const next = Math.max(0, Math.min(shown.length - 1, focusIndex + delta))
    onFocus?.(shown[next])
  }

  let countLabel = $derived(
    query.trim() && contacts.length > 0
      ? t('rowsFiltered', { shown: shown.length, n: contacts.length })
      : t('rows', { n: contacts.length })
  )

  let progressLabel = $derived(
    t('openedProgress', { sent: sentCount, total: contacts.length })
  )
</script>

<div class="table-tools">
  <div class="search-field">
    <span class="search-icon" aria-hidden="true">
      <Icon name="search" size={15} />
    </span>
    <input
      class="input search-input"
      type="search"
      placeholder={t('search')}
      bind:value={query}
      aria-label={t('search')}
    />
    {#if query}
      <button
        class="search-clear"
        type="button"
        aria-label={t('clearSearch')}
        onclick={() => (query = '')}
      >
        <Icon name="x" size={13} />
      </button>
    {/if}
  </div>
  <span class="badge neutral sm tabular desktop-count">{countLabel}</span>
</div>

{#if contacts.length > 0}
  <div class="mobile-send-bar">
    <div
      class="segmented send-mode-seg"
      role="group"
      aria-label={t('navSend')}
      style="--seg-idx: {sendMode === 'focus' ? 1 : 0}"
    >
      <span class="segmented-thumb" aria-hidden="true"></span>
      <button
        type="button"
        class="segmented-btn"
        aria-pressed={sendMode === 'list'}
        onclick={() => (sendMode = 'list')}
      >
        <Icon name="list" size={13} />
        <span>{t('sendModeList')}</span>
      </button>
      <button
        type="button"
        class="segmented-btn"
        aria-pressed={sendMode === 'focus'}
        onclick={() => (sendMode = 'focus')}
      >
        <Icon name="user" size={13} />
        <span>{t('sendModeFocus')}</span>
      </button>
    </div>
    <span class="badge {sentCount > 0 ? 'success' : 'neutral'} sm tabular">
      {#if sentCount > 0}
        <span class="badge-dot" aria-hidden="true"></span>
      {/if}
      {progressLabel}
    </span>
  </div>
{/if}

{#if contacts.length === 0}
  <div class="empty-state compact">
    <div class="empty-icon" aria-hidden="true">
      <Icon name="users" size={20} />
    </div>
    <h3>{t('recipients')}</h3>
    <p>{t('noContacts')}</p>
  </div>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>{t('phone')}</th>
          <th>{t('name')}</th>
          {#each vars as v (v)}
            <th>{v}</th>
          {/each}
          <th class="col-actions">{t('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each shown as contact, i (contact.id)}
          <tr
            onfocusin={() => onFocus?.(contact)}
            onclick={() => onFocus?.(contact)}
          >
            <td class="num muted tabular">{i + 1}</td>
            <td class="phone tabular">
              <div class="phone-cell">
                <span>{contact.phone}</span>
                {#if contact.sentAt?.[template.id]}
                  <span class="badge success sm" title={t('opened')}>
                    <span class="badge-dot" aria-hidden="true"></span>
                    {t('opened')}
                  </span>
                {/if}
              </div>
            </td>
            <td class="col-name">
              <input
                class="cell"
                value={contact.name}
                placeholder="-"
                aria-label={t('name')}
                oninput={(e) => (contact.name = e.currentTarget.value)}
              />
            </td>
            {#each vars as v (v)}
              {@const blank = !resolve(v, contact, template)}
              <td class="col-var" class:blank>
                <input
                  class="cell"
                  value={resolve(v, contact, template)}
                  placeholder="-"
                  title={blank ? t('blankValueTitle') : undefined}
                  aria-label={v}
                  oninput={(e) => setValue(contact, v, e.currentTarget.value)}
                />
              </td>
            {/each}
            <td class="actions">
              <div class="actions-inner">
                {#if confirmId === contact.id}
                  <div class="confirm-pill" data-confirm-id={contact.id} role="group" aria-label={t('confirmDeletePrompt')}>
                    <span class="confirm-prompt">{t('confirmDeletePrompt')}</span>
                    <button class="confirm-btn" type="button" onclick={() => (confirmId = null)}>
                      {t('cancel')}
                    </button>
                    <button class="confirm-btn danger" type="button" onclick={() => confirmRemove(contact)}>
                      {t('delete')}
                    </button>
                  </div>
                {:else}
                  <button class="btn wa sm" type="button" onclick={() => onOpen(contact)}>
                    <Icon name="external" size={14} />
                    <span>{t('openWa')}</span>
                  </button>
                  <button
                    class="btn icon-btn danger-ghost sm"
                    type="button"
                    title={t('delete')}
                    aria-label={t('deleteContactAria', { name: contact.name || contact.phone })}
                    onclick={() => (confirmId = contact.id)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan={vars.length + 4} class="table-empty">
              <span>{t('noMatches')}</span>
              {#if query}
                <button class="btn ghost sm" type="button" onclick={() => (query = '')}>
                  {t('clearSearch')}
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="mobile-send">
    {#if shown.length === 0}
      <div class="empty-state compact">
        <p>{t('noMatches')}</p>
        {#if query}
          <button class="btn secondary sm" type="button" onclick={() => (query = '')}>
            {t('clearSearch')}
          </button>
        {/if}
      </div>
    {:else if sendMode === 'focus' && focusContact}
      {@const isSent = Boolean(focusContact.sentAt?.[template.id])}
      {@const missing = hasMissing(focusContact)}
      <div class="focus-deck">
        <div class="focus-stepper">
          <button
            class="btn secondary sm icon-btn"
            type="button"
            disabled={focusIndex <= 0}
            aria-label={t('prevContact')}
            onclick={() => stepFocus(-1)}
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <div class="focus-status">
            <span class="focus-counter tabular">
              {t('counterOf', { current: focusIndex + 1, total: shown.length })}
            </span>
            {#if isSent}
              <span class="badge success sm">
                <span class="badge-dot" aria-hidden="true"></span>
                {t('opened')}
              </span>
            {:else if missing}
              <span class="badge warn sm">{t('missingVarsBadge')}</span>
            {:else}
              <span class="badge neutral sm">{t('readyBadge')}</span>
            {/if}
          </div>
          <button
            class="btn secondary sm icon-btn"
            type="button"
            disabled={focusIndex >= shown.length - 1}
            aria-label={t('nextContact')}
            onclick={() => stepFocus(1)}
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>

        <article class="rcard" class:sent={isSent}>
          {#if confirmId === focusContact.id}
            <div class="tpl-confirm rcard-confirm" data-confirm-id={focusContact.id} role="group" aria-label={t('confirmDeletePrompt')}>
              <span class="tpl-confirm-label">{t('deleteContactAria', { name: focusContact.name || focusContact.phone })}</span>
              <div class="tpl-confirm-actions">
                <button class="confirm-btn" type="button" onclick={() => (confirmId = null)}>
                  {t('cancel')}
                </button>
                <button class="confirm-btn danger" type="button" onclick={() => confirmRemove(focusContact)}>
                  {t('delete')}
                </button>
              </div>
            </div>
          {:else}
            <header class="rcard-head">
              <div class="rcard-id">
                <span class="rcard-num tabular">#{focusIndex + 1}</span>
                <span class="rcard-phone tabular">{focusContact.phone}</span>
              </div>
              <button
                class="btn icon-btn danger-ghost sm"
                type="button"
                title={t('delete')}
                aria-label={t('deleteContactAria', { name: focusContact.name || focusContact.phone })}
                onclick={() => (confirmId = focusContact.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            </header>
          {/if}

          <div class="rcard-fields">
            <label class="rcard-field">
              <span class="rcard-label">{t('name')}</span>
              <input
                class="input rcard-input"
                value={focusContact.name}
                placeholder="-"
                aria-label={t('name')}
                oninput={(e) => (focusContact.name = e.currentTarget.value)}
              />
            </label>
            {#each vars as v (v)}
              {@const blank = !resolve(v, focusContact, template)}
              <label class="rcard-field" class:blank>
                <span class="rcard-label">{v}</span>
                <input
                  class="input rcard-input"
                  value={resolve(v, focusContact, template)}
                  placeholder="-"
                  title={blank ? t('blankValueTitle') : undefined}
                  aria-label={v}
                  oninput={(e) => setValue(focusContact, v, e.currentTarget.value)}
                />
              </label>
            {/each}
          </div>
        </article>

        <div class="focus-preview">
          <Preview
            text={render(template.body, focusContact, template)}
            emptyLabel={t('previewEmpty')}
            contactLabel=""
            {t}
          />
          {#if missing}
            <div class="inline-alert warning">
              <Icon name="alert" size={15} />
              <span>{t('emptyValueWarn')}</span>
            </div>
          {/if}
        </div>

        <div class="focus-actions">
          <button class="btn wa rcard-send" type="button" onclick={() => onOpen(focusContact)}>
            <Icon name="external" size={15} />
            <span>{isSent ? t('openAgainWa') : t('openWa')}</span>
          </button>
          {#if focusIndex < shown.length - 1}
            <button class="btn primary rcard-next" type="button" onclick={() => stepFocus(1)}>
              <span>{t('nextContact')}</span>
              <Icon name="chevron-right" size={15} />
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <div class="rcard-list">
        {#each shown as contact, i (contact.id)}
          {@const isSent = Boolean(contact.sentAt?.[template.id])}
          {@const missing = hasMissing(contact)}
          <article class="rcard" class:sent={isSent}>
            {#if confirmId === contact.id}
              <div class="tpl-confirm rcard-confirm" data-confirm-id={contact.id} role="group" aria-label={t('confirmDeletePrompt')}>
                <span class="tpl-confirm-label">{t('deleteContactAria', { name: contact.name || contact.phone })}</span>
                <div class="tpl-confirm-actions">
                  <button class="confirm-btn" type="button" onclick={() => (confirmId = null)}>
                    {t('cancel')}
                  </button>
                  <button class="confirm-btn danger" type="button" onclick={() => confirmRemove(contact)}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            {:else}
              <header class="rcard-head">
                <div class="rcard-id">
                  <span class="rcard-num tabular">#{i + 1}</span>
                  <span class="rcard-phone tabular">{contact.phone}</span>
                  {#if isSent}
                    <span class="badge success sm">
                      <span class="badge-dot" aria-hidden="true"></span>
                      {t('opened')}
                    </span>
                  {:else if missing}
                    <span class="badge warn sm">{t('missingVarsBadge')}</span>
                  {/if}
                </div>
                <button
                  class="btn icon-btn danger-ghost sm"
                  type="button"
                  title={t('delete')}
                  aria-label={t('deleteContactAria', { name: contact.name || contact.phone })}
                  onclick={() => (confirmId = contact.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </header>
            {/if}

            <div class="rcard-fields">
              <label class="rcard-field">
                <span class="rcard-label">{t('name')}</span>
                <input
                  class="input rcard-input"
                  value={contact.name}
                  placeholder="-"
                  aria-label={t('name')}
                  onfocus={() => onFocus?.(contact)}
                  oninput={(e) => (contact.name = e.currentTarget.value)}
                />
              </label>
              {#each vars as v (v)}
                {@const blank = !resolve(v, contact, template)}
                <label class="rcard-field" class:blank>
                  <span class="rcard-label">{v}</span>
                  <input
                    class="input rcard-input"
                    value={resolve(v, contact, template)}
                    placeholder="-"
                    title={blank ? t('blankValueTitle') : undefined}
                    aria-label={v}
                    onfocus={() => onFocus?.(contact)}
                    oninput={(e) => setValue(contact, v, e.currentTarget.value)}
                  />
                </label>
              {/each}
            </div>

            {#if expandedId === contact.id}
              <div class="rcard-preview">
                <Preview
                  text={render(template.body, contact, template)}
                  emptyLabel={t('previewEmpty')}
                  contactLabel=""
                  {t}
                />
                {#if missing}
                  <div class="inline-alert warning">
                    <Icon name="alert" size={15} />
                    <span>{t('emptyValueWarn')}</span>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="rcard-actions">
              <button class="btn wa sm rcard-send" type="button" onclick={() => onOpen(contact)}>
                <Icon name="external" size={14} />
                <span>{t('openWa')}</span>
              </button>
              <button
                class="btn sm rcard-preview-btn {expandedId === contact.id ? 'active-toggle' : 'secondary'}"
                type="button"
                aria-expanded={expandedId === contact.id}
                aria-label={expandedId === contact.id ? t('hidePreview') : t('showPreview')}
                title={expandedId === contact.id ? t('hidePreview') : t('showPreview')}
                onclick={() => toggleCardPreview(contact)}
              >
                <Icon name="eye" size={14} />
                <span class="rcard-btn-label">{expandedId === contact.id ? t('hidePreview') : t('showPreview')}</span>
              </button>
              <button
                class="btn icon-btn secondary sm"
                type="button"
                title={t('focusOne')}
                aria-label={t('focusOne')}
                onclick={() => enterFocus(contact)}
              >
                <Icon name="user" size={14} />
              </button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
{/if}
