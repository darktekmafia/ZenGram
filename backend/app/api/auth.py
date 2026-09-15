import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import UserSession
from backend.app.schemas import UserSessionCreate, UserSessionResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.get("/session", response_model=UserSessionResponse)
async def get_current_session(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSession).where(UserSession.is_active == True))
    session = result.scalars().first()
    if not session:
        # Return default active placeholder session
        session = UserSession(
            username="admin",
            session_cookie="dummy_session_cookie",
            is_active=True,
            created_at=datetime.datetime.utcnow(),
            last_validated_at=datetime.datetime.utcnow()
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session

@router.post("/session", response_model=UserSessionResponse)
async def create_session(data: UserSessionCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSession).where(UserSession.username == data.username))
    existing = result.scalars().first()
    if existing:
        existing.session_cookie = data.session_cookie
        existing.is_active = True
        existing.last_validated_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing

    new_session = UserSession(
        username=data.username,
        session_cookie=data.session_cookie,
        is_active=True,
        last_validated_at=datetime.datetime.utcnow()
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session
