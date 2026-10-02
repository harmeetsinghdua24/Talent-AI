from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Notification, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type.value,
        "message": n.message,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    }


@router.get("/mine")
def list_my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), limit: int = 30):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    unread_count = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).count()  # noqa: E712
    return {"unread_count": unread_count, "notifications": [_serialize(n) for n in notifications]}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notification = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return _serialize(notification)


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()
    return {"status": "ok"}
