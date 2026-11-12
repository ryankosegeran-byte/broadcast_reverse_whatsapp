<script>
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import {
    buildLabelOptions,
    filterByLabels,
    filterLabelOptions,
    highlightText,
    labelHue,
  } from './groups.js'

  const INLINE_LIMIT = 6

  let {
    labelPool = [],
    selected = [],
    mode = 'and',
    contacts = [],
    groups = [],
    t,
    onToggle,
    onSetSelection,
    onModeChange,
    onClear,
  } = $props()

  let open = $state(false)
  let query = $state('')
  let draftSelected = $state([])
  let draftMode = $state('and')
  let triggerEl = $state(null)
  let dialogEl = $state(null)
  let searchEl = $state(null)

  let isOverflowed = $derived(labelPool.length > INLINE_LIMIT)
  let inlineChips = $derived(isOverflowed ? selected : labelPool)
  let options = $derived(buildLabelOptions(labelPool, contacts, groups))
  let filteredOptions = $derived(filterLabelOptions(options, query))
  let matchCount = $derived(filterByLabels(contacts, draftSelected, draftMode).length)

  $effect(() => {
    if (!open) return
    const pool = new Set(labelPool)
    if (draftSelected.some((l) => !pool.has(l))) {
      draftSelected = draftSelected.filter((l) => pool.has(l))
    }
  })

  $effect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        closeModal(true)
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
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  function openModal() {
    draftSelected = [...selected]
    draftMode = mode
    query = ''
    open = true
    tick().then(() => {
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
        searchEl?.focus()
      } else {
        dialogEl?.focus()
      }
    })
  }

  function closeModal(restoreFocus = true) {
    open = false
    query = ''
    if (restoreFocus) tick().then(() => triggerEl?.focus())
  }

  function toggleDraft(name) {
    draftSelected = draftSelected.includes(name)
      ? draftSelected.filter((l) => l !== name)
      : [...draftSelected, name]
  }

  function applyModal() {
    onSetSelection?.([...draftSelected])
    onModeChange?.(draftMode)
    closeModal(true)
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) closeModal(true)
  }
</script>

