import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { Upload, Trash2, Eye, EyeOff, ArrowLeft, BookOpen } from 'lucide-react'
import { createSet } from '../../src/lib/actions/sets'
import type { OcclusionBox } from '../../lib/types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PageHeader } from '../components/page-header'
import { cn } from '../lib/cn'

export const Route = createFileRoute('/image-occlusion')({
  head: () => ({
    meta: [
      { title: 'Image Occlusion | Openlet' },
      {
        name: 'description',
        content:
          'Create flashcards from diagrams by masking labels. Study anatomy, maps, and more with image occlusion.',
      },
      { property: 'og:title', content: 'Image Occlusion | Openlet' },
      {
        property: 'og:description',
        content:
          'Create flashcards from diagrams by masking labels. Study anatomy, maps, and more with image occlusion.',
      },
      { name: 'twitter:title', content: 'Image Occlusion | Openlet' },
      {
        name: 'twitter:description',
        content:
          'Create flashcards from diagrams by masking labels. Study anatomy, maps, and more with image occlusion.',
      },
    ],
  }),
  beforeLoad: async () => {
    const { getSession } = await import('../../src/lib/auth/actions')
    const session = await getSession()
    if (!session) throw redirect({ to: '/signin' })
  },
  component: ImageOcclusionPage,
})

