<script module>
  let closeActiveSelect = null
</script>

<script>
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'

  let {
    options = [],
    value = undefined,
    placeholder = '',
    ariaLabel = '',
    icon = '',
    size = 'md',
    className = '',
    disabled = false,
    onChange,
  } = $props()

  const uid = $props.id()

  let open = $state(false)
  let highlighted = $state(0)
  let triggerEl = $state(null)
  let menuEl = $state(null)
  let menuPos = $state({
    left: 0,
    top: 0,
    bottom: null,
    minW: 160,
    maxW: 320,
    maxH: 240,
    flip: false,
  })

  let selectedIdx = $derived(options.findIndex((o) => o.value === value))
  let selected = $derived(selectedIdx >= 0 ? options[selectedIdx] : null)

  function portal(node) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function closeMenu() {
    open = false
    if (closeActiveSelect === closeMenu) closeActiveSelect = null
  }

  function updatePos() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      closeMenu()
      return
    }
    const pad = 8
    const gap = 4
    const vw = window.innerWidth
    const vh = window.innerHeight
    const spaceBelow = vh - rect.bottom - pad - gap
    const spaceAbove = rect.top - pad - gap
    const flip = spaceBelow < 168 && spaceAbove > spaceBelow
    const avail = Math.max(108, flip ? spaceAbove : spaceBelow)
    const maxH = Math.min(264, avail)
    const minW = Math.min(vw - pad * 2, Math.max(rect.width, 160))
    const left = Math.min(Math.max(pad, rect.left), vw - minW - pad)
    const maxW = Math.min(vw - pad - left, Math.max(rect.width + 72, 280))

    menuPos = {
      left,
      top: flip ? null : rect.bottom + gap,
      bottom: flip ? vh - rect.top + gap : null,
      minW,
      maxW,
      maxH,
      flip,
    }
  }

  async function openMenu() {
    if (disabled || !options.length) return
    if (closeActiveSelect && closeActiveSelect !== closeMenu) closeActiveSelect()
    closeActiveSelect = closeMenu
    highlighted = selectedIdx >= 0 ? selectedIdx : 0
    updatePos()
    open = true
    await tick()
    updatePos()
    menuEl?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }

  function toggleMenu() {
    if (open) closeMenu()
    else openMenu()
  }

  function choose(opt) {
    closeMenu()
    if (opt.value !== value) onChange?.(opt.value)
    tick().then(() => triggerEl?.focus({ preventScroll: true }))
  }

  function scrollHighlighted() {
    tick().then(() =>
      menuEl?.querySelector(`[data-idx="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' })
    )
  }

  function onTriggerKeyDown(e) {
    if (disabled || !options.length) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlighted = (highlighted + 1) % options.length
      scrollHighlighted()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlighted = (highlighted - 1 + options.length) % options.length
      scrollHighlighted()
    } else if (e.key === 'Home') {
      e.preventDefault()
      highlighted = 0
      scrollHighlighted()
    } else if (e.key === 'End') {
      e.preventDefault()
      highlighted = options.length - 1
      scrollHighlighted()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const opt = options[highlighted]
      if (opt) choose(opt)
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key.toLowerCase()
      const len = options.length
      for (let step = 1; step <= len; step++) {
        const idx = (highlighted + step) % len
        if (String(options[idx].label ?? '').trim().toLowerCase().startsWith(ch)) {
          highlighted = idx
          scrollHighlighted()
          break
        }
      }
    }
  }

  $effect(() => {
    if (!open) return
    if (highlighted >= options.length) highlighted = Math.max(0, options.length - 1)

    const onOutside = (e) => {
      if (!triggerEl?.contains(e.target) && !menuEl?.contains(e.target)) {
        closeMenu()
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        closeMenu()
        triggerEl?.focus({ preventScroll: true })
      } else if (e.key === 'Tab') {
        closeMenu()
      }
    }
    const onScroll = (e) => {
      if (menuEl && (e.target === menuEl || menuEl.contains(e.target))) return
      updatePos()
    }
    const onResize = () => updatePos()
    const ro = typeof ResizeObserver !== 'undefined' && triggerEl
      ? new ResizeObserver(() => updatePos())
      : null
    if (ro && triggerEl) ro.observe(triggerEl)

    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('click', onOutside, true)
    document.addEventListener('focusin', onOutside, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      if (closeActiveSelect === closeMenu) closeActiveSelect = null
      ro?.disconnect()
      document.removeEventListener('pointerdown', onOutside, true)
      document.removeEventListener('click', onOutside, true)
      document.removeEventListener('focusin', onOutside, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  })
</script>

<button
  bind:this={triggerEl}
  type="button"
  role="combobox"
  class="select-trigger select-{size} {className}"
  class:is-open={open}
  class:is-muted={!selected || selected.muted}
  {disabled}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={open ? `${uid}-list` : undefined}
  aria-activedescendant={open && options[highlighted] ? `${uid}-opt-${highlighted}` : undefined}
  aria-label={ariaLabel || undefined}
  onclick={toggleMenu}
  onkeydown={onTriggerKeyDown}
>
  {#if icon}
    <span class="select-leading" aria-hidden="true">
      <Icon name={icon} size={size === 'sm' ? 13 : 14} />
    </span>
  {/if}
  <span class="select-value">
    {selected ? selected.label : placeholder}
  </span>
  <span class="select-chevron" aria-hidden="true">
    <Icon name="chevron-down" size={size === 'sm' ? 13 : 14} />
  </span>
</button>

{#if open}
  <div
    use:portal
    bind:this={menuEl}
    id="{uid}-list"
    class="select-menu"
    class:is-flipped={menuPos.flip}
    role="listbox"
    aria-label={ariaLabel || undefined}
    style="left:{menuPos.left}px;min-width:{menuPos.minW}px;max-width:{menuPos.maxW}px;max-height:{menuPos.maxH}px;{menuPos.top !== null ? `top:${menuPos.top}px;` : `bottom:${menuPos.bottom}px;`}"
  >
    {#each options as opt, idx (opt.value)}
      {@const isSelected = opt.value === value}
      {@const isHighlighted = idx === highlighted}
      <button
        id="{uid}-opt-{idx}"
        data-idx={idx}
        data-active={isSelected ? 'true' : undefined}
        type="button"
        role="option"
        tabindex="-1"
        aria-selected={isSelected}
        class="select-opt"
        class:selected={isSelected}
        class:highlighted={isHighlighted}
        class:muted={opt.muted}
        class:divider={opt.dividerAfter}
        onmouseenter={() => (highlighted = idx)}
        onclick={() => choose(opt)}
      >
        <span class="select-opt-main">
          <span class="select-opt-label">{opt.label}</span>
          {#if opt.meta}
            <span class="select-opt-meta mono tabular">{opt.meta}</span>
          {/if}
        </span>
        <span class="select-opt-check" aria-hidden="true">
          {#if isSelected}
            <Icon name="check" size={14} />
          {/if}
        </span>
      </button>
    {/each}
  </div>
{/if}
