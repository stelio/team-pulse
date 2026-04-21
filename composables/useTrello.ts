export interface TrelloBoard {
  id: string
  name: string
}

export interface TrelloList {
  id: string
  name: string
}

export interface TrelloMember {
  id: string
  fullName: string
  username: string
  avatarUrl: string | null
}

export interface TrelloCard {
  id: string
  name: string
  due: string | null
  dueComplete: boolean
  idList: string
  listName: string
  url: string
  labels: { name: string; color: string }[]
}

export interface MemberTasks {
  member: TrelloMember
  completed: TrelloCard[]
  doing: TrelloCard[]
  todo: TrelloCard[]
  other: TrelloCard[]
}

const TRELLO_STORAGE_KEY = 'standup-trello-config'

interface TrelloConfig {
  apiKey: string
  token: string
  boardId: string
  doneLists: string[]
}

function loadConfig(): TrelloConfig {
  if (import.meta.server) return { apiKey: '', token: '', boardId: '', doneLists: [] }
  try {
    const data = localStorage.getItem(TRELLO_STORAGE_KEY)
    return data ? JSON.parse(data) : { apiKey: '', token: '', boardId: '', doneLists: [] }
  } catch {
    return { apiKey: '', token: '', boardId: '', doneLists: [] }
  }
}

function saveConfig(config: TrelloConfig): void {
  if (import.meta.server) return
  localStorage.setItem(TRELLO_STORAGE_KEY, JSON.stringify(config))
}

export function useTrello() {
  const apiKey = ref('')
  const token = ref('')
  const boardId = ref('')
  const doneLists = ref<string[]>([])

  const boards = ref<TrelloBoard[]>([])
  const lists = ref<TrelloList[]>([])
  const members = ref<TrelloMember[]>([])
  const memberTasks = ref<Map<string, MemberTasks>>(new Map())

  const loading = ref(false)
  const error = ref('')
  const isConfigured = computed(() => apiKey.value && token.value && boardId.value)

  onMounted(() => {
    const config = loadConfig()
    apiKey.value = config.apiKey
    token.value = config.token
    boardId.value = config.boardId
    doneLists.value = config.doneLists
  })

  function persistConfig() {
    saveConfig({
      apiKey: apiKey.value,
      token: token.value,
      boardId: boardId.value,
      doneLists: doneLists.value
    })
  }

  async function trelloFetch<T>(endpoint: string): Promise<T> {
    const url = `https://api.trello.com/1${endpoint}`
    const separator = endpoint.includes('?') ? '&' : '?'
    const fullUrl = `${url}${separator}key=${apiKey.value}&token=${token.value}`
    const res = await fetch(fullUrl)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Trello API error (${res.status}): ${text}`)
    }
    return res.json()
  }

  async function fetchBoards(): Promise<void> {
    if (!apiKey.value || !token.value) {
      error.value = 'Please enter your API key and token first.'
      return
    }
    loading.value = true
    error.value = ''
    try {
      boards.value = await trelloFetch<TrelloBoard[]>('/members/me/boards?fields=name')
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch boards'
    } finally {
      loading.value = false
    }
  }

  async function fetchBoardData(): Promise<void> {
    if (!boardId.value) return
    loading.value = true
    error.value = ''
    try {
      const [fetchedLists, fetchedMembers] = await Promise.all([
        trelloFetch<TrelloList[]>(`/boards/${boardId.value}/lists?fields=name`),
        trelloFetch<TrelloMember[]>(`/boards/${boardId.value}/members?fields=fullName,username,avatarUrl`)
      ])
      lists.value = fetchedLists
      members.value = fetchedMembers

      // Auto-detect done lists if not configured
      if (doneLists.value.length === 0) {
        const donePatterns = ['done', 'complete', 'finished', 'closed']
        doneLists.value = fetchedLists
          .filter(l => donePatterns.some(p => l.name.toLowerCase().includes(p)))
          .map(l => l.id)
      }

      persistConfig()
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch board data'
    } finally {
      loading.value = false
    }
  }

  async function fetchMemberTasks(): Promise<void> {
    if (!boardId.value) return
    loading.value = true
    error.value = ''
    try {
      const cards = await trelloFetch<(TrelloCard & { idMembers: string[] })[]>(
        `/boards/${boardId.value}/cards?fields=name,due,dueComplete,idList,idMembers,url,labels`
      )

      // Build a list id -> name map
      const listMap = new Map(lists.value.map(l => [l.id, l.name]))
      const doneListIds = new Set(doneLists.value)

      // Enrich cards with list names and map members
      const cardMembers = cards.map(card => ({
        card: { ...card, listName: listMap.get(card.idList) || 'Unknown' },
        memberIds: card.idMembers || []
      }))

      // Categorize lists by name patterns
      const doingPatterns = ['doing', 'in progress', 'in-progress', 'wip', 'working']
      const todoPatterns = ['to do', 'todo', 'to-do', 'next', 'planned', 'backlog']

      const doingListIds = new Set(
        lists.value
          .filter(l => doingPatterns.some(p => l.name.toLowerCase().includes(p)))
          .map(l => l.id)
      )
      const todoListIds = new Set(
        lists.value
          .filter(l => todoPatterns.some(p => l.name.toLowerCase().includes(p)))
          .map(l => l.id)
      )

      // Build per-member task map
      const taskMap = new Map<string, MemberTasks>()
      for (const member of members.value) {
        taskMap.set(member.id, {
          member,
          completed: [],
          doing: [],
          todo: [],
          other: []
        })
      }

      for (const { card, memberIds } of cardMembers) {
        const isDone = doneListIds.has(card.idList) || card.dueComplete
        const isDoing = doingListIds.has(card.idList)
        const isTodo = todoListIds.has(card.idList)

        for (const memberId of memberIds) {
          const entry = taskMap.get(memberId)
          if (entry) {
            if (isDone) {
              entry.completed.push(card)
            } else if (isDoing) {
              entry.doing.push(card)
            } else if (isTodo) {
              entry.todo.push(card)
            } else {
              entry.other.push(card)
            }
          }
        }
      }

      // Sort by due date within each category
      const sortByDueAsc = (a: TrelloCard, b: TrelloCard) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return new Date(a.due).getTime() - new Date(b.due).getTime()
      }
      const sortByDueDesc = (a: TrelloCard, b: TrelloCard) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return new Date(b.due).getTime() - new Date(a.due).getTime()
      }
      for (const entry of taskMap.values()) {
        entry.completed.sort(sortByDueDesc)
        entry.doing.sort(sortByDueAsc)
        entry.todo.sort(sortByDueAsc)
        entry.other.sort(sortByDueAsc)
      }

      memberTasks.value = taskMap
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch tasks'
    } finally {
      loading.value = false
    }
  }

  function getTasksForMember(memberId: string): MemberTasks | null {
    return memberTasks.value.get(memberId) || null
  }

  function saveSettings() {
    persistConfig()
  }

  function clearConfig() {
    apiKey.value = ''
    token.value = ''
    boardId.value = ''
    doneLists.value = []
    boards.value = []
    lists.value = []
    members.value = []
    memberTasks.value = new Map()
    localStorage.removeItem(TRELLO_STORAGE_KEY)
  }

  return {
    // Config
    apiKey,
    token,
    boardId,
    doneLists,
    isConfigured,

    // Data
    boards,
    lists,
    members,
    memberTasks,

    // State
    loading,
    error,

    // Actions
    fetchBoards,
    fetchBoardData,
    fetchMemberTasks,
    getTasksForMember,
    saveSettings,
    clearConfig
  }
}
