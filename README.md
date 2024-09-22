# Features
- Live audio streaming to an arbitrary number of users through WebRTC
- Live transcription running on client through a WASM'd version of (distilled) whisper when audio streaming
- Leverage LLM's to answer student questions (output is provided in a thread of the question)
  - Automatically find the part of the transcript a student's question is referring to
  - Automatically attempt to answer students question
  - Uses open-mixtral-8x7b
- Collaborative real-time whiteboard with media upload and panning ability
- Live messaging and reactions


 

### Dependencies

- npm (to install pnpm) https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
- pnpm (package manager)
  - `npm install -g pnpm`
- bun (runtime for backend service) https://bun.sh/docs/installation
- docker https://www.docker.com/get-started/

## Follow these steps in order

### Setting up db

1. `docker-compose -f docker-compose.dev.yaml up db --build`
2. `cd services/db`
3. `pnpm migrate:generate && pnpm migrate:run && pnpm seed:emoji`

### Setting up backend

1. `docker-compose -f docker-compose.dev.yaml up fireside --build`

### Running frontend

1. `cd frontend`
2. `pnpm install`
3. `pnpm run dev`

## Website Preview

![image](https://github.com/RobPruzan/fireside/assets/97781863/db8c08ce-8aba-4126-9424-55f14fcaf300)


