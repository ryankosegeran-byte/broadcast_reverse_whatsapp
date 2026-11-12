<script>
  import { onMount, tick } from 'svelte'
  import Icon from './Icon.svelte'
  import LabelFilter from './LabelFilter.svelte'
  import { groupOutline, filterByLabels, isDescendant } from './groups.js'

  let {
    contacts = [],
    groups = [],
    t,
    onAdd,
    onPaste,
    onImport,
    onOpen,
    onDelete,
    onAssign,
    onRename,
    onDeleteLabel,
    onCreateGroup,
    onReparent,
    undoLabel = null,
    onUndoRename,
    onBack,
  } = $props()

  let query = $state('')
  let labelMode = $state('and')
  let filterLabels = $state([])
  let selected = $state([])
  let activeGroupId = $state('')
  let groupsOpen = $state(false)
  let dragId = $state(null)
  let dropId = $state(null)
  let menuId = $state(null)
  let confirmDeleteGroupId = $state(null)
  let confirmContactId = $state(null)
  let confirmBulkDelete = $state(false)
  let renameFor = $state(null)
  let renameText = $state('')
  let renameInputEl = $state(null)
  let newGroupText = $state('')
  let newParentId = $state(null)
  let addLabelText = $state('')
  let removeLabelText = $state('')

  let outline = $derived(groupOutline(groups))
  let labelPool = $derived(
    [...new Set(contacts.flatMap((c) => c.labels ?? []))].sort((a, b) => a.localeCompare(b))
  )

  let selectedLabelsPool = $derived.by(() => {
    if (!selected.length) return []
    const set = new Set(selected)
    const labels = new Set()
    for (const c of contacts) {
      if (!set.has(c.id)) continue
      for (const l of c.labels ?? []) labels.add(l)
    }
    return [...labels].sort((a, b) => a.localeCompare(b))
  })

  let counts = $derived.by(() => {
    const map = new Map()
    for (const c of contacts) for (const l of c.labels ?? []) map.set(l, (map.get(l) ?? 0) + 1)
    return map
  })

  let activeGroup = $derived(groups.find((g) => g.id === activeGroupId) ?? null)

  let groupScopedContacts = $derived(
    activeGroup
      ? contacts.filter((c) => (c.labels ?? []).includes(activeGroup.name))
      : contacts
  )

  let visible = $derived.by(() => {
    let list = groupScopedContacts
    list = filterByLabels(list, filterLabels, labelMode)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((c) => c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q))
    return list
  })

  let isFiltered = $derived(Boolean(activeGroupId || filterLabels.length || query.trim()))
  let countLabel = $derived(
    isFiltered && contacts.length > 0
      ? t('rowsFiltered', { shown: visible.length, n: contacts.length })
      : t('rows', { n: contacts.length })
  )

  let allVisibleSelected = $derived(visible.length > 0 && visible.every((c) => selected.includes(c.id)))

  $effect(() => {
    const ids = new Set(contacts.map((c) => c.id))
    if (selected.some((id) => !ids.has(id))) selected = selected.filter((id) => ids.has(id))
  })

  $effect(() => {
    if (!selected.length && confirmBulkDelete) confirmBulkDelete = false
  })

  $effect(() => {
    if (activeGroupId && !groups.some((g) => g.id === activeGroupId)) activeGroupId = ''
  })

  $effect(() => {
    if (!filterLabels.length) return
    const pool = new Set(labelPool)
    if (filterLabels.some((l) => !pool.has(l))) {
      filterLabels = filterLabels.filter((l) => pool.has(l))
    }
  })

  onMount(() => {
    const onPointerDown = (e) => {
      if (menuId && !e.target?.closest?.(`[data-group-menu="${menuId}"]`)) {
        menuId = null
        confirmDeleteGroupId = null
      }
      if (confirmContactId && !e.target?.closest?.(`[data-confirm-contact="${confirmContactId}"]`)) {
        confirmContactId = null
      }
    }
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (menuId || confirmDeleteGroupId || confirmContactId || confirmBulkDelete || renameFor) {
        menuId = null
        confirmDeleteGroupId = null
        confirmContactId = null
        confirmBulkDelete = false
        renameFor = null
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function labelHue(name) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
    return h
  }

  function toggleSelect(contact) {
    selected = selected.includes(contact.id)
      ? selected.filter((id) => id !== contact.id)
      : [...selected, contact.id]
  }

  function toggleAll() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map((c) => c.id))
      selected = selected.filter((id) => !visibleIds.has(id))
    } else {
      selected = [...new Set([...selected, ...visible.map((c) => c.id)])]
    }
  }

  function toggleFilterLabel(label) {
    filterLabels = filterLabels.includes(label)
      ? filterLabels.filter((l) => l !== label)
      : [...filterLabels, label]
  }

  function pickGroup(id) {
    activeGroupId = activeGroupId === id ? '' : id
  }

  function startRename(group) {
    menuId = null
    confirmDeleteGroupId = null
    renameFor = group.id
    renameText = group.name
    tick().then(() => {
      renameInputEl?.focus()
      renameInputEl?.select()
    })
  }

  function commitRename() {
    const group = groups.find((g) => g.id === renameFor)
    const next = renameText.trim()
    renameFor = null
    if (group && next && next !== group.name) onRename?.(group.name, next)
  }

  function doAddLabel() {
    const names = addLabelText.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
    if (!names.length || !selected.length) return
    onAssign?.(selected, names, 'add')
    addLabelText = ''
    selected = []
  }

  function doRemoveLabel() {
    const names = removeLabelText.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
    if (!names.length || !selected.length) return
    onAssign?.(selected, names, 'remove')
    removeLabelText = ''
    selected = []
  }

  function doDelete() {
    for (const id of selected) {
      const c = contacts.find((x) => x.id === id)
      if (c) onDelete?.(c)
    }
    confirmBulkDelete = false
    selected = []
  }

  function onDrop(targetId) {
    if (dragId && dragId !== targetId) onReparent?.(dragId, targetId || null)
    dragId = null
    dropId = null
  }
