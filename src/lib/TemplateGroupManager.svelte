<script>
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import Select from './Select.svelte'
  import { templateGroupOutline, isTemplateGroupDescendant } from './templateGroups.js'

  let {
    groups = [],
    counts = new Map(),
    t,
    onCreate,
    onRename,
    onDelete,
    onReparent,
    onClose,
  } = $props()

  let dialogEl = $state(null)
  let createInputEl = $state(null)
  let renameInputEl = $state(null)
  let newName = $state('')
  let newParentId = $state(null)
  let openId = $state(null)
  let renameFor = $state(null)
  let renameText = $state('')
  let confirmDeleteId = $state(null)
  let dragId = $state(null)
  let dropId = $state(null)
  let errorMsg = $state('')

  let outline = $derived(templateGroupOutline(groups))
  let draggedGroup = $derived(dragId ? groups.find((g) => g.id === dragId) ?? null : null)
  let activeParent = $derived(newParentId ? groups.find((g) => g.id === newParentId) ?? null : null)

  $effect(() => {
    if (newParentId && !groups.some((g) => g.id === newParentId)) newParentId = null
    if (openId && !groups.some((g) => g.id === openId)) openId = null
    if (renameFor && !groups.some((g) => g.id === renameFor)) renameFor = null
    if (confirmDeleteId && !groups.some((g) => g.id === confirmDeleteId)) confirmDeleteId = null
  })

  $effect(() => {
    const prev = document.activeElement
    tick().then(() => createInputEl?.focus({ preventScroll: true }))
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (document.querySelector('.select-menu')) return
        e.preventDefault()
        e.stopImmediatePropagation()
        if (renameFor) {
          renameFor = null
          errorMsg = ''
          return
        }
        if (confirmDeleteId) {
          confirmDeleteId = null
          return
        }
        if (openId) {
          openId = null
          return
        }
        onClose?.()
        return
      }
      if (e.key === 'Tab' && dialogEl) {
        if (document.querySelector('.select-menu')) return
        const focusables = [
          ...dialogEl.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
          ),
        ]
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  })

  function toggleRow(id) {
    if (renameFor) renameFor = null
    confirmDeleteId = null
    errorMsg = ''
    openId = openId === id ? null : id
  }

  function startRename(group) {
    confirmDeleteId = null
    errorMsg = ''
    openId = group.id
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
    if (group && next && next !== group.name) {
      if (groups.some((g) => g.name === next)) {
        errorMsg = t('groupNameExists')
        tick().then(() => renameInputEl?.focus())
        return
      }
      onRename?.(group.name, next)
    }
    renameFor = null
    errorMsg = ''
  }

  function startSubgroup(group) {
    newParentId = group.id
    openId = null
    confirmDeleteId = null
    errorMsg = ''
    tick().then(() => createInputEl?.focus())
  }

  function submitCreate(e) {
    e.preventDefault()
    const clean = newName.trim()
    if (!clean) return
    if (groups.some((g) => g.name === clean)) {
      errorMsg = t('groupNameExists')
      tick().then(() => createInputEl?.focus())
      return
    }
    errorMsg = ''
    onCreate?.(clean, newParentId)
    newName = ''
    newParentId = null
    tick().then(() => createInputEl?.focus())
  }

  function moveOptionsFor(group) {
    return [
      { value: '', label: t('mainGroups') },
      ...outline
        .filter((other) => !isTemplateGroupDescendant(groups, group.id, other.id))
        .map((other) => ({
          value: other.id,
          label: `${'— '.repeat(other.depth)}${other.name}`,
        })),
    ]
  }

  function canDropOn(targetId) {
    if (!dragId || dragId === targetId) return false
    if (targetId && isTemplateGroupDescendant(groups, dragId, targetId)) return false
    return true
  }

  function onDrop(targetId) {
    const target = targetId || null
    if (dragId && dragId !== target) {
      if (target && isTemplateGroupDescendant(groups, dragId, target)) {
        errorMsg = t('dragHint')
      } else {
        errorMsg = ''
        onReparent?.(dragId, target)
      }
    }
    dragId = null
    dropId = null
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose?.()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card modal-tgm"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tgm-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="tgm-title" class="modal-title">{t('templateGroupsTitle')}</h2>
        <p class="modal-desc">{t('templateGroupsDesc')}</p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="tgm-composer">
      {#if activeParent}
        <div class="tgm-parent-pill">
          <span class="tgm-parent-pill-text">
            <Icon name="folder" size={12} />
            <span>{t('subgroupOf')}: <strong>{activeParent.name}</strong></span>
          </span>
          <button
            class="tgm-parent-clear"
            type="button"
            aria-label={t('cancel')}
            onclick={() => {
              newParentId = null
              createInputEl?.focus()
            }}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      {/if}

      <form class="tgm-add-form" onsubmit={submitCreate}>
        <input
          class="input"
          class:input-error={Boolean(errorMsg && !renameFor)}
          bind:this={createInputEl}
          bind:value={newName}
          placeholder={t('templateGroupNamePlaceholder')}
          aria-label={t('newTemplateGroup')}
          oninput={() => (errorMsg = '')}
        />
        <button class="btn primary sm" type="submit" disabled={!newName.trim()}>
          <Icon name="plus" size={14} />
          <span>{t('add')}</span>
        </button>
      </form>

      {#if errorMsg}
        <div class="inline-alert warning" role="alert">
          <Icon name="alert" size={14} />
          <span>{errorMsg}</span>
        </div>
      {/if}
    </div>

    <div class="tgm-scroll">
      {#if groups.length === 0}
        <div class="tgm-empty">
          <Icon name="folder" size={22} />
          <p>{t('noTemplateGroups')}</p>
        </div>
      {:else}
        <ul class="tgm-list" role="tree">
          {#each outline as group (group.id)}
            {@const isOpen = openId === group.id}
            {@const isRenaming = renameFor === group.id}
            {@const tplCount = counts.get(group.id) ?? 0}
            <li
              class="tgm-item"
              class:is-open={isOpen || isRenaming}
              class:is-dragging={dragId === group.id}
              class:is-drop={dropId === group.id}
              style="--depth:{group.depth}"
              role="treeitem"
              aria-level={group.depth + 1}
              aria-expanded={isOpen}
              aria-selected={isOpen}
              draggable={!isRenaming && groups.length > 1}
              ondragstart={(e) => {
                dragId = group.id
                e.dataTransfer?.setData('text/plain', group.id)
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              }}
              ondragend={() => {
                dragId = null
                dropId = null
              }}
              ondragover={(e) => {
                if (!canDropOn(group.id)) return
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                dropId = group.id
              }}
              ondragleave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget) && dropId === group.id) {
                  dropId = null
                }
              }}
              ondrop={(e) => {
                e.preventDefault()
                if (canDropOn(group.id)) onDrop(group.id)
              }}
            >
              {#if isRenaming}
                <form
                  class="tgm-rename-row"
                  onsubmit={(e) => {
                    e.preventDefault()
                    commitRename()
                  }}
                >
                  <input
                    class="input"
                    class:input-error={Boolean(errorMsg)}
                    bind:this={renameInputEl}
                    bind:value={renameText}
                    aria-label={t('renameTemplateGroup')}
                    oninput={() => (errorMsg = '')}
                  />
                  <button class="btn primary sm" type="submit">{t('done')}</button>
                  <button
                    class="btn ghost sm"
                    type="button"
                    onclick={() => {
                      renameFor = null
                      errorMsg = ''
                    }}
                  >
                    {t('cancel')}
                  </button>
                </form>
              {:else}
                <div class="tgm-row">
                  <button
                    class="tgm-row-main"
                    type="button"
                    aria-expanded={isOpen}
                    onclick={() => toggleRow(group.id)}
                  >
                    {#if group.depth > 0}
                      <span class="tgm-guides" aria-hidden="true">
                        {#each Array(group.depth) as _, i (i)}
                          <span class="tgm-guide"></span>
                        {/each}
                      </span>
                    {/if}
                    {#if groups.length > 1}
                      <span class="tgm-grip" aria-hidden="true">
                        <Icon name="grip" size={13} />
                      </span>
                    {/if}
                    <Icon name="folder" size={14} className="tgm-folder" />
                    <span class="tgm-name">{group.name}</span>
                  </button>
                  <span class="tgm-count tabular" title={group.name}>{tplCount}</span>
                  <button
                    class="tgm-toggle"
                    class:is-open={isOpen}
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`${t('editGroupActions')}: ${group.name}`}
                    onclick={() => toggleRow(group.id)}
                  >
                    <Icon name="chevron-right" size={14} />
                  </button>
                </div>

                {#if isOpen}
                  <div class="tgm-drawer">
                    <div class="tgm-drawer-actions">
                      <button class="btn secondary sm" type="button" onclick={() => startRename(group)}>
                        <Icon name="edit" size={12} />
                        <span>{t('renameTemplateGroup')}</span>
                      </button>
                      <button class="btn secondary sm" type="button" onclick={() => startSubgroup(group)}>
                        <Icon name="plus" size={12} />
                        <span>{t('createTemplateSubgroup')}</span>
                      </button>
                      {#if group.parentId}
                        <button
                          class="btn secondary sm"
                          type="button"
                          onclick={() => {
                            onReparent?.(group.id, null)
                            errorMsg = ''
                          }}
                        >
                          <Icon name="chevron-left" size={12} />
                          <span>{t('makeTopLevel')}</span>
                        </button>
                      {/if}
                      {#if confirmDeleteId !== group.id}
                        <button
                          class="btn ghost sm tgm-delete-btn"
                          type="button"
                          onclick={() => (confirmDeleteId = group.id)}
                        >
                          <Icon name="trash" size={12} />
                          <span>{t('deleteTemplateGroup')}</span>
                        </button>
                      {/if}
                    </div>

                    {#if groups.length > 1}
                      <div class="tgm-drawer-move">
                        <span class="tgm-move-label">{t('moveUnder')}</span>
                        <Select
                          size="sm"
                          options={moveOptionsFor(group)}
                          value={group.parentId ?? ''}
                          ariaLabel={`${t('moveUnder')}: ${group.name}`}
                          onChange={(val) => {
                            onReparent?.(group.id, val || null)
                            errorMsg = ''
                          }}
                        />
                      </div>
                    {/if}

                    {#if confirmDeleteId === group.id}
                      <div class="tgm-confirm" role="group" aria-label={t('deleteTemplateGroupConfirm')}>
                        <span>{t('deleteTemplateGroupConfirm')}</span>
                        <div class="tgm-confirm-actions">
                          <button class="confirm-btn" type="button" onclick={() => (confirmDeleteId = null)}>
                            {t('cancel')}
                          </button>
                          <button
                            class="confirm-btn danger"
                            type="button"
                            onclick={() => {
                              onDelete?.(group.id)
                              confirmDeleteId = null
                              openId = null
                              errorMsg = ''
                            }}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              {/if}
            </li>
          {/each}
        </ul>

        {#if draggedGroup?.parentId}
          <div
            class="tgm-root-drop"
            class:is-drop={dropId === ''}
            ondragover={(e) => {
              e.preventDefault()
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
              dropId = ''
            }}
            ondragleave={() => {
              if (dropId === '') dropId = null
            }}
            ondrop={(e) => {
              e.preventDefault()
              onDrop('')
            }}
          >
            <Icon name="chevron-left" size={13} />
            <span>{t('dropToMainGroup')}</span>
          </div>
        {:else if groups.length > 1}
          <p class="tgm-hint">{t('dragHint')}</p>
        {/if}
      {/if}
    </div>

    <div class="modal-footer cmodal-footer tgm-footer">
      <span class="tgm-summary tabular">{t('templateGroupCount', { n: groups.length })}</span>
      <button class="btn primary sm" type="button" onclick={onClose}>{t('done')}</button>
    </div>
  </div>
</div>
