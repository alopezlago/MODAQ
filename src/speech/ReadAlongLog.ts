// A short record of what read-along heard and decided, kept in memory so a moderator who sees it go wrong can copy
// it from the debug window (Options) and send it along. Read-along misbehaves on real speech in ways a test can't
// reproduce, so the record of the moment is the only way to see why.

const maximumEntries = 400;

const entries: string[] = [];
let startTime: number | undefined;

export function logReadAlong(kind: string, detail: string): void {
    const now: number = Date.now();
    startTime ??= now;
    entries.push(`${((now - startTime) / 1000).toFixed(2)}s ${kind}: ${detail}`);
    if (entries.length > maximumEntries) {
        entries.splice(0, entries.length - maximumEntries);
    }
}

// When the first entry was logged, so the relative times can be read as clock times
export function getReadAlongLogStart(): number | undefined {
    return startTime;
}

export function getReadAlongLog(): string {
    return entries.join("\n");
}
