from app.sentence_splitter import split_into_sentences

def test_splits_simple_paragraph():
    text = "First sentence. Second sentence. Third one!"
    result = split_into_sentences(text)
    assert [s.text for s in result] == ["First sentence.", "Second sentence.", "Third one!"]
    assert all(not s.is_heading for s in result)

def test_handles_legal_abbreviations():
    text = "Provider, Inc. shall perform. Art. 5 governs."
    result = split_into_sentences(text)
    # Two sentences, not four. pysbd handles "Inc." and "Art." as abbrev.
    assert len(result) == 2

def test_detects_markdown_headings():
    text = "# Services\nFirst sentence here. Second.\n## Payment\nThird."
    result = split_into_sentences(text)
    headings = [s.text for s in result if s.is_heading]
    assert "Services" in headings
    assert "Payment" in headings

def test_preserves_order_with_idx():
    text = "Alpha. Beta. Gamma."
    result = split_into_sentences(text)
    assert [s.idx for s in result] == [0, 1, 2]


def test_paragraph_idx_groups_sentences_on_same_line():
    text = "First. Second on same line.\nThird on new line."
    result = split_into_sentences(text)
    assert [s.paragraph_idx for s in result] == [0, 0, 1]


def test_paragraph_idx_skips_blank_lines():
    text = "First.\n\n\nSecond.\n\nThird."
    result = split_into_sentences(text)
    assert [s.paragraph_idx for s in result] == [0, 1, 2]


def test_paragraph_idx_heading_owns_its_paragraph():
    text = "# Title\nIntro sentence. Another in intro.\n## Subhead\nBody."
    result = split_into_sentences(text)
    by_text = {s.text: s.paragraph_idx for s in result}
    assert by_text["Title"] == 0
    assert by_text["Intro sentence."] == 1
    assert by_text["Another in intro."] == 1
    assert by_text["Subhead"] == 2
    assert by_text["Body."] == 3


def test_numbered_list_run_is_not_treated_as_headings():
    text = (
        "The Service Provider shall:\n"
        "\n"
        "1. Assign suitably qualified personnel to each engagement\n"
        "2. Provide monthly written status reports to the Customer\n"
        "3. Maintain availability of the hosted platform at 99.9 percent\n"
        "4. Notify the Customer of any material delay without undue delay\n"
        "\n"
        "## Next Section\n"
    )
    result = split_into_sentences(text)
    items = [s for s in result if s.text[:2] in {"1.", "2.", "3.", "4."}]
    assert len(items) == 4
    assert all(not s.is_heading for s in items)


def test_standalone_numbered_line_remains_a_heading():
    text = "1. Services\n\nThe Service Provider shall perform the work.\n"
    result = split_into_sentences(text)
    headings = [s.text for s in result if s.is_heading]
    assert headings == ["1. Services"]