import re
from dataclasses import dataclass


@dataclass
class Chapter:
    index: int
    title: str
    content: str


def split_chapters(text: str) -> list[Chapter]:
    """
    将小说文本按章节拆分。
    支持格式：第1章、第01章、第一章、CHAPTER 1 等
    """
    # 匹配常见章节标题模式
    patterns = [
        r"(?:^|\n)\s*第\s*[0-9一二三四五六七八九十百千]+\s*[章回节卷集]\s*[^\n]*",
        r"(?:^|\n)\s*CHAPTER\s*\d+\s*[^\n]*",
        r"(?:^|\n)\s*Chapter\s*\d+\s*[^\n]*",
    ]

    # 合并所有匹配
    matches = []
    for pattern in patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            matches.append((m.start(), m.group().strip()))

    # 去重排序
    matches = sorted(set(matches), key=lambda x: x[0])

    if len(matches) < 3:
        # 未找到足够章节，尝试按空行分块（兜底）
        blocks = [b.strip() for b in text.split("\n\n") if len(b.strip()) > 500]
        if len(blocks) >= 3:
            return [
                Chapter(index=i + 1, title=f"第{i + 1}段", content=b)
                for i, b in enumerate(blocks)
            ]
        raise ValueError("未找到足够的章节结构（至少需要3章）")

    chapters = []
    for i, (start, title) in enumerate(matches):
        end = matches[i + 1][0] if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        # 去掉标题行，保留正文
        content_lines = content.split("\n")
        if len(content_lines) > 1:
            content = "\n".join(content_lines[1:]).strip()
        chapters.append(Chapter(index=i + 1, title=title, content=content))

    return chapters


def extract_sample_for_characters(text: str, max_chars: int = 8000) -> str:
    """提取前 N 字符作为角色分析样本"""
    return text[:max_chars]
