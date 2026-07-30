# YAPP2

YAPP2 is a backward-compatible superset of the packet JSON produced by
[YetAnotherPacketParser](https://github.com/alopezlago/YetAnotherPacketParser) (YAPP)
and consumed by the MODAQ reader.

It exists to carry one thing plain YAPP cannot: **which words a pronunciation guide
covers**.

Version: **`yapp2/1.0`**.

## The problem

A pronunciation guide is a parenthesized respelling:

> Denis Diderot ("DID-er-OW") edited the *Encyclopédie*.

Plain YAPP stores that as literal text, which is enough to *display* but not enough to
know that the guide belongs to "Diderot" rather than to "Denis", to both words, or to
the sentence. Authoring tools do track it — QEMS marks the covered words with `\P`
markers and styles them — and every export to YAPP had to discard it.

## Design

Two rules, in priority order:

1. **An existing YAPP consumer must read a YAPP2 file correctly, with no changes.**
2. A YAPP2-aware consumer gets the anchoring.

That rules out simply putting a new tag in `question`: MODAQ's text parser strips only
the tags it knows, so an unrecognized `<pg>` would render as the literal characters
`<pg>` in every existing reader. So the canonical fields stay exactly as plain YAPP
would have them, and the anchored variants live beside them.

## Shape

```json
{
  "version": "yapp2/1.0",
  "name": "Round 1",
  "tossups": [
    {
      "number": 1,
      "question": "Denis Diderot (\"DID-er-OW\") edited this work.",
      "answer": "<b><u>Encyclopédie</u></b>",
      "metadata": "A Writer, Literature - European",
      "anchored": {
        "question": "Denis <pg>Diderot</pg> (\"DID-er-OW\") edited this work."
      }
    }
  ],
  "bonuses": [
    {
      "number": 1,
      "leadin": "...",
      "parts": ["...", "..."],
      "answers": ["...", "..."],
      "values": [10, 10],
      "anchored": {
        "parts": ["A <pg>part</pg> (\"PART\") here.", "No anchor in this one."]
      }
    }
  ]
}
```

Everything except `version` and `anchored` is unchanged from YAPP.

### `version`

A string, `"yapp2/<major>.<minor>"`. Its absence means the file is plain YAPP, and a
reader must then ignore `anchored` entirely — a file that omits the marker has not
promised that its canonical fields are tag-free, so trusting `anchored` there risks
rendering a tag the file never declared.

Compare case-insensitively on the `yapp2/` prefix. A reader that understands
`yapp2/1.0` should accept later `1.x` minor versions, since minor bumps only add
optional fields.

### `anchored`

Optional, per question. Holds the same text as the canonical fields with `<pg>` tags
added, and **only** the fields that actually contain an anchor:

| Question type | Allowed keys |
|---|---|
| tossup | `question`, `answer` |
| bonus | `leadin`, `parts`, `answers` |

Rules:

- Omit `anchored` entirely when no field on that question has an anchor. Most questions
  have none, so a YAPP2 file is barely larger than the YAPP equivalent.
- Omit individual keys with no anchor rather than repeating the canonical text.
- `parts` and `answers` are **full-length** arrays matching the canonical arrays
  element-for-element, because they are matched up by index. A reader that sees a
  length mismatch must ignore that array rather than pair strings up wrongly.
- Apart from `<pg>` tags, an anchored string must be identical to its canonical
  counterpart. Anything else (a different answer, extra words) is malformed.

### The `<pg>` tag

`<pg>…</pg>` wraps the word(s) a nearby pronunciation guide covers.

```
Denis <pg>Diderot</pg> ("DID-er-OW") edited this work.
```

- It may contain the inline tags YAPP already allows (`<b> <u> <em> <sup> <sub>`), and
  may appear inside them.
- It does not nest inside itself.
- It carries no attributes.
- It is not tied to a specific guide by ID. The convention is that the anchor precedes
  its guide; a reader that wants to pair them can take the next guide after the anchor.

**The anchored words are ordinary question words.** They are read aloud, they count
toward word counts, and they are buzzable. This is the one thing an implementer is most
likely to get wrong, because the *guide itself* is the opposite on all three counts. A
reader that treats an anchor like a guide will shift every buzz position after it.

`<pg>` is presentational metadata: a consumer that does not care may strip the tags and
lose nothing but the anchoring.

## Producing YAPP2

Emit both forms of a field, then drop the anchored one if it came out identical. A
producer that has no anchoring information should emit plain YAPP (no `version`) rather
than a YAPP2 file with no `anchored` objects.

## Consuming YAPP2

```
if version starts with "yapp2/":
    for each question:
        for each field:
            use anchored[field] if present (and, for arrays, the same length)
            else use the canonical field
else:
    read as plain YAPP; ignore anchored
```

Because the two forms differ only by `<pg>`, a reader that understands the tag loses
nothing by always preferring the anchored text.

## Implementations

- **QEMS** (producer): `qems2/qsub/yapp_export.py` writes it; `qems2/qsub/packet_set_importer.py`
  reads it back, mapping `<pg>` to QEMS's own `\P` markers. Exported from a set's page
  via "Export Packetized YAPP2 JSON".
- **MODAQ** (consumer): `src/parser/FormattedTextParser.ts` parses `<pg>` into
  `IFormattedText.pronunciationTarget`; `src/components/PacketLoaderController.ts`
  prefers the `anchored` fields; `src/state/CustomExport.ts` writes YAPP2 back out.
  That repo carries a copy of this document.

## Why not other approaches

- **A new tag directly in `question`** — breaks rule 1: existing readers show a literal
  `<pg>`.
- **Character offsets in a parallel array** — keeps the text pristine, but offsets are
  ambiguous (relative to the raw HTML, or the rendered text?) and silently rot when
  anything edits the string. Anchors that travel inside the text can't desynchronize
  from it.
- **A separate sidecar file** — packets are passed around as single files; anything not
  in the JSON gets lost.
