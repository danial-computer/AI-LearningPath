import os
from google import genai
from google.genai import types

# ─── Helper: Parsing Pemilihan Profil & Gaya Belajar ───
def parse_course_selection(msg_text: str):
    msg_lower = msg_text.lower()
    if any(k in msg_lower for k in ["database", "basis data", "db", "sql"]) or msg_text.strip() == "1":
        return "Database"
    elif any(k in msg_lower for k in ["orarkom", "organisasi", "cpu", "gerbang", "assembly"]) or msg_text.strip() == "2":
        return "Orarkom"
    elif any(k in msg_lower for k in ["struktur data", "strukdat", "binary tree", "linked list", "stack", "queue", "graph"]) or msg_text.strip() == "3":
        return "Struktur Data"
    return None

# ─── Helper: Membuat System Instruction Gemini ───
def get_system_instruction(course: str, learning_style: str, current_node: dict, mastery: float, remedial_attempts: int):
    node_name = current_node.get("name", "Topik Tidak Diketahui")
    node_desc = current_node.get("description", "Tidak ada deskripsi")

    instruction = (
        "Anda adalah AI Smart AI Tutor yang cerdas, empatik, dan interaktif untuk platform pembelajaran adaptif.\n"
        f"Mata Kuliah: {course}\n"
        f"Topik saat ini: {node_name}\n"
        f"Deskripsi Topik: {node_desc}\n"
        f"Probabilitas Penguasaan Kognitif Siswa pada topik ini: {mastery:.0%}\n\n"

        "--- ATURAN ETIKA & TUTORING (SMART AI GUARDRAIL) ---\n"
        "1. JANGAN PERNAH memberikan jawaban coding langsung atau solusi mentah yang bisa di copy-paste oleh siswa.\n"
        "2. Jika siswa meminta jawaban atau kode lengkap, tolak dengan sopan dan bimbing mereka langkah-demi-langkah menggunakan pertanyaan Smart AI.\n"
        "3. Tanyakan pemahaman awal mereka, berikan potongan pseudocode atau petunjuk kecil (hints), dan minta mereka menulis kodenya sendiri.\n"
        "4. Selalu evaluasi jawaban siswa secara kritis namun konstruktif.\n\n"

        "--- PREFERENSI GAYA BELAJAR KUSTOM ---\n"
        f"Siswa telah menentukan gaya belajar yang paling disukainya: '{learning_style}'.\n"
        "Sesuaikan penjelasan Anda, analogi yang Anda buat, tingkat kedetailan visual (diagram ASCII/tabel jika relevan), atau cara Anda menyusun tantangan latihan agar sejalan dengan keinginan belajar siswa tersebut secara kreatif dan interaktif.\n\n"
    )

    if remedial_attempts >= 2:
        instruction += (
            "--- PENYISIPAN TANTANGAN (CHALLENGE INJECTION) ---\n"
            "Siswa terdeteksi berada di Remedial Loop (gagal memahami kuis/latihan berkali-kali).\n"
            "Untuk mencegah frustrasi:\n"
            "- Sederhanakan bahasa Anda dan tawarkan sub-topik alternatif yang lebih mudah.\n"
            "- Berikan analogi yang lebih sederhana.\n"
            "- Berikan saran untuk berkonsultasi dengan Asisten Praktikum.\n"
            "- Jika mereka mengalami kebuntuan total pada koding, berikan mereka tantangan visual/alternatif yang menyegarkan.\n\n"
        )

    instruction += (
        "--- EVALUASI KOGNITIF & BKT UPDATE ---\n"
        "Evaluasi apakah interaksi/jawaban siswa menunjukkan bahwa mereka berhasil menjawab kuis/pertanyaan latihan dengan BENAR atau SALAH.\n"
        "Di bagian akhir respon Anda, Anda HARUS menyisipkan salah satu tag rahasia berikut (pisahkan dengan baris baru):\n"
        "- Jika siswa berhasil menjawab pertanyaan latihan/kuis dengan BENAR dan menunjukkan pemahaman: ketik `[BKT_UPDATE: CORRECT]`\n"
        "- Jika siswa mencoba menjawab pertanyaan latihan/kuis tetapi SALAH atau masih salah paham: ketik `[BKT_UPDATE: INCORRECT]`\n"
        "- Jika siswa hanya bertanya secara umum, berdiskusi biasa, atau belum menjawab kuis: JANGAN sisipkan tag apa pun.\n"
        "Tag ini sangat penting untuk memperbarui status kognitif (Knowledge Tracing) di database backend."
    )
    return instruction

