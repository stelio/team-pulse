export interface TeamMember {
  id: string
  name: string
}

export type StandupPhase = 'setup' | 'active' | 'finished'

const STORAGE_KEY = 'standup-team-members'
const TIMER_KEY = 'standup-timer-duration'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadMembers(): TeamMember[] {
  if (import.meta.server) return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveMembers(members: TeamMember[]): void {
  if (import.meta.server) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
}

function loadTimerDuration(): number {
  if (import.meta.server) return 90
  try {
    const data = localStorage.getItem(TIMER_KEY)
    return data ? parseInt(data, 10) : 90
  } catch {
    return 90
  }
}

function saveTimerDuration(seconds: number): void {
  if (import.meta.server) return
  localStorage.setItem(TIMER_KEY, String(seconds))
}

export function useStandup() {
  const members = ref<TeamMember[]>([])
  const queue = ref<TeamMember[]>([])
  const currentIndex = ref(0)
  const phase = ref<StandupPhase>('setup')
  const timerDuration = ref(90)
  const timeRemaining = ref(0)
  const timerRunning = ref(false)
  const totalElapsed = ref(0)

  let timerInterval: ReturnType<typeof setInterval> | null = null
  let totalInterval: ReturnType<typeof setInterval> | null = null

  // Initialize from localStorage on client
  onMounted(() => {
    members.value = loadMembers()
    timerDuration.value = loadTimerDuration()
  })

  // Team management
  function addMember(name: string): void {
    if (!name.trim()) return
    const member: TeamMember = {
      id: generateId(),
      name: name.trim()
    }
    members.value.push(member)
    saveMembers(members.value)
  }

  function removeMember(id: string): void {
    members.value = members.value.filter(m => m.id !== id)
    saveMembers(members.value)
  }

  function setTimerDuration(seconds: number): void {
    timerDuration.value = seconds
    saveTimerDuration(seconds)
  }

  // Shuffle using Fisher-Yates
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Stand-up flow
  function startStandup(): void {
    if (members.value.length === 0) return
    queue.value = shuffleArray(members.value)
    currentIndex.value = 0
    phase.value = 'active'
    totalElapsed.value = 0
    startTotalTimer()
    startTimer()
  }

  function startTimer(): void {
    stopTimer()
    timeRemaining.value = timerDuration.value
    timerRunning.value = true
    timerInterval = setInterval(() => {
      if (timeRemaining.value > 0) {
        timeRemaining.value--
      } else {
        timerRunning.value = false
        if (timerInterval) clearInterval(timerInterval)
      }
    }, 1000)
  }

  function stopTimer(): void {
    timerRunning.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function startTotalTimer(): void {
    stopTotalTimer()
    totalInterval = setInterval(() => {
      totalElapsed.value++
    }, 1000)
  }

  function stopTotalTimer(): void {
    if (totalInterval) {
      clearInterval(totalInterval)
      totalInterval = null
    }
  }

  function nextSpeaker(): void {
    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
      startTimer()
    } else {
      finishStandup()
    }
  }

  function previousSpeaker(): void {
    if (currentIndex.value > 0) {
      currentIndex.value--
      startTimer()
    }
  }

  function finishStandup(): void {
    stopTimer()
    stopTotalTimer()
    phase.value = 'finished'
  }

  function resetStandup(): void {
    stopTimer()
    stopTotalTimer()
    queue.value = []
    currentIndex.value = 0
    totalElapsed.value = 0
    phase.value = 'setup'
  }

  // Computed
  const currentSpeaker = computed(() => queue.value[currentIndex.value] || null)
  const speakersRemaining = computed(() => queue.value.length - currentIndex.value - 1)
  const progress = computed(() => {
    if (queue.value.length === 0) return 0
    return ((currentIndex.value + 1) / queue.value.length) * 100
  })
  const timerProgress = computed(() => {
    if (timerDuration.value === 0) return 100
    return (timeRemaining.value / timerDuration.value) * 100
  })
  const timerColor = computed(() => {
    const pct = timerProgress.value
    if (pct > 50) return 'success'
    if (pct > 25) return 'warning'
    return 'error'
  })
  const isOvertime = computed(() => timeRemaining.value === 0 && timerRunning.value === false && phase.value === 'active')
  const isLastSpeaker = computed(() => currentIndex.value === queue.value.length - 1)

  // Cleanup
  onUnmounted(() => {
    stopTimer()
    stopTotalTimer()
  })

  return {
    // State
    members,
    queue,
    currentIndex,
    phase,
    timerDuration,
    timeRemaining,
    timerRunning,
    totalElapsed,

    // Computed
    currentSpeaker,
    speakersRemaining,
    progress,
    timerProgress,
    timerColor,
    isOvertime,
    isLastSpeaker,

    // Actions
    addMember,
    removeMember,
    setTimerDuration,
    startStandup,
    nextSpeaker,
    previousSpeaker,
    finishStandup,
    resetStandup,
    startTimer,
    stopTimer
  }
}
