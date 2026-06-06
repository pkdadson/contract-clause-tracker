from .sentence_splitter import SplitSentence

_TYPE_KEYWORDS: list[tuple[str, str]] = [
    ("nda", "NDA"),
    ("non-disclosure", "NDA"),
    ("master services", "MSA"),
    ("services agreement", "MSA"),
    ("msa", "MSA"),
    ("employment", "Employment"),
    ("data processing", "DPA"),
    ("dpa", "DPA"),
    ("reseller", "Reseller"),
]


def _match_keywords(haystack: str) -> str | None:
    lower = haystack.lower()
    for keyword, ctype in _TYPE_KEYWORDS:
        if keyword in lower:
            return ctype
    return None


def infer_from_title(title: str) -> str | None:
    return _match_keywords(title)


def infer_from_content(sentences: list[SplitSentence]) -> str | None:
    head_text: list[str] = []
    for ss in sentences:
        if ss.is_heading:
            head_text.append(ss.text)
            break
    body_seen = 0
    for ss in sentences:
        if ss.is_heading:
            continue
        head_text.append(ss.text)
        body_seen += 1
        if body_seen >= 2:
            break
    if not head_text:
        return None
    return _match_keywords(" ".join(head_text))