# ─── Helper: Simulasi AI Respons (Fallback jika API Key kosong) ───
def simulate_ai_response(prompt: str, session = None) -> str:
    prompt_lower = prompt.lower()
    
    # ─── Simulasi Onboarding (Setup Profil Belajar) ───
    if session and (session.course is None or session.learning_style is None):
        if session.course is None:
            # Cek jika siswa bertanya tentang memilih semua / 3 sekaligus
            if any(k in prompt_lower for k in ["bisa 3", "3 sekaligus", "pilih semua", "semua mata kuliah", "hanya bisa 1"]):
                return (
                    "Untuk satu ruang obrolan (chat session) ini, Anda hanya bisa memilih **satu mata kuliah** agar proses belajar lebih terarah dan materi tidak bercampur.\n\n"
                    "Namun, Anda bisa membuka sesi percakapan baru kapan saja dengan mengeklik tombol **'+ Chat baru'** di menu dropdown obrolan kiri atas untuk mata kuliah lainnya!\n\n"
                    "Silakan pilih salah satu mata kuliah yang ingin Anda fokuskan di sini:\n"
                    "1. **Sistem Database**\n"
                    "2. **Organisasi dan Arsitektur Komputer (Orarkom)**\n"
                    "3. **Struktur Data**\n\n"
                    "*Balas dengan mengetikkan nama mata kuliah atau angka **1**, **2**, atau **3**.*"
                )
            
            detected_course = parse_course_selection(prompt)
            if detected_course:
                # Simpan sementara di session.course agar di langkah berikutnya terdeteksi
                session.course = detected_course
                return (
                    f"Mata kuliah Anda telah diatur ke **{detected_course}**.\n\n"
                    "Sekarang, beritahu saya **bagaimana cara belajar yang paling nyaman untuk Anda?**\n"
                    "Anda bebas menuliskan preferensi belajar Anda dalam kata-kata sendiri (misalnya: *'Saya suka penjelasan dengan analogi cerita'*, *'Tolong beri visualisasi diagram teks/ASCII'*, atau *'Saya ingin langsung fokus pada latihan koding praktis'*)."
                )
            else:
                return (
                    "Halo! Selamat datang di **AI Learning Path**.\n"
                    "Sebelum kita mulai belajar, silakan pilih **Mata Kuliah** yang ingin Anda pelajari terlebih dahulu:\n\n"
                    "1. **Sistem Database**\n"
                    "2. **Organisasi dan Arsitektur Komputer (Orarkom)**\n"
                    "3. **Struktur Data**\n\n"
                    "*Balas pesan ini dengan mengetikkan nama mata kuliah atau angka **1**, **2**, atau **3**.*"
                )
        
        elif session.learning_style is None:
            # Selesaikan setup dengan tag
            return f"Bagus sekali! Gaya belajar Anda telah diatur ke: \"{prompt}\".\n\n[SETUP_COMPLETE: {session.course} | {prompt}]"
            
    if "ingin berhenti" in prompt_lower or "menyerah" in prompt_lower or "dropout" in prompt_lower:
        return (
            "⚠️ [Intervensi Sistem]\n"
            "Saya mengerti ini mungkin terasa berat. Berdasarkan data, banyak mahasiswa yang "
            "mengalami kesulitan di tahap ini, namun berhasil lulus setelah mengulang kuis "
            "praktikum. Apakah Anda ingin mencoba latihan yang lebih mudah dulu untuk "
            "mengembalikan kepercayaan diri?"
        )
    
    if any(k in prompt_lower for k in ["jawaban", "kodingan", "buatkan", "jawabannya", "minta kode"]):
        return (
            "🔍 [Smart AI Guardrail]\n"
            "Sebagai AI Tutor, saya tidak bisa memberikan jawaban kode langsung demi integritas akademik.\n"
            "Namun, saya bisa memberi Anda petunjuk. Cobalah pikirkan:\n"
            "1. Apa parameter input yang dibutuhkan?\n"
            "2. Bagaimana kondisi batas (edge cases) untuk algoritma ini?\n"
            "Coba tuliskan potongan kodenya dahulu dan bagikan ke saya untuk dievaluasi!\n\n"
            "[BKT_UPDATE: INCORRECT]"
        )
        
    if any(k in prompt_lower for k in ["benar", "betul", "selesai", "berhasil", "sudah", "berikutnya"]):
        return (
            "🎉 Bagus sekali! Jawaban atau analisis Anda tepat sekali. Anda telah berhasil menguasai bagian konsep ini.\n\n"
            "Mari kita berlanjut ke submateri berikutnya atau mencoba tantangan baru. Apakah Anda siap?\n\n"
            "[BKT_UPDATE: CORRECT]"
        )
        
    return (
        "Menarik sekali! Mari kita bahas konsep ini lebih dalam menggunakan gaya belajar yang Anda pilih.\n"
        "Apakah ada bagian dari penjelasan sebelumnya yang ingin Anda diskusikan kembali?"
    )

