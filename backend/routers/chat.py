import os
import uuid
import shutil
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from core.session import get_session, UserSession, session_registry
from core.graph_loader import load_syllabus_graph, get_next_topic
from core.bkt_sm2 import update_bkt, update_sm2
from core.llm_agent import generate_ai_response, get_system_instruction

router = APIRouter()
UPLOAD_DIR = "uploads"

def _build_response(reply: str, file_url, file_name, file_size, file_type):
    response = {"reply": reply}
    if file_url:
        response["file_url"] = file_url
        response["file_name"] = file_name
        response["file_size"] = file_size
        response["file_type"] = file_type
    return response

@router.post("/")
async def chat_with_ai(
    request: Request,
    message: str = Form(None),
    file: UploadFile = File(None),
):
    content_type = request.headers.get("content-type", "")
    
    # 1. Parsing Input (JSON vs Form Data)
    if "application/json" in content_type:
        try:
            body = await request.json()
            user_message = body.get("message", "")
        except Exception:
            raise HTTPException(status_code=400, detail="JSON body tidak valid.")
    else:
        user_message = message

    if not user_message:
        raise HTTPException(status_code=400, detail="Pesan (message) wajib diisi.")

    # Ambil Session ID dari headers
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, chat_history = get_session(session_id)

    # 2. Intersep Command Reset
    if user_message.strip().lower() == "/reset":
        if session_id in session_registry:
            session_registry[session_id] = {
                "session_state": UserSession(),
                "chat_history": []
            }
        reply = "🔄 **Sesi belajar telah di-reset.** Silakan pilih kembali mata kuliah dan gaya belajar Anda dengan mengirimkan pesan baru."
        return _build_response(reply, None, None, None, None)

    # 3. Handle File Upload (jika dikirim lewat Form Data)
    file_url = None
    file_name = None
    file_size = None
    file_type = None
    file_content_str = ""

    if file and file.filename:
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_url = f"http://localhost:8000/uploads/{unique_name}"
        file_name = file.filename
        file_size = os.path.getsize(file_path)
        file_type = file.content_type or "application/octet-stream"

        if ext.lower() in [".txt", ".py", ".json", ".js", ".ts", ".html", ".css", ".md", ".csv", ".ipynb", ".xml"]:
            try:
                file.file.seek(0)
                content = await file.read()
                file_content_str = f"\n\n[Siswa mengunggah file teks '{file.filename}']\nIsi file:\n```\n{content.decode('utf-8', errors='ignore')}\n```"
            except Exception as e:
                print(f"Error reading text file: {e}")

    # 4. Deteksi Profil Pengguna Baru (Onboarding via Gemini)
    if session.course is None or session.learning_style is None:
        onboarding_instruction = (
            "Anda adalah AI Smart AI Tutor untuk platform AI Learning Path.\n"
            "Tugas Anda saat ini adalah memandu siswa baru untuk mengonfigurasi profil belajar mereka secara ramah dan interaktif melalui percakapan alami.\n\n"
            
            "Langkah-langkah konfigurasi yang harus dipenuhi:\n"
            "1. Siswa harus memilih SATU mata kuliah dari 3 pilihan berikut:\n"
            "   - 'Sistem Database'\n"
            "   - 'Organisasi dan Arsitektur Komputer' (atau 'Orarkom')\n"
            "   - 'Struktur Data'\n"
            "   *Aturan:* Jika siswa bingung, ingin memilih ketiganya, atau bertanya, jelaskan dengan ramah bahwa untuk satu ruang percakapan chat ini mereka harus memilih salah satu mata kuliah agar materi tidak bercampur dan belajar lebih terfokus. Informasikan bahwa mereka bisa membuat chat/sesi baru di sidebar (tombol '+') untuk mempelajari mata kuliah lainnya secara terpisah.\n\n"
            
            "2. Siswa harus menentukan gaya belajar yang mereka inginkan secara bebas.\n"
            "   Berikan mereka contoh (seperti: penjelasan dengan analogi cerita, visualisasi diagram teks, latihan coding, dll.), tetapi bebaskan mereka untuk menentukan preferensi mereka sendiri.\n\n"
            
            "--- FORMAT PENYELESAIAN SETUP ---\n"
            "Begitu siswa secara eksplisit telah menyepakati mata kuliah pilihan mereka DAN memberikan gaya belajar yang mereka inginkan, Anda HARUS menyisipkan tag rahasia berikut di baris paling akhir respon Anda:\n"
            "`[SETUP_COMPLETE: COURSE | STYLE]`\n"
            "Di mana:\n"
            "- COURSE harus bernilai salah satu dari string eksak berikut: 'Database', 'Orarkom', atau 'Struktur Data'.\n"
            "- STYLE adalah preferensi gaya belajar kustom yang mereka inginkan (misal: 'analogi cerita dan visual diagram').\n"
            "Contoh tag akhir: `[SETUP_COMPLETE: Struktur Data | analogi cerita dan visual diagram]`\n\n"
            
            "Ingat: JANGAN sisipkan tag rahasia ini jika siswa baru memilih salah satu. Hanya sisipkan ketika KEDUA parameter tersebut sudah jelas disepakati."
        )
        
        prompt = user_message
        ai_raw_reply = generate_ai_response(
            system_instruction=onboarding_instruction,
            prompt=prompt,
            history=chat_history,
            session=session
        )
        
        # Cek apakah setup selesai dari tag [SETUP_COMPLETE: COURSE | STYLE]
        if "[SETUP_COMPLETE:" in ai_raw_reply:
            try:
                parts = ai_raw_reply.split("[SETUP_COMPLETE:")
                main_reply = parts[0].strip()
                tag_content = parts[1].split("]")[0].strip()
                course_part, style_part = tag_content.split("|", 1)
                
                detected_course = course_part.strip()
                detected_style = style_part.strip()
                
                if detected_course in ["Database", "Orarkom", "Struktur Data"]:
                    session.course = detected_course
                    session.learning_style = detected_style
                    
                    G, syllabus_data = load_syllabus_graph(session.course)
                    if G:
                        session.graph = G
                        session.syllabus = syllabus_data
                        session.mastery = {topic["id"]: 0.15 for topic in syllabus_data}
                        session.fsrs_cards = {}
                        session.remedial_attempts = 0
                        session.override_active = False
                        session.current_node = get_next_topic(session)
                        
                        reply = main_reply + (
                            f"\n\n⚙️ **[Profil Belajar Aktif]**\n"
                            f"• Mata Kuliah: **{session.course}**\n"
                            f"• Gaya Belajar: *\"{session.learning_style}\"*\n\n"
                            f"Topik pertama kita adalah **{session.current_node['name']}**.\n"
                            f"Deskripsi: {session.current_node['description']}\n\n"
                            "Apakah Anda siap untuk memulai? Katakan 'Siap' untuk memulai materi pertama!"
                        )
                        chat_history.append({"role": "user", "content": user_message})
                        chat_history.append({"role": "bot", "content": reply})
                        return _build_response(reply, file_url, file_name, file_size, file_type)
            except Exception as e:
                print(f"Error parsing SETUP_COMPLETE tag: {e}")
                
        # Jika belum selesai setup
        clean_reply = ai_raw_reply.split("[SETUP_COMPLETE:")[0].strip()
        chat_history.append({"role": "user", "content": user_message})
        chat_history.append({"role": "bot", "content": clean_reply})
        return _build_response(clean_reply, file_url, file_name, file_size, file_type)

    # 5. Percakapan Utama dengan Gemini API
    current_node = session.current_node
    mastery = session.mastery.get(current_node["id"], 0.15)
    
    system_instruction = get_system_instruction(
        course=session.course,
        learning_style=session.learning_style,
        current_node=current_node,
        mastery=mastery,
        remedial_attempts=session.remedial_attempts
    )
    
    prompt = user_message + file_content_str
    
    ai_raw_reply = generate_ai_response(
        system_instruction=system_instruction,
        prompt=prompt,
        history=chat_history,
        session=session
    )
    
    # 6. Parse Tag Update Kognitif (BKT & SM-2)
    is_correct = None
    if "[BKT_UPDATE: CORRECT]" in ai_raw_reply:
        is_correct = True
        ai_reply = ai_raw_reply.replace("[BKT_UPDATE: CORRECT]", "").strip()
    elif "[BKT_UPDATE: INCORRECT]" in ai_raw_reply:
        is_correct = False
        ai_reply = ai_raw_reply.replace("[BKT_UPDATE: INCORRECT]", "").strip()
    else:
        ai_reply = ai_raw_reply.strip()

    # Eksekusi Update Cognitive State
    if is_correct is not None:
        old_mastery = session.mastery.get(current_node["id"], 0.15)
        new_mastery = update_bkt(old_mastery, is_correct)
        session.mastery[current_node["id"]] = new_mastery
        
        # SM-2 Update
        card = session.fsrs_cards.get(current_node["id"], {"interval": 1, "ease_factor": 2.5, "repetitions": 0})
        rating = 3 if is_correct else 1
        new_card = update_sm2(card, rating)
        session.fsrs_cards[current_node["id"]] = new_card
        
        if not is_correct:
            session.remedial_attempts += 1
            # UPGRADE 1: DETEKSI REMEDIAL LOOP & RESTRUKTURISASI GRAPH DINAMIS
            if session.remedial_attempts >= 2 and not current_node.get("is_remedial", False):
                rem_node_id = f"{current_node['id']}_REM_PRACTICE"
                node_exists = any(t["id"] == rem_node_id for t in session.syllabus)
                
                if not node_exists:
                    # Ambil prasyarat asli dari node induk
                    original_prereqs = list(current_node.get("prerequisites", []))
                    
                    rem_node = {
                        "id": rem_node_id,
                        "name": f"Latihan Penguatan: {current_node['name']}",
                        "description": f"Materi penguatan terfokus dan sederhana untuk memantapkan pemahaman Anda tentang '{current_node['name']}' sebelum melangkah maju.",
                        "difficulty": max(0.1, round(current_node.get("difficulty", 0.5) - 0.2, 2)),
                        "est_minutes": 25,
                        "prerequisites": original_prereqs,
                        "is_remedial": True,
                        "parent_node_id": current_node["id"]
                    }
                    
                    # Sisipkan remedial node tepat sebelum node induk di syllabus
                    current_idx = next(i for i, t in enumerate(session.syllabus) if t["id"] == current_node["id"])
                    session.syllabus.insert(current_idx, rem_node)
                    
                    # Tambah remedial node ke NetworkX Graph
                    session.graph.add_node(rem_node_id, **rem_node)
                    
                    # Hubungkan prereqs asli ke remedial node, dan hapus hubungan langsung ke node induk
                    for p in original_prereqs:
                        if session.graph.has_node(p):
                            session.graph.add_edge(p, rem_node_id)
                            if session.graph.has_edge(p, current_node["id"]):
                                session.graph.remove_edge(p, current_node["id"])
                                
                    # Hubungkan remedial node ke node induk
                    session.graph.add_edge(rem_node_id, current_node["id"])
                    
                    # Update prerequisites list di syllabus metadata
                    for topic in session.syllabus:
                        if topic["id"] == current_node["id"]:
                            topic["prerequisites"] = [rem_node_id]
                            break
                            
                    session.mastery[rem_node_id] = 0.35
                    
                # Alihkan secara dinamis
                for topic in session.syllabus:
                    if topic["id"] == rem_node_id:
                        session.current_node = topic
                        session.mastery[rem_node_id] = 0.35  # Reset agar mereka harus mengulangnya jika dialihkan kembali
                        break
                session.remedial_attempts = 0
                ai_reply += (
                    f"\n\n⚠️ **[Jalur Belajar Direkayasa Ulang]**\n"
                    f"Sistem mendeteksi Anda mengalami hambatan berulang. AI menyisipkan materi latihan khusus: "
                    f"**{session.current_node['name']}**.\n"
                    f"Mari kita perkuat dasar pemahaman Anda pada latihan ini terlebih dahulu!"
                )
        else:
            session.remedial_attempts = 0
            
            # Jika lulus materi
            if new_mastery >= 0.8:
                next_node = get_next_topic(session)
                if next_node:
                    session.current_node = next_node
                    session.remedial_attempts = 0
                    session.override_active = False
                    ai_reply += (
                        f"\n\n🎉 **Selamat!** Anda telah menguasai topik **{current_node['name']}** dengan tingkat penguasaan kognitif {new_mastery:.0%}.\n"
                        f"Mari lanjut ke topik berikutnya: **{next_node['name']}**.\n"
                        f"Deskripsi: {next_node['description']}"
                    )
                else:
                    ai_reply += (
                        f"\n\n🏆 **Luar Biasa!** Anda telah berhasil menguasai semua materi kuliah **{session.course}**! "
                        "Seluruh silabus telah diselesaikan dengan sangat baik. Anda dapat meninjau kembali materi kapan saja atau memilih mata kuliah baru dengan mengetik **/reset**."
                    )

    # 7. Simpan Riwayat Chat
    chat_history.append({"role": "user", "content": user_message})
    chat_history.append({"role": "bot", "content": ai_reply})
    
    return _build_response(ai_reply, file_url, file_name, file_size, file_type)
