<script>
  let { name, size = 16, className = '' } = $props()
</script>

{#if name === 'wa'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
    <path
      d="M12.1 2.4a9.4 9.4 0 0 0-8.14 14.1L2.6 21.4l5.05-1.32A9.4 9.4 0 1 0 12.1 2.4Z"
      fill="currentColor"
      opacity="0.16"
    />
    <path
      d="M12.1 2.4a9.4 9.4 0 0 0-8.14 14.1L2.6 21.4l5.05-1.32A9.4 9.4 0 1 0 12.1 2.4Zm0 1.85a7.55 7.55 0 0 1 0 15.1 7.5 7.5 0 0 1-3.83-1.05l-.36-.21-2.64.69.7-2.58-.23-.37a7.55 7.55 0 0 1 6.36-11.58Z"
      fill="currentColor"
    />
    <path
      d="M8.93 7.58c-.16 0-.42.05-.62.31-.21.26-.78.78-.78 1.87s.78 2.18.94 2.34c.1.16 1.56 2.5 3.85 3.43 1.92.78 2.29.62 2.7.57.42-.05 1.35-.57 1.56-1.09.21-.57.21-1.04.16-1.14-.05-.1-.21-.16-.42-.26l-1.51-.73c-.21-.1-.36-.1-.52.1l-.73.88c-.16.16-.26.21-.47.1-.21-.1-.88-.31-1.66-1.04-.62-.52-1.04-1.2-1.14-1.4-.1-.21 0-.31.1-.42l.36-.42c.1-.16.16-.21.21-.36.05-.16.05-.26 0-.36l-.68-1.66c-.16-.42-.36-.36-.52-.36Z"
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
    {:else if name === 'info'}
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    {:else if name === 'calendar'}
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" />
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
    {:else if name === 'smile'}
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" />
    {:else if name === 'clock'}
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    {:else if name === 'leaf'}
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    {:else if name === 'coffee'}
      <path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /><path d="M6 2v2" />
    {:else if name === 'compass'}
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    {:else if name === 'lightbulb'}
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" />
    {:else if name === 'heart'}
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    {:else if name === 'flag'}
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" />
    {:else if name === 'menu'}
      <line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" />
    {:else if name === 'edit'}
      <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    {:else if name === 'eye'}
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
    {:else if name === 'send'}
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" />
    {:else if name === 'chevron-left'}
      <path d="m15 18-6-6 6-6" />
    {:else if name === 'chevron-right'}
      <path d="m9 18 6-6-6-6" />
    {:else if name === 'list'}
      <line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />
    {:else if name === 'user'}
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    {/if}
  </svg>
{/if}