<div class="label-filter">
  <button
    bind:this={triggerEl}
    class="label-filter-trigger"
    class:has-active={selected.length > 0}
    type="button"
    aria-haspopup="dialog"
    aria-expanded={open}
    title={t('labelFilterOpen')}
    onclick={openModal}
  >
    <Icon name="search" size={11} />
    <span>{t('filterByLabel')}</span>
    {#if selected.length > 0}
      <span class="label-filter-count tabular">{selected.length}</span>
    {:else if isOverflowed}
      <span class="label-filter-total tabular">{labelPool.length}</span>
    {/if}
  </button>

  {#each inlineChips as label (label)}
    <button
      class="chip"
      class:is-overflowed-chip={isOverflowed}
      type="button"
      aria-pressed={selected.includes(label)}
      title={isOverflowed ? t('removeFilterLabel', { name: label }) : undefined}
      onclick={() => onToggle?.(label)}
    >
      <span>{label}</span>
      {#if isOverflowed}
        <Icon name="x" size={10} />
      {/if}
    </button>
  {/each}

  <button
    class="btn ghost xs match-toggle"
    type="button"
    aria-pressed={mode === 'or'}
    onclick={() => onModeChange?.(mode === 'and' ? 'or' : 'and')}
  >
    {mode === 'and' ? t('filterMatchAll') : t('filterMatchAny')}
  </button>

  {#if selected.length}
    <button class="btn ghost xs" type="button" onclick={() => onClear?.()}>
      {t('clearLabels')}
    </button>
  {/if}
</div>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={onBackdropClick}>
    <div
      class="modal-card modal-lfilter"
      bind:this={dialogEl}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lfilter-modal-title"
    >
      <div class="modal-header">
        <div>
          <h2 id="lfilter-modal-title" class="modal-title">{t('labelFilterTitle')}</h2>
          <p class="modal-desc">{t('labelFilterDesc', { total: labelPool.length })}</p>
        </div>
        <button
          class="modal-close"
          type="button"
          onclick={() => closeModal(true)}
          aria-label={t('close')}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div class="lfilter-top">
        <div class="search-field">
          <span class="search-icon" aria-hidden="true">
            <Icon name="search" size={14} />
          </span>
          <input
            bind:this={searchEl}
            class="input lfilter-search-input"
            type="search"
            bind:value={query}
            placeholder={t('labelSearchPlaceholder')}
            aria-label={t('labelSearchPlaceholder')}
          />
          {#if query}
            <button
              class="search-clear"
              type="button"
              aria-label={t('clearSearch')}
              onclick={() => {
                query = ''
                searchEl?.focus()
              }}
            >
              <Icon name="x" size={13} />
            </button>
          {/if}
        </div>

        <div class="lfilter-mode-row">
          <div
            class="segmented lfilter-mode-seg"
            role="group"
            aria-label={t('filterByLabel')}
            style="--seg-idx: {draftMode === 'or' ? 1 : 0}"
          >
            <span class="segmented-thumb" aria-hidden="true"></span>
            <button
              type="button"
              class="segmented-btn"
              aria-pressed={draftMode === 'and'}
              onclick={() => (draftMode = 'and')}
            >
              {t('filterMatchAll')}
            </button>
            <button
              type="button"
              class="segmented-btn"
              aria-pressed={draftMode === 'or'}
              onclick={() => (draftMode = 'or')}
            >
              {t('filterMatchAny')}
            </button>
          </div>
          {#if draftSelected.length > 0}
            <span class="badge neutral sm tabular">
              {t('selectedCount', { n: draftSelected.length })}
            </span>
          {/if}
        </div>

        {#if draftSelected.length > 0}
          <div class="lfilter-picked" role="region" aria-label={t('labels')}>
            {#each draftSelected as label (label)}
              <button
                type="button"
                class="label-chip lfilter-picked-chip"
                style="--label-hue: {labelHue(label)}"
                title={t('removeFilterLabel', { name: label })}
                onclick={() => toggleDraft(label)}
              >
                <span>{label}</span>
                <Icon name="x" size={11} />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="lfilter-list" role="group" aria-label={t('labels')}>
        {#if filteredOptions.length === 0}
          <div class="lfilter-empty">
            <p>{t('labelSearchEmpty', { query: query.trim() })}</p>
            <button
              class="btn secondary sm"
              type="button"
              onclick={() => {
                query = ''
                searchEl?.focus()
              }}
            >
              {t('clearSearch')}
            </button>
          </div>
        {:else}
          {#each filteredOptions as opt (opt.name)}
            {@const checked = draftSelected.includes(opt.name)}
            <button
              type="button"
              class="lfilter-item"
              role="checkbox"
              aria-checked={checked}
              style="--label-hue: {opt.hue}"
              onclick={() => toggleDraft(opt.name)}
            >
              <span class="lfilter-check" aria-hidden="true">
                {#if checked}<Icon name="check" size={12} />{/if}
              </span>
              <span class="lfilter-dot" aria-hidden="true"></span>
              <span class="lfilter-item-text">
                <span class="lfilter-item-name">
                  {#each highlightText(opt.name, query) as seg, i (i)}
                    {#if seg.match}<mark class="lfilter-mark">{seg.text}</mark>{:else}{seg.text}{/if}
                  {/each}
                </span>
                {#if opt.parentPath}
                  <span class="lfilter-item-parent">
                    {#each highlightText(opt.parentPath, query) as seg, i (i)}
                      {#if seg.match}<mark class="lfilter-mark">{seg.text}</mark>{:else}{seg.text}{/if}
                    {/each}
                  </span>
                {/if}
              </span>
              <span class="lfilter-item-count tabular" title={t('groupCount', { n: opt.count })}>
                {opt.count}
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="modal-footer cmodal-footer lfilter-footer">
        <div class="lfilter-footer-left">
          {#if draftSelected.length === 0}
            <span class="badge neutral sm tabular">
              {t('labelMatchNoneFilter', { total: contacts.length })}
            </span>
          {:else if matchCount === 0}
            <span class="badge warn sm tabular">
              {t('labelMatchCount', { n: matchCount, total: contacts.length })}
            </span>
          {:else}
            <span class="badge accent sm tabular">
              <span class="badge-dot" aria-hidden="true"></span>
              {t('labelMatchCount', { n: matchCount, total: contacts.length })}
            </span>
          {/if}
          {#if draftSelected.length > 0}
            <button class="btn ghost xs" type="button" onclick={() => (draftSelected = [])}>
              {t('clearLabels')}
            </button>
          {/if}
        </div>
        <div class="lfilter-footer-actions">
          <button class="btn ghost sm" type="button" onclick={() => closeModal(true)}>
            {t('cancel')}
          </button>
          <button class="btn primary sm" type="button" onclick={applyModal}>
            {t('applyFilter')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