</script>

<section class="contacts-view" aria-label={t('contactsTitle')}>
  <header class="contacts-head">
    <div class="contacts-head-copy">
      <div class="contacts-title-row">
        <h2>{t('contactsTitle')}</h2>
        <span class="badge neutral sm tabular">{contacts.length}</span>
      </div>
      <p class="hint contacts-desc">{t('contactsDesc')}</p>
    </div>
    <div class="contacts-head-actions">
      <button class="btn {contacts.length ? 'secondary' : 'primary'} sm" type="button" onclick={onAdd}>
        <Icon name="plus" size={13} /><span>{t('addContactShort')}</span>
      </button>
      <button class="btn secondary sm" type="button" onclick={onPaste}>
        <Icon name="clipboard" size={13} /><span>{t('pasteRowsShort')}</span>
      </button>
      <button class="btn secondary sm" type="button" onclick={onImport}>
        <Icon name="upload" size={13} /><span>{t('importContactsShort')}</span>
      </button>
      <button class="btn primary sm contacts-back-btn" type="button" onclick={onBack}>
        <Icon name="send" size={13} /><span>{t('backToSend')}</span>
      </button>
    </div>
  </header>

  {#if undoLabel}
    <div class="undo-bar" role="status">
      <span>{t('labelRenamed', { name: undoLabel.to })}</span>
      <button class="btn secondary xs" type="button" onclick={onUndoRename}>{t('undo')}</button>
    </div>
  {/if}

  <div class="contacts-grid">
    <aside class="group-tree" class:open={groupsOpen} aria-label={t('groupsTitle')}>
      <div class="group-tree-head">
        <h3 class="group-tree-title">{t('groupsTitle')}</h3>
        <button
          class="group-collapse-btn"
          type="button"
          aria-expanded={groupsOpen}
          onclick={() => (groupsOpen = !groupsOpen)}
        >
          <span class="group-collapse-left">
            <Icon name="folder" size={13} />
            <span class="group-collapse-title">{t('groupsTitle')}</span>
            <span class="badge neutral sm tabular">{groups.length}</span>
          </span>
          <span class="group-collapse-right">
            {#if activeGroup}
              <span class="badge accent sm group-active-tag">{activeGroup.name}</span>
            {/if}
            <Icon name="chevron-right" size={14} className={groupsOpen ? 'rot-open' : ''} />
          </span>
        </button>
      </div>

      <div class="group-tree-body">
        {#if newParentId}
          {@const parent = groups.find((g) => g.id === newParentId)}
          <div class="group-add-hint">
            <span>{t('subgroupOf')}: {parent?.name ?? ''}</span>
            <button class="btn ghost xs" type="button" onclick={() => (newParentId = null)}>{t('cancel')}</button>
          </div>
        {/if}
        <form
          class="group-add"
          onsubmit={(e) => {
            e.preventDefault()
            if (newGroupText.trim()) onCreateGroup?.(newGroupText, newParentId)
            newGroupText = ''
            newParentId = null
          }}
        >
          <input class="input" bind:value={newGroupText} placeholder={t('groupNamePlaceholder')} aria-label={t('newGroup')} />
          <button class="btn icon-btn secondary sm" type="submit" disabled={!newGroupText.trim()} aria-label={t('newGroup')}>
            <Icon name="plus" size={14} />
          </button>
        </form>

        <ul class="group-list" role="tree">
          <li class:drop={dropId === ''}>
            <button
              class="group-row"
              class:active={!activeGroupId}
              type="button"
              onclick={() => (activeGroupId = '')}
              ondragover={(e) => {
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                dropId = ''
              }}
              ondragleave={() => { if (dropId === '') dropId = null }}
              ondrop={(e) => { e.preventDefault(); onDrop('') }}
            >
              <Icon name="users" size={13} />
              <span class="group-name">{t('allContactsGroup')}</span>
              <span class="badge neutral sm tabular">{contacts.length}</span>
            </button>
          </li>
          {#each outline as group (group.id)}
            <li
              class="group-item"
              class:drop={dropId === group.id}
              style="--depth:{group.depth}"
              data-group-menu={group.id}
              draggable={renameFor !== group.id}
              ondragstart={(e) => {
                dragId = group.id
                e.dataTransfer?.setData('text/plain', group.id)
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              }}
              ondragend={() => { dragId = null; dropId = null }}
              ondragover={(e) => {
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                dropId = group.id
              }}
              ondragleave={() => { if (dropId === group.id) dropId = null }}
              ondrop={(e) => { e.preventDefault(); onDrop(group.id) }}
            >
              {#if renameFor === group.id}
                <form
                  class="group-add"
                  onsubmit={(e) => {
                    e.preventDefault()
                    commitRename()
                  }}
                >
                  <input class="input" bind:this={renameInputEl} bind:value={renameText} aria-label={t('renameGroup')} />
                  <button class="btn secondary sm" type="submit">{t('done')}</button>
                  <button class="btn ghost sm" type="button" onclick={() => (renameFor = null)}>{t('cancel')}</button>
                </form>
              {:else}
                <button class="group-row" class:active={activeGroupId === group.id} type="button" onclick={() => pickGroup(group.id)}>
                  <Icon name="folder" size={13} />
                  <span class="group-name">{group.name}</span>
                  <span class="badge neutral sm tabular">{counts.get(group.name) ?? 0}</span>
                </button>
                <button
                  class="group-menu-btn"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuId === group.id}
                  aria-label={t('groupsTitle') + ': ' + group.name}
                  onclick={() => {
                    menuId = menuId === group.id ? null : group.id
                    confirmDeleteGroupId = null
                  }}
                >
                  <Icon name="menu" size={13} />
                </button>
                {#if menuId === group.id}
                  <div class="group-menu" role="menu">
                    <button type="button" role="menuitem" onclick={() => startRename(group)}>
                      <Icon name="edit" size={12} /><span>{t('renameGroup')}</span>
                    </button>
                    <button type="button" role="menuitem" onclick={() => { newParentId = group.id; menuId = null }}>
                      <Icon name="plus" size={12} /><span>{t('createSubgroup')}</span>
                    </button>
                    {#if group.parentId}
                      <button type="button" role="menuitem" onclick={() => { onReparent?.(group.id, null); menuId = null }}>
                        <Icon name="chevron-left" size={12} /><span>{t('makeTopLevel')}</span>
                      </button>
                    {/if}
                    <label class="group-menu-field">
                      <span>{t('moveUnder')}</span>
                      <select
                        class="input"
                        value={group.parentId ?? ''}
                        onchange={(e) => { onReparent?.(group.id, e.currentTarget.value || null); menuId = null }}
                      >
                        <option value="">{t('mainGroups')}</option>
                        {#each outline.filter((other) => !isDescendant(groups, group.id, other.id)) as other (other.id)}
                          <option value={other.id}>{other.name}</option>
                        {/each}
                      </select>
                    </label>
                    {#if confirmDeleteGroupId === group.id}
                      <div class="group-menu-confirm" role="group" aria-label={t('deleteGroupConfirm')}>
                        <span class="hint">{t('deleteGroupConfirm')}</span>
                        <div class="group-menu-confirm-actions">
                          <button class="confirm-btn" type="button" onclick={() => (confirmDeleteGroupId = null)}>
                            {t('cancel')}
                          </button>
                          <button
                            class="confirm-btn danger"
                            type="button"
                            onclick={() => {
                              onDeleteLabel?.(group.name)
                              if (activeGroupId === group.id) activeGroupId = ''
                              confirmDeleteGroupId = null
                              menuId = null
                            }}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    {:else}
                      <button class="danger" type="button" role="menuitem" onclick={() => (confirmDeleteGroupId = group.id)}>
                        <Icon name="trash" size={12} /><span>{t('deleteGroup')}</span>
                      </button>
                    {/if}
                  </div>
                {/if}
              {/if}
            </li>
          {/each}
        </ul>
        {#if groups.length > 1}
          <p class="hint group-hint">{t('dragHint')}</p>
        {/if}
      </div>
    </aside>

    <div class="contacts-main">
      {#if contacts.length > 0}
        <div class="contacts-tools">
          <div class="search-field">
            <span class="search-icon" aria-hidden="true"><Icon name="search" size={14} /></span>
            <input class="input search-input" type="search" placeholder={t('search')} bind:value={query} aria-label={t('search')} />
            {#if query}
              <button class="search-clear" type="button" aria-label={t('clearSearch')} onclick={() => (query = '')}>
                <Icon name="x" size={13} />
              </button>
            {/if}
          </div>
        </div>

        {#if labelPool.length}
          <LabelFilter
            {labelPool}
            selected={filterLabels}
            mode={labelMode}
            contacts={groupScopedContacts}
            {groups}
            {t}
            onToggle={toggleFilterLabel}
            onSetSelection={(next) => (filterLabels = [...next])}
            onModeChange={(next) => (labelMode = next)}
            onClear={() => (filterLabels = [])}
          />
        {/if}

        <div class="contacts-list-bar">
          <label class="select-all-check">
            <input type="checkbox" checked={allVisibleSelected} disabled={!visible.length} onchange={toggleAll} />
            <span>{t('selectAll')}</span>
          </label>
          <span class="badge neutral sm tabular">{countLabel}</span>
        </div>

        {#if selected.length}
          <div class="bulk-bar" role="region" aria-label={t('bulkActions')}>
            <div class="bulk-bar-head">
              <span class="badge accent sm tabular">{t('selectedCount', { n: selected.length })}</span>
              <button class="btn icon-btn ghost xs bulk-close" type="button" aria-label={t('selectNone')} onclick={() => (selected = [])}>
                <Icon name="x" size={13} />
              </button>
            </div>
            <form class="bulk-inline" onsubmit={(e) => { e.preventDefault(); doAddLabel() }}>
              <input class="input" bind:value={addLabelText} placeholder={t('labelInputPlaceholder')} aria-label={t('bulkAssign')} list="group-names" />
              <button class="btn secondary xs" type="submit">{t('bulkAssign')}</button>
            </form>
            <form class="bulk-inline" onsubmit={(e) => { e.preventDefault(); doRemoveLabel() }}>
              <input class="input" bind:value={removeLabelText} placeholder={t('labelRemovedPlaceholder')} aria-label={t('bulkRemove')} list="selected-labels" />
              <button class="btn secondary xs" type="submit">{t('bulkRemove')}</button>
            </form>
            {#if confirmBulkDelete}
              <div class="confirm-pill" role="group" aria-label={t('confirmDeletePrompt')}>
                <span class="confirm-prompt">{t('confirmDeletePrompt')}</span>
                <button class="confirm-btn" type="button" onclick={() => (confirmBulkDelete = false)}>{t('cancel')}</button>
                <button class="confirm-btn danger" type="button" onclick={doDelete}>{t('delete')}</button>
              </div>
            {:else}
              <button class="btn danger-ghost xs bulk-del-btn" type="button" onclick={() => (confirmBulkDelete = true)}>
                <Icon name="trash" size={12} /><span>{t('bulkDelete')}</span>
              </button>
            {/if}
          </div>
        {/if}

        <datalist id="group-names">
          {#each groups as g (g.id)}<option value={g.name}></option>{/each}
        </datalist>
        <datalist id="selected-labels">
          {#each selectedLabelsPool as l (l)}<option value={l}></option>{/each}
        </datalist>
      {/if}

      {#if contacts.length === 0}
        <div class="empty-state compact contacts-empty">
          <div class="empty-icon" aria-hidden="true">
            <Icon name="users" size={18} />
          </div>
          <p>{t('noContacts')}</p>
        </div>
      {:else if !visible.length}
        <div class="empty-state compact contacts-empty">
          <p>{t('noMatches')}</p>
          <div class="empty-actions">
            {#if query}
              <button class="btn secondary sm" type="button" onclick={() => (query = '')}>
                {t('clearSearch')}
              </button>
            {/if}
            {#if filterLabels.length}
              <button class="btn secondary sm" type="button" onclick={() => (filterLabels = [])}>
                {t('clearFilters')}
              </button>
            {/if}
            {#if activeGroupId}
              <button class="btn secondary sm" type="button" onclick={() => (activeGroupId = '')}>
                {t('allContactsGroup')}
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <div class="clist" role="list">
          {#each visible as contact (contact.id)}
            <div class="clist-row" class:selected={selected.includes(contact.id)} role="listitem">
              {#if confirmContactId === contact.id}
                <div class="tpl-confirm" data-confirm-contact={contact.id} role="group" aria-label={t('confirmDeletePrompt')}>
                  <span class="tpl-confirm-label">{contact.name || contact.phone}</span>
                  <div class="tpl-confirm-actions">
                    <button class="confirm-btn" type="button" onclick={() => (confirmContactId = null)}>
                      {t('cancel')}
                    </button>
                    <button
                      class="confirm-btn danger"
                      type="button"
                      onclick={() => {
                        confirmContactId = null
                        onDelete?.(contact)
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              {:else}
                <div class="clist-top">
                  <label class="clist-check">
                    <input type="checkbox" aria-label={contact.name || contact.phone} checked={selected.includes(contact.id)} onchange={() => toggleSelect(contact)} />
                  </label>
                  <button class="clist-identity" type="button" onclick={() => onOpen?.(contact)}>
                    <span class="clist-name" class:mono={!contact.name}>{contact.name || contact.phone}</span>
                    {#if contact.name}<span class="clist-phone mono tabular">{contact.phone}</span>{/if}
                  </button>
                  <div class="clist-status">
                    <button class="btn secondary xs" type="button" onclick={() => onOpen?.(contact)}>
                      <Icon name="edit" size={12} /><span>{t('manageContact')}</span>
                    </button>
                    <button
                      class="btn icon-btn danger-ghost xs"
                      type="button"
                      title={t('delete')}
                      aria-label={t('deleteContactAria', { name: contact.name || contact.phone })}
                      onclick={() => (confirmContactId = contact.id)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
                {#if (contact.labels ?? []).length}
                  <div class="clist-labels">
                    {#each contact.labels as label (label)}
                      <span class="label-chip" style="--label-hue:{labelHue(label)}">{label}</span>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>
