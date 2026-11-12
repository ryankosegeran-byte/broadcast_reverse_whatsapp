<script>
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import { AUTO_PRESETS, formatAutoDate } from './dates.js'

  let { t, varKey, value, lang = undefined, onPick, onClose } = $props()

  let dialogEl = $state(null)

  onMount(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  })

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function pick(preset) {
    onPick(preset)
    onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card modal-auto"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="auto-date-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="auto-date-title" class="modal-title">{t('autoDateTitle')}</h2>
        <p class="modal-desc">{'{{' + varKey + '}}'} · {t('autoDateDesc')}</p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="modal-body">
      <div class="auto-options" role="radiogroup" aria-label={t('autoDateTitle')}>
        <button
          class="auto-option"
          type="button"
          role="radio"
          aria-checked={!value}
          onclick={() => pick('')}
        >
          <span class="auto-option-label">{t('autoNone')}</span>
          <span class="auto-option-preview">{t('autoNoneHint')}</span>
        </button>
        {#each AUTO_PRESETS as preset (preset)}
          <button
            class="auto-option"
            type="button"
            role="radio"
            aria-checked={value === preset}
            onclick={() => pick(preset)}
          >
            <span class="auto-option-label">{t('autoPreset_' + preset)}</span>
            <span class="auto-option-preview tabular">{formatAutoDate(preset, new Date(), lang)}</span>
          </button>
        {/each}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" type="button" onclick={onClose}>{t('cancel')}</button>
      </div>
    </div>
  </div>
</div>
