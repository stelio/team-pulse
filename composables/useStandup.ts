export interface TeamMember {
  id: string
  name: string
  trelloMemberId?: string
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

// Shared singleton state so all pages see the same data
const members = ref<TeamMember[]>([])
const queue = ref<TeamMember[]>([])
const currentIndex = ref(0)
const phase = ref<StandupPhase>('setup')
const timerDuration = ref(90)
const timeRemaining = ref(0)
const timerRunning = ref(false)
const totalElapsed = ref(0)
let _initialized = false

let timerInterval: ReturnType<typeof setInterval> | null = null
let totalInterval: ReturnType<typeof setInterval> | null = null
let tickTockCtx: AudioContext | null = null
let countdownActive = false

function playTick(isTock: boolean): void {
  if (import.meta.server) return
  try {
    if (!tickTockCtx || tickTockCtx.state === 'closed') {
      tickTockCtx = new AudioContext()
    }
    const ctx = tickTockCtx
    const now = ctx.currentTime

    // Short percussive click — tick is higher pitched, tock is lower
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(isTock ? 600 : 800, now)
    osc.frequency.exponentialRampToValueAtTime(isTock ? 300 : 400, now + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.start(now)
    osc.stop(now + 0.12)
  } catch {
    // Audio not available
  }
}

function playAngelicFlute(): void {
  if (import.meta.server) return
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    const duration = 3

    // Angelic flute: layered sine waves with gentle vibrato at a major chord
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    for (const freq of notes) {
      const osc = ctx.createOscillator()
      const vibrato = ctx.createOscillator()
      const vibratoGain = ctx.createGain()
      const gain = ctx.createGain()

      // Main tone — sine for flute-like purity
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      // Gentle vibrato
      vibrato.type = 'sine'
      vibrato.frequency.setValueAtTime(5, now)
      vibratoGain.gain.setValueAtTime(3, now)
      vibrato.connect(vibratoGain)
      vibratoGain.connect(osc.frequency)

      osc.connect(gain)
      gain.connect(ctx.destination)

      // Soft swell in, sustain, gentle fade
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.06, now + 0.4)
      gain.gain.setValueAtTime(0.06, now + duration - 1)
      gain.gain.linearRampToValueAtTime(0, now + duration)

      osc.start(now)
      osc.stop(now + duration)
      vibrato.start(now)
      vibrato.stop(now + duration)
    }

    // Add a breathy noise layer for realism
    const bufferSize = ctx.sampleRate * duration
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015
    }
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    const noiseFilter = ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(800, now)
    noiseFilter.Q.setValueAtTime(1, now)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseGain.gain.setValueAtTime(0, now)
    noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.4)
    noiseGain.gain.setValueAtTime(0.08, now + duration - 1)
    noiseGain.gain.linearRampToValueAtTime(0, now + duration)
    noise.start(now)
    noise.stop(now + duration)

    setTimeout(() => ctx.close(), (duration + 0.5) * 1000)
  } catch {
    // Audio not available
  }
}

export function useStandup() {
  // Initialize from localStorage once on client
  onMounted(() => {
    if (!_initialized) {
      members.value = loadMembers()
      timerDuration.value = loadTimerDuration()
      _initialized = true
    }
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
    countdownActive = false
    timerInterval = setInterval(() => {
      if (timeRemaining.value > 0) {
        timeRemaining.value--
        // Tick-tock for the last 10 seconds
        if (timeRemaining.value <= 10 && timeRemaining.value > 0) {
          countdownActive = true
          playTick(timeRemaining.value % 2 === 0)
        }
        // Angelic flute when time is up
        if (timeRemaining.value === 0) {
          playAngelicFlute()
        }
      } else {
        timerRunning.value = false
        if (timerInterval) clearInterval(timerInterval)
      }
    }, 1000)
  }

  function stopTimer(): void {
    timerRunning.value = false
    countdownActive = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (tickTockCtx && tickTockCtx.state !== 'closed') {
      tickTockCtx.close()
      tickTockCtx = null
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
