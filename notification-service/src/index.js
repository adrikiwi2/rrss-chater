const express = require('express')
const { spawn } = require('child_process')

const app = express()
app.use(express.json())

const SECRET = process.env.NOTIFY_SECRET
const GROUP_JID = process.env.WHATSAPP_GROUP_JID
const WACLI_STORE = process.env.WACLI_STORE || '/root/.wacli'
const PORT = process.env.PORT || 3000

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!SECRET || token !== SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

function runWacli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('wacli', ['--store', WACLI_STORE, ...args])
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { process.stdout.write(d); stdout += d })
    proc.stderr.on('data', d => { process.stderr.write(d); stderr += d })
    proc.on('close', code => {
      if (code !== 0) reject(new Error(stderr || `wacli exited with code ${code}`))
      else resolve(stdout)
    })
  })
}

// Health check
app.get('/health', (req, res) => res.json({ ok: true }))

// Iniciar auth — el QR aparece en los logs de Railway
app.post('/auth', auth, (req, res) => {
  res.json({ message: 'Auth iniciado — abre los logs de Railway y escanea el QR' })
  const proc = spawn('wacli', ['--store', WACLI_STORE, 'auth'], { stdio: 'inherit' })
  proc.on('close', code => console.log(`wacli auth terminó con código ${code}`))
})

// Enviar mensaje
app.post('/notify', auth, async (req, res) => {
  const { message, to } = req.body
  if (!message) return res.status(400).json({ error: 'message requerido' })

  const recipient = to || GROUP_JID
  if (!recipient) return res.status(400).json({ error: 'to o WHATSAPP_GROUP_JID requerido' })

  try {
    await runWacli(['send', 'text', '--to', recipient, '--message', message])
    console.log(`[notify] Mensaje enviado a ${recipient}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[notify] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Listar chats (útil para obtener el JID del grupo)
app.get('/chats', auth, async (req, res) => {
  const query = req.query.q || ''
  try {
    const args = ['chats', 'list', '--limit', '20', '--json']
    if (query) args.push('--query', query)
    const output = await runWacli(args)
    res.json(JSON.parse(output))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => console.log(`Notification service escuchando en puerto ${PORT}`))
