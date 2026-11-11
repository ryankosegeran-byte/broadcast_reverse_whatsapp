<script>
  let { t, onClose } = $props()
</script>

<div class="overlay">
  <div class="card modal" role="dialog" aria-modal="true" aria-label={t('helpTitle')}>
    <div class="row between">
      <h2>{t('helpTitle')}</h2>
      <button class="btn ghost small" type="button" onclick={onClose} aria-label={t('close')}>×</button>
    </div>
    <ol class="help-list">
      {#each t('helpItems') as item}
        <li>{item}</li>
      {/each}
    </ol>
    <p class="muted small">{t('devicesNote')}</p>
    <button class="btn primary" type="button" onclick={onClose}>{t('close')}</button>
  </div>
</div>
