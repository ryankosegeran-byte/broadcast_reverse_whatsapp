<script>
  let { text, emptyLabel } = $props()
</script>

<div class="preview-box">
  {#if text}
    <pre class="preview-text">{text}</pre>
  {:else}
    <p class="muted small">{emptyLabel}</p>
  {/if}
</div>
