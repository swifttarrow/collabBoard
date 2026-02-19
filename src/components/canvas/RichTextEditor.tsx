"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Strikethrough,
  Underline as UnderlineIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  content: string;
  onUpdate: (html: string) => void;
  onBlur?: () => void;
  className?: string;
  style?: React.CSSProperties;
  editable?: boolean;
};

/** Converts plain text to HTML for TipTap. Handles backward compatibility. */
function toEditorContent(text: string): string {
  if (!text.trim()) return "<p></p>";
  if (text.includes("<") && text.includes(">")) return text;
  return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</p>`;
}

export function RichTextEditor({
  content,
  onUpdate,
  onBlur,
  className,
  style,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: toEditorContent(content),
    editable,
    editorProps: {
      attributes: {
        class: "outline-none min-h-full w-full p-0 m-0 text-base [&_strong]:font-bold [&_em]:italic [&_s]:line-through [&_u]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h1]:font-bold [&_h1]:text-lg [&_h2]:font-bold [&_h2]:text-base [&_h3]:font-semibold [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-sm",
      },
      handleDOMEvents: {
        blur: () => {
          onBlur?.();
        },
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBlur?.();
          return true;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onBlur?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== "<p></p>") {
        onUpdate(html);
      }
    },
    immediatelyRender: true,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(toEditorContent(content), { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const toggleStrike = useCallback(() => editor?.chain().focus().toggleStrike().run(), [editor]);
  const toggleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor]);
  const toggleCode = useCallback(() => editor?.chain().focus().toggleCode().run(), [editor]);
  const setParagraph = useCallback(() => editor?.chain().focus().setParagraph().run(), [editor]);
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const toggleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const toggleCodeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor]);
  const setHorizontalRule = useCallback(() => editor?.chain().focus().setHorizontalRule().run(), [editor]);
  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rich-text-editor", className)} style={style}>
      <EditorContent editor={editor} />
      <BubbleMenu
        editor={editor}
        className="flex flex-col gap-1 rounded-2xl border border-slate-200/60 bg-white/95 px-2 py-1.5 shadow-xl shadow-slate-200/50 backdrop-blur-md"
      >
        {/* Row 1: Text formatting & block types */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton onMouseDown={toggleBold} active={editor.isActive("bold")} title="Bold">
            <span className="text-sm font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleItalic} active={editor.isActive("italic")} title="Italic">
            <span className="text-sm italic">I</span>
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleStrike} active={editor.isActive("strike")} title="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleUnderline} active={editor.isActive("underline")} title="Underline">
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleCode} active={editor.isActive("code")} title="Inline code">
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton onMouseDown={setParagraph} active={!editor.isActive("heading") && !editor.isActive("blockquote") && !editor.isActive("codeBlock")} title="Paragraph">
            <span className="text-xs font-medium">¶</span>
          </ToolbarButton>
          <Divider />
          <ToolbarButton onMouseDown={toggleBulletList} active={editor.isActive("bulletList")} title="Bullet list">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleOrderedList} active={editor.isActive("orderedList")} title="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleBlockquote} active={editor.isActive("blockquote")} title="Blockquote">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onMouseDown={toggleCodeBlock} active={editor.isActive("codeBlock")} title="Code block">
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>
        {/* Row 2: Insert & history */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton onMouseDown={setHorizontalRule} title="Horizontal rule">
            <Minus className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton onMouseDown={undo} disabled={!editor.can().undo()} title="Undo">
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onMouseDown={redo} disabled={!editor.can().redo()} title="Redo">
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </BubbleMenu>
    </div>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/80" />;
}

function ToolbarButton({
  onMouseDown,
  active,
  title,
  disabled,
  children,
}: {
  onMouseDown: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onMouseDown();
      }}
      title={title}
      disabled={disabled}
      className={cn(
        "rounded-lg p-2 transition-all duration-150 hover:bg-slate-100/90",
        active && "bg-slate-200/80 text-slate-800 shadow-sm",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}
