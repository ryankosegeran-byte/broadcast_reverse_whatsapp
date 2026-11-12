<script>
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import { templateGroupOutline, isTemplateGroupDescendant } from './templateGroups.js'

  let {
    groups = [],
    t,
    onCreate,
    onRename,
    onDelete,
    onReparent,
    onClose,
  } = $props()

  let dialogEl = $state(null)
  let renameInputEl = $state(null)
  let newName = $state('')
  let newParentId = $state(null)
  let renameFor = $state(null)
  let renameText = $state('')
  let menuId = $state(null)
  let confirmDeleteId = $state(null)
  let dragId = $state(null)
  let dropId = $state(null)
  let errorMsg = $state('')

  let outline = $derived(templateGroupOutline(groups))

  $effect(() => {
    if (newParentId && !groups.some((g) => g.id === newParentId)) newParentId = null
  })

  $effect(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onPointerDown = (e) => {
      if (menuId && !e.target?.closest?.(`[data-group-menu="${menuId}"]`)) {
        menuId = null
        confirmDeleteId = null
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (menuId || confirmDeleteId || renameFor) {
          menuId = null
          confirmDeleteId = null
          renameFor = null
          errorMsg = ''
          return
        }
        onClose?.()
        return
      }
      if (e.key === 'Tab' && dialogEl) {
        const focusables = [
          ...dialogEl.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
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
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  })

  function startRename(group) {
    menuId = null
    confirmDeleteId = null
    errorMsg = ''
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

  function submitCreate(e) {
    e.preventDefault()
    const clean = newName.trim()
    if (!clean) return
    if (groups.some((g) => g.name === clean)) {
      errorMsg = t('groupNameExists')
      return
    }
    errorMsg = ''
    onCreate?.(clean, newParentId)
    newName = ''
    newParentId = null
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

    <div class="modal-body">
      {#if errorMsg}
        <div class="inline-alert warning">
          <Icon name="alert" size={15} />
          <span>{errorMsg}</span>
        </div>
      {/if}

      {#if newParentId}
        {@const parent = groups.find((g) => g.id === newParentId)}
        <div class="group-add-hint">
          <span>{t('subgroupOf')}: {parent?.name ?? ''}</span>
          <button class="btn ghost xs" type="button" onclick={() => (newParentId = null)}>{t('cancel')}</button>
        </div>
      {/if}
      <form class="group-add" onsubmit={submitCreate}>
        <input
          class="input"
          bind:value={newName}
          placeholder={t('templateGroupNamePlaceholder')}
          aria-label={t('newTemplateGroup')}
          oninput={() => (errorMsg = '')}
        />
        <button class="btn icon-btn secondary sm" type="submit" disabled={!newName.trim()} aria-label={t('newTemplateGroup')}>
          <Icon name="plus" size={14} />
        </button>
      </form>

      {#if groups.length === 0}
        <p class="hint">{t('noTemplateGroups')}</p>
      {:else}
        <ul class="group-list" role="tree">
          <li class:drop={dropId === ''}>
            <button
              class="group-row"
              type="button"
              ondragover={(e) => {
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                dropId = ''
              }}
              ondragleave={() => { if (dropId === '') dropId = null }}
              ondrop={(e) => { e.preventDefault(); onDrop('') }}
            >
              <Icon name="folder" size={13} />
              <span class="group-name">{t('mainGroups')}</span>
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
                <form class="group-add tgm-rename" onsubmit={(e) => { e.preventDefault(); commitRename() }}>
                  <input
                    class="input"
                    bind:this={renameInputEl}
                    bind:value={renameText}
                    aria-label={t('renameTemplateGroup')}
                    oninput={() => (errorMsg = '')}
                  />
                  <button class="btn secondary sm" type="submit">{t('done')}</button>
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
                <button
                  class="group-row"
                  type="button"
                  onclick={() => {
                    menuId = menuId === group.id ? null : group.id
                    confirmDeleteId = null
                  }}
                >
                  <Icon name="folder" size={13} />
                  <span class="group-name">{group.name}</span>
                </button>
                <button
                  class="group-menu-btn"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuId === group.id}
                  aria-label={t('templateGroupsTitle') + ': ' + group.name}
                  onclick={() => {
                    menuId = menuId === group.id ? null : group.id
                    confirmDeleteId = null
                  }}
                >
                  <Icon name="menu" size={13} />
                </button>
                {#if menuId === group.id}
                  <div class="group-menu" role="menu">
                    <button type="button" role="menuitem" onclick={() => startRename(group)}>
                      <Icon name="edit" size={12} /><span>{t('renameTemplateGroup')}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onclick={() => {
                        newParentId = group.id
                        menuId = null
                        confirmDeleteId = null
                        errorMsg = ''
                      }}
                    >
                      <Icon name="plus" size={12} /><span>{t('createTemplateSubgroup')}</span>
                    </button>
                    {#if group.parentId}
                      <button
                        type="button"
                        role="menuitem"
                        onclick={() => {
                          onReparent?.(group.id, null)
                          menuId = null
                          confirmDeleteId = null
                          errorMsg = ''
                        }}
                      >
                        <Icon name="chevron-left" size={12} /><span>{t('makeTopLevel')}</span>
                      </button>
                    {/if}
                    <label class="group-menu-field">
                      <span>{t('moveUnder')}</span>
                      <select
                        class="input"
                        value={group.parentId ?? ''}
                        onchange={(e) => {
                          onReparent?.(group.id, e.currentTarget.value || null)
                          menuId = null
                          confirmDeleteId = null
                          errorMsg = ''
                        }}
                      >
                        <option value="">{t('mainGroups')}</option>
                        {#each outline.filter((other) => !isTemplateGroupDescendant(groups, group.id, other.id)) as other (other.id)}
                          <option value={other.id}>{'— '.repeat(other.depth) + other.name}</option>
                        {/each}
                      </select>
                    </label>
                    {#if confirmDeleteId === group.id}
                      <div class="group-menu-confirm" role="group" aria-label={t('deleteTemplateGroupConfirm')}>
                        <span class="hint">{t('deleteTemplateGroupConfirm')}</span>
                        <div class="group-menu-confirm-actions">
                          <button class="confirm-btn" type="button" onclick={() => (confirmDeleteId = null)}>
                            {t('cancel')}
                          </button>
                          <button
                            class="confirm-btn danger"
                            type="button"
                            onclick={() => {
                              onDelete?.(group.id)
                              confirmDeleteId = null
                              menuId = null
                              errorMsg = ''
                            }}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    {:else}
                      <button class="danger" type="button" role="menuitem" onclick={() => (confirmDeleteId = group.id)}>
                        <Icon name="trash" size={12} /><span>{t('deleteTemplateGroup')}</span>
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
      {/if}
    </div>

    <div class="modal-footer cmodal-footer tgm-footer">
      <button class="btn primary sm" type="button" onclick={onClose}>{t('close')}</button>
    </div>
  </div>
</div>
