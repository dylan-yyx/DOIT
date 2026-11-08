const path = require('node:path')

function resolveDataDir({ override, packaged, installed, exeDir, appData, projectDir }) {
  if (override) return override
  if (!packaged) return path.join(projectDir, '.local-data')
  return installed ? path.join(appData, 'DOIT', 'data') : path.join(exeDir, 'data')
}

module.exports = { resolveDataDir }
