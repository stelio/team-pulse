# TeamPulse

A lightweight daily stand-up app that keeps meetings focused and under 15 minutes. Built with Nuxt 3 and Nuxt UI.

## Features

- **Speaker randomizer** — shuffles team members into a random speaking order each session using Fisher-Yates
- **Countdown timer** — configurable per-speaker timer (60s, 90s, 120s, or auto-calculated 15min / team size) with color-coded warnings (green → amber → red)
- **Trello integration** — connects to a Trello board to display each speaker's Doing, To Do, and Completed cards during the stand-up
- **Dark / light mode** — toggle between themes
- **Persistent settings** — team members, timer preferences, and Trello config are saved to localStorage

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Trello setup

1. Go to [trello.com/power-ups/admin](https://trello.com/power-ups/admin) and create a Power-Up to get your API key
2. Generate a token from the same page
3. In the app, click the gear icon and follow the setup steps: connect, select a board, mark done lists, and link team members

## Deploy to GitHub Pages

The repo includes a GitHub Actions workflow that builds and deploys on every push to `master`.

1. Create a GitHub repo named `teampulse`
2. Push your code
3. Go to Settings → Pages and set source to **GitHub Actions**

The app will be available at `https://<username>.github.io/teampulse/`.

## Tech stack

- [Nuxt 3](https://nuxt.com)
- [Nuxt UI](https://ui.nuxt.com)
- [Trello REST API](https://developer.atlassian.com/cloud/trello/rest/)
