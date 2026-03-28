import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set in .env.local' }, { status: 500 })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: `You are a professional product photographer for kitchen and homeware brands. Analyze this product image.

PRODUCT: [identify in one line]

POSE 1 — FRONT VIEW:
Best background color and lighting for a clean product shot. 1-2 sentences.

POSE 2 — LIFESTYLE ANGLE:
A real-life context or 3/4 angle shot idea. 1-2 sentences.

POSE 3 — DETAIL CLOSE-UP:
What feature to zoom in on and how to frame it. 1-2 sentences.

SIZE DIAGRAM:
Which 2-3 dimensions matter most for this kitchen product? Brief tip.

TOP 3 BACKGROUNDS:
List 3 hex color codes with a 2-word label each. Format: #hexcode — Label

Plain text only. No asterisks, no markdown, no bullet symbols.`
            }
          ]
        }]
      })
    })
    const data = await response.json()
    const text = data.content?.filter((b: {type:string}) => b.type === 'text').map((b: {text:string}) => b.text).join('\n') || 'No analysis returned.'
    return NextResponse.json({ result: text })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
