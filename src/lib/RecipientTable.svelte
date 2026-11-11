<script>
  import { resolve } from './vars.js'

  let { contacts, template, vars, t, onOpen, onDelete, onFocus } = $props()

  let query = $state('')

  let shown = $derived(
    contacts.filter((c) => {
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q)
    })
  )

  function setValue(contact, key, value) {
    contact.values[template.id] ??= {}
    contact.values[template.id][key] = value
  }
</script>

<div class="table-tools">
  <input class="input search" type="search" placeholder={t('search')} bind:value={query} aria-label={t('search')} />
  <span class="muted small">{t('rows', { n: contacts.length })}</span>
</div>

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
        <th>{t('action')}</th>
      </tr>
    </thead>
    <tbody>
      {#each shown as contact, i (contact.id)}
        <tr onfocusin={() => onFocus?.(contact)}>
          <td class="num muted">{i + 1}</td>
          <td class="phone">
            <span>{contact.phone}</span>
            {#if contact.sentAt?.[template.id]}
              <span class="sent" title={t('opened')}>✓</span>
            {/if}
          </td>
          <td>
            <input
              class="cell"
              value={contact.name}
              placeholder="—"
              aria-label={t('name')}
              oninput={(e) => (contact.name = e.currentTarget.value)}
            />
          </td>
          {#each vars as v (v)}
            <td class:blank={!resolve(v, contact, template)}>
              <input
                class="cell"
                value={resolve(v, contact, template)}
                placeholder="—"
                aria-label={v}
                oninput={(e) => setValue(contact, v, e.currentTarget.value)}
              />
            </td>
          {/each}
          <td class="actions">
            <button class="btn wa small" type="button" onclick={() => onOpen(contact)}>{t('openWa')}</button>
            <button
              class="btn ghost small danger"
              type="button"
              title={t('delete')}
              aria-label={t('delete')}
              onclick={() => onDelete(contact)}>×</button
            >
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan={vars.length + 4} class="muted center">{t('noContacts')}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
