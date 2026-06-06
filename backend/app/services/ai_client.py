from openai import AsyncOpenAI


async def fetch_models(base_url: str, api_key: str):
    """获取远端模型列表，返回 (models_list, error_message)"""
    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        models = await client.models.list()
        return [m.id for m in models.data], None
    except Exception as e:
        return [], f"Failed to fetch models: {str(e)}"


async def test_connection(base_url: str, api_key: str):
    """测试连接是否可用，返回 (ok, message)"""
    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        # 轻量请求：获取模型列表
        await client.models.list()
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)


def get_client(base_url: str, api_key: str) -> AsyncOpenAI:
    """获取 OpenAI 客户端实例"""
    return AsyncOpenAI(base_url=base_url, api_key=api_key)


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