function ImageOcclusionPage() {
  const navigate = Route.useNavigate()
  const [image, setImage] = useState<string | null>(null)
  const [boxes, setBoxes] = useState<OcclusionBox[]>([])
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const [mode, setMode] = useState<'edit' | 'study'>('edit')
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set())
  const [setTitle, setSetTitle] = useState('Image occlusion')
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImage(ev.target?.result as string)
      setBoxes([])
      setSelectedBox(null)
    }
    reader.readAsDataURL(file)
  }

  function clampCoord(v: number): number {
    return Math.max(0, Math.min(100, v))
  }

  function getCanvasRect() {
    return canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (mode !== 'edit') return
    const rect = getCanvasRect()
    const x = clampCoord(((e.clientX - rect.left) / (rect.width || 1)) * 100)
    const y = clampCoord(((e.clientY - rect.top) / (rect.height || 1)) * 100)
    setDrawing(true)
    setStartPos({ x, y })
    setCurrentRect({ x, y, width: 0, height: 0 })
    setSelectedBox(null)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!drawing || !startPos) return
    const rect = getCanvasRect()
    const rawX = ((e.clientX - rect.left) / (rect.width || 1)) * 100
    const rawY = ((e.clientY - rect.top) / (rect.height || 1)) * 100
    setCurrentRect({
      x: clampCoord(Math.min(startPos.x, rawX)),
      y: clampCoord(Math.min(startPos.y, rawY)),
      width: clampCoord(Math.abs(rawX - startPos.x)),
      height: clampCoord(Math.abs(rawY - startPos.y)),
    })
  }

  function handleMouseUp() {
    if (!drawing || !currentRect) return
    setDrawing(false)
    if (currentRect.width < 1 || currentRect.height < 1) {
      setCurrentRect(null)
      return
    }
    const id = crypto.randomUUID()
    const label = `Label ${boxes.length + 1}`
    setBoxes((prev) => [...prev, { id, ...currentRect, label }])
    setSelectedBox(id)
    setLabelInput(label)
    setCurrentRect(null)
    setStartPos(null)
  }

  function updateBox(id: string, key: keyof OcclusionBox, value: string | number) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: value } : b)))
  }

  function deleteBox(id: string) {
    setBoxes((prev) => prev.filter((b) => b.id !== id))
    if (selectedBox === id) setSelectedBox(null)
  }

  function toggleHidden(id: string) {
    setHiddenSet((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function hideAll() {
    setHiddenSet(new Set(boxes.map((b) => b.id)))
  }

  async function saveAsSet() {
    if (boxes.length === 0) return
    try {
      const result = await createSet({
        data: {
          title: setTitle.trim() || 'Image occlusion',
          description: 'Generated from image occlusion',
          subject: '',
          cards: boxes.map((b, i) => ({
            term: b.label,
            definition: `Region ${i + 1} on diagram`,
          })),
        },
      })
      navigate({ to: '/set/$id', params: { id: result.id } })
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        back={
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Library
          </a>
        }
        title="Image occlusion"
        description="Mask labels on a diagram, then reveal them one by one"
      />

      {!image && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-6 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center transition-colors hover:border-primary/40"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            className="hidden"
          />
          <Upload className="size-7 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Upload a diagram</span>
          <span className="text-xs text-muted-foreground">
            Anatomy, maps, circuits. Anything with labels
          </span>
        </button>
      )}

      {image && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
              <button
                onClick={() => setMode('edit')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold',
                  mode === 'edit' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
                )}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setMode('study')
                  hideAll()
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold',
                  mode === 'study' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
                )}
              >
                Study
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {boxes.length > 0 && (
                <>
                  <Input
                    value={setTitle}
                    onChange={(e) => setSetTitle(e.target.value)}
                    className="h-9 w-40"
                    placeholder="Set title"
                  />
                  <Button size="sm" onClick={saveAsSet}>
                    <BookOpen className="size-3.5" /> Save as set
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setImage(null)
                  setBoxes([])
                }}
              >
                Remove image
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row">
            <div
              ref={canvasRef}
              className={cn(
                'relative flex-1 overflow-hidden rounded-xl border bg-card shadow-sm',
                mode === 'edit' ? 'border-border cursor-crosshair' : 'border-primary/20',
              )}
              style={{ aspectRatio: '4/3', maxHeight: '520px' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (drawing) {
                  setDrawing(false)
                  setCurrentRect(null)
                }
              }}
            >
              <img
                src={image}
                alt="Diagram"
                className="h-full w-full object-contain"
                draggable={false}
              />

              {boxes.map((box) => (
                <div
                  key={box.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (mode === 'edit') {
                      setSelectedBox(box.id)
                      setLabelInput(box.label)
                    } else {
                      toggleHidden(box.id)
                    }
                  }}
                  className={cn(
                    'absolute rounded border-2 transition-colors',
                    selectedBox === box.id && mode === 'edit' && 'border-primary bg-primary/15',
                    hiddenSet.has(box.id) && 'border-foreground/50 bg-foreground/80',
                    !hiddenSet.has(box.id) &&
                      selectedBox !== box.id &&
                      'border-foreground/25 bg-background/20 hover:bg-background/35',
                    mode === 'study' && 'cursor-pointer',
                  )}
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                  }}
                >
                  {hiddenSet.has(box.id) ? (
                    <span className="absolute inset-0 flex items-center justify-center text-background">
                      <EyeOff className="size-3.5" />
                    </span>
                  ) : (
                    <span className="absolute left-0.5 top-0.5 max-w-[95%] truncate rounded bg-background/90 px-1 text-[0.6rem] font-semibold text-foreground">
                      {box.label}
                    </span>
                  )}
                </div>
              ))}

              {currentRect && (
                <div
                  className="absolute border-2 border-primary/60 bg-primary/15"
                  style={{
                    left: `${currentRect.x}%`,
                    top: `${currentRect.y}%`,
                    width: `${currentRect.width}%`,
                    height: `${currentRect.height}%`,
                  }}
                />
              )}
            </div>

            {mode === 'edit' && (
              <div className="w-full shrink-0 space-y-3 lg:w-64">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Labels</h2>
                  <span className="text-xs text-muted-foreground">{boxes.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">Drag on the image to add a region</p>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {boxes.map((box) => (
                    <div
                      key={box.id}
                      className={cn(
                        'rounded-lg border p-2.5 text-sm',
                        selectedBox === box.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card',
                      )}
                      onClick={() => {
                        setSelectedBox(box.id)
                        setLabelInput(box.label)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          value={box.id === selectedBox ? labelInput : box.label}
                          onChange={(e) => {
                            if (box.id === selectedBox) setLabelInput(e.target.value)
                          }}
                          onBlur={() => {
                            if (selectedBox === box.id) updateBox(box.id, 'label', labelInput)
                          }}
                          className="min-w-0 flex-1 bg-transparent font-semibold text-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleHidden(box.id)
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                        >
                          {hiddenSet.has(box.id) ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteBox(box.id)
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'study' && (
              <div className="w-full shrink-0 lg:w-64">
                <h2 className="text-sm font-semibold text-foreground">Reveal</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click a masked region or use the list
                </p>
                <div className="mt-3 space-y-1.5">
                  {boxes.map((box) => (
                    <button
                      key={box.id}
                      type="button"
                      onClick={() => toggleHidden(box.id)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                        hiddenSet.has(box.id)
                          ? 'border-border bg-card text-muted-foreground'
                          : 'border-[var(--success)]/30 bg-[color-mix(in_oklab,var(--success)_8%,transparent)] font-semibold text-foreground',
                      )}
                    >
                      {hiddenSet.has(box.id) ? '???' : box.label}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={hideAll}>
                  Hide all
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
