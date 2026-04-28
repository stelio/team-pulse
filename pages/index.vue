<script setup lang="ts">
const {
  members,
  queue,
  currentIndex,
  phase,
  timerDuration,
  timeRemaining,
  totalElapsed,
  currentSpeaker,
  speakersRemaining,
  timerProgress,
  timerColor,
  isOvertime,
  isLastSpeaker,
  addMember,
  removeMember,
  setTimerDuration,
  startStandup,
  nextSpeaker,
  previousSpeaker,
  finishStandup,
  resetStandup
} = useStandup()

const {
  isConfigured: trelloConfigured,
  loading: trelloLoading,
  fetchBoardData,
  fetchMemberTasks,
  getTasksForMember
} = useTrello()

const newMemberName = ref('')

// Fetch Trello data when stand-up starts (using only active members)
async function handleStartStandup() {
  if (activeMembers.value.length < 2) return
  // Temporarily swap members to only active ones for the shuffle
  const allMembers = [...members.value]
  members.value = activeMembers.value
  startStandup()
  members.value = allMembers
  if (trelloConfigured.value) {
    await fetchBoardData()
    await fetchMemberTasks()
  }
}

// Get tasks for current speaker
const currentSpeakerTasks = computed(() => {
  if (!currentSpeaker.value?.trelloMemberId) return null
  return getTasksForMember(currentSpeaker.value.trelloMemberId)
})

