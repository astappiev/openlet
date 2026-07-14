import { cn } from '../lib/cn'

const FLIP_MS = 650

export function FlashcardFace({
  label,
  text,
  flipped,
  side,
  size = 'lg',
}: {
  label: string
  text: string
  flipped: boolean
  side: 'front' | 'back'
  size?: 'md' | 'lg'
}) {
  const isFront = side === 'front'
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[#e8eaf0] bg-white p-6 sm:p-8',
        !isFront && 'border-[#e0e4ff] bg-[#fafbff]',
        size === 'lg' ? 'min-h-[280px]' : 'min-h-[200px]',
      )}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: isFront ? 'rotateY(0deg)' : 'rotateY(180deg)',
        boxShadow: '0 12px 40px -12px rgba(26,29,38,0.1), 0 4px 12px -4px rgba(66,85,255,0.06)',
      }}
      aria-hidden={isFront ? flipped : !flipped}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7c84a0]">{label}</p>
      <p
        className={cn(
          'mt-4 max-w-full text-center leading-snug text-[#1a1d26]',
          isFront ? 'font-display font-semibold' : 'font-semibold',
          size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg',
          text.length > 120 && 'text-base sm:text-lg font-sans',
          text.length > 220 && 'text-sm sm:text-base font-sans',
        )}
      >
        {text}
      </p>
      {isFront && !flipped && (
        <p className="mt-8 text-xs font-semibold text-[#7c84a0]">Click to flip</p>
      )}
    </div>
  )
}

export function Flashcard({
  term,
  definition,
  flipped,
  onFlip,
  termFirst = true,
  size = 'lg',
  className,
}: {
  term: string
  definition: string
  flipped: boolean
  onFlip?: () => void
  termFirst?: boolean
  size?: 'md' | 'lg'
  className?: string
}) {
  const front = termFirst
    ? { label: 'Term', text: term }
    : { label: 'Definition', text: definition }
  const back = termFirst ? { label: 'Definition', text: definition } : { label: 'Term', text: term }

  return (
    <div
      data-flip-card
      className={cn(
        'w-full cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none',
        className,
      )}
      style={{ perspective: '1600px', perspectiveOrigin: '50% 50%' }}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onFlip?.()
        }
      }}
      aria-label={flipped ? `Showing ${back.label}` : `Showing ${front.label}. Flip card`}
    >
      <div
        className={cn(
          'relative w-full',
          size === 'lg' ? 'h-[min(48vh,340px)] min-h-[260px]' : 'h-52',
        )}
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          willChange: 'transform',
        }}
      >
        <FlashcardFace {...front} flipped={flipped} side="front" size={size} />
        <FlashcardFace {...back} flipped={flipped} side="back" size={size} />
      </div>
    </div>
  )
}
