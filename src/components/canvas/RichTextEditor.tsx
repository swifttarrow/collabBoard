"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "@tiptap/extension-text-style/font-size";
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
  Type,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  content: string;
  onUpdate: (html: string) => void;
  onBlur?: (event?: FocusEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  editable?: boolean;
  /** If provided, blur to an element inside this container is ignored (e.g. toolbar click). */
  blurExcludeRef?: React.RefObject<HTMLElement | null>;
  /** If provided, assigned to the editor root div. Use for blurExcludeRef so it only covers the editor box. */
  editorContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** When true, focus the editor when it becomes available (e.g. on overlay open). */
  autoFocus?: boolean;
  /** When true, append BubbleMenu to document.body to avoid overflow clipping (e.g. in canvas). */
  appendMenuToBody?: boolean;
};

/** Converts plain text to HTML for TipTap. Handles backward compatibility. */
function toEditorContent(text: string): string {
  if (!text.trim()) return "<p></p>";
  if (text.includes("<") && text.includes(">")) return text;
  return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</p>`;
}

const FONT_SIZES = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
];

export function RichTextEditor({
  content,
  onUpdate,
  onBlur,
  className,
  style,
  editable = true,
  blurExcludeRef,
  editorContainerRef,
  autoFocus = false,
  appendMenuToBody = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type here…" }),
      TextStyle,
      FontSize,
    ],
    content: toEditorContent(content),
    editable,
    editorProps: {
      attributes: {
        class: "outline-none min-h-full w-full p-0 m-0 text-base [&_p]:min-h-[1.5em] [&_strong]:font-bold [&_em]:italic [&_s]:line-through [&_u]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h1]:font-bold [&_h1]:text-lg [&_h2]:font-bold [&_h2]:text-base [&_h3]:font-semibold [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-sm",
      },
      handleDOMEvents: {
        blur: (_view, event: FocusEvent) => {
          const target = event.relatedTarget as Node | null;
          if (target) {
            if (blurExcludeRef?.current?.contains(target)) return;
            if (appendMenuToBody && (target as Element).closest?.(".text-bubble-menu")) return;
          }
          onBlur?.(event);
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
      onUpdate(editor.getHTML());
    },
    immediatelyRender: true,
  });

  const prevContentRef = useRef(content);
  useEffect(() => {
    if (!editor) return;
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      editor.commands.setContent(toEditorContent(content), { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (autoFocus && editor && editable) {
      editor.commands.focus("end");
    }
  }, [autoFocus, editor, editable]);

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
  const setFontSize = useCallback(
    (size: string) => editor?.chain().focus().setFontSize(size).run(),
    [editor]
  );
  const unsetFontSize = useCallback(() => editor?.chain().focus().unsetFontSize().run(), [editor]);

  const [, forceRender] = useState(0);
  const scheduledRef = useRef(false);
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (scheduledRef.current) return;
      scheduledRef.current = true;
      requestAnimationFrame(() => {
        scheduledRef.current = false;
        forceRender((n) => n + 1);
      });
    };
    editor.on("selectionUpdate", onUpdate);
    editor.on("transaction", onUpdate);
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("transaction", onUpdate);
    };
  }, [editor]);

  const currentFontSize = editor?.getAttributes("textStyle").fontSize ?? "16px";

  if (!editor) return null;

  return (
    <div ref={editorContainerRef} className={cn("rich-text-editor", className)} style={style}>
      <EditorContent editor={editor} />
      <BubbleMenu
        editor={editor}
        className="text-bubble-menu"
        appendTo={() => (appendMenuToBody ? document.body : blurExcludeRef?.current ?? document.body)}
      >
        {/* Row 1: Font size & text formatting */}
        <div className="flex items-center gap-1 flex-wrap">
          <FontSizeSelect
            value={currentFontSize}
            onSelect={setFontSize}
            onReset={unsetFontSize}
          />
          <Divider />
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
        <div className="flex items-center gap-1">
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
  return <div className="text-bubble-divider" />;
}

function FontSizeSelect({
  value,
  onSelect,
  onReset,
}: {
  value: string;
  onSelect: (size: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const displayValue = FONT_SIZES.find((s) => s.value === value)?.label ?? value;
  return (
    <div className="relative">
      <button
        type="button"
        className="text-bubble-btn flex items-center gap-1 min-w-[52px]"
        title="Font size"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        <Type className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium tabular-nums">{displayValue}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          />
          <div className="text-bubble-dropdown absolute left-0 top-full mt-1 z-50 min-w-[72px] rounded-lg border py-1 shadow-lg">
            {FONT_SIZES.map(({ label, value: v }) => (
              <button
                key={v}
                type="button"
                className="text-bubble-dropdown-item w-full px-3 py-1.5 text-left text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(v);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="text-bubble-dropdown-item w-full px-3 py-1.5 text-left text-sm border-t mt-1 pt-1 opacity-70"
              onMouseDown={(e) => {
                e.preventDefault();
                onReset();
                setOpen(false);
              }}
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
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
      data-active={active ? "true" : "false"}
      className={cn(
        "text-bubble-btn",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}
