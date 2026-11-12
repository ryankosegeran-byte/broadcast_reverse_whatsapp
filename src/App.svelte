<script>
  import { onMount, tick } from 'svelte'
  import * as store from './lib/storage.js'
  import { render, resolve, templateVarKeys, varLabel } from './lib/vars.js'
  import { formatAutoDate, isAutoPreset } from './lib/dates.js'
  import { normalizePhone, isValidPhone, buildWaUrl } from './lib/wa.js'
  import { wrapMarker } from './lib/waFormat.js'
  import { uniqueLabels, mergeContacts } from './lib/contacts.js'
  import {
    filterByLabels,
    assignLabels,
    expandLabels,
    renameLabel,
    deleteLabel,
    createGroup,
    setGroupParent,
    backfillHierarchy,
    syncGroups,
  } from './lib/groups.js'
  import {
    templateGroupOutline,
    templateGroupPath,
    templateGroupDescendantIds,
    templateGroupCounts,
    filterTemplates,
    createTemplateGroup,
    renameTemplateGroup,
    deleteTemplateGroup,
    setTemplateGroupParent,
    assignTemplateGroup,
  } from './lib/templateGroups.js'
  import { t, lang, setLang, applyLang } from './lib/i18n.svelte.js'
  import Icon from './lib/Icon.svelte'
  import Preview from './lib/Preview.svelte'
  import RecipientTable from './lib/RecipientTable.svelte'
  import ContactsView from './lib/ContactsView.svelte'
  import TemplateGroupManager from './lib/TemplateGroupManager.svelte'
  import ImportDialog from './lib/ImportDialog.svelte'
  import ContactImport from './lib/ContactImport.svelte'
  import ContactModal from './lib/ContactModal.svelte'
  import HelpModal from './lib/HelpModal.svelte'
  import AboutModal from './lib/AboutModal.svelte'
  import AutoDateModal from './lib/AutoDateModal.svelte'
  import EmojiPicker from './lib/EmojiPicker.svelte'
  import Select from './lib/Select.svelte'

  const THEME_KEY = 'wa-broadcast:theme'
  const boot = store.loadState()

  let data = $state(boot.state)
  let activeId = $state(boot.state.templates[0]?.id ?? null)
  let previewId = $state(null)
  let notice = $state('')
  let blockedUrl = $state('')
  let showHelp = $state(false)
  let showAbout = $state(false)
  let autoFor = $state(null)
  let showPaste = $state(false)
  let showAdd = $state(false)
  let pasteText = $state('')
  let pasteError = $state('')
  let addPhoneError = $state('')
  let addSavedCount = $state(0)
  let newVar = $state('')
  let showImport = $state(false)
  let showContactImport = $state(false)
  let editingId = $state(null)
  let editingScopeIds = $state([])
  let importData = $state(null)
  let importInfo = $state(null)
  let confirmTplId = $state(null)
  let confirmTplEl = $state(null)
  let showEmoji = $state(false)
  let mobileTab = $state('compose')
  let showMobileMenu = $state(false)
  let form = $state({ phone: '', name: '', values: {} })
  let theme = $state(readTheme())
  let labelFilter = $state([])
  let labelMode = $state('and')
  let labelUndo = $state(null)
  let undoTimer
  let showTemplateManager = $state(false)
  let tplQuery = $state('')
  let tplGroupFilter = $state('')
  let tplOpen = $state({})
  let tplDragId = $state(null)
  let tplDropGroupId = $state(null)

  let nameEl = $state(null)
  let bodyEl = $state(null)
  let emojiBtnEl = $state(null)
  let addBtnEl = $state(null)
  let pasteBtnEl = $state(null)
  let addPhoneEl = $state(null)
  let pasteEl = $state(null)
  let addDialogEl = $state(null)
  let pasteDialogEl = $state(null)
  let mobileMenuEl = $state(null)
  let mobileMenuBtnEl = $state(null)
  let viewportEl = $state(null)
  let fileEl = $state(null)
  let bodyCursor = null
  let noticeTimer

  let active = $derived(data.templates.find((x) => x.id === activeId) ?? null)
  let templateOptions = $derived(
    data.templates.map((tpl) => ({
      value: tpl.id,
      label: tpl.name || t('untitled'),
      meta: templateGroupPath(data.templateGroups, tpl.groupId),
    }))
  )
  let vars = $derived(active ? templateVarKeys(active) : [])
  let valueVars = $derived(vars.filter((v) => v !== 'nama'))
  let labelPool = $derived(uniqueLabels(data.contacts))
  let filteredContacts = $derived(filterByLabels(data.contacts, labelFilter, labelMode))
  let tplOutline = $derived(templateGroupOutline(data.templateGroups))
  let tplGroupById = $derived(new Map(data.templateGroups.map((g) => [g.id, g])))
  let tplGroupCounts = $derived(templateGroupCounts(data.templateGroups, data.templates))
  let tplVisible = $derived(
    filterTemplates(data.templates, data.templateGroups, tplQuery, tplGroupFilter)
  )
  let tplVisibleUngrouped = $derived(tplVisible.filter((x) => !x.groupId))
  let tplForceOpen = $derived(
    Boolean(tplQuery.trim()) || (tplGroupFilter && tplGroupFilter !== '__none__')
  )
  let tplVisibleGroupIds = $derived.by(() => {
    const set = new Set()
    const addAncestors = (startId) => {
      let cur = startId ? tplGroupById.get(startId) : null
      const seen = new Set()
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        set.add(cur.id)
        cur = cur.parentId ? tplGroupById.get(cur.parentId) : null
      }
    }
    for (const tpl of tplVisible) addAncestors(tpl.groupId)
    if (!tplQuery.trim() && tplGroupFilter !== '__none__') {
      if (!tplGroupFilter) {
        for (const g of data.templateGroups) set.add(g.id)
      } else if (tplGroupById.has(tplGroupFilter)) {
        addAncestors(tplGroupFilter)
        for (const id of templateGroupDescendantIds(data.templateGroups, tplGroupFilter)) {
          set.add(id)
        }
      }
    }
    return set
  })
  let tplFilterOptions = $derived([
    { value: '', label: t('allGroups') },
    ...tplOutline.map((g) => ({
      value: g.id,
      label: '— '.repeat(g.depth) + g.name,
      meta: String(tplGroupCounts.get(g.id) ?? 0),
    })),
    {
      value: '__none__',
      label: t('noGroup'),
      meta: String(data.templates.filter((x) => !x.groupId).length),
    },
  ])
  let tplAssignOptions = $derived([
    { value: '', label: t('noGroup') },
    ...tplOutline.map((g) => ({ value: g.id, label: '— '.repeat(g.depth) + g.name })),
  ])
  let previewContact = $derived(
    filteredContacts.find((c) => c.id === previewId) ?? filteredContacts[0] ?? null
  )
  let previewText = $derived(
    !active ? '' : previewContact ? render(active.body, previewContact, active, lang()) : active.body
  )
  let previewMissing = $derived(
    active && previewContact ? vars.filter((v) => !resolve(v, previewContact, active, lang())) : []
  )
  let editingContact = $derived(
    editingId ? data.contacts.find((c) => c.id === editingId) ?? null : null
  )
  let editingNavList = $derived(
    editingScopeIds
      .map((id) => data.contacts.find((c) => c.id === id))
      .filter(Boolean)
  )

  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }

  function applyThemeAttr(next) {
    const root = document.documentElement
    if (next === 'dark') {
      root.setAttribute('data-theme', 'dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#141414')
    } else {
      root.removeAttribute('data-theme')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fcfcfc')
    }
  }

  function toggleTheme(event) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const commit = () => {
      theme = next
      applyThemeAttr(next)
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* storage blocked */
      }
    }

    if (reduce || !document.startViewTransition) {
      commit()
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--vt-x', `${Math.round(rect.left + rect.width / 2)}px`)
    root.style.setProperty('--vt-y', `${Math.round(rect.top + rect.height / 2)}px`)
    root.dataset.vt = 'theme'

    const vt = document.startViewTransition(commit)
    vt.finished.finally(() => {
      delete root.dataset.vt
    })
  }

  $effect(() => {
    JSON.stringify(data)
    store.scheduleSave(data)
  })

  $effect(() => {
    data.groups ??= []
    const names = new Set(data.groups.map((g) => g.name))
    const missing = uniqueLabels(data.contacts).some((l) => !names.has(l))
    if (missing) syncGroups(data.groups, data.contacts)
  })

  $effect(() => {
    data.templateGroups ??= []
    if (
      tplGroupFilter &&
      tplGroupFilter !== '__none__' &&
      !data.templateGroups.some((g) => g.id === tplGroupFilter)
    ) {
      tplGroupFilter = ''
    }
  })

  $effect(() => {
    if (labelFilter.length === 0) return
    const pool = new Set(labelPool)
    if (labelFilter.some((l) => !pool.has(l))) {
      labelFilter = labelFilter.filter((l) => pool.has(l))
    }
  })

  $effect(() => {
    if (showHelp || showAbout || showTemplateManager || showImport || showContactImport || showAdd || showPaste || editingId || autoFor) {
      showEmoji = false
      showMobileMenu = false
    }
  })

  onMount(() => {
    applyLang()
    applyThemeAttr(theme)
    store.setSaveErrorHandler(() => notify(t('storageFull')))
    if (boot.warning) notify(warningText(boot.warning))

    const onPointerDown = (e) => {
      if (confirmTplId && confirmTplEl && !confirmTplEl.contains(e.target)) {
        confirmTplId = null
      }
      if (
        showMobileMenu &&
        mobileMenuEl &&
        !mobileMenuEl.contains(e.target) &&
        (!mobileMenuBtnEl || !mobileMenuBtnEl.contains(e.target))
      ) {
        showMobileMenu = false
      }
    }
    const onKeyDown = (e) => {
      if (showHelp || showAbout || showTemplateManager || showImport || showContactImport || editingId || autoFor) return
      if (showAdd) {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeAddModal(true)
          return
        }
        trapModalTab(e, addDialogEl)
        return
      }
      if (showPaste) {
        if (e.key === 'Escape') {
          e.preventDefault()
          closePasteModal(true)
          return
        }
        trapModalTab(e, pasteDialogEl)
        return
      }
      if (e.key === 'Escape' && showMobileMenu) {
        e.preventDefault()
        closeMobileMenu(true)
        return
      }
      if (e.key === 'Escape' && confirmTplId) {
        confirmTplId = null
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function warningText(kind) {
    if (kind === 'newer') return t('warnNewer')
    if (kind === 'corrupt') return t('warnCorrupt')
    return t('warnStorage')
  }

  function notify(message) {
    notice = message
    blockedUrl = ''
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = ''), 6000)
  }

  function clearNotice() {
    clearTimeout(noticeTimer)
    notice = ''
    blockedUrl = ''
  }

  function switchMobileTab(tab) {
    mobileTab = tab
    showEmoji = false
    showMobileMenu = false
    tick().then(() => viewportEl?.scrollTo(0, 0))
  }

  function toggleMobileMenu() {
    if (!showMobileMenu) showEmoji = false
    showMobileMenu = !showMobileMenu
  }

  function closeMobileMenu(restoreFocus = false) {
    showMobileMenu = false
    if (restoreFocus) tick().then(() => mobileMenuBtnEl?.focus())
  }

  function newTemplate() {
    const now = new Date().toISOString()
    const groupId =
      tplGroupFilter &&
      tplGroupFilter !== '__none__' &&
      data.templateGroups.some((g) => g.id === tplGroupFilter)
        ? tplGroupFilter
        : null
    const tpl = {
      id: store.uid('tpl'),
      name: '',
      body: '',
      vars: [],
      globals: {},
      auto: {},
      groupId,
      createdAt: now,
      updatedAt: now,
    }
    data.templates.push(tpl)
    activeId = tpl.id
    previewId = null
    confirmTplId = null
    tplQuery = ''
    if (groupId) tplOpen[groupId] = true
    showEmoji = false
    showMobileMenu = false
    bodyCursor = null
    if (typeof window !== 'undefined' && window.innerWidth <= 760) {
      mobileTab = 'compose'
      tick().then(() => {
        viewportEl?.scrollTo(0, 0)
        nameEl?.focus()
      })
    } else {
      tick().then(() => nameEl?.focus())
    }
  }

  function selectTemplate(id, fromMobileList = false) {
    activeId = id
    showEmoji = false
    bodyCursor = null
    if (fromMobileList && typeof window !== 'undefined' && window.innerWidth <= 760) {
      switchMobileTab('compose')
    }
  }

  function confirmDeleteTemplate(id) {
    confirmTplId = null
    showEmoji = false
    bodyCursor = null
    data.templates = data.templates.filter((x) => x.id !== id)
    for (const contact of data.contacts) {
      delete contact.values[id]
      delete contact.sentAt[id]
    }
    if (activeId === id) activeId = data.templates[0]?.id ?? null
  }

  function syncBodyCursor() {
    if (!bodyEl) return
    bodyCursor = {
      start: bodyEl.selectionStart ?? bodyEl.value.length,
      end: bodyEl.selectionEnd ?? bodyEl.value.length,
    }
  }

  function toggleEmoji() {
    if (!showEmoji) syncBodyCursor()
    showEmoji = !showEmoji
  }

  function closeEmoji(restoreFocus = false) {
    showEmoji = false
    if (restoreFocus) tick().then(() => emojiBtnEl?.focus())
  }

  async function applyFormat(marker) {
    if (!active || !bodyEl) return
    const start = bodyEl.selectionStart ?? bodyCursor?.start ?? active.body.length
    const end = bodyEl.selectionEnd ?? bodyCursor?.end ?? start
    const next = wrapMarker(active.body, start, end, marker)
    active.body = next.text
    bodyCursor = { start: next.start, end: next.end }
    await tick()
    bodyEl.focus()
    bodyEl.selectionStart = next.start
    bodyEl.selectionEnd = next.end
  }

  function trapModalTab(e, el) {
    if (e.key !== 'Tab' || !el) return
    const focusables = [
      ...el.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
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

  async function insertVar(key) {
    if (!active || !bodyEl) return
    const token = `{{${key}}}`
    const len = active.body.length
    const hasLiveFocus = document.activeElement === bodyEl
    const rawStart = hasLiveFocus ? bodyEl.selectionStart : (bodyCursor?.start ?? len)
    const rawEnd = hasLiveFocus ? bodyEl.selectionEnd : (bodyCursor?.end ?? rawStart)
    const start = Math.max(0, Math.min(rawStart ?? len, len))
    const end = Math.max(start, Math.min(rawEnd ?? start, len))
    active.body = active.body.slice(0, start) + token + active.body.slice(end)
    const nextPos = start + token.length
    bodyCursor = { start: nextPos, end: nextPos }
    await tick()
    bodyEl.focus()
    bodyEl.selectionStart = bodyEl.selectionEnd = nextPos
  }

  async function insertEmoji(char) {
    if (!active || !bodyEl) return
    const len = active.body.length
    const hasLiveFocus = document.activeElement === bodyEl
    const rawStart = hasLiveFocus ? bodyEl.selectionStart : (bodyCursor?.start ?? bodyEl.selectionStart ?? len)
    const rawEnd = hasLiveFocus ? bodyEl.selectionEnd : (bodyCursor?.end ?? bodyEl.selectionEnd ?? rawStart)
    const start = Math.max(0, Math.min(rawStart ?? len, len))
    const end = Math.max(start, Math.min(rawEnd ?? start, len))

    active.body = active.body.slice(0, start) + char + active.body.slice(end)
    const nextPos = start + char.length
    bodyCursor = { start: nextPos, end: nextPos }
    await tick()
    bodyEl.selectionStart = bodyEl.selectionEnd = nextPos
  }

  function addVariable(event) {
    event.preventDefault()
    const name = newVar.trim().replace(/^\{\{|\}\}$/g, '').trim()
    if (!/^[\w.-]+$/.test(name)) return notify(t('badVarName'))
    active.vars ??= []
    if (name !== 'nama' && !active.vars.some((v) => v.key === name)) {
      active.vars.push({ key: name, label: '' })
    }
    insertVar(name)
    newVar = ''
  }

  function setVarLabel(key, value) {
    if (!active) return
    active.vars ??= []
    const found = active.vars.find((v) => v.key === key)
    if (found) found.label = value
    else active.vars.push({ key, label: value })
  }

  function removeVar(key) {
    if (!active) return
    active.vars = (active.vars ?? []).filter((v) => v.key !== key)
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    active.body = active.body.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'), '')
  }

  function autoValue(key) {
    return formatAutoDate(active?.auto?.[key], new Date(), lang())
  }

  function clearVarAuto(key) {
    if (!active?.auto) return
    delete active.auto[key]
  }

  function pushContact(rawPhone, rawName, values, quiet = false) {
    const phone = normalizePhone(rawPhone)
    if (!isValidPhone(phone)) {
      if (!quiet) notify(t('badPhone'))
      return null
    }
    if (data.contacts.some((c) => c.phone === phone)) {
      if (!quiet) notify(t('dupPhone'))
      return null
    }
    const created = {
      id: store.uid('c'),
      phone,
      name: String(rawName ?? '').trim(),
      labels: [],
      values: active ? { [active.id]: values } : {},
      sentAt: {},
    }
    data.contacts.push(created)
    return created
  }

  function submitManualContact(keepOpen = false) {
    const phone = normalizePhone(form.phone)
    if (!isValidPhone(phone)) {
      addPhoneError = t('badPhone')
      tick().then(() => addPhoneEl?.focus())
      return
    }
    if (data.contacts.some((c) => c.phone === phone)) {
      addPhoneError = t('dupPhone')
      tick().then(() => addPhoneEl?.focus())
      return
    }
    const values = {}
    for (const [key, value] of Object.entries(form.values)) {
      if (value?.trim()) values[key] = value.trim()
    }
    const created = pushContact(phone, form.name, values, true)
    if (!created) return
    previewId = created.id
    addPhoneError = ''
    form = { phone: '', name: '', values: {} }
    if (keepOpen) {
      addSavedCount += 1
      tick().then(() => addPhoneEl?.focus())
    } else {
      closeAddModal(true)
    }
  }

  function addPasted() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    let ok = 0
    let fail = 0
    let lastAdded = null
    for (const line of lines) {
      const sep = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ','
      const cols = line.split(sep).map((cell) => cell.trim())
      const values = {}
      valueVars.forEach((key, index) => {
        const value = cols[2 + index]
        if (value) values[key] = value
      })
      const created = pushContact(cols[0], cols[1] ?? '', values, true)
      if (created) {
        ok++
        lastAdded = created
      } else {
        fail++
      }
    }
    if (ok) {
      if (lastAdded) previewId = lastAdded.id
      pasteText = ''
      pasteError = ''
      closePasteModal(true)
      notify(t('pasteResult', { ok, fail }))
    } else if (lines.length) {
      pasteError = t('pasteResult', { ok, fail })
    }
  }

  function toggleLabelFilter(label) {
    labelFilter = labelFilter.includes(label)
      ? labelFilter.filter((l) => l !== label)
      : [...labelFilter, label]
  }

  function toggleLabelMode(mode) {
    labelMode = mode
  }

  function setLabelFilter(next) {
    const pool = new Set(labelPool)
    labelFilter = [...new Set(next)].filter((l) => pool.has(l))
  }

  function assignLabelsTo(ids, labels, mode) {
    const names = mode === 'remove' ? labels : expandLabels(data.groups, labels)
    const changed = assignLabels(data.contacts, ids, names, mode)
    if (mode !== 'remove') syncGroups(data.groups, data.contacts)
    notify(t('contactsUpdated', { n: changed }))
  }

  function renameGroupName(from, to) {
    const oldName = String(from ?? '').trim()
    const newName = String(to ?? '').trim()
    if (!oldName || !newName || oldName === newName) return
    if (data.groups.some((g) => g.name === newName)) {
      notify(t('groupNameExists'))
      return
    }
    renameLabel(data.groups, data.contacts, oldName, newName)
    labelFilter = labelFilter.map((l) => (l === oldName ? newName : l))
    labelUndo = { from: oldName, to: newName }
    clearTimeout(undoTimer)
    undoTimer = setTimeout(() => (labelUndo = null), 8000)
  }

  function undoRenameGroup() {
    if (!labelUndo) return
    const { from, to } = labelUndo
    if (data.groups.some((g) => g.name === from)) {
      notify(t('groupNameExists'))
      labelUndo = null
      clearTimeout(undoTimer)
      return
    }
    renameLabel(data.groups, data.contacts, to, from)
    labelFilter = labelFilter.map((l) => (l === to ? from : l))
    labelUndo = null
    clearTimeout(undoTimer)
  }

  function removeGroup(name) {
    deleteLabel(data.groups, data.contacts, name)
    labelFilter = labelFilter.filter((l) => l !== name)
    if (labelUndo && (labelUndo.from === name || labelUndo.to === name)) {
      labelUndo = null
      clearTimeout(undoTimer)
    }
  }

  function createNewGroup(name, parentId = null) {
    const cleanName = String(name ?? '').trim()
    if (!cleanName) return
    if (data.groups.some((g) => g.name === cleanName)) {
      notify(t('groupNameExists'))
      return
    }
    const row = createGroup(data.groups, cleanName, parentId)
    if (row) labelUndo = null
  }

  function reparentGroup(id, parentId) {
    if (!setGroupParent(data.groups, id, parentId)) {
      notify(t('dragHint'))
      return
    }
    backfillHierarchy(data.groups, data.contacts)
  }

  function newTemplateGroup(name, parentId = null) {
    const cleanName = String(name ?? '').trim()
    if (!cleanName) return
    if (data.templateGroups.some((g) => g.name === cleanName)) {
      notify(t('groupNameExists'))
      return
    }
    createTemplateGroup(data.templateGroups, cleanName, parentId)
  }

  function renameTemplateGroupName(from, to) {
    if (!renameTemplateGroup(data.templateGroups, from, to)) {
      notify(t('groupNameExists'))
    }
  }

  function removeTemplateGroup(id) {
    const deleted = data.templateGroups.find((g) => g.id === id)
    const moved = deleteTemplateGroup(data.templateGroups, data.templates, id)
    if (tplGroupFilter === id) tplGroupFilter = deleted?.parentId ?? ''
    if (moved) notify(t('templatesMoved', { n: moved }))
  }

  function reparentTemplateGroup(id, parentId) {
    if (!setTemplateGroupParent(data.templateGroups, id, parentId)) {
      notify(t('dragHint'))
    }
  }

  function dropTemplateOnGroup(groupId) {
    if (tplDragId) {
      const moved = assignTemplateGroup(data.templates, [tplDragId], groupId || null)
      if (moved) notify(t('templatesMoved', { n: moved }))
    }
    tplDragId = null
    tplDropGroupId = null
  }

  function moveActiveToGroup(groupId) {
    if (active) assignTemplateGroup(data.templates, [active.id], groupId || null)
  }

  function tplGroupDepth(groupId) {
    const g = tplOutline.find((x) => x.id === groupId)
    return g ? g.depth + 1 : 0
  }

  function hasCollapsedAncestor(groupId) {
    if (tplForceOpen) return false
    let cur = tplGroupById.get(groupId)
    const seen = new Set()
    while (cur?.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId)
      if (tplOpen[cur.parentId] === false) return true
      cur = tplGroupById.get(cur.parentId)
    }
    return false
  }

  function toggleSent(contact, sent) {
    if (!active) return
    contact.sentAt ??= {}
    if (sent) contact.sentAt[active.id] = new Date().toISOString()
    else delete contact.sentAt[active.id]
  }

  function deleteContact(contact) {
    data.contacts = data.contacts.filter((c) => c.id !== contact.id)
    if (previewId === contact.id) previewId = null
    if (editingId === contact.id) editingId = null
  }

  function openContactModal(contact, list = filteredContacts) {
    editingId = contact.id
    editingScopeIds = list.map((c) => c.id)
    previewId = contact.id
  }

  function selectEditingContact(id) {
    editingId = id
    previewId = id
  }

  function openWa(contact) {
    if (!active) return
    const text = render(active.body, contact, active, lang())
    const url = buildWaUrl(contact.phone, text)
    const win = window.open(url, '_blank', 'noopener')
    if (win) {
      contact.sentAt ??= {}
      contact.sentAt[active.id] = new Date().toISOString()
    } else {
      blockedUrl = url
      notify(t('popupBlocked'))
    }
    if (url.length > 8000) notify(t('urlTooLong'))
  }

  function exportAll() {
    store.downloadExport(data)
  }

  async function onImportFile(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return notify(t('importBadFile'))

    let parsed
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return notify(t('importNotJson'))
    }

    const result = store.validateState(parsed)
    if (!result.ok) {
      notify(
        result.error === 'newer'
          ? t('importNewer')
          : result.error === 'phone'
            ? t('importPhone')
            : t('importNotJson')
      )
      return
    }
    importData = result.data
    importInfo = result.counts
    showImport = true
  }

  function doReplace() {
    data = importData
    activeId = data.templates[0]?.id ?? null
    previewId = null
    editingId = null
    editingScopeIds = []
    labelFilter = []
    labelMode = 'and'
    labelUndo = null
    tplQuery = ''
    tplGroupFilter = ''
    tplOpen = {}
    clearTimeout(undoTimer)
    showImport = false
    store.saveNow(data)
    notify(t('importDone'))
  }

  function doMerge() {
    store.mergeStates(data, importData)
    showImport = false
    store.saveNow(data)
    notify(t('importDone'))
  }

  function doImportContacts(contacts, stats) {
    const { added, merged } = mergeContacts(data.contacts, contacts)
    labelFilter = labelFilter.filter((l) => uniqueLabels(data.contacts).includes(l))
    syncGroups(data.groups, data.contacts)
    showContactImport = false
    notify(t('importContactsDone', { added, merged, bad: stats.bad }))
  }

  function openPasteModal() {
    if (showHelp || showAbout || showTemplateManager || showImport || showContactImport || editingId || autoFor) return
    showMobileMenu = false
    showEmoji = false
    showPaste = true
    showAdd = false
    pasteError = ''
    tick().then(() => pasteEl?.focus())
  }

  function closePasteModal(restoreFocus = false) {
    showPaste = false
    pasteError = ''
    if (restoreFocus) tick().then(() => pasteBtnEl?.focus())
  }

  function openAddModal() {
    if (showHelp || showAbout || showTemplateManager || showImport || showContactImport || editingId || autoFor) return
    showMobileMenu = false
    showEmoji = false
    showAdd = true
    showPaste = false
    addPhoneError = ''
    addSavedCount = 0
    tick().then(() => addPhoneEl?.focus())
  }

  function closeAddModal(restoreFocus = false) {
    showAdd = false
    addPhoneError = ''
    addSavedCount = 0
    form = { phone: '', name: '', values: {} }
    if (restoreFocus) tick().then(() => addBtnEl?.focus())
  }
