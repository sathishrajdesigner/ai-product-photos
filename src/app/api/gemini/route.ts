import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_IMAGE_GEN = 'gemini-2.0-flash-preview-image-generation'

type ImagePart = { inlineData: { mimeType: string; data: string } }
type TextPart  = { text: string }
type Part = ImagePart | TextPart

const PROMPTS: Record<string, (h: string, w: string) => string> = {
  front: () => `
You are a professional e-commerce product photographer. Your task is STRICTLY to re-photograph the product shown in IMAGE 1 (product reference).

CRITICAL RULES — NO EXCEPTIONS:
- The product must be 100% IDENTICAL to IMAGE 1. Same shape, proportions, color, texture, finish, branding, logo, and stickers.
- Do NOT redesign, recreate, or modify the product in ANY way.
- Do NOT hallucinate or approximate details not visible. Preserve what is shown exactly.
- Only remove obvious defects (dust, rust, scratches) without altering the product material or finish.

BACKGROUND:
- Use EXACTLY the background from IMAGE 2 (background reference). Same gradient, tone, color, shadows, and lighting.
- Do NOT create a new background or modify the reference background.

LOGO & STICKER (IMAGE 3 — if provided):
- Preserve the exact logo and sticker from IMAGE 3 on the product. Same size, placement, color, and design.

OUTPUT — IMAGE 1 (FRONT VIEW):
- Straight front-facing view, product centered and perfectly aligned
- Match background, lighting, shadows, and tone exactly from IMAGE 2
- Ultra high resolution, sharp edges, no blur, no distortion
- Premium e-commerce catalog style (Amazon/Flipkart level)
- Clean, minimal, professional`,

  left: () => `
You are a professional e-commerce product photographer. Your task is STRICTLY to re-photograph the product shown in IMAGE 1 (product reference).

CRITICAL RULES — NO EXCEPTIONS:
- The product must be 100% IDENTICAL to IMAGE 1. Same shape, proportions, color, texture, finish, branding, logo, and stickers.
- Do NOT redesign, recreate, or modify the product in ANY way.
- Only remove obvious defects (dust, rust, scratches) without altering the product material or finish.

BACKGROUND:
- Use EXACTLY the background from IMAGE 2. Same gradient, tone, color, shadows, and lighting.

LOGO & STICKER (IMAGE 3 — if provided):
- Preserve the exact logo and sticker from IMAGE 3 on the product.

OUTPUT — IMAGE 2 (LEFT SIDE VIEW):
- Left profile view of the product
- Maintain exact proportions from IMAGE 1
- Same background, lighting consistency, and shadows as IMAGE 2 reference
- Ultra high resolution, sharp edges, no blur
- Premium e-commerce catalog style`,

  angle: () => `
You are a professional e-commerce product photographer. Your task is STRICTLY to re-photograph the product shown in IMAGE 1 (product reference).

CRITICAL RULES — NO EXCEPTIONS:
- The product must be 100% IDENTICAL to IMAGE 1. Same shape, proportions, color, texture, finish, branding, logo, and stickers.
- Do NOT redesign, recreate, or modify the product in ANY way.
- Only remove obvious defects (dust, rust, scratches) without altering the product material or finish.

BACKGROUND:
- Use EXACTLY the background from IMAGE 2. Same gradient, tone, color, shadows, and lighting.

LOGO & STICKER (IMAGE 3 — if provided):
- Preserve the exact logo and sticker from IMAGE 3 on the product.

OUTPUT — IMAGE 3 (RIGHT / 45° ANGLE VIEW):
- Slight right-angled perspective (approximately 45°)
- Preserve exact geometry and proportions
- Same background, lighting consistency, and shadows as IMAGE 2 reference
- Ultra high resolution, sharp edges, no blur
- Premium e-commerce catalog style`,

  dimensions: (h, w) => `
You are a professional e-commerce product photographer and graphic designer. Your task is to create a product dimensions image.

CRITICAL RULES — NO EXCEPTIONS:
- The product must be 100% IDENTICAL to IMAGE 1 (product reference). Same shape, proportions, color, texture, finish, branding, and stickers.
- Do NOT redesign, recreate, or modify the product in ANY way.

BACKGROUND:
- Use EXACTLY the background from IMAGE 2. Same gradient, tone, color, and lighting.

MEASUREMENT STYLE:
- Use EXACTLY the arrow style, font style, spacing, and layout shown in IMAGE 3 (measurement reference).
- Do NOT create a new measurement style — replicate it precisely.

OUTPUT — IMAGE 4 (DIMENSIONS VIEW):
- Display the product front-facing, centered
- Show HEIGHT = ${h} clearly labeled with arrows
- Show WIDTH = ${w} clearly labeled with arrows
- Use the EXACT measurement arrow style, font, and layout from IMAGE 3 reference
- Do NOT overlap arrows with key product features, logo, or sticker
- Measurement labels must be clean, readable, and precisely placed
- Same background and lighting as IMAGE 2
- Ultra high resolution, sharp edges, premium e-commerce catalog style`,
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set in .env.local' }, { status: 500 })
  }

  const {
    type,
    // legacy single-image operations
    imageBase64, mediaType, poseType,
    // new multi-reference product generation
    productImage, backgroundImage, logoImage, stickerImage, measurementImage,
    height, width,
    imageType,
  } = await req.json()

  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    // ── New: multi-reference product image generation ──────────────────
    if (type === 'generate-product-image') {
      if (!productImage?.b64) {
        return NextResponse.json({ error: 'productImage is required' }, { status: 400 })
      }

      const parts: Part[] = []

      // IMAGE 1 — product reference
      parts.push({ inlineData: { mimeType: productImage.mime || 'image/jpeg', data: productImage.b64 } })
      parts.push({ text: 'IMAGE 1: This is the PRODUCT REFERENCE. Preserve this product 100% exactly.' })

      // IMAGE 2 — background reference
      if (backgroundImage?.b64) {
        parts.push({ inlineData: { mimeType: backgroundImage.mime || 'image/jpeg', data: backgroundImage.b64 } })
        parts.push({ text: 'IMAGE 2: This is the BACKGROUND REFERENCE. Use this exact background, gradient, tone, and lighting.' })
      } else {
        parts.push({ text: 'IMAGE 2: No background reference provided. Use a clean white studio background.' })
      }

      // IMAGE 3 — brand logo reference
      if (logoImage?.b64) {
        parts.push({ inlineData: { mimeType: logoImage.mime || 'image/jpeg', data: logoImage.b64 } })
        parts.push({ text: 'IMAGE 3: This is the BRAND LOGO REFERENCE. Preserve this exact logo on the product — same size, position, color, and clarity. Do NOT modify it.' })
      }

      // IMAGE 4 — sticker reference
      if (stickerImage?.b64) {
        parts.push({ inlineData: { mimeType: stickerImage.mime || 'image/jpeg', data: stickerImage.b64 } })
        parts.push({ text: 'IMAGE 4: This is the STICKER REFERENCE. Preserve this exact sticker on the product — same design, position, color, and clarity. Do NOT modify it.' })
      }

      // IMAGE 5 — measurement style (for dimensions image only)
      if (imageType === 'dimensions' && measurementImage?.b64) {
        parts.push({ inlineData: { mimeType: measurementImage.mime || 'image/jpeg', data: measurementImage.b64 } })
        parts.push({ text: 'IMAGE 5: This is the MEASUREMENT STYLE REFERENCE. Replicate this exact arrow style, font, spacing, and layout for the dimension annotations.' })
      }

      // Main generation prompt
      const promptFn = PROMPTS[imageType as keyof typeof PROMPTS]
      if (!promptFn) {
        return NextResponse.json({ error: 'Invalid imageType' }, { status: 400 })
      }
      parts.push({ text: promptFn(height || '', width || '') })

      const model = genAI.getGenerativeModel({ model: MODEL_IMAGE_GEN })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as never,
      })

      for (const part of result.response.candidates?.[0]?.content?.parts ?? []) {
        const p = part as { inlineData?: { data: string; mimeType: string } }
        if (p.inlineData) {
          return NextResponse.json({ imageBase64: p.inlineData.data, mimeType: p.inlineData.mimeType })
        }
      }
      return NextResponse.json({ error: 'No image returned by Gemini' }, { status: 500 })
    }

    // ── Legacy: single-image operations (kept for backward compat) ─────
    if (type === 'remove-bg' || type === 'generate-pose' || type === 'fix-defects') {
      const legacyPrompts: Record<string, string> = {
        'remove-bg': 'Remove the background from this product image. Place the product on a pure white (#ffffff) background. Keep the product itself completely unchanged.',
        'front':  'Professional front-facing product shot on pure white studio background, soft even lighting, product perfectly centered.',
        'angle':  'Professional 3/4 angle product shot on warm neutral beige background, natural warm lighting.',
        'detail': 'Dramatic close-up shot on pure black background, focused spotlight on the most interesting texture or detail.',
      }

      if (type === 'fix-defects') {
        const { GoogleGenerativeAI: G } = await import('@google/generative-ai')
        const g2 = new G(apiKey)
        const vision = g2.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const analysis = await vision.generateContent({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: mediaType, data: imageBase64 } },
            { text: 'Analyze this product image for defects (scratches, dents, dust, blur, bad lighting, color issues). List each issue on a new line as "[TYPE]: description". If perfect, write "NO DEFECTS FOUND". Plain text only.' },
          ]}],
        })
        const defectReport = analysis.response.text()

        const fixModel = g2.getGenerativeModel({ model: MODEL_IMAGE_GEN })
        const fixResult = await fixModel.generateContent({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: mediaType, data: imageBase64 } },
            { text: 'Fix and enhance this product image professionally: remove dust/scratches, correct lighting, fix color balance, sharpen slight blur. Keep the product authentic — do not change its shape or add features.' },
          ]}],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as never,
        })

        let fixedBase64 = '', fixedMime = ''
        for (const part of fixResult.response.candidates?.[0]?.content?.parts ?? []) {
          const p = part as { inlineData?: { data: string; mimeType: string } }
          if (p.inlineData) { fixedBase64 = p.inlineData.data; fixedMime = p.inlineData.mimeType }
        }
        return NextResponse.json({ defectReport, imageBase64: fixedBase64, mimeType: fixedMime })
      }

      const prompt = type === 'remove-bg' ? legacyPrompts['remove-bg'] : legacyPrompts[poseType] || ''
      const model = genAI.getGenerativeModel({ model: MODEL_IMAGE_GEN })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: mediaType, data: imageBase64 } },
          { text: prompt },
        ]}],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as never,
      })

      for (const part of result.response.candidates?.[0]?.content?.parts ?? []) {
        const p = part as { inlineData?: { data: string; mimeType: string } }
        if (p.inlineData) {
          return NextResponse.json({ imageBase64: p.inlineData.data, mimeType: p.inlineData.mimeType })
        }
      }
      return NextResponse.json({ error: 'No image returned by Gemini' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
