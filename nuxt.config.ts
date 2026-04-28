export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  compatibilityDate: '2025-01-01',
  css: ['~/assets/css/main.css'],

  // Static generation for GitHub Pages
  ssr: false,
  nitro: {
    preset: 'github-pages'
  },

  app: {
    // Set baseURL to your repo name for GitHub Pages
    // Change this if your repo has a different name
    baseURL: process.env.NUXT_APP_BASE_URL || '/team-pulse/',
    head: {
      title: 'TeamPulse',
      meta: [
        { name: 'description', content: 'TeamPulse — daily stand-up timer & randomizer' }
      ]
    }
  }
})
