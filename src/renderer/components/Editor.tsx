import { forwardRef } from 'react'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

const Editor = forwardRef<HTMLTextAreaElement, EditorProps>(({ value, onChange }, ref) => {
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 w-full p-4 resize-none outline-none font-['Consolas',_'Courier_New',_monospace] text-sm leading-relaxed text-gray-900 bg-white placeholder-gray-400"
      placeholder="Comece a digitar ou use o botão Gravar para transcrever áudio..."
      spellCheck
    />
  )
})

Editor.displayName = 'Editor'

export default Editor
