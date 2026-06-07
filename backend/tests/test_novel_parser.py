import pytest
from app.services.novel_parser import split_chapters, extract_sample_for_characters
from tests.test_data import SAMPLE_NOVEL


def test_split_chapters_found():
    chapters = split_chapters(SAMPLE_NOVEL)
    assert len(chapters) == 3
    assert chapters[0].title == "第一章 初遇"
    assert chapters[1].title == "第二章 冲突"
    assert chapters[2].title == "第三章 真相"
    assert chapters[0].index == 1
    assert chapters[1].index == 2
    assert chapters[2].index == 3


def test_split_chapters_content():
    chapters = split_chapters(SAMPLE_NOVEL)
    assert "林晓" in chapters[0].content
    assert "周宇" in chapters[1].content
    assert "钢琴" in chapters[2].content


def test_extract_sample():
    sample = extract_sample_for_characters(SAMPLE_NOVEL, max_chars=500)
    assert len(sample) <= 500
    assert "第一章" in sample


def test_split_chapters_english():
    text = """
CHAPTER 1 The Beginning

Once upon a time there was a princess.
She lived in a tall tower.

Chapter 2 The Adventure

The princess escaped and found a dragon.
They became friends.

CHAPTER 3 The End

They lived happily ever after.
"""
    chapters = split_chapters(text)
    assert len(chapters) == 3
    assert "CHAPTER 1 The Beginning" in chapters[0].title


def test_split_chapters_fallback_blocks():
    text = "A" * 600 + "\n\n" + "B" * 600 + "\n\n" + "C" * 600 + "\n\n" + "D" * 600
    chapters = split_chapters(text)
    assert len(chapters) >= 3


def test_split_chapters_too_short():
    with pytest.raises(ValueError):
        split_chapters("太短了")
