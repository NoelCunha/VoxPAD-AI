interface StatusBarProps {
  message: string
  charCount: number
  wordCount: number
}

export default function StatusBar({ message, charCount, wordCount }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-surface text-xs text-gray-500 select-none">
      <span>{message}</span>
      <div className="flex gap-4">
        <span>{wordCount} palavras</span>
        <span>{charCount} caracteres</span>
      </div>
    </div>
  )
}
