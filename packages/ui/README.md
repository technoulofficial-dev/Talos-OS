# Talos Mission Control

The Bronze-Punk themed Next.js 16 dashboard for Talos OS.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** with custom Bronze-Punk theme
- **React Flow** for task visualization
- **Framer Motion** for animations
- **Supabase Realtime** for live updates
- **Lucide React** for icons

## Design

- **Background**: Dark gunmetal (`#1a1a1a`) with subtle radial gradients
- **Accents**: Copper/bronze (`#b87333`, `#cd7f32`)
- **Glow**: Cyan runes (`#00e5ff`)
- **Borders**: Gear-motif corners
- **Effects**: CRT scanlines, flicker animations

## Pages

- **Dashboard** - System overview with agent grid and task flow
- **Agents** - Detailed agent management
- **Tasks** - Real-time task queue visualization
- **Memory** - User Cortex and Nornir memory browser
- **Blueprint** - Living Blueprint reconfiguration system

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Configure environment variables in `.env.local`

4. Run development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Build

```bash
npm run build
npm start
```