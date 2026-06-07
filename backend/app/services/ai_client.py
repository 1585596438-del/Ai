import os
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