// Keyboard navigation: left/right arrows for previous/next speaker
function handleKeydown(e: KeyboardEvent) {
  if (phase.value !== 'active') return
  if (e.key === 'ArrowLeft') {
    previousSpeaker()
  } else if (e.key === 'ArrowRight') {
    if (isLastSpeaker.value) {
      finishStandup()
    } else {
      nextSpeaker()
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

function formatDueDate(due: string | null): string {
  if (!due) return 'No due date'
  const date = new Date(due)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const formatted = date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
  if (diffDays < 0) return `${formatted} (${Math.abs(diffDays)}d overdue)`
  if (diffDays === 0) return `${formatted} (today)`
  if (diffDays === 1) return `${formatted} (tomorrow)`
  return `${formatted} (in ${diffDays}d)`
}

function handleAddMember() {
  addMember(newMemberName.value)
  newMemberName.value = ''
}

// Track excluded members for this session
const excludedIds = ref(new Set<string>())

function toggleExclude(id: string) {
  const next = new Set(excludedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  excludedIds.value = next
}

const activeMembers = computed(() =>
  members.value.filter(m => !excludedIds.value.has(m.id))
)

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const fairShareSeconds = computed(() => {
  if (activeMembers.value.length === 0) return 0
  return Math.floor(900 / activeMembers.value.length)
})

const useFairShare = ref(true)

// Sync fair-share selection when member count changes or on init
watch(fairShareSeconds, (val) => {
  if (useFairShare.value) {
    setTimerDuration(val)
  }
}, { immediate: true })

function selectFairShare() {
  useFairShare.value = true
  setTimerDuration(fairShareSeconds.value)
}

function selectFixed(seconds: number) {
  useFairShare.value = false
  setTimerDuration(seconds)
}

const fixedTimerOptions = [
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '120s', value: 120 }
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-amber-50 dark:from-gray-900 dark:via-purple-950 dark:to-gray-900 transition-colors duration-300">
    <!-- Header -->
    <header class="px-6 py-4 flex items-center justify-end gap-2">
      <UButton
        icon="i-lucide-settings"
        color="neutral"
        variant="ghost"
        to="/settings"
      />
      <UButton
        :icon="$colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="ghost"
        @click="$colorMode.preference = $colorMode.value === 'dark' ? 'light' : 'dark'"
      />
    </header>

    <main class="mx-auto pb-12" :class="phase === 'active' ? 'px-4' : 'px-6 max-w-2xl'">
      <!-- SETUP PHASE -->
      <div v-if="phase === 'setup'" class="space-y-8">
        <!-- Add member form -->
        <UCard class="shadow-lg border-2 border-violet-100 dark:border-violet-800">
          <template #header>
            <div class="flex items-center gap-2">
              <span class="text-xl">👥</span>
              <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Team Members</h2>
            </div>
          </template>

          <form @submit.prevent="handleAddMember" class="flex gap-3 mb-6">
            <UInput
              v-model="newMemberName"
              placeholder="Add a team member..."
              size="lg"
              class="flex-1"
              autofocus
            />
            <UButton
              type="submit"
              icon="i-lucide-plus"
              size="lg"
              color="primary"
              :disabled="!newMemberName.trim()"
            >
              Add
            </UButton>
          </form>

          <!-- Members list -->
          <TransitionGroup name="slide-up" tag="div" class="space-y-2">
            <div
              v-for="member in members"
              :key="member.id"
              class="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r border transition-opacity"
              :class="excludedIds.has(member.id)
                ? 'from-gray-100 to-gray-100 dark:from-gray-800/30 dark:to-gray-800/30 border-gray-200 dark:border-gray-700 opacity-50'
                : 'from-violet-50 to-pink-50 dark:from-violet-900/30 dark:to-pink-900/30 border-violet-100 dark:border-violet-800'"
            >
              <div class="flex items-center gap-3 cursor-pointer" @click="toggleExclude(member.id)">
                <UIcon
                  :name="excludedIds.has(member.id) ? 'i-lucide-user-x' : 'i-lucide-user-check'"
                  :class="excludedIds.has(member.id) ? 'text-gray-400' : 'text-green-500'"
                />
                <span class="font-medium" :class="excludedIds.has(member.id) ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'">{{ member.name }}</span>
              </div>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="removeMember(member.id)"
              />
            </div>
          </TransitionGroup>

          <p v-if="members.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-8">
            No team members yet. Add some above! ☝️
          </p>
        </UCard>

        <!-- Timer setting -->
        <UCard class="shadow-lg border-2 border-pink-100 dark:border-pink-800">
          <template #header>
            <div class="flex items-center gap-2">
              <span class="text-xl">⏱️</span>
              <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Timer per Speaker</h2>
            </div>
          </template>

          <div class="flex flex-wrap gap-3">
            <UButton
              v-for="option in fixedTimerOptions"
              :key="option.value"
              :color="!useFairShare && timerDuration === option.value ? 'primary' : 'neutral'"
              :variant="!useFairShare && timerDuration === option.value ? 'solid' : 'outline'"
              size="lg"
              @click="selectFixed(option.value)"
            >
              {{ option.label }}
            </UButton>
            <UButton
              :color="useFairShare ? 'primary' : 'neutral'"
              :variant="useFairShare ? 'solid' : 'outline'"
              size="lg"
              :disabled="activeMembers.length === 0"
              @click="selectFairShare"
            >
              15min / {{ activeMembers.length || '?' }} = {{ activeMembers.length ? formatTime(fairShareSeconds) : '???' }}
            </UButton>
          </div>
        </UCard>

        <!-- Start button -->
        <div class="text-center pt-4">
          <UButton
            size="xl"
            color="primary"
            :disabled="activeMembers.length < 2"
            class="px-12 py-4 text-lg font-bold shadow-xl shadow-violet-200 dark:shadow-violet-900/40"
            @click="handleStartStandup"
          >
            🚀 Start Stand-Up!
          </UButton>
          <p v-if="activeMembers.length < 2" class="text-sm text-gray-400 mt-3">
            At least 2 active team members needed to begin
          </p>
        </div>
      </div>

      <!-- ACTIVE PHASE -->
      <div v-else-if="phase === 'active'" class="space-y-6">
        <!-- Top bar: speaker count + total time -->
        <div class="flex justify-between text-lg text-gray-500 dark:text-gray-400 px-2">
          <span>Speaker {{ currentIndex + 1 }} of {{ queue.length }}</span>
          <span>Total: {{ formatTime(totalElapsed) }}</span>
        </div>

        <!-- Main layout: speaker/timer left, tasks right -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[calc(100vh-8rem)]">
          <!-- Left column: speaker + timer + nav -->
          <div class="flex flex-col space-y-6">
            <!-- Current speaker card -->
            <Transition name="bounce" mode="out-in">
              <UCard
                :key="currentSpeaker?.id"
                class="shadow-2xl border-2 text-center py-12"
                :class="[
                  isOvertime
                    ? 'border-red-300 dark:border-red-700 pulse-warning'
                    : 'border-violet-200 dark:border-violet-700'
                ]"
              >
                <div class="space-y-3">
                  <h2 class="text-5xl font-bold text-gray-800 dark:text-gray-100">
                    {{ currentSpeaker?.name }}
                  </h2>
                  <p class="text-gray-400 text-lg uppercase tracking-widest">is speaking</p>
                </div>
              </UCard>
            </Transition>

            <!-- Timer display -->
            <div class="text-center space-y-4">
              <div
                class="text-8xl font-mono font-bold transition-colors duration-300"
                :class="{
                  'text-green-500': timerColor === 'success',
                  'text-amber-500': timerColor === 'warning',
                  'text-red-500 pulse-warning': timerColor === 'error'
                }"
              >
                {{ formatTime(timeRemaining) }}
              </div>
              <UProgress
                :value="timerProgress"
                :color="timerColor"
                size="xl"
              />
              <p v-if="isOvertime" class="text-red-500 text-xl font-semibold animate-pulse">
                ⏰ Time's up! Wrap it up!
              </p>
            </div>

            <!-- Navigation buttons -->
            <div class="flex justify-center gap-4">
              <UButton
                icon="i-lucide-skip-back"
                color="neutral"
                variant="outline"
                size="xl"
                class="text-lg px-6 py-3"
                :disabled="currentIndex === 0"
                @click="previousSpeaker"
              >
                Previous
              </UButton>
              <UButton
                v-if="!isLastSpeaker"
                icon="i-lucide-skip-forward"
                trailing
                color="primary"
                size="xl"
                class="text-lg px-6 py-3"
                @click="nextSpeaker"
              >
                Next Speaker
              </UButton>
              <UButton
                v-else
                icon="i-lucide-flag"
                trailing
                color="success"
                size="xl"
                class="text-lg px-6 py-3"
                @click="finishStandup"
              >
                Finish!
              </UButton>
            </div>

            <!-- Up next -->
            <div v-if="speakersRemaining > 0">
              <p class="text-base text-gray-400 dark:text-gray-500 text-center mb-3">Up next:</p>
              <div class="flex flex-wrap justify-center gap-2">
                <UBadge
                  v-for="member in queue.slice(currentIndex + 1)"
                  :key="member.id"
                  color="neutral"
                  variant="subtle"
                  size="lg"
                  class="text-base"
                >
                  {{ member.name }}
                </UBadge>
              </div>
            </div>

            <!-- Cancel -->
            <div class="text-center">
              <UButton color="neutral" variant="ghost" size="sm" @click="resetStandup">
                Cancel Stand-Up
              </UButton>
            </div>
          </div>

          <!-- Right columns: Trello tasks (spans 3 cols) -->
          <div v-if="currentSpeakerTasks" class="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Doing -->
            <UCard class="shadow-lg border-2 border-orange-300 dark:border-orange-600 bg-orange-50/50 dark:bg-orange-950/20">
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">Doing</h3>
                  <UBadge color="warning" variant="solid" size="lg">{{ currentSpeakerTasks.doing.length }}</UBadge>
                </div>
              </template>
              <div v-if="currentSpeakerTasks.doing.length > 0" class="space-y-3">
                <a
                  v-for="card in currentSpeakerTasks.doing"
                  :key="card.id"
                  :href="card.url"
                  target="_blank"
                  class="block p-4 rounded-lg bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors border border-orange-200 dark:border-orange-700"
                >
                  <p class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ card.name }}</p>
                  <p v-if="card.due" class="text-base mt-2" :class="new Date(card.due) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'">
                    {{ formatDueDate(card.due) }}
                  </p>
                </a>
              </div>
              <p v-else class="text-lg text-gray-400 dark:text-gray-500 text-center py-6">No cards</p>
            </UCard>

            <!-- To Do -->
            <UCard class="shadow-lg border-2 border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20">
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">To Do</h3>
                  <UBadge color="info" variant="solid" size="lg">{{ currentSpeakerTasks.todo.length }}</UBadge>
                </div>
              </template>
              <div v-if="currentSpeakerTasks.todo.length > 0" class="space-y-3">
                <a
                  v-for="card in currentSpeakerTasks.todo.slice(0, 8)"
                  :key="card.id"
                  :href="card.url"
                  target="_blank"
                  class="block p-4 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-700"
                >
                  <p class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ card.name }}</p>
                  <p v-if="card.due" class="text-base mt-2" :class="new Date(card.due) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'">
                    {{ formatDueDate(card.due) }}
                  </p>
                </a>
                <p v-if="currentSpeakerTasks.todo.length > 8" class="text-base text-gray-400 text-center pt-1">
                  +{{ currentSpeakerTasks.todo.length - 8 }} more
                </p>
              </div>
              <p v-else class="text-lg text-gray-400 dark:text-gray-500 text-center py-6">No cards</p>
            </UCard>

            <!-- Completed -->
            <UCard class="shadow-md border-2 border-green-200 dark:border-green-800">
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Completed</h3>
                  <UBadge color="success" variant="subtle" size="lg">{{ currentSpeakerTasks.completed.length }}</UBadge>
                </div>
              </template>
              <div v-if="currentSpeakerTasks.completed.length > 0" class="space-y-3">
                <a
                  v-for="card in currentSpeakerTasks.completed.slice(0, 8)"
                  :key="card.id"
                  :href="card.url"
                  target="_blank"
                  class="block p-4 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <p class="text-lg font-medium text-gray-800 dark:text-gray-100">{{ card.name }}</p>
                </a>
                <p v-if="currentSpeakerTasks.completed.length > 8" class="text-base text-gray-400 text-center pt-1">
                  +{{ currentSpeakerTasks.completed.length - 8 }} more
                </p>
              </div>
              <p v-else class="text-lg text-gray-400 dark:text-gray-500 text-center py-6">No cards</p>
            </UCard>
          </div>

          <div v-else-if="trelloConfigured && trelloLoading" class="lg:col-span-3 flex items-center justify-center">
            <p class="text-lg text-gray-400">Loading Trello tasks...</p>
          </div>
        </div>
      </div>

      <!-- FINISHED PHASE -->
      <div v-else-if="phase === 'finished'" class="text-center space-y-8 pt-12">
        <div class="space-y-4">
          <span class="text-7xl block">🎉</span>
          <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-100">
            Stand-Up Complete!
          </h2>
          <p class="text-xl text-gray-500 dark:text-gray-400">
            Total time: <span class="font-bold text-violet-600 dark:text-violet-400">{{ formatTime(totalElapsed) }}</span>
          </p>
        </div>

        <!-- Summary -->
        <UCard class="shadow-lg border-2 border-green-100 dark:border-green-800 text-left">
          <template #header>
            <div class="flex items-center gap-2">
              <span class="text-xl">📋</span>
              <h3 class="font-semibold text-gray-800 dark:text-gray-100">Speaking Order</h3>
            </div>
          </template>
          <ol class="space-y-2">
            <li
              v-for="(member, i) in queue"
              :key="member.id"
              class="flex items-center gap-3 p-2 rounded-lg"
            >
              <span class="text-sm font-bold text-gray-400 w-6">{{ i + 1 }}.</span>
              <span class="font-medium text-gray-700 dark:text-gray-200">{{ member.name }}</span>
            </li>
          </ol>
        </UCard>

        <UButton
          size="xl"
          color="primary"
          class="px-12 py-4 text-lg font-bold shadow-xl shadow-violet-200 dark:shadow-violet-900/40"
          @click="resetStandup"
        >
          🔄 New Stand-Up
        </UButton>
      </div>
    </main>
  </div>
</template>
