<script>
  import { onMount } from 'svelte'
  import { resolve } from './vars.js'
  import Icon from './Icon.svelte'

  let { contacts, template, vars, t, onOpen, onDelete, onFocus } = $props()

  let query = $state('')
  let confirmId = $state(null)
  let confirmEl = $state(null)

  let shown = $derived(
    contacts.filter((c) => {
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q)
    })
  )

  onMount(() => {
    const onPointerDown = (e) => {
      if (confirmId && confirmEl && !confirmEl.contains(e.target)) {
        confirmId = null
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && confirmId) {
        e.stopPropagation()
        confirmId = null
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function setValue(contact, key, value) {
    contact.values[template.id] ??= {}
    contact.values[template.id][key] = value
  }

  function confirmRemove(contact) {
    confirmId = null
    onDelete(contact)
  }

  let countLabel = $derived(
    query.trim() && contacts.length > 0
      ? t('rowsFiltered', { shown: shown.length, n: contacts.length })
      : t('rows', { n: contacts.length })
  )
</script>

<div class="table-tools">
  <div class="search-field">
    <span class="search-icon" aria-hidden="true">
      <Icon name="search" size={15} />
    </span>
    <input
      class="input search-input"
      type="search"
      placeholder={t('search')}
      bind:value={query}
      aria-label={t('search')}
    />
    {#if query}
      <button
        class="search-clear"
        type="button"
        aria-label={t('clearSearch')}
        onclick={() => (query = '')}
      >
        <Icon name="x" size={13} />
      </button>
    {/if}
  </div>
  <span class="badge neutral sm tabular">{countLabel}</span>
</div>

{#if contacts.length === 0}
  <div class="empty-state compact">
    <div class="empty-icon" aria-hidden="true">
      <Icon name="users" size={20} />
    </div>
    <h3>{t('recipients')}</h3>
    <p>{t('noContacts')}</p>
  </div>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>{t('phone')}</th>
          <th>{t('name')}</th>
          {#each vars as v (v)}
            <th>{v}</th>
          {/each}
          <th class="col-actions">{t('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each shown as contact, i (contact.id)}
          <tr
            onfocusin={() => onFocus?.(contact)}
            onclick={() => onFocus?.(contact)}
          >
            <td class="num muted tabular">{i + 1}</td>
            <td class="phone tabular">
              <div class="phone-cell">
                <span>{contact.phone}</span>
                {#if contact.sentAt?.[template.id]}
                  <span class="badge success sm" title={t('opened')}>
                    <span class="badge-dot" aria-hidden="true"></span>
                    {t('opened')}
                  </span>
                {/if}
              </div>
            </td>
            <td class="col-name">
              <input
                class="cell"
                value={contact.name}
                placeholder="-"
                aria-label={t('name')}
                oninput={(e) => (contact.name = e.currentTarget.value)}
              />
            </td>
            {#each vars as v (v)}
              {@const blank = !resolve(v, contact, template)}
              <td class="col-var" class:blank>
                <input
                  class="cell"
                  value={resolve(v, contact, template)}
                  placeholder="-"
                  title={blank ? t('blankValueTitle') : undefined}
                  aria-label={v}
                  oninput={(e) => setValue(contact, v, e.currentTarget.value)}
                />
              </td>
            {/each}
            <td class="actions">
              <div class="actions-inner">
                {#if confirmId === contact.id}
                  <div class="confirm-pill" bind:this={confirmEl} role="group" aria-label={t('confirmDeletePrompt')}>
                    <span class="confirm-prompt">{t('confirmDeletePrompt')}</span>
                    <button class="confirm-btn" type="button" onclick={() => (confirmId = null)}>
                      {t('cancel')}
                    </button>
                    <button class="confirm-btn danger" type="button" onclick={() => confirmRemove(contact)}>
                      {t('delete')}
                    </button>
                  </div>
                {:else}
                  <button class="btn wa sm" type="button" onclick={() => onOpen(contact)}>
                    <Icon name="external" size={14} />
                    <span>{t('openWa')}</span>
                  </button>
                  <button
                    class="btn icon-btn danger-ghost sm"
                    type="button"
                    title={t('delete')}
                    aria-label={t('deleteContactAria', { name: contact.name || contact.phone })}
                    onclick={() => (confirmId = contact.id)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan={vars.length + 4} class="table-empty">
              <span>{t('noMatches')}</span>
              {#if query}
                <button class="btn ghost sm" type="button" onclick={() => (query = '')}>
                  {t('clearSearch')}
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
