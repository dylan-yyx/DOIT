import { createServer } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'

// Historical examples are explicit regression fixtures, never first-launch content.
export async function legacyFixture() {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  try {
    const { createLegacySeed } = await server.ssrLoadModule('/src/core/legacy-examples.ts')
    const data = createLegacySeed()
    data.preferences.exampleCleanupDone = true
    return data
  } finally {
    await server.close()
  }
}
export async function writeLegacyFixture(directory) {
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'data.json'), JSON.stringify(await legacyFixture()))
}