</script>

{#snippet tplRow(tpl)}
  <li
    class="tpl-item"
    class:active={tpl.id === activeId}
    style="--depth:{tplGroupDepth(tpl.groupId)}"
    draggable={confirmTplId !== tpl.id}
    ondragstart={(e) => {
      tplDragId = tpl.id
      e.dataTransfer?.setData('text/plain', tpl.id)
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    }}
    ondragend={() => {
      tplDragId = null
      tplDropGroupId = null
    }}
  >
    {#if confirmTplId === tpl.id}
      <div class="tpl-confirm" bind:this={confirmTplEl} role="group" aria-label={t('confirmDeleteTemplatePrompt')}>
        <span class="tpl-confirm-label">{t('confirmDeleteTemplatePrompt')}</span>
        <div class="tpl-confirm-actions">
          <button class="confirm-btn" type="button" onclick={() => (confirmTplId = null)}>
            {t('cancel')}
          </button>
          <button class="confirm-btn danger" type="button" onclick={() => confirmDeleteTemplate(tpl.id)}>
            {t('delete')}
          </button>
        </div>
      </div>
    {:else}
      <button class="tpl-name" type="button" onclick={() => selectTemplate(tpl.id, true)}>
        {tpl.name || t('untitled')}
      </button>
      <button
        class="tpl-del"
        type="button"
        title={t('delete')}
        aria-label={t('deleteTemplateAria', { name: tpl.name || t('untitled') })}
        onclick={() => (confirmTplId = tpl.id)}
      >
        <Icon name="x" size={14} />
      </button>
    {/if}
  </li>
{/snippet}

<div class="page" class:no-template={!active} data-mobile-tab={mobileTab}>
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <Icon name="wa" size={24} />
      </span>
      <div class="brand-copy">
        <h1>{t('appTitle')}</h1>
        <p class="subtitle">{t('tagline')}</p>
      </div>
    </div>

    <div class="toolbar">
      <div
        class="segmented"
        role="group"
        aria-label={t('language')}
        style="--seg-idx: {lang() === 'id' ? 1 : 0}"
      >
        <span class="segmented-thumb" aria-hidden="true"></span>
        <button
          type="button"
          class="segmented-btn"
          aria-pressed={lang() === 'en'}
          onclick={() => setLang('en')}
        >
          EN
        </button>
        <button
          type="button"
          class="segmented-btn"
          aria-pressed={lang() === 'id'}
          onclick={() => setLang('id')}
        >
          ID
        </button>
      </div>

      <button
        class="btn icon-btn secondary sm"
        type="button"
        onclick={toggleTheme}
        aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
        title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>

      <button
        class="btn secondary sm"
        class:active-toggle={mobileTab === 'contacts'}
        type="button"
        aria-pressed={mobileTab === 'contacts'}
        onclick={() => switchMobileTab(mobileTab === 'contacts' ? 'send' : 'contacts')}
      >
        <Icon name="users" size={15} />
        <span>{t('navContacts')}</span>
      </button>

      <button class="btn secondary sm" type="button" onclick={() => (showHelp = true)}>
        <Icon name="help" size={15} />
        <span>{t('help')}</span>
      </button>

      <button class="btn secondary sm" type="button" onclick={() => (showAbout = true)}>
        <Icon name="info" size={15} />
        <span>{t('about')}</span>
      </button>

      <button class="btn secondary sm" type="button" onclick={exportAll}>
        <Icon name="download" size={15} />
        <span>{t('export')}</span>
      </button>

      <button class="btn secondary sm" type="button" onclick={() => fileEl?.click()}>
        <Icon name="upload" size={15} />
        <span>{t('import')}</span>
      </button>
      <input bind:this={fileEl} type="file" accept=".json,application/json" hidden onchange={onImportFile} />
    </div>

    <div class="mobile-header-actions">
      <button
        class="btn icon-btn secondary sm"
        type="button"
        onclick={toggleTheme}
        aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
        title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>
      <button
        bind:this={mobileMenuBtnEl}
        class="btn secondary sm mobile-menu-btn"
        class:active-toggle={showMobileMenu}
        type="button"
        aria-expanded={showMobileMenu}
        aria-haspopup="dialog"
        aria-label={showMobileMenu ? t('closeMenu') : t('menu')}
        onclick={toggleMobileMenu}
      >
        <Icon name={showMobileMenu ? 'x' : 'menu'} size={16} />
        <span class="mobile-menu-btn-label">{t('menu')}</span>
      </button>
    </div>
  </header>

  {#if showMobileMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mobile-menu-backdrop" onclick={() => closeMobileMenu(false)}></div>
    <div
      class="mobile-menu"
      bind:this={mobileMenuEl}
      role="dialog"
      aria-label={t('menu')}
    >
      <div class="mobile-menu-intro">
        <p class="mobile-menu-tagline">{t('tagline')}</p>
        <p class="hint">{t('devicesNote')}</p>
      </div>

      <div class="mobile-menu-row">
        <span class="mobile-menu-label">{t('language')}</span>
        <div
          class="segmented"
          role="group"
          aria-label={t('language')}
          style="--seg-idx: {lang() === 'id' ? 1 : 0}"
        >
          <span class="segmented-thumb" aria-hidden="true"></span>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={lang() === 'en'}
            onclick={() => setLang('en')}
          >
            EN
          </button>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={lang() === 'id'}
            onclick={() => setLang('id')}
          >
            ID
          </button>
        </div>
      </div>

      <div class="mobile-menu-row">
        <span class="mobile-menu-label">{t('themeLabel')}</span>
        <button
          class="btn secondary sm"
          type="button"
          onclick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          <span>{theme === 'dark' ? t('themeDark') : t('themeLight')}</span>
        </button>
      </div>

      <div class="mobile-menu-actions">
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            exportAll()
          }}
        >
          <Icon name="download" size={16} />
          <span>{t('export')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            fileEl?.click()
          }}
        >
          <Icon name="upload" size={16} />
          <span>{t('import')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showContactImport = true
          }}
        >
          <Icon name="users" size={16} />
          <span>{t('importContacts')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showTemplateManager = true
          }}
        >
          <Icon name="folder" size={16} />
          <span>{t('manageTemplates')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            switchMobileTab('contacts')
          }}
        >
          <Icon name="users" size={16} />
          <span>{t('navContacts')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showHelp = true
          }}
        >
          <Icon name="help" size={16} />
          <span>{t('help')}</span>
        </button>
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showAbout = true
          }}
        >
          <Icon name="info" size={16} />
          <span>{t('about')}</span>
        </button>
      </div>
    </div>
  {/if}

  {#if notice}
    <div class="alert-banner" role="status" aria-live="polite">
      <span class="alert-icon" aria-hidden="true">
        <Icon name="alert" size={16} />
      </span>
      <div class="alert-body">
        <span>{notice}</span>
        {#if blockedUrl}
          <a class="alert-link" href={blockedUrl} target="_blank" rel="noopener">
            {blockedUrl.slice(0, 64)}…
          </a>
        {/if}
      </div>
      <button class="alert-dismiss" type="button" onclick={clearNotice} aria-label={t('dismiss')}>
        <Icon name="x" size={14} />
      </button>
    </div>
  {/if}

  <div class="mobile-viewport" bind:this={viewportEl}>
  {#if mobileTab === 'contacts'}
    <ContactsView
      contacts={data.contacts}
      groups={data.groups}
      {t}
      onAdd={openAddModal}
      onPaste={openPasteModal}
      onImport={() => (showContactImport = true)}
      onOpen={(contact) => openContactModal(contact, data.contacts)}
      onDelete={deleteContact}
      onAssign={assignLabelsTo}
      onRename={renameGroupName}
      onDeleteLabel={removeGroup}
      onCreateGroup={createNewGroup}
      onReparent={reparentGroup}
      undoLabel={labelUndo}
      onUndoRename={undoRenameGroup}
      onBack={() => switchMobileTab('send')}
    />
  {:else}
  <main class="workspace" class:single={!active}>
    <div class="workspace-rail">
      <aside class="panel sidebar" aria-label={t('templates')}>
        <div class="panel-head">
          <h2>{t('templates')}</h2>
          <div class="sidebar-head-actions">
            <button
              class="btn icon-btn secondary sm"
              type="button"
              title={t('manageTemplates')}
              aria-label={t('manageTemplates')}
              onclick={() => (showTemplateManager = true)}
            >
              <Icon name="folder" size={14} />
            </button>
            <button
              class="btn sm {data.templates.length === 0 ? 'primary' : 'secondary'}"
              type="button"
              onclick={newTemplate}
            >
              <Icon name="plus" size={14} />
              <span>{t('newTemplate')}</span>
            </button>
          </div>
        </div>

        {#if data.templates.length === 0 && data.templateGroups.length === 0}
          <p class="muted small sidebar-empty">{t('noTemplatesDesc')}</p>
        {:else}
          <div class="tpl-tools">
            {#if data.templates.length > 0}
              <div class="search-field">
                <span class="search-icon" aria-hidden="true"><Icon name="search" size={13} /></span>
                <input
                  class="input search-input"
                  type="search"
                  placeholder={t('templateSearchPlaceholder')}
                  aria-label={t('templateSearchPlaceholder')}
                  bind:value={tplQuery}
                />
                {#if tplQuery}
                  <button
                    class="search-clear"
                    type="button"
                    aria-label={t('clearSearch')}
                    onclick={() => (tplQuery = '')}
                  >
                    <Icon name="x" size={13} />
                  </button>
                {/if}
              </div>
            {/if}
            {#if data.templateGroups.length > 0}
              <Select
                size="sm"
                icon="folder"
                ariaLabel={t('filterByGroup')}
                value={tplGroupFilter}
                options={tplFilterOptions}
                onChange={(id) => (tplGroupFilter = id)}
              />
            {/if}
          </div>

          {#if data.templateGroups.length === 0}
            {#if tplVisible.length > 0}
              <ul class="tpl-tree">
                {#each tplVisible as tpl (tpl.id)}
                  {@render tplRow(tpl)}
                {/each}
              </ul>
            {/if}
          {:else if tplVisibleGroupIds.size > 0 || tplVisibleUngrouped.length > 0}
            <ul class="tpl-tree">
              {#each tplOutline as group (group.id)}
                {#if tplVisibleGroupIds.has(group.id) && !hasCollapsedAncestor(group.id)}
                  {@const open = tplForceOpen ? true : tplOpen[group.id] !== false}
                  {@const kids = tplVisible.filter((x) => x.groupId === group.id)}
                  {@const hasVisibleKids = tplOutline.some(
                    (d) => d.parentId === group.id && tplVisibleGroupIds.has(d.id)
                  )}
                  <li
                    class="tpl-group"
                    class:drop={tplDropGroupId === group.id}
                    style="--depth:{group.depth}"
                    ondragover={(e) => {
                      if (!tplDragId) return
                      e.preventDefault()
                      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                      tplDropGroupId = group.id
                    }}
                    ondragleave={(e) => {
                      if (tplDropGroupId === group.id && !e.currentTarget.contains(e.relatedTarget)) {
                        tplDropGroupId = null
                      }
                    }}
                    ondrop={(e) => {
                      e.preventDefault()
                      dropTemplateOnGroup(group.id)
                    }}
                  >
                    <div class="tpl-group-row">
                      {#if hasVisibleKids || kids.length}
                        <button
                          class="tpl-caret"
                          type="button"
                          aria-expanded={open}
                          aria-label={group.name}
                          onclick={() => (tplOpen[group.id] = !open)}
                        >
                          <Icon name="chevron-right" size={12} className={open ? 'rot-open' : ''} />
                        </button>
                      {:else}
                        <span class="tpl-caret-spacer" aria-hidden="true"></span>
                      {/if}
                      <Icon name="folder" size={12} />
                      <span class="tpl-group-name">{group.name}</span>
                      <span class="badge neutral sm tabular">{tplGroupCounts.get(group.id) ?? 0}</span>
                    </div>
                    {#if open && kids.length}
                      <ul class="tpl-group-list">
                        {#each kids as tpl (tpl.id)}
                          {@render tplRow(tpl)}
                        {/each}
                      </ul>
                    {/if}
                  </li>
                {/if}
              {/each}

              {#if tplVisibleUngrouped.length}
                <li
                  class="tpl-group tpl-ungrouped"
                  class:drop={tplDropGroupId === '__none__'}
                  ondragover={(e) => {
                    if (!tplDragId) return
                    e.preventDefault()
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                    tplDropGroupId = '__none__'
                  }}
                  ondragleave={(e) => {
                    if (tplDropGroupId === '__none__' && !e.currentTarget.contains(e.relatedTarget)) {
                      tplDropGroupId = null
                    }
                  }}
                  ondrop={(e) => {
                    e.preventDefault()
                    dropTemplateOnGroup('')
                  }}
                >
                  <div class="tpl-group-row">
                    <span class="tpl-caret-spacer" aria-hidden="true"></span>
                    <Icon name="file" size={12} />
                    <span class="tpl-group-name">{t('noGroup')}</span>
                    <span class="badge neutral sm tabular">{tplVisibleUngrouped.length}</span>
                  </div>
                  <ul class="tpl-group-list">
                    {#each tplVisibleUngrouped as tpl (tpl.id)}
                      {@render tplRow(tpl)}
                    {/each}
                  </ul>
                </li>
              {/if}
            </ul>
          {/if}

          {#if data.templates.length === 0}
            <p class="muted small sidebar-empty">{t('noTemplatesDesc')}</p>
          {:else if tplVisible.length === 0}
            <p class="muted small sidebar-empty">{t('noMatchingTemplates')}</p>
          {/if}
        {/if}
      </aside>

      <section class="panel recipients" aria-label={t('recipients')}>
        <div class="mobile-tpl-bar" class:empty-tpl={!active}>
          {#if active}
            <div class="mobile-tpl-picker">
              <Select
                size="sm"
                icon="file"
                ariaLabel={t('activeTemplate')}
                value={activeId}
                options={templateOptions}
                onChange={(id) => selectTemplate(id)}
              />
            </div>
            <button
              class="btn secondary sm"
              type="button"
              onclick={() => switchMobileTab('compose')}
            >
              <Icon name="edit" size={13} />
              <span>{t('navCompose')}</span>
            </button>
          {:else}
            <span class="mobile-tpl-caption">{t('noTemplates')}</span>
            <button class="btn primary sm" type="button" onclick={newTemplate}>
              <Icon name="plus" size={14} />
              <span>{t('newTemplate')}</span>
            </button>
          {/if}
        </div>

        <div class="panel-head recipients-head">
          <div class="recipients-title-row">
            <h2>{t('recipients')}</h2>
            <span class="badge neutral sm tabular">{data.contacts.length}</span>
          </div>
          <div class="recipients-actions" role="group" aria-label={t('recipients')}>
            <button
              bind:this={addBtnEl}
              class="btn sm {data.contacts.length ? 'secondary' : 'primary'}"
              type="button"
              aria-haspopup="dialog"
              aria-label={t('addContact')}
              title={t('addContact')}
              onclick={openAddModal}
            >
              <Icon name="plus" size={12} />
              <span>{t('addContactShort')}</span>
            </button>
            <button
              bind:this={pasteBtnEl}
              class="btn sm secondary"
              type="button"
              aria-haspopup="dialog"
              aria-label={t('pasteRows')}
              title={t('pasteRows')}
              onclick={openPasteModal}
            >
              <Icon name="clipboard" size={12} />
              <span>{t('pasteRowsShort')}</span>
            </button>
            <button
              class="btn sm secondary"
              type="button"
              aria-haspopup="dialog"
              aria-label={t('importContacts')}
              title={t('importContacts')}
              onclick={() => (showContactImport = true)}
            >
              <Icon name="upload" size={12} />
              <span>{t('importContactsShort')}</span>
            </button>
          </div>
        </div>

        <RecipientTable
          contacts={filteredContacts}
          allContacts={data.contacts}
          allContactIds={data.contacts.map((c) => c.id)}
          totalCount={data.contacts.length}
          template={active}
          groups={data.groups}
          {labelPool}
          {labelFilter}
          {labelMode}
          onToggleLabelFilter={toggleLabelFilter}
          onSetLabelFilter={setLabelFilter}
          onToggleLabelMode={toggleLabelMode}
          onClearLabelFilter={() => (labelFilter = [])}
          focusedId={previewContact?.id ?? null}
          lang={lang()}
          {t}
          onOpen={openWa}
          onDelete={deleteContact}
          onFocus={(contact) => (previewId = contact.id)}
          onEdit={(contact, list) => openContactModal(contact, list)}
          onToggleSent={toggleSent}
        />
      </section>

      {#if active}
        <section class="panel variables-panel" aria-label={t('variables')}>
          <div class="panel-head variables-head">
            <h2>{t('variables')}</h2>
            {#if valueVars.length > 0}
              <span class="badge neutral sm tabular">{valueVars.length}</span>
            {/if}
          </div>

          <form class="var-add" onsubmit={addVariable}>
            <input
              class="input"
              bind:value={newVar}
              placeholder={t('varNamePlaceholder')}
              aria-label={t('addVariable')}
            />
            <button
              class="btn secondary sm"
              type="submit"
              title={t('addVariable')}
              aria-label={t('addVariable')}
            >
              <Icon name="plus" size={14} />
              <span>{t('add')}</span>
            </button>
          </form>

          <div class="chips">
            <button class="chip" type="button" onclick={() => insertVar('nama')}>+ {'{{nama}}'}</button>
            {#each valueVars as v (v)}
              <button class="chip" type="button" onclick={() => insertVar(v)}>+ {'{{' + v + '}}'}</button>
            {/each}
          </div>

          <div class="var-hints">
            <p class="hint">{t('insertHint')} {t('nameBuiltinHint')}</p>
          </div>

          {#if valueVars.length}
            <div class="var-rows">
              {#each valueVars as v (v)}
                <div class="var-row">
                  <div class="var-row-head">
                    <span class="var-key" title={'{{' + v + '}}'}>{'{{' + v + '}}'}</span>
                    <button
                      class="btn icon-btn danger-ghost xs"
                      type="button"
                      title={t('removeVariable')}
                      aria-label={t('removeVariable')}
                      onclick={() => removeVar(v)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                  <div class="var-row-inputs">
                    <input
                      class="input"
                      bind:value={
                        () => (active.vars ?? []).find((x) => x.key === v)?.label ?? '',
                        (val) => setVarLabel(v, val)
                      }
                      placeholder={t('varDisplayName')}
                      aria-label={t('varDisplayName') + ' ' + v}
                    />
                    {#if isAutoPreset(active.auto?.[v])}
                      <button
                        class="input auto-display"
                        type="button"
                        title={t('autoChange') + ' — ' + autoValue(v)}
                        onclick={() => (autoFor = v)}
                      >
                        <Icon name="calendar" size={12} />
                        <span>{autoValue(v)}</span>
                      </button>
                    {:else}
                      <input
                        class="input"
                        bind:value={() => active.globals[v] ?? '', (val) => (active.globals[v] = val)}
                        placeholder={t('varDefault')}
                        aria-label={t('varDefault') + ' ' + v}
                      />
                    {/if}
                  </div>
                  <div class="var-auto-row">
                    <button class="btn secondary xs" type="button" onclick={() => (autoFor = v)}>
                      <Icon name="calendar" size={12} />
                      <span>{isAutoPreset(active.auto?.[v]) ? t('autoChange') : t('autoSet')}</span>
                    </button>
                    {#if isAutoPreset(active.auto?.[v])}
                      <span class="badge neutral sm" title={t('autoDateTitle')}>
                        {t('autoPreset_' + active.auto[v])}
                      </span>
                      <button
                        class="btn icon-btn danger-ghost xs"
                        type="button"
                        title={t('autoClear')}
                        aria-label={t('autoClear') + ' ' + v}
                        onclick={() => clearVarAuto(v)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
              <p class="hint var-global-hint">{t('globalHint')}</p>
            </div>
          {/if}
        </section>
      {/if}
    </div>

    {#if active}
      <section class="panel editor" aria-label={t('messageBody')}>
        <div class="mobile-tpl-bar">
          <div class="mobile-tpl-picker">
            <Select
              size="sm"
              icon="file"
              ariaLabel={t('activeTemplate')}
              value={activeId}
              options={templateOptions}
              onChange={(id) => selectTemplate(id)}
            />
          </div>
          <button
            class="btn icon-btn secondary sm"
            type="button"
            title={t('newTemplate')}
            aria-label={t('newTemplate')}
            onclick={newTemplate}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        <label class="field">
          <span class="field-label">{t('templateName')}</span>
          <input class="input" bind:this={nameEl} bind:value={active.name} placeholder={t('namePlaceholder')} />
        </label>

        <div class="field">
          <span class="field-label">{t('templateGroupField')}</span>
          <Select
            size="sm"
            icon="folder"
            ariaLabel={t('templateGroupField')}
            value={active.groupId ?? ''}
            options={tplAssignOptions}
            onChange={(id) => moveActiveToGroup(id)}
          />
        </div>

        <div class="field editor-body-field">
          <div class="field-head">
            <label class="field-label" for="msg-body">{t('messageBody')}</label>
            <div class="format-bar" role="toolbar" aria-label={t('messageBody')}>
              <button
                class="format-btn"
                type="button"
                title={t('formatBold')}
                aria-label={t('formatBold')}
                onclick={() => applyFormat('*')}
              >
                <Icon name="bold" size={14} />
              </button>
              <button
                class="format-btn"
                type="button"
                title={t('formatItalic')}
                aria-label={t('formatItalic')}
                onclick={() => applyFormat('_')}
              >
                <Icon name="italic" size={14} />
              </button>
              <button
                class="format-btn"
                type="button"
                title={t('formatStrike')}
                aria-label={t('formatStrike')}
                onclick={() => applyFormat('~')}
              >
                <Icon name="strike" size={14} />
              </button>
              <button
                class="format-btn"
                type="button"
                title={t('formatMono')}
                aria-label={t('formatMono')}
                onclick={() => applyFormat('`')}
              >
                <Icon name="code" size={14} />
              </button>
              <span class="format-sep" aria-hidden="true"></span>
              <button
                bind:this={emojiBtnEl}
                class="format-btn"
                class:active={showEmoji}
                type="button"
                title={t('emojiPicker')}
                aria-label={t('emojiPicker')}
                aria-expanded={showEmoji}
                aria-haspopup="dialog"
                onclick={toggleEmoji}
              >
                <Icon name="smile" size={15} />
              </button>
            </div>
            {#if showEmoji}
              <EmojiPicker
                {t}
                anchorEl={emojiBtnEl}
                onPick={insertEmoji}
                onClose={closeEmoji}
              />
            {/if}
          </div>
          <textarea
            id="msg-body"
            class="input body"
            bind:this={bodyEl}
            bind:value={active.body}
            rows="13"
            placeholder={t('bodyPlaceholder')}
            onfocus={syncBodyCursor}
            onkeyup={syncBodyCursor}
            onmouseup={syncBodyCursor}
            onselect={syncBodyCursor}
            oninput={syncBodyCursor}
          ></textarea>
        </div>
      </section>

      <aside class="panel preview-panel" aria-label={t('preview')}>
        {#if filteredContacts.length > 1}
          <div class="mobile-preview-picker">
            <span class="mobile-tpl-caption">{t('recipients')}</span>
            <Select
              size="sm"
              icon="user"
              ariaLabel={t('recipients')}
              value={previewContact?.id ?? ''}
              options={filteredContacts.map((c) => ({
                value: c.id,
                label: c.name || c.phone,
                meta: c.name ? c.phone : '',
              }))}
              onChange={(id) => (previewId = id)}
            />
          </div>
        {/if}
        <Preview
          text={previewText}
          emptyLabel={active ? t('previewBodyEmpty') : t('previewEmpty')}
          contactLabel={previewContact ? (previewContact.name || previewContact.phone) : ''}
          {t}
        />
        {#if previewMissing.length}
          <div class="inline-alert warning preview-warn">
            <Icon name="alert" size={15} />
            <span>{t('emptyValueWarn')}</span>
          </div>
        {/if}
        <div class="mobile-preview-actions">
          {#if previewContact}
            <button class="btn wa sm mobile-preview-send" type="button" onclick={() => openWa(previewContact)}>
              <Icon name="external" size={14} />
              <span>{t('openWa')}</span>
            </button>
          {/if}
          <button class="btn secondary sm" type="button" onclick={() => switchMobileTab('send')}>
            <Icon name="send" size={14} />
            <span>{t('goToSend')}</span>
          </button>
        </div>
      </aside>
    {:else}
      <section class="panel empty-panel">
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">
            <Icon name="file" size={22} />
          </div>
          <h3>{t('noTemplates')}</h3>
          <p>{t('selectTemplateDesc')}</p>
          <div class="empty-actions">
            <button class="btn primary" type="button" onclick={newTemplate}>
              <Icon name="plus" size={15} />
              <span>{t('newTemplate')}</span>
            </button>
            <button class="btn secondary" type="button" onclick={() => (showHelp = true)}>
              <Icon name="help" size={15} />
              <span>{t('help')}</span>
            </button>
          </div>
        </div>
      </section>
    {/if}
  </main>
  {/if}
  </div>

  <nav class="mobile-nav" aria-label={t('navLabel')}>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'templates'}
      aria-current={mobileTab === 'templates' ? 'page' : undefined}
      onclick={() => switchMobileTab('templates')}
    >
      <Icon name="file" size={18} />
      <span class="mobile-nav-label">{t('navTemplates')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'compose'}
      aria-current={mobileTab === 'compose' ? 'page' : undefined}
      onclick={() => switchMobileTab('compose')}
    >
      <Icon name="edit" size={18} />
      <span class="mobile-nav-label">{t('navCompose')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'preview'}
      aria-current={mobileTab === 'preview' ? 'page' : undefined}
      onclick={() => switchMobileTab('preview')}
    >
      <Icon name="eye" size={18} />
      <span class="mobile-nav-label">{t('navPreview')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'contacts'}
      aria-current={mobileTab === 'contacts' ? 'page' : undefined}
      onclick={() => switchMobileTab('contacts')}
    >
      <Icon name="users" size={18} />
      <span class="mobile-nav-label">{t('navContacts')}</span>
    </button>
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'send'}
      aria-current={mobileTab === 'send' ? 'page' : undefined}
      onclick={() => switchMobileTab('send')}
    >
      <span class="mobile-nav-icon-wrap">
        <Icon name="send" size={18} />
        {#if data.contacts.length > 0}
          <span class="mobile-nav-count tabular">{data.contacts.length}</span>
        {/if}
      </span>
      <span class="mobile-nav-label">{t('navSend')}</span>
    </button>
  </nav>
</div>

{#if showHelp}
  <HelpModal {t} onClose={() => (showHelp = false)} />
{/if}

{#if showAbout}
  <AboutModal {t} onClose={() => (showAbout = false)} />
{/if}

{#if showTemplateManager}
  <TemplateGroupManager
    groups={data.templateGroups}
    {t}
    onCreate={newTemplateGroup}
    onRename={renameTemplateGroupName}
    onDelete={removeTemplateGroup}
    onReparent={reparentTemplateGroup}
    onClose={() => (showTemplateManager = false)}
  />
{/if}

{#if autoFor && active}
  <AutoDateModal
    {t}
    varKey={autoFor}
    value={active.auto?.[autoFor] ?? ''}
    lang={lang()}
    onPick={(preset) => {
      if (!preset) clearVarAuto(autoFor)
      else (active.auto ??= {})[autoFor] = preset
    }}
    onClose={() => (autoFor = null)}
  />
{/if}

{#if showImport && importInfo}
  <ImportDialog
    info={importInfo}
    {t}
    onReplace={doReplace}
    onMerge={doMerge}
    onExportFirst={exportAll}
    onCancel={() => (showImport = false)}
  />
{/if}

{#if showContactImport}
  <ContactImport
    template={active}
    templateId={active?.id ?? null}
    varKeys={valueVars}
    {t}
    onImport={doImportContacts}
    onCancel={() => (showContactImport = false)}
  />
{/if}

{#if showAdd}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={(e) => e.target === e.currentTarget && closeAddModal(true)}>
    <div
      class="modal-card modal-add"
      bind:this={addDialogEl}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-contact-title"
    >
      <div class="modal-header">
        <div>
          <div class="cmodal-title-row">
            <h2 id="add-contact-title" class="modal-title">{t('addContact')}</h2>
            {#if addSavedCount > 0}
              <span class="badge success sm tabular">
                <span class="badge-dot" aria-hidden="true"></span>
                {t('addedCountBadge', { n: addSavedCount })}
              </span>
            {/if}
          </div>
          <p class="modal-desc">{t('addContactDesc')}</p>
        </div>
        <button class="modal-close" type="button" onclick={() => closeAddModal(true)} aria-label={t('close')}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <form
        class="modal-add-form"
        novalidate
        onsubmit={(e) => {
          e.preventDefault()
          submitManualContact(false)
        }}
      >
        <div class="modal-body">
          <div class="cmodal-grid-2">
            <label class="field">
              <span class="field-label">{t('phone')}</span>
              <input
                bind:this={addPhoneEl}
                class="input mono"
                class:input-error={Boolean(addPhoneError)}
                bind:value={form.phone}
                placeholder="0896..."
                oninput={() => (addPhoneError = '')}
              />
              {#if addPhoneError}
                <span class="cmodal-error">{addPhoneError}</span>
              {/if}
            </label>
            <label class="field">
              <span class="field-label">{t('name')}</span>
              <input
                class="input"
                bind:value={form.name}
                placeholder="-"
              />
            </label>
          </div>

          {#if active && valueVars.length}
            <div class="add-modal-vars">
              <div class="add-modal-vars-head">
                <span class="field-label">{t('contactSectionVars')}</span>
                <span class="cmodal-tpl-tag">{active.name || t('untitled')}</span>
              </div>
              <div class="cmodal-grid-2">
                {#each valueVars as v (v)}
                  <label class="field">
                    <span class="field-label" title={v}>{varLabel(active, v)}</span>
                    <input
                      class="input"
                      bind:value={() => form.values[v] ?? '', (val) => (form.values[v] = val)}
                      placeholder={isAutoPreset(active.auto?.[v])
                        ? t('usingDefault', { val: autoValue(v) })
                        : active.globals?.[v]
                          ? t('usingDefault', { val: active.globals[v] })
                          : '-'}
                    />
                  </label>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <div class="modal-footer cmodal-footer">
          <button class="btn ghost sm" type="button" onclick={() => closeAddModal(true)}>
            {t('cancel')}
          </button>
          <div class="row gap wrap">
            <button class="btn secondary sm" type="button" onclick={() => submitManualContact(true)}>
              <Icon name="plus" size={14} />
              <span>{t('addAnother')}</span>
            </button>
            <button class="btn primary sm" type="submit">
              {t('add')}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showPaste}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={(e) => e.target === e.currentTarget && closePasteModal(true)}>
    <div
      class="modal-card modal-paste"
      bind:this={pasteDialogEl}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-contacts-title"
    >
      <div class="modal-header">
        <div>
          <h2 id="paste-contacts-title" class="modal-title">{t('pasteRows')}</h2>
          <p class="modal-desc">{active ? t('pasteHelp') : t('pasteHelpNoTemplate')}</p>
        </div>
        <button class="modal-close" type="button" onclick={() => closePasteModal(true)} aria-label={t('close')}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div class="modal-body">
        {#if pasteError}
          <div class="inline-alert warning">
            <Icon name="alert" size={15} />
            <span>{pasteError}</span>
          </div>
        {/if}
        <textarea
          bind:this={pasteEl}
          class="input mono"
          rows="6"
          bind:value={pasteText}
          placeholder={t('pastePlaceholder')}
          oninput={() => (pasteError = '')}
        ></textarea>
      </div>
      <div class="modal-footer cmodal-footer">
        <button class="btn ghost sm" type="button" onclick={() => closePasteModal(true)}>
          {t('cancel')}
        </button>
        <button
          class="btn primary sm"
          type="button"
          onclick={addPasted}
          disabled={!pasteText.trim()}
        >
          {t('addContactsAction')}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if editingContact}
  <ContactModal
    contact={editingContact}
    template={active}
    vars={valueVars}
    allContacts={data.contacts}
    {labelPool}
    groups={data.groups}
    navList={editingNavList}
    lang={lang()}
    {t}
    onSelectContact={selectEditingContact}
    onOpen={openWa}
    onDelete={deleteContact}
    onClose={() => (editingId = null)}
  />
{/if}
