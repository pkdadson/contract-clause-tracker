from dataclasses import dataclass
import re
import pysbd

_HEADING_RE = re.compile(r"^\s*(#{1,6})\s+(.+?)\s*$")
_NUMBERED_HEADING_RE = re.compile(r"^\s*\d+(\.\d+)*\.?\s+[A-Z][^.]{1,80}$")

@dataclass(frozen=True, slots=True)
class SplitSentence:
    idx: int
    text: str
    is_heading: bool


def split_into_sentences(text: str) -> list[SplitSentence]:
    segmenter = pysbd.Segmenter(language="en", clean=False)
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
        for sent in segmenter.segment(line):
            stripped = sent.strip()
            if stripped:
                out.append(SplitSentence(idx, stripped, is_heading=False))
                idx += 1
    return out