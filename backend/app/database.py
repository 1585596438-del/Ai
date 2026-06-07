from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def init_db():
    """初始化数据库表结构，并执行增量迁移"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 增量迁移：为已有数据库补充缺失列
    async with async_session() as session:
        try:
            # 检查 is_active 列是否存在（SQLite 不支持 ALTER COLUMN，用 PRAGMA 探测）
            result = await session.execute(
                text("PRAGMA table_info(ai_providers)")
            )
            columns = [row[1] for row in result.fetchall()]
            if "is_active" not in columns:
                await session.execute(
                    text("ALTER TABLE ai_providers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
                )
                await session.commit()
        except Exception:
            pass  # 表不存在时忽略

        try:
            # 检查 conversations 表的 mode 列是否存在
            result = await session.execute(
                text("PRAGMA table_info(conversations)")
            )
            columns = [row[1] for row in result.fetchall()]
            if "mode" not in columns:
                await session.execute(
                    text("ALTER TABLE conversations ADD COLUMN mode VARCHAR NOT NULL DEFAULT 'default'")
                )
                await session.commit()
        except Exception:
            pass
