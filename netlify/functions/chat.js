export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonRes(405, { error: 'Method not allowed' })
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const message = String(body.question || body.message || '').trim()
    if (!message) return jsonRes(400, { error: 'Message is required' })

    const reply = getSimpleReply(message)
    return jsonRes(200, { answer: reply })
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

