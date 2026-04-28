<script setup lang="ts">
const {
  apiKey,
  token,
  boardIds,
  doneLists,
  isConfigured,
  boards,
  lists,
  members: trelloMembers,
  loading,
  error,
  fetchBoards,
  fetchBoardData,
  saveSettings,
  clearConfig
} = useTrello()

const { members: teamMembers } = useStandup()

const showToken = ref(false)
const connectionTested = ref(false)

// Rehydrate on page load if already configured
onMounted(async () => {
  if (apiKey.value && token.value) {
    await fetchBoards()
    if (boards.value.length > 0) {
      connectionTested.value = true
    }
    if (boardIds.value.length > 0) {
      await fetchBoardData()
    }
  }
})

async function handleConnect() {
  connectionTested.value = false
  await fetchBoards()
  if (boards.value.length > 0) {
    connectionTested.value = true
  }
}

async function toggleBoard(id: string) {
  if (boardIds.value.includes(id)) {
    boardIds.value = boardIds.value.filter(b => b !== id)
  } else {
    boardIds.value = [...boardIds.value, id]
  }
  // Reset done lists when boards change so auto-detect runs again
  doneLists.value = []
  await fetchBoardData()
  saveSettings()
}

function toggleDoneList(listId: string) {
  if (doneLists.value.includes(listId)) {
    doneLists.value = doneLists.value.filter(l => l !== listId)
  } else {
    doneLists.value = [...doneLists.value, listId]
  }
  saveSettings()
}

function linkTrelloMember(teamMemberId: string, trelloMemberId: string) {
  const member = teamMembers.value.find(m => m.id === teamMemberId)
  if (member) {
    member.trelloMemberId = trelloMemberId || undefined
    // Trigger save by updating localStorage
    localStorage.setItem('standup-team-members', JSON.stringify(teamMembers.value))
  }
}

function handleDisconnect() {
  // Unlink all team members
  for (const member of teamMembers.value) {
    member.trelloMemberId = undefined
  }
  localStorage.setItem('standup-team-members', JSON.stringify(teamMembers.value))
  clearConfig()
  connectionTested.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-amber-50 dark:from-gray-900 dark:via-purple-950 dark:to-gray-900 transition-colors duration-300">
    <header class="px-6 py-4">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        to="/"
      >
        Back
      </UButton>
    </header>

    <main class="max-w-2xl mx-auto px-6 pb-12 space-y-8">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Trello Integration</h1>

      <!-- Step 1: API credentials -->
      <UCard class="shadow-lg border-2 border-violet-100 dark:border-violet-800">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">1. Connect to Trello</h2>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Get your API key and token from
            <a
              href="https://trello.com/power-ups/admin"
              target="_blank"
              class="text-violet-600 dark:text-violet-400 underline"
            >trello.com/power-ups/admin</a>.
            Create a Power-Up, copy the API key, then generate a token.
          </p>

          <UInput
            v-model="apiKey"
            placeholder="Trello API Key"
            size="lg"
          />

          <div class="relative">
            <UInput
              v-model="token"
              :type="showToken ? 'text' : 'password'"
              placeholder="Trello Token"
              size="lg"
            />
            <UButton
              :icon="showToken ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              color="neutral"
              variant="ghost"
              size="xs"
              class="absolute right-2 top-1/2 -translate-y-1/2"
              @click="showToken = !showToken"
            />
          </div>

          <div class="flex gap-3">
            <UButton
              color="primary"
              :loading="loading"
              :disabled="!apiKey || !token"
              @click="handleConnect"
            >
              Connect
            </UButton>
            <UButton
              v-if="isConfigured"
              color="error"
              variant="outline"
              @click="handleDisconnect"
            >
              Disconnect
            </UButton>
          </div>

          <p v-if="connectionTested && !error" class="text-green-600 dark:text-green-400 text-sm font-medium">
            Connected successfully! Found {{ boards.length }} board(s).
          </p>
          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
        </div>
      </UCard>

      <!-- Step 2: Select boards -->
      <UCard v-if="boards.length > 0" class="shadow-lg border-2 border-pink-100 dark:border-pink-800">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">2. Select Boards</h2>
        </template>

        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select one or more boards to pull tasks from during stand-up.
        </p>

        <div class="space-y-2">
          <div
            v-for="board in boards"
            :key="board.id"
            class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
            :class="boardIds.includes(board.id)
              ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700'
              : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'"
            @click="toggleBoard(board.id)"
          >
            <UIcon
              :name="boardIds.includes(board.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
              :class="boardIds.includes(board.id) ? 'text-violet-500' : 'text-gray-400'"
              class="text-lg"
            />
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ board.name }}</span>
          </div>
        </div>
      </UCard>

      <!-- Step 3: Configure done lists -->
      <UCard v-if="lists.length > 0" class="shadow-lg border-2 border-amber-100 dark:border-amber-800">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">3. Mark "Done" Lists</h2>
        </template>

        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select which lists represent completed work. Cards in these lists (or with completed due dates) will show as done.
        </p>

        <div class="space-y-2">
          <div
            v-for="list in lists"
            :key="list.id"
            class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
            :class="doneLists.includes(list.id)
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'"
            @click="toggleDoneList(list.id)"
          >
            <UIcon
              :name="doneLists.includes(list.id) ? 'i-lucide-check-circle' : 'i-lucide-circle'"
              :class="doneLists.includes(list.id) ? 'text-green-500' : 'text-gray-400'"
              class="text-lg"
            />
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ list.name }}</span>
          </div>
        </div>
      </UCard>

      <!-- Step 4: Link team members -->
      <UCard v-if="trelloMembers.length > 0 && teamMembers.length > 0" class="shadow-lg border-2 border-violet-100 dark:border-violet-800">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">4. Link Team Members</h2>
        </template>

        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Match your stand-up team members to their Trello accounts.
        </p>

        <div class="space-y-3">
          <div
            v-for="member in teamMembers"
            :key="member.id"
            class="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700"
          >
            <span class="font-medium text-gray-800 dark:text-gray-100 min-w-[120px]">{{ member.name }}</span>
            <USelect
              :model-value="member.trelloMemberId || '__none__'"
              :items="[
                { label: 'Not linked', value: '__none__' },
                ...trelloMembers.map(tm => ({ label: `${tm.fullName} (@${tm.username})`, value: tm.id }))
              ]"
              class="flex-1"
              @update:model-value="linkTrelloMember(member.id, $event === '__none__' ? '' : $event)"
            />
          </div>
        </div>
      </UCard>

      <div v-if="teamMembers.length === 0 && boards.length > 0">
        <UCard class="shadow-lg border-2 border-amber-100 dark:border-amber-800">
          <p class="text-center text-gray-500 dark:text-gray-400 py-4">
            Add team members on the home page first, then come back here to link them to Trello accounts.
          </p>
          <div class="text-center">
            <UButton to="/" color="primary" variant="outline">Go to Home</UButton>
          </div>
        </UCard>
      </div>
    </main>
  </div>
</template>
