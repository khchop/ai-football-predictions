'use client'

interface NarrativePreviewProps {
  previewText: string
  fullSectionId: string
  previewLines?: number
  className?: string
}

export function NarrativePreview({
  previewText,
  fullSectionId,
  previewLines = 4,
  className = '',
}: NarrativePreviewProps) {
  const scrollToFull = () => {
    const element = document.getElementById(fullSectionId)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  // Truncate to approximate word count for preview (150 words target)
  const words = previewText.split(/\s+/)
  const previewWordCount = 150
  const isLongContent = words.length > previewWordCount
  const preview = isLongContent
    ? words.slice(0, previewWordCount).join(' ') + '...'
    : previewText

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-foreground leading-relaxed text-sm md:text-base">
        {preview}
      </p>
      {isLongContent && (
        <button
          onClick={scrollToFull}
          className="text-primary hover:underline font-medium text-sm min-h-[44px] inline-flex items-center gap-1"
          type="button"
        >
          Read Full Analysis
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}
