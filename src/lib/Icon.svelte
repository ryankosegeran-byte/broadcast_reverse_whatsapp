<script>
  let { name, size = 16, className = '' } = $props()
</script>

{#if name === 'wa'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
    <path
      d="M12 3a9 9 0 0 0-7.79 13.5L3 21l4.64-1.2A9 9 0 1 0 12 3Z"
      fill="currentColor"
      opacity="0.16"
    />
    <path
      d="M12 3a9 9 0 0 0-7.79 13.5L3 21l4.64-1.2A9 9 0 1 0 12 3Z"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linejoin="round"
    />
    <path
      d="M9.4 8.8c-.2 0-.5.1-.7.4-.3.3-1 1-1 2.3s1 2.6 1.1 2.8c.2.2 1.9 3 4.6 4.1 2.3.9 2.7.7 3.2.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3 0-.1-.2-.2-.5-.3l-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.3-.1-1.1-.4-2-1.2-.8-.7-1.3-1.5-1.4-1.7-.1-.2 0-.4.1-.5l.5-.5c.1-.2.2-.3.2-.4.1-.2 0-.3 0-.4l-.8-2c-.2-.4-.4-.4-.7-.4Z"
      fill="currentColor"
    />
  </svg>
{:else}
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
    aria-hidden="true"
  >
    {#if name === 'plus'}
      <path d="M5 12h14" /><path d="M12 5v14" />
    {:else if name === 'x'}
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    {:else if name === 'trash'}
      <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    {:else if name === 'copy'}
      <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    {:else if name === 'check'}
      <path d="M4 12.5 9.5 18 20 6.5" />
    {:else if name === 'sun'}
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    {:else if name === 'moon'}
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    {:else if name === 'help'}
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
    {:else if name === 'download'}
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    {:else if name === 'upload'}
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
    {:else if name === 'external'}
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    {:else if name === 'search'}
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    {:else if name === 'alert'}
      <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
    {:else if name === 'file'}
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    {:else if name === 'users'}
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    {:else if name === 'clipboard'}
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    {:else if name === 'bold'}
      <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
    {:else if name === 'italic'}
      <line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" />
    {:else if name === 'strike'}
      <path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" x2="20" y1="12" y2="12" />
    {:else if name === 'code'}
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    {:else if name === 'chevron-down'}
      <path d="m6 9 6 6 6-6" />
    {/if}
  </svg>
{/if}
