// Whatever file a reader has, as a packet MODAQ can read.
//
// A reader outside a tournament brings their own packet, and it's whatever the
// set was released as: nearly always a PDF for recent sets, a Word document
// for the rest, and a JSON file only if someone already converted it. MODAQ
// itself reads JSON and (through YAPP) .docx; this adds PDF, and does all
// three from one place so the moderator page can take any of them from a
// single file picker or a file dropped on the page.
//
// The file's CONTENTS decide how it's read, not its name: a packet saved as
// "packet.pdf" that is really a Word document (it happens) still works.

import { IPacket } from "../state/IPacket";
import { pdfToPacketHtml, IPdfJsLib } from "./pdfPacket";
import { markPacketPowerFromBold } from "./boldPower";

// Klaxon's own route to its YAPP instance (see /api/yapp/parse in Klaxon's
// server/index.js). The parser takes a .docx, and — for anything that isn't a
// zip — HTML, which is what a PDF is turned into first.
const PARSE_URL = "/api/yapp/parse?modaq=true";

// The parser's own ceiling (Klaxon's proxy enforces the same).
const MAX_PARSE_BYTES = 3 * 1024 * 1024;
// PDFs are read here, in the browser, so they can be bigger — a packet with
// embedded images easily passes 3 MB — but not unboundedly so.
const MAX_PDF_BYTES = 40 * 1024 * 1024;

export interface IReadPacket {
    packet: IPacket;
    // What to call it: the file's name without the extension.
    name: string;
}

export type PacketStatus = (text: string) => void;

export const PACKET_ACCEPT =
    ".docx,.pdf,.json,application/pdf,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function packetName(file: File): string {
    return file.name.replace(/\.(docx|pdf|json|doc)$/i, "").trim() || "Packet";
}

function startsWith(bytes: Uint8Array, text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        if (bytes[i] !== text.charCodeAt(i)) return false;
    }
    return true;
}

/**
 * Read a packet file (JSON, .docx, or PDF) into a packet. Throws an Error whose
 * message is fit to show the reader as-is.
 */
export async function readPacketFile(file: File, status: PacketStatus = () => undefined): Promise<IReadPacket> {
    const name = packetName(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0) {
        throw new Error("That file is empty.");
    }

    // %PDF — a PDF, whatever it's called.
    if (startsWith(bytes, "%PDF")) {
        if (bytes.length > MAX_PDF_BYTES) {
            throw new Error(
                `That PDF is ${megabytes(bytes.length)}. The largest this reads is ${megabytes(MAX_PDF_BYTES)}.`
            );
        }
        status("Reading the PDF…");
        const html = await pdfToHtml(bytes);
        status("Parsing the questions…");
        return { packet: await parse(new TextEncoder().encode(html), "the PDF"), name };
    }

    // PK — a zip, which for a packet means a Word document.
    if (startsWith(bytes, "PK")) {
        if (bytes.length > MAX_PARSE_BYTES) {
            throw new Error(
                `That document is ${megabytes(bytes.length)}. The parser takes up to ${megabytes(MAX_PARSE_BYTES)} — ` +
                    "images in the document are usually why; a PDF of the same packet will work."
            );
        }
        status("Parsing the questions…");
        return { packet: await parse(bytes, "the document"), name };
    }

    // The signature of the old binary Word format (.doc), which the parser
    // can't read at all.
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
        throw new Error(
            "That's an old-style Word document (.doc). Open it in Word and save it as .docx or PDF, then load that."
        );
    }

    // Otherwise it had better be a packet already.
    let packet: IPacket;
    try {
        packet = JSON.parse(new TextDecoder().decode(bytes)) as IPacket;
    } catch {
        throw new Error("That isn't a packet file. Load a Word document (.docx), a PDF, or a packet JSON file.");
    }
    return { packet: checked(packet, "That JSON file"), name };
}

function checked(packet: IPacket, what: string): IPacket {
    if (packet == undefined || !Array.isArray(packet.tossups)) {
        throw new Error(`${what} isn't a packet — it has no tossups in it.`);
    }
    if (packet.tossups.length === 0) {
        throw new Error(`No tossups were found in ${what === "That JSON file" ? "that file" : what}.`);
    }
    return packet;
}

async function parse(body: Uint8Array, what: string): Promise<IPacket> {
    let response: Response;
    try {
        response = await fetch(PARSE_URL, {
            method: "POST",
            headers: { "content-type": "application/octet-stream" },
            body,
        });
    } catch {
        throw new Error("Couldn't reach the packet parser. Check the connection and try again.");
    }
    const text = await response.text();
    if (!response.ok) {
        let messages: string[] = [];
        try {
            const parsed = JSON.parse(text);
            messages = parsed?.errorMessages ?? (parsed?.error ? [parsed.error] : []);
        } catch {
            /* not JSON */
        }
        // The parser leads with a bare "Parse Error." before saying what it
        // actually tripped on.
        const useful = messages.filter((m) => !/^parse error\.?$/i.test(m.trim()));
        throw new Error(
            useful.length
                ? `The parser couldn't read ${what}: ${useful.slice(0, 2).join(" ")}`
                : `The parser couldn't read ${what} (${response.status}).`
        );
    }
    let packet: IPacket;
    try {
        packet = JSON.parse(text) as IPacket;
    } catch {
        throw new Error("The parser sent back something that isn't a packet.");
    }
    // Some packets mark power by setting the powered part in bold and writing no
    // marker at all; the parser keeps the bold and there is nothing for a format
    // to match. See boldPower.ts — questions that say nothing about power this
    // way are left exactly as they came.
    return checked(markPacketPowerFromBold(packet), what);
}

// pdf.js is about a megabyte and a half with its worker, and most readers
// never drop a PDF, so it's fetched the first time one is.
let pdfjsPromise: Promise<IPdfJsLib> | undefined;

function loadPdfJs(): Promise<IPdfJsLib> {
    if (pdfjsPromise == undefined) {
        pdfjsPromise = Promise.all([
            import("pdfjs-dist/build/pdf.min.mjs"),
            import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]).then(([lib, worker]) => {
            lib.GlobalWorkerOptions.workerSrc = worker.default;
            return (lib as unknown) as IPdfJsLib;
        });
        // A failed load (a dropped connection) shouldn't stick for the session.
        pdfjsPromise.catch(() => {
            pdfjsPromise = undefined;
        });
    }
    return pdfjsPromise;
}

async function pdfToHtml(bytes: Uint8Array): Promise<string> {
    let pdfjs: IPdfJsLib;
    try {
        pdfjs = await loadPdfJs();
    } catch {
        throw new Error("Couldn't load the PDF reader. Check the connection and try again.");
    }
    try {
        return await pdfToPacketHtml(pdfjs, bytes);
    } catch (error) {
        const message = (error as Error)?.message ?? "";
        if (/password/i.test(message) || (error as { name?: string })?.name === "PasswordException") {
            throw new Error("That PDF is password-protected. Use an unlocked copy of the packet.");
        }
        if (/no text in it/.test(message)) {
            throw error;
        }
        throw new Error("Couldn't read that PDF: " + (message || "it may be damaged."));
    }
}

function megabytes(n: number): string {
    return `${(n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0)} MB`;
}
