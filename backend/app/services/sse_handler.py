"""SSE 事件推送管理器 — 在异步生成任务中用来广播进度和文本"""
import asyncio
import json
import time
from typing import Optional


class SSEHandler:
    """SSE 事件队列：生成任务往里放事件，/stream 端点往外取"""

    def __init__(self):
        self._queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
        self._start_time = time.time()

    def progress(self, stage: str, progress: int, detail: str = ""):
        """推送进度事件"""
        payload = json.dumps({
            "stage": stage,
            "progress": progress,
            "detail": detail
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: progress\ndata: {payload}\n\n")

    def message_delta(self, message_id: str, delta: str):
        """推送消息文本增量"""
        payload = json.dumps({
            "message_id": message_id,
            "delta": delta
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: message\ndata: {payload}\n\n")

    def done(self, conversation_id: str, message_id: str, status: str = "completed"):
        """推送完成事件"""
        duration_ms = int((time.time() - self._start_time) * 1000)
        payload = json.dumps({
            "conversation_id": conversation_id,
            "message_id": message_id,
            "status": status,
            "duration_ms": duration_ms
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: done\ndata: {payload}\n\n")
        self._queue.put_nowait(None)  # 结束信号

    def error(self, error_code: str, error_message: str):
        """推送错误事件"""
        payload = json.dumps({
            "error_code": error_code,
            "error_message": error_message
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: error\ndata: {payload}\n\n")
        self._queue.put_nowait(None)

    async def __aiter__(self):
        """异步迭代器：供 StreamingResponse 消费"""
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item


# 全局注册表：conversation_id → SSEHandler
_handlers: dict[str, SSEHandler] = {}


def get_handler(conversation_id: str) -> SSEHandler:
    """为指定对话创建并注册一个新的 SSEHandler"""
    handler = SSEHandler()
    _handlers[conversation_id] = handler
    return handler


def remove_handler(conversation_id: str):
    """移除指定对话的 SSEHandler"""
    _handlers.pop(conversation_id, None)


def get_existing_handler(conversation_id: str) -> Optional[SSEHandler]:
    """获取已有 SSEHandler（不创建新的）"""
    return _handlers.get(conversation_id)
