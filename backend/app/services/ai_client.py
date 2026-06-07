import os
import json
import base64
from openai import AsyncOpenAI
import httpx


def _get_proxy():
    """读取系统代理环境变量"""
    return os.getenv("HTTP_PROXY") or os.getenv("http_proxy") or os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")


def _create_httpx_client(timeout: float = 10.0):
    """创建 httpx 客户端，自动使用系统代理"""
    proxy = _get_proxy()
    if proxy:
        return httpx.AsyncClient(timeout=timeout, proxy=proxy)
    return httpx.AsyncClient(timeout=timeout)


def get_client(base_url: str, api_key: str) -> AsyncOpenAI:
    """获取 OpenAI 客户端实例，自动识别系统代理"""
    proxy = _get_proxy()
    http_client = None
    if proxy:
        http_client = httpx.AsyncClient(proxy=proxy)
    return AsyncOpenAI(base_url=base_url, api_key=api_key, http_client=http_client)


async def fetch_models(base_url: str, api_key: str):
    """获取远端模型列表，返回 (models_list, error_message)"""
    try:
        client = get_client(base_url, api_key)
        models = await client.models.list()
        return [m.id for m in models.data], None
    except Exception as e:
        return [], f"Failed to fetch models: {str(e)}"


async def test_connection(base_url: str, api_key: str):
    """测试连接是否可用，返回 (ok, message)"""
    try:
        client = get_client(base_url, api_key)
        await client.models.list()
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)


async def chat_completion(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 4000,
):
    """封装聊天补全调用"""
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def chat_completion_with_system(
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 4000,
):
    """封装带 system prompt 的聊天补全调用（兼容旧版 httpx 调用方式）"""
    client = get_client(base_url, api_key)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return await chat_completion(client, model, messages, temperature, max_tokens)


# ──────── 流式聊天补全 ────────


async def stream_chat_completion(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 4096,
):
    """
    流式聊天补全：异步生成器，逐 token yield delta 内容。
    使用 httpx 流式响应遍历 SSE 事件。
    """
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    proxy = _get_proxy()
    async with httpx.AsyncClient(timeout=300.0, proxy=proxy) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise RuntimeError(f"API error {resp.status_code}: {body.decode()[:500]}")

            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        return
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


# ──────── 多模态探测 ────────


def _make_empty_png_base64() -> str:
    """生成一个 1×1 透明 PNG 的 base64（最小探测图，仅 68 字节）"""
    raw = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\r\n\xe2\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return base64.b64encode(raw).decode()


async def check_multimodal(base_url: str, api_key: str, model_name: str) -> bool:
    """
    探测模型是否支持多模态（图片输入）。
    发送一个最小图片 + 文本请求，成功返回 True，失败返回 False。
    """
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "Reply with exactly: OK"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{_make_empty_png_base64()}"}},
            ]
        }],
        "max_tokens": 5,
        "temperature": 0,
    }

    try:
        proxy = _get_proxy()
        async with httpx.AsyncClient(timeout=15.0, proxy=proxy) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return "OK" in content
            return False
    except Exception:
        return False


# 多模态探测结果缓存（按 model_name 缓存，避免重复探测）
_multimodal_cache: dict[str, bool] = {}


async def check_multimodal_cached(base_url: str, api_key: str, model_name: str) -> bool:
    """带缓存的多模态探测"""
    if model_name in _multimodal_cache:
        return _multimodal_cache[model_name]
    result = await check_multimodal(base_url, api_key, model_name)
    _multimodal_cache[model_name] = result
    return result
