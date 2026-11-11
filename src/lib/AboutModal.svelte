<script>
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import pkg from '../../package.json'

  let { t, onClose } = $props()

  let dialogEl = $state(null)
  const year = new Date().getFullYear()
  const version = pkg?.version ?? ''

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
    aria-labelledby="about-dialog-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="about-dialog-title" class="modal-title">{t('aboutTitle')}</h2>
        <p class="modal-desc">
          {t('appTitle')} · {t('aboutVersion', { v: version })} · {year}
        </p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="modal-body">
      <p>{t('tagline')}</p>

      <h3 class="about-heading">{t('aboutFeaturesTitle')}</h3>
      <ul class="about-list">
        {#each t('aboutFeatures') as item}
          <li>{item}</li>
        {/each}
      </ul>

      <p class="about-meta">{t('aboutTech')}</p>
      <p class="about-meta">{t('aboutDisclaimer')}</p>

      <div class="about-card">
        <span class="about-label">{t('aboutCreatorTitle')}</span>
        <span class="about-name">{t('aboutCreatorName')}</span>
        <div class="about-links">
          <a
            class="btn secondary sm"
            href="https://github.com/ryankosegeran-byte/broadcast_reverse_whatsapp"
            target="_blank"
            rel="noopener"
          >
            <Icon name="external" size={14} />
            <span>{t('aboutGithub')}</span>
          </a>
          <a class="btn secondary sm" href="mailto:ryankosegeran2@gmail.com">
            <Icon name="external" size={14} />
            <span>{t('aboutEmail')}</span>
          </a>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn primary" type="button" onclick={onClose}>{t('close')}</button>
      </div>
    </div>
  </div>
</div>
