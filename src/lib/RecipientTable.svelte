<script>
  import { onMount } from 'svelte'
  import { render, resolve, templateVarKeys } from './vars.js'
  import { splitBySent } from './groups.js'
  import Icon from './Icon.svelte'
  import Preview from './Preview.svelte'

  let {
    contacts,
    allContactIds = [],
    totalCount = contacts.length,
    template,
    labelPool = [],
    labelFilter = [],
    onToggleLabelFilter,
    onClearLabelFilter,
    focusedId = null,
    lang = undefined,
    t,
    onOpen,
    onDelete,
    onFocus,
    onEdit,
    labelMode = 'and',
    onToggleLabelMode,
    onToggleSent,
  } = $props()

  let query = $state('')
  let confirmId = $state(null)
  let sendMode = $state('list')
  let selected = $state([])
  let selectedOnly = $state(false)
  let statusFilter = $state('all')
  let sentOpen = $state(false)

  let allVars = $derived(template ? templateVarKeys(template) : [])

  let shown = $derived(
    contacts.filter((c) => {
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q)
    })
  )

  let effectiveSelectedOnly = $derived(selectedOnly && selected.length > 0)

  let statusScoped = $derived(
    !template || statusFilter === 'all'
      ? shown
      : shown.filter(
          (c) => (statusFilter === 'sent') === Boolean(c.sentAt?.[template.id])
        )
  )

  let listContacts = $derived(
    effectiveSelectedOnly ? statusScoped.filter((c) => selected.includes(c.id)) : statusScoped
  )

  let split = $derived(splitBySent(listContacts, template?.id ?? null))
  let unsent = $derived(split.unsent)
  let sent = $derived(split.sent)
  let groupedBySent = $derived(statusFilter === 'all' && sent.length > 0)

  let scope = $derived(
    selected.length ? statusScoped.filter((c) => selected.includes(c.id)) : statusScoped
  )

  let sentCount = $derived(template ? scope.filter((c) => c.sentAt?.[template.id]).length : 0)

  let focusIndex = $derived.by(() => {
    if (!scope.length) return -1
    const idx = focusedId ? scope.findIndex((c) => c.id === focusedId) : -1
    return idx >= 0 ? idx : 0
  })

  let focusContact = $derived(focusIndex >= 0 ? scope[focusIndex] : null)

  let allShownSelected = $derived(
    statusScoped.length > 0 && statusScoped.every((c) => selected.includes(c.id))
  )

  let someShownSelected = $derived(
    statusScoped.length > 0 && statusScoped.some((c) => selected.includes(c.id)) && !allShownSelected
  )

  $effect(() => {
    if (!template && statusFilter !== 'all') statusFilter = 'all'
  })

  $effect(() => {
    if (!selected.length) {
      if (selectedOnly) selectedOnly = false
      return
    }
    const validIds = new Set(allContactIds.length ? allContactIds : contacts.map((c) => c.id))
    if (selected.some((id) => !validIds.has(id))) {
      selected = selected.filter((id) => validIds.has(id))
    }
  })

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

  function missingCountFor(contact) {
    if (!template) return 0
    let count = 0
    for (const v of allVars) {
      if (!resolve(v, contact, template, lang)) count++
    }
    return count
  }

  function confirmRemove(contact) {
    confirmId = null
    selected = selected.filter((id) => id !== contact.id)
    onDelete(contact)
  }

  function labelHue(name) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
    return h
  }

  function toggleSelect(contact) {
    selected = selected.includes(contact.id)
      ? selected.filter((id) => id !== contact.id)
      : [...selected, contact.id]
  }

  function selectAllShown() {
    const next = new Set(selected)
    for (const c of statusScoped) next.add(c.id)
    selected = [...next]
  }

  function clearSelection() {
    selected = []
    selectedOnly = false
  }

  function handleIdentityClick(contact) {
    onFocus?.(contact)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches) {
      toggleSelect(contact)
    }
  }

  function startFocusQueue() {
    const target = scope.find((c) => !(template && c.sentAt?.[template.id])) ?? scope[0]
    if (target) onFocus?.(target)
    sendMode = 'focus'
  }

  function stepFocus(delta) {
    if (!scope.length) return
    const next = Math.max(0, Math.min(scope.length - 1, focusIndex + delta))
    onFocus?.(scope[next])
  }

  function openModalFor(contact) {
    onFocus?.(contact)
    onEdit?.(contact, scope.includes(contact) ? scope : statusScoped)
  }

  let countLabel = $derived(
    (query.trim() || labelFilter.length || selected.length || statusFilter !== 'all') && totalCount > 0
      ? t('rowsFiltered', { shown: scope.length, n: totalCount })
      : t('rows', { n: totalCount })
  )

  let progressLabel = $derived(
    t('openedProgress', { sent: sentCount, total: scope.length })
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
</div>

{#if labelPool.length}
  <div class="label-filter">
    <span class="label-filter-label">{t('filterByLabel')}</span>
    {#each labelPool as label (label)}
      <button
        class="chip"
        type="button"
        aria-pressed={labelFilter.includes(label)}
        onclick={() => onToggleLabelFilter?.(label)}
      >
        {label}
      </button>
    {/each}
    <button
      class="btn ghost xs match-toggle"
      type="button"
      aria-pressed={labelMode === 'or'}
      onclick={() => onToggleLabelMode?.(labelMode === 'and' ? 'or' : 'and')}
    >
      {labelMode === 'and' ? t('filterMatchAll') : t('filterMatchAny')}
    </button>
    {#if labelFilter.length}
      <button class="btn ghost xs" type="button" onclick={() => onClearLabelFilter?.()}>{t('clearLabels')}</button>
    {/if}
  </div>
{/if}

{#if totalCount > 0}
  <div class="list-controls">
    <label class="select-all-check">
      <input
        type="checkbox"
        checked={allShownSelected}
        indeterminate={someShownSelected}
        disabled={statusScoped.length === 0}
        onchange={(e) => (e.currentTarget.checked ? selectAllShown() : clearSelection())}
      />
      <span>{t('selectAll')}</span>
    </label>

    <div class="list-controls-right">
      <span class="badge neutral sm tabular desktop-only-count">{countLabel}</span>

      {#if template}
        <div
          class="segmented status-seg"
          role="group"
          aria-label={t('statusAll')}
          style="--seg-idx: {['all', 'unsent', 'sent'].indexOf(statusFilter)}"
        >
          <span class="segmented-thumb" aria-hidden="true"></span>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={statusFilter === 'all'}
            onclick={() => (statusFilter = 'all')}
          >{t('statusAll')}</button>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={statusFilter === 'unsent'}
            onclick={() => (statusFilter = 'unsent')}
          >{t('statusUnsent')}</button>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={statusFilter === 'sent'}
            onclick={() => (statusFilter = 'sent')}
          >{t('statusSent')}</button>
        </div>
      {/if}

      <div class="mobile-send-bar">
        {#if template}
          <span class="badge {sentCount > 0 ? 'success' : 'neutral'} sm tabular">
            {#if sentCount > 0}
              <span class="badge-dot" aria-hidden="true"></span>
            {/if}
            {progressLabel}
          </span>
        {/if}
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
      </div>
    </div>
  </div>

  {#if selected.length > 0}
    <div class="selection-queue" role="region" aria-label={t('selectedCount', { n: selected.length })}>
      <span class="selection-queue-count tabular">
        <span class="badge-dot" aria-hidden="true"></span>
        {t('selectedCount', { n: selected.length })}
      </span>
      <div class="selection-queue-actions">
        {#if sendMode === 'list'}
          <button
            type="button"
            class="btn xs selection-filter-btn {effectiveSelectedOnly ? 'primary' : 'secondary'}"
            aria-pressed={effectiveSelectedOnly}
            onclick={() => (selectedOnly = !selectedOnly)}
          >
            {t('selectedOnly')}
          </button>
          <button
            type="button"
            class="btn wa xs mobile-queue-focus"
            onclick={startFocusQueue}
          >
            <Icon name="send" size={12} />
            <span>{t('sendModeFocus')}</span>
          </button>
        {/if}
        <button
          type="button"
          class="btn icon-btn ghost xs"
          aria-label={t('selectNone')}
          title={t('selectNone')}
          onclick={clearSelection}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  {/if}
{/if}

{#snippet contactRow(contact)}
  {@const isSent = Boolean(template && contact.sentAt?.[template.id])}
  {@const missingCount = missingCountFor(contact)}
  {@const isFocused = focusedId === contact.id}
  {@const isSelected = selected.includes(contact.id)}
  <div
    class="clist-row"
    class:focused={isFocused}
    class:selected={isSelected}
    class:sent={isSent}
    role="listitem"
    ondblclick={(e) => {
      if (!e.target?.closest?.('input, button:not(.clist-identity)')) {
        openModalFor(contact)
      }
    }}
  >
    {#if confirmId === contact.id}
      <div class="tpl-confirm" data-confirm-id={contact.id} role="group" aria-label={t('confirmDeletePrompt')}>
        <span class="tpl-confirm-label">{contact.name || contact.phone}</span>
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
      <div class="clist-top">
        <label class="clist-check">
          <input
            type="checkbox"
            aria-label={contact.name || contact.phone}
            checked={isSelected}
            onclick={(e) => e.stopPropagation()}
            onchange={() => toggleSelect(contact)}
          />
        </label>
        <button
          type="button"
          class="clist-identity"
          onclick={() => handleIdentityClick(contact)}
        >
          <span class="clist-name" class:mono={!contact.name}>
            {contact.name || contact.phone}
          </span>
          {#if contact.name}
            <span class="clist-phone mono tabular">{contact.phone}</span>
          {/if}
        </button>
        <div class="clist-status">
          {#if isSent}
            <span class="badge success sm" title={t('sentBadge')}>
              <span class="badge-dot" aria-hidden="true"></span>
              {t('sentBadge')}
            </span>
          {:else if missingCount > 0}
            <button
              type="button"
              class="badge warn sm clist-missing-btn"
              title={t('blankValueTitle')}
              onclick={(e) => {
                e.stopPropagation()
                openModalFor(contact)
              }}
            >
              {t('missingCount', { n: missingCount })}
            </button>
          {/if}
          <button
            class="btn icon-btn danger-ghost xs"
            type="button"
            title={t('delete')}
            aria-label={t('deleteContactAria', { name: contact.name || contact.phone })}
            onclick={(e) => {
              e.stopPropagation()
              confirmId = contact.id
            }}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>

      <div class="clist-bottom">
        <div class="clist-labels">
          {#each contact.labels ?? [] as label (label)}
            <span class="label-chip" style="--label-hue:{labelHue(label)}">{label}</span>
          {/each}
        </div>
        <div class="clist-actions">
          {#if template}
            <button
              class="btn icon-btn ghost xs"
              type="button"
              title={isSent ? t('markUnsent') : t('markSent')}
              aria-label={isSent ? t('markUnsent') : t('markSent')}
              onclick={(e) => {
                e.stopPropagation()
                onToggleSent?.(contact, !isSent)
              }}
            >
              <Icon name={isSent ? 'x' : 'check'} size={12} />
            </button>
          {/if}
          <button
            class="btn secondary xs"
            type="button"
            onclick={(e) => {
              e.stopPropagation()
              openModalFor(contact)
            }}
          >
            <Icon name="edit" size={12} />
            <span>{t('manageContact')}</span>
          </button>
          <button
            class="btn wa xs"
            type="button"
            disabled={!template}
            aria-label={isSent ? t('openAgainWa') : t('openWa')}
            title={template ? (isSent ? t('openAgainWa') : t('openWa')) : t('needTemplateToSend')}
            onclick={(e) => {
              e.stopPropagation()
              onFocus?.(contact)
              onOpen(contact)
            }}
          >
            <Icon name="external" size={12} />
            <span>{t('openWaShort')}</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#if totalCount === 0}
  <div class="empty-state compact">
    <div class="empty-icon" aria-hidden="true">
      <Icon name="users" size={20} />
    </div>
    <p>{t('noContacts')}</p>
  </div>
{:else if statusScoped.length === 0 || (sendMode === 'list' && listContacts.length === 0)}
  <div class="empty-state compact">
    <p>{t('noMatches')}</p>
    <div class="empty-actions">
      {#if query}
        <button class="btn secondary sm" type="button" onclick={() => (query = '')}>
          {t('clearSearch')}
        </button>
      {/if}
      {#if labelFilter.length}
        <button class="btn secondary sm" type="button" onclick={() => onClearLabelFilter?.()}>
          {t('clearFilters')}
        </button>
      {/if}
      {#if statusFilter !== 'all'}
        <button class="btn secondary sm" type="button" onclick={() => (statusFilter = 'all')}>
          {t('statusAll')}
        </button>
      {/if}
      {#if effectiveSelectedOnly}
        <button class="btn secondary sm" type="button" onclick={() => (selectedOnly = false)}>
          {t('selectedOnly')}
        </button>
      {/if}
    </div>
  </div>
{:else}
  {#if !groupedBySent || unsent.length > 0}
    <div class="clist" data-mobile-mode={sendMode} role="list">
      {#if groupedBySent}
        {#each unsent as contact (contact.id)}{@render contactRow(contact)}{/each}
      {:else}
        {#each listContacts as contact (contact.id)}{@render contactRow(contact)}{/each}
      {/if}
    </div>
  {/if}

  {#if groupedBySent}
    <section class="sent-section" data-mobile-mode={sendMode}>
      <button
        class="sent-toggle"
        type="button"
        aria-expanded={sentOpen}
        onclick={() => (sentOpen = !sentOpen)}
      >
        <Icon name="chevron-right" size={14} className={sentOpen ? 'rot-open' : ''} />
        <span>{t('sentSection', { n: sent.length })}</span>
      </button>
      {#if sentOpen}
        <div class="clist sent-list" data-mobile-mode={sendMode} role="list">
          {#each sent as contact (contact.id)}{@render contactRow(contact)}{/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if sendMode === 'focus'}
    <div class="mobile-send">
      {#if focusContact}
        {@const isSent = Boolean(template && focusContact.sentAt?.[template.id])}
        {@const missing = missingCountFor(focusContact) > 0}
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
                {t('counterOf', { current: focusIndex + 1, total: scope.length })}
              </span>
              {#if template}
                {#if isSent}
                  <span class="badge success sm">
                    <span class="badge-dot" aria-hidden="true"></span>
                    {t('sentBadge')}
                  </span>
                {:else if missing}
                  <span class="badge warn sm">{t('missingVarsBadge')}</span>
                {:else}
                  <span class="badge neutral sm">{t('readyBadge')}</span>
                {/if}
              {/if}
            </div>
            <button
              class="btn secondary sm icon-btn"
              type="button"
              disabled={focusIndex >= scope.length - 1}
              aria-label={t('nextContact')}
              onclick={() => stepFocus(1)}
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>

          <article class="focus-card" class:sent={isSent}>
            {#if confirmId === focusContact.id}
              <div class="tpl-confirm" data-confirm-id={focusContact.id} role="group" aria-label={t('confirmDeletePrompt')}>
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
              <div class="focus-card-top">
                <label class="clist-check">
                  <input
                    type="checkbox"
                    aria-label={focusContact.name || focusContact.phone}
                    checked={selected.includes(focusContact.id)}
                    onchange={() => toggleSelect(focusContact)}
                  />
                </label>
                <div class="focus-card-id">
                  <span class="clist-name" class:mono={!focusContact.name}>
                    {focusContact.name || focusContact.phone}
                  </span>
                  {#if focusContact.name}
                    <span class="clist-phone mono tabular">{focusContact.phone}</span>
                  {/if}
                </div>
                <div class="focus-card-actions">
                  {#if template}
                    <button
                      class="btn icon-btn ghost xs"
                      type="button"
                      title={isSent ? t('markUnsent') : t('markSent')}
                      aria-label={isSent ? t('markUnsent') : t('markSent')}
                      onclick={() => onToggleSent?.(focusContact, !isSent)}
                    >
                      <Icon name={isSent ? 'x' : 'check'} size={12} />
                    </button>
                  {/if}
                  <button
                    class="btn secondary xs"
                    type="button"
                    onclick={() => openModalFor(focusContact)}
                  >
                    <Icon name="edit" size={12} />
                    <span>{t('manageContact')}</span>
                  </button>
                  <button
                    class="btn icon-btn danger-ghost xs"
                    type="button"
                    title={t('delete')}
                    aria-label={t('deleteContactAria', { name: focusContact.name || focusContact.phone })}
                    onclick={() => (confirmId = focusContact.id)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
              {#if (focusContact.labels ?? []).length}
                <div class="focus-card-labels">
                  {#each focusContact.labels ?? [] as label (label)}
                    <span class="label-chip" style="--label-hue:{labelHue(label)}">{label}</span>
                  {/each}
                </div>
              {/if}
            {/if}
          </article>

          <div class="focus-preview">
            {#if template}
              <Preview
                text={render(template.body, focusContact, template, lang)}
                emptyLabel={t('previewBodyEmpty')}
                contactLabel=""
                {t}
              />
              {#if missing}
                <div class="inline-alert warning">
                  <Icon name="alert" size={15} />
                  <span>{t('emptyValueWarn')}</span>
                </div>
              {/if}
            {:else}
              <div class="inline-alert">
                <Icon name="alert" size={15} />
                <span>{t('needTemplateToSend')}</span>
              </div>
            {/if}
          </div>

          <div class="focus-actions">
            <button
              class="btn wa focus-send"
              type="button"
              disabled={!template}
              title={template ? (isSent ? t('openAgainWa') : t('openWa')) : t('needTemplateToSend')}
              onclick={() => onOpen(focusContact)}
            >
              <Icon name="external" size={15} />
              <span>{isSent ? t('openAgainWa') : t('openWa')}</span>
            </button>
            {#if focusIndex < scope.length - 1}
              <button class="btn primary focus-next" type="button" onclick={() => stepFocus(1)}>
                <span>{t('nextContact')}</span>
                <Icon name="chevron-right" size={15} />
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-state compact">
          <p>{t('noMatches')}</p>
          {#if selected.length}
            <button class="btn secondary sm" type="button" onclick={clearSelection}>
              {t('selectNone')}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
{/if}
