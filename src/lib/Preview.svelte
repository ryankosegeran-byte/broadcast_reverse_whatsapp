<script>
  import { onDestroy } from 'svelte'
  import { tokenizeWaLine } from './waFormat.js'
  import Icon from './Icon.svelte'

  let { text, emptyLabel, contactLabel = '', t } = $props()

  let copyState = $state('idle')
  let copyTimer

  onDestroy(() => clearTimeout(copyTimer))

  let lines = $derived(String(text ?? '').split('\n'))

  async function handleCopy() {
    if (!text) return
    clearTimeout(copyTimer)
    let ok = true
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        throw new Error('fallback')
      }
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;'
      document.body.append(area)
      area.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      area.remove()
    }
    copyState = ok ? 'copied' : 'error'
    copyTimer = setTimeout(() => {
      copyState = 'idle'
    }, 1800)
  }

  let copyLabel = $derived(
    copyState === 'copied' ? t('copied') : copyState === 'error' ? t('copyFailed') : t('copy')
  )
</script>

<div class="preview-shell">
  <div class="preview-toolbar">
    <div class="preview-head">
      <h2>{t('preview')}</h2>
      <button
        class="btn secondary sm copy-btn"
        type="button"
        data-copy-state={copyState}
        disabled={!text}
        onclick={handleCopy}
        aria-label={t('copy')}
      >
        <span class="copy-glyph" aria-hidden="true">
          {#if copyState === 'copied'}
            <Icon name="check" size={14} />
          {:else if copyState === 'error'}
            <Icon name="alert" size={14} />
          {:else}
            <Icon name="copy" size={14} />
          {/if}
        </span>
        <span class="copy-label">{copyLabel}</span>
      </button>
    </div>
  </div>

  <div class="wa-stage">
    <div class="wa-chat-head" aria-hidden="true">
      <span class="wa-chat-avatar">
        {#if contactLabel}
          {contactLabel.trim().charAt(0).toUpperCase()}
        {:else}
          <Icon name="wa" size={13} />
        {/if}
      </span>
      <div class="wa-chat-meta">
        <span class="wa-chat-name">{contactLabel || 'WhatsApp'}</span>
        {#if contactLabel}
          <span class="wa-chat-tag">WhatsApp</span>
        {/if}
      </div>
    </div>

    <div class="wa-chat-body">
      {#if text}
        <div class="wa-bubble">
          <div class="wa-content">
            {#each lines as line, lineIdx}
              {#if line === ''}
                <div class="wa-blank"></div>
              {:else}
                <p class="wa-line">
                  {#each tokenizeWaLine(line) as seg}
                    {#if seg.type === 'bold'}
                      <strong class="wa-bold">{seg.value}</strong>
                    {:else if seg.type === 'italic'}
                      <em>{seg.value}</em>
                    {:else if seg.type === 'strike'}
                      <s>{seg.value}</s>
                    {:else if seg.type === 'mono'}
                      <code class="wa-mono">{seg.value}</code>
                    {:else if seg.type === 'link'}
                      <span class="wa-link">{seg.value}</span>
                    {:else}
                      {seg.value}
                    {/if}
                  {/each}
                </p>
              {/if}
            {/each}
          </div>
          <div class="wa-foot" aria-hidden="true">
            <span class="tabular">{t('charsCount', { n: text.length })}</span>
            <span class="wa-ticks">✓✓</span>
          </div>
        </div>
      {:else}
        <p class="muted small wa-empty">{emptyLabel}</p>
      {/if}
    </div>
  </div>
</div>

<span class="sr-only" role="status" aria-live="polite">
  {copyState === 'copied' ? t('copied') : copyState === 'error' ? t('copyFailed') : ''}
</span>
