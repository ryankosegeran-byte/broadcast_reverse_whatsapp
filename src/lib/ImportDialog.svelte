<script>
  let { info, t, onReplace, onMerge, onExportFirst, onCancel } = $props()
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={t('importTitle')}>
  <div class="card modal">
    <h2>{t('importTitle')}</h2>
    <p>{t('importFound', { t: info.templates, c: info.contacts })}</p>
    <p class="muted small">{t('importReplaceWarn')}</p>
    <div class="row gap wrap">
      <button class="btn primary" type="button" onclick={onMerge}>{t('importMerge')}</button>
      <button class="btn danger" type="button" onclick={onReplace}>{t('importReplace')}</button>
      <button class="btn ghost" type="button" onclick={onExportFirst}>{t('exportFirst')}</button>
      <button class="btn ghost" type="button" onclick={onCancel}>{t('cancel')}</button>
    </div>
  </div>
</div>
