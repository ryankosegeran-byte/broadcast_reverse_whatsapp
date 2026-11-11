<script>
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'

  let { t, onClose } = $props()

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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-dialog-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="help-dialog-title" class="modal-title">{t('helpTitle')}</h2>
        <p class="modal-desc">{t('devicesNote')}</p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>
    <div class="modal-body">
      <ol class="help-list">
        {#each t('helpItems') as item}
          <li>{item}</li>
        {/each}
      </ol>
      <div class="modal-actions">
        <button class="btn primary" type="button" onclick={onClose}>{t('close')}</button>
      </div>
    </div>
  </div>
</div>
