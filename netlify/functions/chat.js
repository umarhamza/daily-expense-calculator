export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonRes(405, { error: 'Method not allowed' })
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const message = String(body.question || body.message || '').trim()
    if (!message) return jsonRes(400, { error: 'Message is required' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      const reply = getSimpleReply(message)
      return jsonRes(200, { answer: reply, usedGemini: false })
    }

    const res = await callGemini(apiKey, message)
    if (res.ok) return jsonRes(200, { answer: res.text, usedGemini: true })

    // Fallback to a simple reply when Gemini fails
    const reply = getSimpleReply(message)
    return jsonRes(200, { answer: reply, usedGemini: false })
  } catch (err) {
    return jsonRes(500, { error: err?.message || 'Unexpected error' })
  }
}

function jsonRes(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(obj),
  }
}

/**
 * Minimal rule-based reply.
 * Inputs: user message string.
 * Returns: short response string.
 */
function getSimpleReply(message) {
  const s = message.toLowerCase()
  if (/^(hi|hello|hey)\b/.test(s)) return 'Hi! How can I help?'
  if (/help|how to|what can you do/.test(s)) return 'I am a simple chatbot. Ask me anything.'
  if (/thanks|thank you/.test(s)) return "You're welcome!"
  if (/bye|goodbye|see you/.test(s)) return 'Goodbye!'
  return `You said: ${message}`
}

/**
 * Calls Gemini with a simple assistant prompt.
 * Inputs: apiKey string, user message string.
 * Returns: { ok: boolean, text?: string, error?: string }.
 */
async function callGemini(apiKey, message) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`
    const system = 'You are a helpful, concise assistant.'
    const prompt = [system, '', String(message || '')].join('\n')
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [ { role: 'user', parts: [ { text: prompt } ] } ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return { ok: false, error: `Gemini error ${resp.status}: ${text}` }
    }
    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return { ok: true, text: text || 'Sorry, I could not generate a response.' }
  } catch (e) {
    return { ok: false, error: e?.message || 'Gemini call failed' }
  }
}

