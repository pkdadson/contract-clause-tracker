from dataclasses import dataclass
import re

_HEADING_RE = re.compile(r"^\s*(#{1,6})\s+(.+?)\s*$")
_NUMBERED_HEADING_RE = re.compile(r"^\s*\d+(\.\d+)*\.?\s+[A-Z][^.]{1,80}$")
_LIST_PREFIX_RE = re.compile(r"^\s*\d+(\.\d+)*\.?\s+")
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
    paragraph_idx: int


def _ends_in_abbrev(s: str) -> bool:
    m = _TAIL_WORD.search(s)
    return m is not None and m.group(1).lower() in _ABBREVS


def _numbered_list_lines(lines: list[str]) -> set[int]:
    """Indices of lines that belong to a run of two or more consecutive numbered lines.

    A standalone ``1. Services`` line is still treated as a heading. Only when
    two or more numbered lines appear in a row (separated at most by blanks) do
    we classify them as list items.
    """
    runs: list[list[int]] = []
    current: list[int] = []
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue
        if _HEADING_RE.match(raw):
            if current:
                runs.append(current)
                current = []
            continue
        m = _LIST_PREFIX_RE.match(line)
        if m and m.end() < len(line):
            current.append(i)
            continue
        if current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    result: set[int] = set()
    for run in runs:
        if len(run) >= 2:
            result.update(run)
    return result


def split_into_sentences(text: str) -> list[SplitSentence]:
    lines = text.splitlines()
    list_lines = _numbered_list_lines(lines)
    out: list[SplitSentence] = []
    idx = 0
    paragraph_idx = -1
    for i, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue
        paragraph_idx += 1
        if (m := _HEADING_RE.match(raw_line)):
            out.append(SplitSentence(idx, m.group(2), True, paragraph_idx))
            idx += 1
            continue
        if i not in list_lines and _NUMBERED_HEADING_RE.match(line):
            out.append(SplitSentence(idx, line, True, paragraph_idx))
            idx += 1
            continue
        prefix = ""
        body = line
        if i in list_lines:
            pm = _LIST_PREFIX_RE.match(line)
            if pm:
                prefix = pm.group(0)
                body = line[pm.end():]
        merged: list[str] = []
        for cand in _BOUNDARY.split(body):
            if merged and _ends_in_abbrev(merged[-1]):
                merged[-1] = merged[-1] + " " + cand
            else:
                merged.append(cand)
        if prefix and merged:
            merged[0] = prefix + merged[0]
        for sent in merged:
            stripped = sent.strip()
            if stripped:
                out.append(SplitSentence(idx, stripped, False, paragraph_idx))
                idx += 1
    return out