# ─── Helper: Memanggil Real Gemini API ───
def generate_ai_response(system_instruction: str, prompt: str, history=None) -> str:
    import os
    # Kumpulkan semua API Key dari environment
    api_keys = []
    base_key = os.environ.get("GEMINI_API_KEY")
    if base_key and base_key.strip() != "":
        api_keys.append(base_key.strip())
    
    for i in range(1, 10):
        k = os.environ.get(f"GEMINI_API_KEY_{i}")
        if k and k.strip() != "" and k.strip() not in api_keys:
            api_keys.append(k.strip())
            
    if not api_keys:
        return "⚠️ **API key error.**\n\nTidak ada Gemini API Key yang ditemukan di `.env`."

    MODELS = [
        ("gemini-2.5-flash",    "v1beta"),
        ("gemini-1.5-flash",    "v1"),
        ("gemini-1.5-pro",      "v1"),
    ]

    contents = []
    if history:
        for msg in history[-10:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg["content"])]
            ))
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=prompt)]
    ))

    last_error = None
    for api_key in api_keys:
        for model_name, api_version in MODELS:
            try:
                client = genai.Client(
                    api_key=api_key,
                    http_options={"api_version": api_version}
                )

                if api_version == "v1beta":
                    config = types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.7,
                    )
                    model_contents = contents
                else:
                    config = types.GenerateContentConfig(temperature=0.7)
                    system_turn = types.Content(
                        role="user",
                        parts=[types.Part.from_text(
                            text=f"[System Instructions — follow these throughout the conversation]\n{system_instruction}"
                        )]
                    )
                    ack_turn = types.Content(
                        role="model",
                        parts=[types.Part.from_text(text="Understood. I will follow these instructions throughout our conversation.")]
                    )
                    model_contents = [system_turn, ack_turn] + contents

                response = client.models.generate_content(
                    model=model_name,
                    contents=model_contents,
                    config=config
                )
                if model_name != "gemini-2.5-flash":
                    print(f"[Cascade] Using fallback model: {model_name}")
                return response.text
            except Exception as e:
                err_str = str(e)
                print(f"Gemini API Error [{model_name}] dengan kunci tertentu: {e}")
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "404" in err_str or "NOT_FOUND" in err_str or "503" in err_str:
                    last_error = e
                    continue # Lanjut ke model berikutnya, atau ke key berikutnya jika model habis
                
                last_error = e
                break # Hard error (auth/network), stop looping model
        else:
            # Jika loop model habis karena Resource Exhausted/404, lanjut ke API KEY berikutnya
            print("Beralih ke API Key cadangan berikutnya...")
            continue
            
        # Jika loop break (Hard error), hentikan pencarian key juga
        break

    err_str = str(last_error) if last_error else ""
    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
        return (
            "⚠️ **Sistem sedang mengalami antrean tinggi (High Demand).**\n\n"
            "Semua kunci cadangan API telah mencapai batas maksimal (Rate Limit). Harap tunggu sekitar 1 menit lalu coba lagi."
        )
    elif "503" in err_str or "UNAVAILABLE" in err_str:
        return "⚠️ **Server AI sedang kelebihan beban.**\n\nSilakan coba lagi dalam beberapa detik."
    elif "401" in err_str or "API_KEY" in err_str:
        return "⚠️ **Error API Key.**\n\nKonfigurasi API Key ditolak. Periksa kembali file `.env` Anda."
    else:
        return "⚠️ **Terjadi kesalahan saat menghubungi AI.**\n\nSilakan coba lagi sebentar lagi."



