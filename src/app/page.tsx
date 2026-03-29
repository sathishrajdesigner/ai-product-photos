'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

type Tab = 'edit' | 'frames' | 'size' | 'ai'

interface Adj { brightness: number; contrast: number; saturation: number; warmth: number }
interface SizeCfg { width: string; height: string; depth: string; productName: string; arrowColor: string }

const FRAMES = [
  { id: 'f1', label: 'Front view', hint: 'White studio', bg: '#ffffff', dark: false },
  { id: 'f2', label: '3/4 Angle', hint: 'Warm neutral', bg: '#f0ede8', dark: false },
  { id: 'f3', label: 'Detail shot', hint: 'Dark & moody', bg: '#18181b', dark: true },
]

const NAV = [
  { id: 'edit', label: 'Edit', icon: (a: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#111110' : '#999994'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )},
  { id: 'frames', label: 'Frames', icon: (a: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#111110' : '#999994'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { id: 'size', label: 'Size', icon: (a: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#111110' : '#999994'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 6H3M21 12H3M21 18H3"/><path d="M8 3l-5 3 5 3M16 15l5 3-5 3"/>
    </svg>
  )},
  { id: 'ai', label: 'AI Tips', icon: (a: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#111110' : '#999994'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
    </svg>
  )},
]

export default function ProductStudio() {
  const [tab, setTab] = useState<Tab>('edit')
  const [origImg, setOrigImg] = useState<HTMLImageElement | null>(null)
  const [adj, setAdj] = useState<Adj>({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 })
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [scale, setScale] = useState(72)
  const [posX, setPosX] = useState(0)
  const [posY, setPosY] = useState(0)
  const [sizeCfg, setSizeCfg] = useState<SizeCfg>({ width: '12 cm', height: '18 cm', depth: '6 cm', productName: 'Product', arrowColor: '#1d4ed8' })
  const [toast, setToast] = useState('')
  // original upload base64 (for Gemini API)
  const [uploadedB64, setUploadedB64] = useState('')
  const [uploadedMime, setUploadedMime] = useState('image/jpeg')

  // AI Studio — reference images
  type RefImg = { b64: string; mime: string; url: string }
  const [bgRef,      setBgRef]      = useState<RefImg | null>(null)
  const [measureRef, setMeasureRef] = useState<RefImg | null>(null)
  const [logoRef,    setLogoRef]    = useState<RefImg | null>(null)
  const [stickerRef, setStickerRef] = useState<RefImg | null>(null)
  // AI Studio — dimensions
  const [dimHeight, setDimHeight] = useState('')
  const [dimWidth,  setDimWidth]  = useState('')
  const [dimWeight, setDimWeight] = useState('')
  // AI Studio — generation state
  type StepStatus = 'idle' | 'running' | 'done' | 'error'
  const [aiRunning, setAiRunning] = useState(false)
  const [aiSteps,   setAiSteps]   = useState<Record<string, StepStatus>>({
    front: 'idle', left: 'idle', angle: 'idle', dimensions: 'idle',
  })
  const [aiResults, setAiResults] = useState<Record<string, string>>({})
  const [aiErrors,  setAiErrors]  = useState<Record<string, string>>({})

  const editRef = useRef<HTMLCanvasElement>(null)
  const frameRefs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)]
  const sizeRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const applyFilters = useCallback((canvas: HTMLCanvasElement, src: HTMLImageElement, a: Adj, rot: number, fH: boolean) => {
    const ctx = canvas.getContext('2d')!
    let cw = src.width, ch = src.height
    if (rot % 180 !== 0) [cw, ch] = [ch, cw]
    canvas.width = cw; canvas.height = ch
    ctx.save()
    ctx.translate(cw / 2, ch / 2)
    ctx.rotate((rot * Math.PI) / 180)
    if (fH) ctx.scale(-1, 1)
    ctx.drawImage(src, -src.width / 2, -src.height / 2)
    ctx.restore()
    const d = ctx.getImageData(0, 0, cw, ch); const px = d.data
    const cf = (259 * (a.contrast + 255)) / (255 * (259 - a.contrast))
    const sf = (a.saturation + 100) / 100
    for (let i = 0; i < px.length; i += 4) {
      let r = px[i], g = px[i + 1], b = px[i + 2]
      r = Math.min(255, Math.max(0, r + a.brightness))
      g = Math.min(255, Math.max(0, g + a.brightness))
      b = Math.min(255, Math.max(0, b + a.brightness))
      r = Math.min(255, Math.max(0, cf * (r - 128) + 128))
      g = Math.min(255, Math.max(0, cf * (g - 128) + 128))
      b = Math.min(255, Math.max(0, cf * (b - 128) + 128))
      const gr = 0.299 * r + 0.587 * g + 0.114 * b
      r = Math.min(255, Math.max(0, gr + sf * (r - gr)))
      g = Math.min(255, Math.max(0, gr + sf * (g - gr)))
      b = Math.min(255, Math.max(0, gr + sf * (b - gr)))
      r = Math.min(255, Math.max(0, r + a.warmth))
      b = Math.min(255, Math.max(0, b - a.warmth))
      px[i] = r; px[i + 1] = g; px[i + 2] = b
    }
    ctx.putImageData(d, 0, 0)
  }, [])

  const drawEdit = useCallback(() => {
    if (!editRef.current || !origImg) return
    applyFilters(editRef.current, origImg, adj, rotation, flipH)
  }, [origImg, adj, rotation, flipH, applyFilters])

  const drawFrame = useCallback((idx: number) => {
    const c = frameRefs[idx]?.current
    const ec = editRef.current
    if (!c || !ec || !origImg) return
    const W = 800, H = 800
    c.width = W; c.height = H
    const ctx = c.getContext('2d')!
    const cfg = FRAMES[idx]
    ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H)
    const iw = ec.width, ih = ec.height
    const fit = Math.min((W * scale / 100) / iw, (H * scale / 100) / ih)
    const dw = iw * fit, dh = ih * fit
    ctx.save()
    ctx.translate(W / 2 + posX, H / 2 + posY)
    if (idx === 1) ctx.transform(1, 0, -0.1, 1, 0, 0)
    if (idx === 2) {
      const cr = Math.min(dw, dh) * 0.5
      ctx.beginPath(); ctx.arc(0, 0, cr, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(ec, -dw * 0.25, -dh * 0.25, dw * 1.25, dh * 1.25)
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '500 18px DM Sans,sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('DETAIL VIEW', W / 2, H - 28)
      return
    }
    ctx.drawImage(ec, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
    ctx.fillStyle = cfg.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'
    ctx.font = '500 16px DM Sans,sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(['FRONT VIEW', '3/4 ANGLE', 'DETAIL VIEW'][idx], W / 2, H - 24)
  }, [origImg, editRef, scale, posX, posY])

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string) => {
    const hl = 10, ang = Math.atan2(y2 - y1, x2 - x1)
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ;[0, 1].forEach(e => {
      const ex = e ? x2 : x1, ey = e ? y2 : y1, d = e ? ang : ang + Math.PI
      ctx.beginPath(); ctx.moveTo(ex, ey)
      ctx.lineTo(ex - hl * Math.cos(d - Math.PI / 7), ey - hl * Math.sin(d - Math.PI / 7))
      ctx.lineTo(ex - hl * Math.cos(d + Math.PI / 7), ey - hl * Math.sin(d + Math.PI / 7))
      ctx.closePath(); ctx.fill()
    })
  }

  const drawSize = useCallback(() => {
    const c = sizeRef.current, ec = editRef.current
    if (!c || !ec || !origImg) return
    const W = 800, H = 800
    c.width = W; c.height = H
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#f8f7ff'; ctx.fillRect(0, 0, W, H)
    const iw = ec.width, ih = ec.height
    const fit = Math.min((W * 0.5) / iw, (H * 0.52) / ih)
    const dw = iw * fit, dh = ih * fit
    const x0 = W / 2 - dw / 2, y0 = H / 2 - dh / 2
    ctx.drawImage(ec, x0, y0, dw, dh)
    const ac = sizeCfg.arrowColor, g = 14
    drawArrow(ctx, x0, y0 + dh + g + 16, x0 + dw, y0 + dh + g + 16, ac)
    ctx.fillStyle = ac; ctx.font = 'bold 16px DM Sans,sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(sizeCfg.width, x0 + dw / 2, y0 + dh + g + 36)
    drawArrow(ctx, x0 - g - 16, y0, x0 - g - 16, y0 + dh, ac)
    ctx.save(); ctx.translate(x0 - g - 34, y0 + dh / 2); ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = ac; ctx.font = 'bold 16px DM Sans,sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(sizeCfg.height, 0, 0); ctx.restore()
    if (sizeCfg.depth) {
      drawArrow(ctx, x0 + dw + g + 16, y0, x0 + dw + g + 16, y0 + dh, ac)
      ctx.save(); ctx.translate(x0 + dw + g + 36, y0 + dh / 2); ctx.rotate(Math.PI / 2)
      ctx.fillStyle = ac; ctx.font = 'bold 16px DM Sans,sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(sizeCfg.depth, 0, 0); ctx.restore()
    }
    ctx.fillStyle = ac; ctx.fillRect(0, 0, W, 36)
    ctx.fillStyle = '#fff'; ctx.font = '600 14px DM Sans,sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(sizeCfg.productName.toUpperCase() + '  —  DIMENSIONS', 20, 23)
  }, [origImg, editRef, sizeCfg])

  useEffect(() => { drawEdit() }, [drawEdit])
  useEffect(() => {
    if (!origImg) return
    frameRefs.forEach((_, i) => drawFrame(i))
    drawSize()
  }, [origImg, adj, rotation, flipH, scale, posX, posY, sizeCfg, tab])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      const dataUrl = ev.target?.result as string
      const img = new Image()
      img.onload = () => { setOrigImg(img); setAdj({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 }); setRotation(0); setFlipH(false) }
      img.src = dataUrl
      setUploadedB64(dataUrl.split(',')[1])
      setUploadedMime(f.type || 'image/jpeg')
      // reset AI results when new image loaded
      setAiResults({}); setAiSteps({ front: 'idle', left: 'idle', angle: 'idle', dimensions: 'idle' })
      setBgRef(null); setMeasureRef(null); setLogoRef(null); setStickerRef(null)
    }
    r.readAsDataURL(f)
  }

  async function runAiStudio() {
    if (!uploadedB64) return
    setAiRunning(true)
    setAiResults({})
    setAiErrors({})
    setAiSteps({ front: 'idle', left: 'idle', angle: 'idle', dimensions: 'idle' })

    const call = async (body: object) => {
      const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return res.json()
    }

    const productImage = { b64: uploadedB64, mime: uploadedMime }
    const backgroundImage = bgRef      ? { b64: bgRef.b64,      mime: bgRef.mime }      : null
    const logoImage       = logoRef    ? { b64: logoRef.b64,    mime: logoRef.mime }    : null
    const stickerImage    = stickerRef ? { b64: stickerRef.b64, mime: stickerRef.mime } : null
    const measurementImage = measureRef ? { b64: measureRef.b64, mime: measureRef.mime } : null

    const base = { type: 'generate-product-image', productImage, backgroundImage, logoImage, stickerImage, measurementImage, height: dimHeight, width: dimWidth }

    // All 4 images in parallel for speed
    const imageTypes = ['front', 'left', 'angle', 'dimensions'] as const
    setAiSteps({ front: 'running', left: 'running', angle: 'running', dimensions: 'running' })

    await Promise.all(
      imageTypes.map(async (imageType) => {
        try {
          const d = await call({ ...base, imageType })
          if (d.imageBase64) {
            setAiResults(r => ({ ...r, [imageType]: `data:${d.mimeType};base64,${d.imageBase64}` }))
            setAiSteps(s => ({ ...s, [imageType]: 'done' }))
          } else {
            setAiErrors(e => ({ ...e, [imageType]: d.error || 'No image returned' }))
            setAiSteps(s => ({ ...s, [imageType]: 'error' }))
          }
        } catch (err) {
          setAiErrors(e => ({ ...e, [imageType]: String(err) }))
          setAiSteps(s => ({ ...s, [imageType]: 'error' }))
        }
      })
    )

    setAiRunning(false)
  }

  function readRefImage(file: File, setter: (r: { b64: string; mime: string; url: string }) => void) {
    const r = new FileReader()
    r.onload = ev => {
      const dataUrl = ev.target?.result as string
      setter({ b64: dataUrl.split(',')[1], mime: file.type || 'image/jpeg', url: dataUrl })
    }
    r.readAsDataURL(file)
  }

  function dlCanvas(c: HTMLCanvasElement | null, name: string) {
    if (!c) return
    const a = document.createElement('a'); a.download = name + '.png'; a.href = c.toDataURL('image/png'); a.click()
    showToast('Saved: ' + name)
  }

  function dlDataUrl(dataUrl: string, name: string) {
    const a = document.createElement('a'); a.download = name + '.png'; a.href = dataUrl; a.click()
    showToast('Saved: ' + name)
  }

  function exportAll() {
    const items = [
      { ref: frameRefs[0].current, name: 'front-view' },
      { ref: frameRefs[1].current, name: 'angle-view' },
      { ref: frameRefs[2].current, name: 'detail-view' },
      { ref: sizeRef.current, name: 'size-diagram' },
    ]
    items.forEach(({ ref, name }, i) => setTimeout(() => dlCanvas(ref, `happyfount-${name}`), i * 400))
    showToast('Exporting all 4 frames...')
  }

  const Slider = ({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) => (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)', minWidth: 32, textAlign: 'right' }}>{value > 0 ? '+' : ''}{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} step={1} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="section-label mb-3 mt-1">{children}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--surface)' }}>

      {/* Header */}
      <header style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top)', flexShrink: 0, zIndex: 10 }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'var(--black)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>IYD</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>Product Studio</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>Happy Fount Kitchen Wares</div>
            </div>
          </div>
          {origImg && (
            <button onClick={exportAll} className="ripple"
              style={{ background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export
            </button>
          )}
        </div>
      </header>

      {/* Main scrollable content */}
      <main className="scrollable" style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>

        {/* No image — upload screen */}
        {!origImg && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
            <div style={{ width: 80, height: 80, border: '2px dashed var(--border)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: 'var(--white)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 500, marginBottom: 8, textAlign: 'center' }}>Upload a product image</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28, maxWidth: 280 }}>PNG, JPG or WEBP. Edit, create 3 pose frames, add size diagram and get AI tips.</div>
            <button onClick={() => fileRef.current?.click()} className="ripple"
              style={{ background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 16, padding: '16px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', maxWidth: 280 }}>
              Choose from gallery
            </button>
            <button onClick={() => cameraRef.current?.click()} className="ripple"
              style={{ background: 'transparent', color: 'var(--black)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer', width: '100%', maxWidth: 280, marginTop: 12 }}>
              Take a photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* EDIT TAB */}
        {origImg && (
          <div style={{ display: tab === 'edit' ? 'block' : 'none', padding: 16 }} className="slide-up">
            {/* Canvas preview */}
            <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ background: '#f0f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 240 }}>
                <canvas ref={editRef} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => fileRef.current?.click()} className="ripple"
                  style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 500, background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}>
                  Change image
                </button>
                <button onClick={() => dlCanvas(editRef.current, 'happyfount-edited')} className="ripple"
                  style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 500, background: 'transparent', cursor: 'pointer', color: 'var(--black)' }}>
                  Save edited
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

            {/* Adjustments */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <SectionLabel>Light & color</SectionLabel>
              <Slider label="Brightness" min={-100} max={100} value={adj.brightness} onChange={v => setAdj(a => ({ ...a, brightness: v }))} />
              <Slider label="Contrast" min={-100} max={100} value={adj.contrast} onChange={v => setAdj(a => ({ ...a, contrast: v }))} />
              <Slider label="Saturation" min={-100} max={100} value={adj.saturation} onChange={v => setAdj(a => ({ ...a, saturation: v }))} />
              <Slider label="Warmth" min={-50} max={50} value={adj.warmth} onChange={v => setAdj(a => ({ ...a, warmth: v }))} />
              <button onClick={() => setAdj({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 })} className="ripple"
                style={{ width: '100%', padding: '12px 0', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', background: 'transparent', cursor: 'pointer', marginTop: 4 }}>
                Reset all adjustments
              </button>
            </div>

            {/* Transform */}
            <div className="card" style={{ padding: 16 }}>
              <SectionLabel>Transform</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: '↺ Rotate left', action: () => setRotation(r => (r - 90 + 360) % 360) },
                  { label: '↻ Rotate right', action: () => setRotation(r => (r + 90) % 360) },
                  { label: '⇄ Flip H', action: () => setFlipH(f => !f) },
                  { label: 'Reset flip', action: () => { setFlipH(false); setRotation(0) } },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.action} className="ripple"
                    style={{ padding: '14px 0', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 500, background: 'transparent', cursor: 'pointer', color: 'var(--black)' }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FRAMES TAB */}
        {origImg && (
          <div style={{ display: tab === 'frames' ? 'block' : 'none', padding: 16 }} className="slide-up">
            {/* Frame position controls */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <SectionLabel>Frame settings</SectionLabel>
              <Slider label="Product scale" min={20} max={120} value={scale} onChange={setScale} />
              <Slider label="Horizontal" min={-120} max={120} value={posX} onChange={setPosX} />
              <Slider label="Vertical" min={-120} max={120} value={posY} onChange={setPosY} />
            </div>

            {/* 3 frames */}
            {FRAMES.map((cfg, i) => (
              <div key={cfg.id} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{cfg.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{cfg.hint}</div>
                  </div>
                  <button onClick={() => dlCanvas(frameRefs[i].current, `happyfount-${cfg.id}`)} className="ripple"
                    style={{ background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Save
                  </button>
                </div>
                <div style={{ background: cfg.bg, padding: 12, display: 'flex', justifyContent: 'center' }}>
                  <canvas ref={frameRefs[i]} style={{ width: '100%', maxWidth: 340, borderRadius: 6, aspectRatio: '1/1' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SIZE TAB */}
        {origImg && (
          <div style={{ display: tab === 'size' ? 'block' : 'none', padding: 16 }} className="slide-up">
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <SectionLabel>Product details</SectionLabel>
              {[
                { key: 'productName', label: 'Product name' },
                { key: 'width', label: 'Width (e.g. 12 cm)' },
                { key: 'height', label: 'Height (e.g. 18 cm)' },
                { key: 'depth', label: 'Depth / length (optional)' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>{f.label}</label>
                  <input type="text"
                    value={sizeCfg[f.key as keyof SizeCfg]}
                    onChange={e => setSizeCfg(s => ({ ...s, [f.key]: e.target.value }))}
                    style={{ width: '100%', fontSize: 15, padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--white)', color: 'var(--black)' }} />
                </div>
              ))}
              <div style={{ marginBottom: 4 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>Arrow color</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['#1d4ed8', '#111110', '#dc2626', '#16a34a', '#9333ea'].map(c => (
                    <button key={c} onClick={() => setSizeCfg(s => ({ ...s, arrowColor: c }))}
                      style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: sizeCfg.arrowColor === c ? '3px solid var(--black)' : '3px solid transparent', outline: sizeCfg.arrowColor === c ? '2px solid var(--white)' : 'none', cursor: 'pointer', transition: 'transform 0.1s', transform: sizeCfg.arrowColor === c ? 'scale(1.15)' : 'scale(1)' }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Size canvas preview */}
            <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Size diagram preview</div>
                <button onClick={() => dlCanvas(sizeRef.current, 'happyfount-size-diagram')} className="ripple"
                  style={{ background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  Save
                </button>
              </div>
              <div style={{ background: '#f8f7ff', padding: 12, display: 'flex', justifyContent: 'center' }}>
                <canvas ref={sizeRef} style={{ width: '100%', maxWidth: 340, borderRadius: 6, aspectRatio: '1/1' }} />
              </div>
            </div>
          </div>
        )}

        {/* AI STUDIO TAB */}
        {tab === 'ai' && (
          <div style={{ padding: 16 }} className="slide-up">

            {/* Header */}
            <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc05,#ea4335)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>AI Product Studio</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Powered by Google Gemini · Generates 4 e-commerce images</div>
              </div>
            </div>

            {/* Step 1 — Product image */}
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <SectionLabel>Step 1 — Product Image *</SectionLabel>
              {origImg ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)', flexShrink: 0, background: '#f0f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploadedB64
                      ? <img src={`data:${uploadedMime};base64,${uploadedB64}`} alt="product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Product image ready</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>From Edit tab</div>
                  </div>
                  <button onClick={() => setTab('edit')} style={{ fontSize: 12, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Change</button>
                </div>
              ) : (
                <button onClick={() => setTab('edit')} className="ripple"
                  style={{ width: '100%', padding: '12px 0', background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Upload product image in Edit tab →
                </button>
              )}
            </div>

            {/* Step 2 — Reference images */}
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <SectionLabel>Step 2 — Reference Images</SectionLabel>
              {([
                { label: 'Background Reference', state: bgRef, setter: setBgRef },
                { label: 'Measurement Style Ref', state: measureRef, setter: setMeasureRef },
                { label: 'Brand Logo Ref', state: logoRef, setter: setLogoRef },
                { label: 'Sticker Ref', state: stickerRef, setter: setStickerRef },
              ] as { label: string; state: RefImg | null; setter: (r: RefImg) => void }[]).map((item) => (
                <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, border: '1.5px dashed var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {item.state
                      ? <img src={item.state.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.state ? 'Uploaded ✓' : 'Tap to upload'}</div>
                  </div>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) readRefImage(f, item.setter) }} />
                </label>
              ))}
            </div>

            {/* Step 3 — Dimensions */}
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <SectionLabel>Step 3 — Product Dimensions</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { label: 'Height *', val: dimHeight, set: setDimHeight, placeholder: 'e.g. 24 cm' },
                  { label: 'Width *',  val: dimWidth,  set: setDimWidth,  placeholder: 'e.g. 16 cm' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 5 }}>{f.label}</label>
                    <input type="text" value={f.val} placeholder={f.placeholder} onChange={e => f.set(e.target.value)}
                      style={{ width: '100%', fontSize: 14, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--white)', color: 'var(--black)', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 5 }}>Weight (optional)</label>
                <input type="text" value={dimWeight} placeholder="e.g. 1.2 kg" onChange={e => setDimWeight(e.target.value)}
                  style={{ width: '100%', fontSize: 14, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--white)', color: 'var(--black)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Generate button */}
            <button onClick={runAiStudio} disabled={aiRunning || !origImg} className="ripple"
              style={{ width: '100%', padding: '15px 0', background: (aiRunning || !origImg) ? '#888' : 'var(--black)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: (aiRunning || !origImg) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              {aiRunning && <div className="spinner" style={{ borderTopColor: '#fff' }} />}
              {aiRunning ? 'Generating with Gemini...' : '✨ Generate 4 Product Images'}
            </button>

            {/* Progress */}
            {(aiRunning || Object.values(aiSteps).some(s => s !== 'idle')) && (() => {
              const steps = [
                { key: 'front',      label: 'Image 1 — Front View' },
                { key: 'left',       label: 'Image 2 — Left Side View' },
                { key: 'angle',      label: 'Image 3 — Right / 45° Angle' },
                { key: 'dimensions', label: 'Image 4 — Dimensions View' },
              ]
              const icon = (s: StepStatus) =>
                s === 'done'    ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 14 }}>✓</span>
                : s === 'error'  ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>✗</span>
                : s === 'running'? <div className="spinner" style={{ width: 13, height: 13, borderWidth: 2, flexShrink: 0 }} />
                : <span style={{ color: '#ccc', fontSize: 12 }}>○</span>
              return (
                <div className="card" style={{ padding: 14, marginBottom: 14 }}>
                  <SectionLabel>Generating</SectionLabel>
                  {steps.map((st, i) => (
                    <div key={st.key} style={{ padding: '9px 0', borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>{icon(aiSteps[st.key])}</div>
                        <div style={{ fontSize: 13, color: aiSteps[st.key] === 'running' ? 'var(--black)' : aiSteps[st.key] === 'done' ? 'var(--black)' : 'var(--muted)', fontWeight: aiSteps[st.key] === 'running' ? 600 : 400 }}>{st.label}</div>
                      </div>
                      {aiSteps[st.key] === 'error' && aiErrors[st.key] && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, marginLeft: 30, wordBreak: 'break-word' }}>{aiErrors[st.key]}</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Results */}
            {[
              { key: 'front',      label: 'Image 1 — Front View',         filename: 'product-front-view' },
              { key: 'left',       label: 'Image 2 — Left Side View',      filename: 'product-left-view' },
              { key: 'angle',      label: 'Image 3 — Right / 45° Angle',   filename: 'product-angle-view' },
              { key: 'dimensions', label: 'Image 4 — Dimensions View',     filename: 'product-dimensions' },
            ].filter(r => aiResults[r.key]).map(r => (
              <div key={r.key} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                  <button onClick={() => dlDataUrl(aiResults[r.key], r.filename)} className="ripple"
                    style={{ background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Save
                  </button>
                </div>
                <div style={{ background: '#f0f0ee', display: 'flex', justifyContent: 'center', padding: 10 }}>
                  <img src={aiResults[r.key]} alt={r.label}
                    style={{ maxWidth: '100%', maxHeight: 340, borderRadius: 8, objectFit: 'contain' }} />
                </div>
              </div>
            ))}

          </div>
        )}

        {/* No image but on non-edit tab */}
        {!origImg && tab !== 'edit' && (
          <div style={{ padding: 24, textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Upload a product image first in the Edit tab.</div>
            <button onClick={() => setTab('edit')} className="ripple"
              style={{ marginTop: 16, padding: '12px 24px', background: 'var(--black)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Go to Edit
            </button>
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav style={{ background: 'var(--white)', borderTop: '1px solid var(--border)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', height: 56 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id as Tab)} className="ripple"
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0' }}>
              {n.icon(tab === n.id)}
              <span style={{ fontSize: 10, fontWeight: tab === n.id ? 600 : 400, color: tab === n.id ? 'var(--black)' : 'var(--muted)', letterSpacing: 0.2 }}>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Toast notification */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'var(--black)', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
