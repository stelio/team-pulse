export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  compatibilityDate: '2025-01-01',
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Stand-Up Shuffle',
      meta: [
        { name: 'description', content: 'Daily stand-up timer & randomizer' }
      ]
    }
  }
})
