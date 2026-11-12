<script>
  import { onMount, tick } from 'svelte'
  import {
    EMOJI_CATEGORIES,
    loadRecentEmojis,
    pushRecentEmoji,
    lookupEmoji,
    filterEmojis,
  } from './emojis.js'
  import Icon from './Icon.svelte'

  let { t, anchorEl = null, onPick, onClose } = $props()

  let popoverEl = $state(null)
  let scrollEl = $state(null)
  let query = $state('')
  let activeCat = $state('recent')
  let hovered = $state(null)
  let recent = $state(loadRecentEmojis())
  let sectionRefs = $state({})

  const tabs = [
    { id: 'recent', icon: 'clock' },
    ...EMOJI_CATEGORIES.map((c) => ({ id: c.id, icon: c.icon })),
  ]

  let recentItems = $derived(recent.map((char) => lookupEmoji(char)))
  let searchHits = $derived(query.trim() ? filterEmojis(query) : [])

  onMount(() => {
    popoverEl?.focus()

    const onPointerDown = (e) => {
      if (
        popoverEl &&
        !popoverEl.contains(e.target) &&
        (!anchorEl || !anchorEl.contains(e.target))
      ) {
        onClose()
      }
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose(true)
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('click', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('click', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  })

  function catLabel(id) {
    return t(`emojiCat_${id}`)
  }

  async function selectTab(id) {
    activeCat = id
    if (query.trim()) {
      query = ''
      await tick()
    }
    const target = sectionRefs[id]
    if (target && scrollEl) {
      scrollEl.scrollTo({
        top: target.offsetTop,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    }
  }

  function handleScroll() {
    if (!scrollEl || query.trim()) return
    const top = scrollEl.scrollTop + 28
    let current = 'recent'
    for (const tab of tabs) {
      const el = sectionRefs[tab.id]
      if (el && el.offsetTop <= top) current = tab.id
    }
    activeCat = current
  }

  function pick(item) {
    recent = pushRecentEmoji(recent, item.char)
    onPick(item.char)
  }
</script>

<div
  class="emoji-popover"
  bind:this={popoverEl}
  tabindex="-1"
  role="dialog"
  aria-label={t('emojiPicker')}
>
  <div class="emoji-tabs" role="tablist" aria-label={t('emojiPicker')}>
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        class="emoji-tab"
        class:active={!query.trim() && activeCat === tab.id}
        aria-selected={!query.trim() && activeCat === tab.id}
        aria-label={catLabel(tab.id)}
        title={catLabel(tab.id)}
        onclick={() => selectTab(tab.id)}
      >
        <Icon name={tab.icon} size={15} />
      </button>
    {/each}
  </div>

  <div class="emoji-search-wrap">
    <div class="search-field emoji-search-field">
      <span class="search-icon" aria-hidden="true">
        <Icon name="search" size={14} />
      </span>
      <input
        class="input emoji-search-input"
        type="search"
        bind:value={query}
        placeholder={t('emojiSearch')}
        aria-label={t('emojiSearch')}
      />
      {#if query}
        <button
          class="search-clear"
          type="button"
          aria-label={t('emojiClear')}
          onclick={() => (query = '')}
        >
          <Icon name="x" size={12} />
        </button>
      {/if}
    </div>
  </div>

  <div class="emoji-scroll" bind:this={scrollEl} onscroll={handleScroll}>
    {#if query.trim()}
      {#if searchHits.length === 0}
        <p class="muted small emoji-empty">{t('emojiEmpty')}</p>
      {:else}
        <div class="emoji-grid">
          {#each searchHits as item (item.char)}
            <button
              type="button"
              class="emoji-cell"
              aria-label={item.name}
              title={item.name}
              onmouseenter={() => (hovered = item)}
              onfocus={() => (hovered = item)}
              onclick={() => pick(item)}
            >
              {item.char}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <section class="emoji-section" bind:this={sectionRefs.recent}>
        <h3 class="emoji-cat-title">{catLabel('recent')}</h3>
        <div class="emoji-grid">
          {#each recentItems as item (item.char)}
            <button
              type="button"
              class="emoji-cell"
              aria-label={item.name}
              title={item.name}
              onmouseenter={() => (hovered = item)}
              onfocus={() => (hovered = item)}
              onclick={() => pick(item)}
            >
              {item.char}
            </button>
          {/each}
        </div>
      </section>

      {#each EMOJI_CATEGORIES as cat (cat.id)}
        <section class="emoji-section" bind:this={sectionRefs[cat.id]}>
          <h3 class="emoji-cat-title">{catLabel(cat.id)}</h3>
          <div class="emoji-grid">
            {#each cat.emojis as item (item.char)}
              <button
                type="button"
                class="emoji-cell"
                aria-label={item.name}
                title={item.name}
                onmouseenter={() => (hovered = item)}
                onfocus={() => (hovered = item)}
                onclick={() => pick(item)}
              >
                {item.char}
              </button>
            {/each}
          </div>
        </section>
      {/each}
    {/if}
  </div>

  <div class="emoji-footer" aria-live="polite">
    {#if hovered}
      <span class="emoji-footer-glyph" aria-hidden="true">{hovered.char}</span>
      <span class="emoji-footer-name">{hovered.name}</span>
    {:else}
      <span class="emoji-footer-hint">{t('emojiHint')}</span>
    {/if}
  </div>
</div>
