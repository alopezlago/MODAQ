import * as React from "react";

import { PACKET_ACCEPT } from "./packetFile";

// Where a packet goes: a big target to drop a file on, which is also a button
// that opens the file picker. With `pageWide`, a file dropped anywhere on the
// page counts too — the reader shouldn't have to aim — and the browser's own
// habit of opening a dropped file in place of the page is stopped.

export function PacketDrop(props: {
    onFiles: (files: File[]) => void;
    multiple?: boolean;
    disabled?: boolean;
    pageWide?: boolean;
    title: string;
    hint?: string;
}): JSX.Element {
    const { onFiles, multiple, disabled, pageWide, title, hint } = props;
    const input = React.useRef<HTMLInputElement>(null);
    const [over, setOver] = React.useState(false);

    const take = React.useCallback(
        (list: FileList | null | undefined) => {
            const files = Array.from(list ?? []);
            if (files.length === 0 || disabled) {
                return;
            }
            onFiles(multiple ? files : files.slice(0, 1));
        },
        [onFiles, multiple, disabled]
    );

    React.useEffect(() => {
        if (!pageWide) {
            return;
        }
        // A drag counts in and out of every element it crosses, so count too.
        let depth = 0;
        const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes("Files");
        const enter = (e: DragEvent): void => {
            if (!hasFiles(e)) return;
            depth++;
            setOver(true);
        };
        const leave = (e: DragEvent): void => {
            if (!hasFiles(e)) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) setOver(false);
        };
        const overPage = (e: DragEvent): void => {
            if (hasFiles(e)) e.preventDefault();
        };
        const drop = (e: DragEvent): void => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            depth = 0;
            setOver(false);
            take(e.dataTransfer?.files);
        };
        window.addEventListener("dragenter", enter);
        window.addEventListener("dragleave", leave);
        window.addEventListener("dragover", overPage);
        window.addEventListener("drop", drop);
        return () => {
            window.removeEventListener("dragenter", enter);
            window.removeEventListener("dragleave", leave);
            window.removeEventListener("dragover", overPage);
            window.removeEventListener("drop", drop);
        };
    }, [pageWide, take]);

    return (
        <div
            className={"pk-drop" + (over ? " over" : "") + (disabled ? " disabled" : "")}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            // The input's own click bubbles back up here; don't open the picker twice.
            onClick={(e) => !disabled && e.target !== input.current && input.current?.click()}
            onKeyDown={(e) => {
                if (!disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    input.current?.click();
                }
            }}
            // Without page-wide listening, the zone takes drops itself.
            onDragOver={(e) => {
                if (!pageWide) {
                    e.preventDefault();
                    setOver(true);
                }
            }}
            onDragLeave={() => !pageWide && setOver(false)}
            onDrop={(e) => {
                if (!pageWide) {
                    e.preventDefault();
                    setOver(false);
                    take(e.dataTransfer.files);
                }
            }}
        >
            <span className="pk-drop-icon" aria-hidden="true">
                ⤓
            </span>
            <strong className="pk-drop-title">{title}</strong>
            {hint && <span className="pk-drop-hint">{hint}</span>}
            <span className="pk-drop-button">{multiple ? "Choose packet files" : "Choose a packet file"}</span>
            <input
                ref={input}
                type="file"
                accept={PACKET_ACCEPT}
                multiple={multiple}
                hidden
                onChange={(e) => {
                    take(e.target.files);
                    e.target.value = ""; // the same file again is a fresh choice
                }}
            />
        </div>
    );
}
