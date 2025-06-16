from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

DATABASE_URL = "sqlite:///./local.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    slack_id = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String)
    total_xp = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Submission(Base):
    __tablename__ = "submissions"
    submission_id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI()

class UserCreate(BaseModel):
    slack_id: str
    display_name: str | None = None

class UserUpdate(BaseModel):
    total_xp: int | None = None
    current_streak: int | None = None
    longest_streak: int | None = None
    display_name: str | None = None

@app.post("/users")
def create_user(payload: UserCreate):
    session = SessionLocal()
    user = User(slack_id=payload.slack_id, display_name=payload.display_name)
    session.add(user)
    session.commit()
    session.refresh(user)
    session.close()
    return {"user": user.__dict__}

@app.get("/users/slack/{slack_id}")
def get_user_by_slack(slack_id: str):
    session = SessionLocal()
    user = session.query(User).filter_by(slack_id=slack_id).first()
    session.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user.__dict__}

@app.get("/users/{user_id}")
def get_user(user_id: int):
    session = SessionLocal()
    user = session.query(User).get(user_id)
    session.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user.__dict__}

@app.put("/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate):
    session = SessionLocal()
    user = session.query(User).get(user_id)
    if not user:
        session.close()
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(user, k, v)
    user.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(user)
    session.close()
    return {"user": user.__dict__}

@app.get("/submissions/count")
def submissions_count(author_id: int):
    session = SessionLocal()
    count = session.query(Submission).filter_by(author_id=author_id).count()
    session.close()
    return {"count": count}
