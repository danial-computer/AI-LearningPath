from fastapi import APIRouter, Request
from core.session import get_session, UserSession, session_registry

router = APIRouter()

@router.post("/reset")
def reset_session(request: Request):
    session_id = request.headers.get("X-Session-ID", "default_session")
    if session_id in session_registry:
        session_registry[session_id] = {
            "session_state": UserSession(),
            "chat_history": []
        }
    return {"status": "ok", "message": f"Sesi belajar '{session_id}' berhasil di-reset!"}

@router.get("/progress")
def get_progress(request: Request):
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, _ = get_session(session_id)
    
    if not session.course:
        return {"configured": False}
        
    return {
        "configured": True,
        "course": session.course,
        "learning_style": session.learning_style,
        "current_node": session.current_node,
        "mastery": session.mastery,
        "fsrs_cards": session.fsrs_cards,
        "remedial_attempts": session.remedial_attempts,
        "syllabus": session.syllabus
    }
