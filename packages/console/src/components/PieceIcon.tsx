import { PuzzlePieceIcon } from '@heroicons/react/24/outline'

export default function PieceIcon({ className }: { className?: string }) {
  return (
    <PuzzlePieceIcon
      className={`w-9 inline-block align-middle mb-1 px-2 py-0 ${className ?? ''}`}
      title='Piece'
    />
  )
}