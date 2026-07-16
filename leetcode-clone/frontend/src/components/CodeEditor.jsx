import Editor from "@monaco-editor/react";
import React, { useRef } from "react";

const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    fontLigatures: true,
    cursorSmoothCaretAnimation: "on",
    automaticLayout: true,
    quickSuggestions: true,
    parameterHints: { enabled: false },
    hover: { enabled: false },
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: "currentDocument",
    renderWhitespace: "none",
    scrollBeyondLastLine: false,
    smoothScrolling: false,
    renderLineHighlight: "none",
    autoClosingBrackets: "always",
    autoClosingQuotes: "always",
    autoSurround: "languageDefined",
    bracketPairColorization: { enabled: true },
    formatOnType: true
};

const resolveMonacoLanguage = (language) => {
    const normalized = String(language || "").trim().toLowerCase();
    if (normalized === "js") return "javascript";
    if (normalized === "cpp") return "cpp";
    if (normalized === "py") return "python";
    return normalized || "javascript";
};

function CodeEditor({ language, code, setCode, template, width = "650px", height = "400px", lockFirstLine = false, readOnly = false }) {
    const editorRef = useRef(null);

    function onMount(editor) {
        editorRef.current = editor;

        if (lockFirstLine) {
            // Hard Lock: Cursor Logic
            editor.onDidChangeCursorPosition(e => {
                if (e.position.lineNumber === 1) {
                    editor.setPosition({ lineNumber: 2, column: 1 });
                }
            });

            // Content Guard: Prevent modifying line 1 (Signature)
            if (!editor.__listenersAttached) {
                editor.onDidChangeModelContent(e => {
                    e.changes.forEach(change => {
                        if (change.range.startLineNumber === 1) {
                            editor.getModel().setValue(template);
                        }
                    });
                });
                editor.__listenersAttached = true;
            }
        }
    }

    function handleEditorChange(value) {
        if (setCode) setCode(value);
    }

    return (
        <Editor
            width={width}
            height={height}
            language={resolveMonacoLanguage(language)}
            value={code}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={onMount}
            options={{ ...editorOptions, readOnly }}
        />
    );
}

// Memoize to prevent re-renders when parent state changes but props match
export default React.memo(CodeEditor);

