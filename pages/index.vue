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
  progress,
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

const newMemberName = ref('')

function handleAddMember() {
  addMember(newMemberName.value)
  newMemberName.value = ''
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const fairShareSeconds = computed(() => {
  if (members.value.length === 0) return 0
  return Math.floor(900 / members.value.length)
})

const useFairShare = ref(false)

// Sync fair-share selection when member count changes
watch(fairShareSeconds, (val) => {
  if (useFairShare.value) {
    setTimerDuration(val)
  }
})

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
    <header class="px-6 py-4 flex items-center justify-end">
      <UButton
        :icon="$colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="ghost"
        @click="$colorMode.preference = $colorMode.value === 'dark' ? 'light' : 'dark'"
      />
    </header>

    <main class="max-w-2xl mx-auto px-6 pb-12">
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
              class="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-900/30 dark:to-pink-900/30 border border-violet-100 dark:border-violet-800"
            >
              <div class="flex items-center gap-3">
                <span class="font-medium text-gray-800 dark:text-gray-100">{{ member.name }}</span>
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
              :disabled="members.length === 0"
              @click="selectFairShare"
            >
              15min / {{ members.length || '?' }} = {{ members.length ? formatTime(fairShareSeconds) : '???' }}
            </UButton>
          </div>
        </UCard>

        <!-- Start button -->
        <div class="text-center pt-4">
          <UButton
            size="xl"
            color="primary"
            :disabled="members.length < 2"
            class="px-12 py-4 text-lg font-bold shadow-xl shadow-violet-200 dark:shadow-violet-900/40"
            @click="startStandup"
          >
            🚀 Start Stand-Up!
          </UButton>
          <p v-if="members.length < 2" class="text-sm text-gray-400 mt-3">
            Add at least 2 team members to begin
          </p>
        </div>
      </div>

      <!-- ACTIVE PHASE -->
      <div v-else-if="phase === 'active'" class="space-y-6">
        <!-- Speaker info -->
        <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Speaker {{ currentIndex + 1 }} of {{ queue.length }}</span>
          <span>Total: {{ formatTime(totalElapsed) }}</span>
        </div>

        <!-- Current speaker card -->
        <Transition name="bounce" mode="out-in">
          <UCard
            :key="currentSpeaker?.id"
            class="shadow-2xl border-2 text-center py-8"
            :class="[
              isOvertime
                ? 'border-red-300 dark:border-red-700 pulse-warning'
                : 'border-violet-200 dark:border-violet-700'
            ]"
          >
            <div class="space-y-4">
              <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-100">
                {{ currentSpeaker?.name }}
              </h2>
              <p class="text-gray-400 text-sm uppercase tracking-wide">is speaking</p>
            </div>
          </UCard>
        </Transition>

        <!-- Timer display -->
        <div class="text-center space-y-4">
          <div
            class="text-6xl font-mono font-bold transition-colors duration-300"
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
            size="lg"
            class="max-w-xs mx-auto"
          />
          <p v-if="isOvertime" class="text-red-500 font-semibold animate-pulse">
            ⏰ Time's up! Wrap it up!
          </p>
        </div>

        <!-- Navigation buttons -->
        <div class="flex justify-center gap-4 pt-4">
          <UButton
            icon="i-lucide-skip-back"
            color="neutral"
            variant="outline"
            size="lg"
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
            size="lg"
            @click="nextSpeaker"
          >
            Next Speaker
          </UButton>
          <UButton
            v-else
            icon="i-lucide-flag"
            trailing
            color="success"
            size="lg"
            @click="finishStandup"
          >
            Finish!
          </UButton>
        </div>

        <!-- Up next -->
        <div v-if="speakersRemaining > 0" class="pt-4">
          <p class="text-sm text-gray-400 dark:text-gray-500 text-center mb-3">Up next:</p>
          <div class="flex flex-wrap justify-center gap-2">
            <UBadge
              v-for="member in queue.slice(currentIndex + 1)"
              :key="member.id"
              color="neutral"
              variant="subtle"
              size="lg"
            >
              {{ member.name }}
            </UBadge>
          </div>
        </div>

        <!-- Cancel button -->
        <div class="text-center pt-6">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="resetStandup"
          >
            Cancel Stand-Up
          </UButton>
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
