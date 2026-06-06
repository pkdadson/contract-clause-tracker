from dataclasses import dataclass
import re

_HEADING_RE = re.compile(r"^\s*(#{1,6})\s+(.+?)\s*$")
_NUMBERED_HEADING_RE = re.compile(r"^\s*\d+(\.\d+)*\.?\s+[A-Z][^.]{1,80}$")
_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-Z(])")
_TAIL_WORD = re.compile(r"(\w+)\.$")

_ABBREVS = frozenset({
    "inc", "corp", "ltd", "llc", "co", "plc",
    "mr", "mrs", "ms", "dr", "jr", "sr",
    "art", "sec", "no", "vol", "ch", "ex",
    "vs", "et", "al", "etc", "ie", "eg",
})


@dataclass(frozen=True, slots=True)
class SplitSentence:
    idx: int
    text: str
    is_heading: bool


def _ends_in_abbrev(s: str) -> bool:
    m = _TAIL_WORD.search(s)
    return m is not None and m.group(1).lower() in _ABBREVS


def split_into_sentences(text: str) -> list[SplitSentence]:
    out: list[SplitSentence] = []
    idx = 0
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if (m := _HEADING_RE.match(raw_line)):
            out.append(SplitSentence(idx, m.group(2), is_heading=True))
            idx += 1
            continue
        if _NUMBERED_HEADING_RE.match(line):
            out.append(SplitSentence(idx, line, is_heading=True))
            idx += 1
            continue
        merged: list[str] = []
        for cand in _BOUNDARY.split(line):
            if merged and _ends_in_abbrev(merged[-1]):
                merged[-1] = merged[-1] + " " + cand
            else:
                merged.append(cand)
        for sent in merged:
            stripped = sent.strip()
            if stripped:
                out.append(SplitSentence(idx, stripped, is_heading=False))
                idx += 1
    return out
