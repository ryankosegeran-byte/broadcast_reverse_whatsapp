<script>
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'

  let { info, t, onReplace, onMerge, onExportFirst, onCancel } = $props()

  let dialogEl = $state(null)

  onMount(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
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
    aria-labelledby="import-dialog-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="import-dialog-title" class="modal-title">{t('importTitle')}</h2>
        <p class="modal-desc">{t('importFound', { t: info.templates, c: info.contacts, l: info.labels ?? 0 })}</p>
      </div>
      <button class="modal-close" type="button" onclick={onCancel} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>
    <div class="modal-body">
      <div class="inline-alert warning">
        <Icon name="alert" size={16} />
        <span>{t('importReplaceWarn')}</span>
      </div>
      <div class="modal-actions">
        <button class="btn primary" type="button" onclick={onMerge}>{t('importMerge')}</button>
        <button class="btn danger" type="button" onclick={onReplace}>{t('importReplace')}</button>
        <button class="btn secondary" type="button" onclick={onExportFirst}>{t('exportFirst')}</button>
        <button class="btn ghost" type="button" onclick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  </div>
</div>
