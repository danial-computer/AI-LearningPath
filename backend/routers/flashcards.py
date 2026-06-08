from fastapi import APIRouter, Request
from pydantic import BaseModel
from core.session import get_session
from core.flashcards_db import get_flashcards
from core.bkt_sm2 import update_sm2

router = APIRouter()

@router.get("/")
def get_topic_flashcards(topic_id: str):
    cards = get_flashcards(topic_id)
    return {"topic_id": topic_id, "cards": cards}

class ReviewRequest(BaseModel):
    topic_id: str
    rating: int

@router.post("/review")
def review_flashcard(req: ReviewRequest, request: Request):
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, _ = get_session(session_id)
    
    if req.topic_id not in session.mastery:
        session.mastery[req.topic_id] = 0.5
        
    card = session.fsrs_cards.get(req.topic_id, {"interval": 1, "ease_factor": 2.5, "repetitions": 0})
    new_card = update_sm2(card, req.rating)
    session.fsrs_cards[req.topic_id] = new_card
    
    # Berikan dampak rating review ke Mastery BKT
    if req.rating >= 3:
        old_m = session.mastery.get(req.topic_id, 0.5)
        session.mastery[req.topic_id] = min(0.99, old_m + 0.05)
    else:
        old_m = session.mastery.get(req.topic_id, 0.5)
        session.mastery[req.topic_id] = max(0.01, old_m - 0.10)
        
    return {
        "status": "ok",
        "message": "FSRS SM-2 state updated",
        "card": new_card,
        "mastery": session.mastery[req.topic_id]
    }
