const fs = require('node:fs')
const path = require('node:path')

const serverUrl = process.env.CLOUD_SELLER_SERVER_URL
if (!serverUrl) {
  throw new Error('Defina CLOUD_SELLER_SERVER_URL antes de gerar o instalador.')
}

const parsed = new URL(serverUrl)
if (!['https:', 'http:'].includes(parsed.protocol)) {
  throw new Error('CLOUD_SELLER_SERVER_URL precisa usar HTTPS (ou HTTP para localhost).')
}
if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
  throw new Error('Instaladores de produção exigem HTTPS.')
}

fs.writeFileSync(
  path.join(__dirname, 'app-config.json'),
  JSON.stringify({ serverUrl: parsed.origin }, null, 2),
)
