import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image as ImageIcon,
  Paperclip,
  Loader2,
} from 'lucide-react'
import { uploadAttachment } from '../lib/api'
import { useToast } from './ui'

/**
 * WYSIWYG editor for article bodies (knowledge base + success stories). Authors
 * format like Notion/Word and drag/paste/pick images & files; uploads go to
 * /api/attachments and are embedded inline. Content is serialized to **markdown**
 * (via tiptap-markdown) so it stays compatible with the portal's Markdown renderer
 * and the Notion sync, which also speak markdown. StarterKit v3 already bundles the
 * Link extension, so it isn't registered separately.
 */

const EXTENSIONS = [
  StarterKit.configure({
    link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
  }),
  Image.configure({ inline: false }),
  Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true, breaks: true }),
]

/** tiptap-markdown augments editor.storage at runtime but ships loose types. */
function getMarkdown(editor: Editor): string {
  return (editor.storage as any).markdown?.getMarkdown?.() ?? ''
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (markdown: string) => void }) {
  const toast = useToast()
  const editorRef = useRef<Editor | null>(null)
  const lastEmitted = useRef(value)
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const insertUpload = useCallback(
    async (file: File, asImage: boolean) => {
      const ed = editorRef.current
      if (!ed) return
      setUploading(true)
      try {
        const asset = await uploadAttachment(file)
        if (asImage || asset.mimeType.startsWith('image/')) {
          ed.chain().focus().setImage({ src: asset.url, alt: asset.filename }).run()
        } else {
          // A file attachment: insert a link (rendered as a download link in the body),
          // then a trailing plain space so typing continues outside the link.
          ed
            .chain()
            .focus()
            .insertContent([
              { type: 'text', text: `📎 ${asset.filename}`, marks: [{ type: 'link', attrs: { href: asset.url } }] },
              { type: 'text', text: ' ' },
            ])
            .run()
        }
      } catch (e) {
        toast.push(e instanceof Error ? e.message : 'Upload failed.', 'error')
      } finally {
        setUploading(false)
      }
    },
    [toast],
  )

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value,
    immediatelyRender: false,
    // Re-render on each transaction so the toolbar's active states track the cursor;
    // TipTap v3's useEditor doesn't re-render on transactions by default.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'tiptap' },
      handlePaste: (_view, event) => {
        const img = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
        if (!img) return false
        void insertUpload(img, true)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (!files.length) return false
        event.preventDefault()
        for (const f of files) void insertUpload(f, f.type.startsWith('image/'))
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const md = getMarkdown(editor)
      lastEmitted.current = md
      onChange(md)
    },
  })
  editorRef.current = editor

  // Sync external value → editor without echoing our own edits back (which would
  // fight the cursor as markdown re-serialization normalizes the text).
  useEffect(() => {
    if (!editor) return
    if (value === lastEmitted.current) return
    editor.commands.setContent(value || '', { emitUpdate: false })
    lastEmitted.current = value
  }, [value, editor])

  if (!editor) return null

  const promptLink = () => {
    const prev = (editor.getAttributes('link').href as string) ?? ''
    const url = window.prompt('Link URL', prev || 'https://')
    if (url === null) return
    const chain = editor.chain().focus()
    if (url === '') chain.unsetLink().run()
    else chain.setLink({ href: url }).run()
  }

  const onPick = (asImage: boolean) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void insertUpload(f, asImage)
    e.target.value = ''
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        <ToolBtn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon size={15} />
        </ToolBtn>
        <ToolBtn label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon size={15} />
        </ToolBtn>
        <Divider />
        <ToolBtn
          label="Heading"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={16} />
        </ToolBtn>
        <ToolBtn
          label="Subheading"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolBtn>
        <Divider />
        <ToolBtn label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolBtn>
        <ToolBtn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolBtn>
        <ToolBtn label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolBtn>
        <ToolBtn label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={15} />
        </ToolBtn>
        <Divider />
        <ToolBtn label="Link" active={editor.isActive('link')} onClick={promptLink}>
          <Link2 size={15} />
        </ToolBtn>
        <ToolBtn label="Insert image" onClick={() => imageInput.current?.click()}>
          <ImageIcon size={15} />
        </ToolBtn>
        <ToolBtn label="Attach file" onClick={() => fileInput.current?.click()}>
          <Paperclip size={15} />
        </ToolBtn>
        {uploading && (
          <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-xs text-muted dark:text-muted-dark">
            <Loader2 size={13} className="animate-spin" /> Uploading…
          </span>
        )}
      </div>

      <EditorContent editor={editor} />

      <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={onPick(true)} />
      <input ref={fileInput} type="file" className="hidden" onChange={onPick(false)} />
    </div>
  )
}

function ToolBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the editor selection: don't let the button steal focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rich-editor-btn${active ? ' is-active' : ''}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-line dark:bg-line-dark" />
}
