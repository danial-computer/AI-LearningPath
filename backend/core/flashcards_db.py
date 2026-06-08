# ─── Database Flashcards Statik untuk Active Recall ───
FLASHCARDS_DB = {
    "DB_01_INTRO": [
        {"q": "Apa fungsi utama DBMS?", "a": "Mengelola, menyimpan, memanipulasi, dan memulihkan basis data secara efisien dan aman."},
        {"q": "Apa itu arsitektur 3-level ANSI-SPARC?", "a": "Arsitektur level Eksternal (User view), Konseptual (Community view), dan Internal (Physical view) untuk memisahkan struktur logis dan fisik data."}
    ],
    "DB_02_ERD": [
        {"q": "Apa beda entitas kuat dan entitas lemah?", "a": "Entitas kuat memiliki primary key unik sendiri, sedangkan entitas lemah bergantung pada entitas kuat lain untuk diidentifikasi."},
        {"q": "Apa arti kardinalitas relasi 1:N?", "a": "Satu baris data di tabel pertama dapat terhubung ke banyak baris di tabel kedua, tetapi baris di tabel kedua hanya dapat terhubung ke satu baris di tabel pertama."}
    ],
    "DB_03_RELATIONAL_MODEL": [
        {"q": "Apa itu Foreign Key?", "a": "Kolom di suatu tabel yang merujuk pada Primary Key tabel lain untuk menghubungkan kedua tabel."},
        {"q": "Apa yang dimaksud Integritas Referensial?", "a": "Aturan yang memastikan nilai Foreign Key di suatu tabel selalu menunjuk ke baris yang ada (valid) di tabel asal."}
    ],
    "DB_04_NORMALIZATION": [
        {"q": "Kapan suatu tabel memenuhi syarat Bentuk Normal Ketiga (3NF)?", "a": "Ketika sudah memenuhi 2NF dan tidak memiliki ketergantungan transitif (atribut non-key tidak boleh bergantung pada atribut non-key lainnya)."},
        {"q": "Apa tujuan utama dari proses Normalisasi Database?", "a": "Meminimalkan redundansi (duplikasi) data dan menghindari anomali ketika operasi insert, update, dan delete."}
    ],
    "DB_05_SQL_DDL": [
        {"q": "Apa itu DDL dalam SQL?", "a": "Data Definition Language, digunakan untuk mendefinisikan skema dan struktur database (perintah CREATE, ALTER, DROP)."}
    ],
    "OR_01_REPRESENTASI": [
        {"q": "Bagaimana cara merepresentasikan angka negatif -5 dalam biner 8-bit Two's Complement?", "a": "5 biner: 00000101. Invert bit: 11111010. Tambah 1: 11111011."},
        {"q": "Berapakah nilai desimal dari bilangan biner 1101?", "a": "13 (8 + 4 + 0 + 1 = 13)."}
    ],
    "OR_02_GERBANG_LOGIKA": [
        {"q": "Apa karakteristik utama dari gerbang logika XOR?", "a": "Output bernilai 1 jika dan hanya jika input-inputnya memiliki nilai logika yang berbeda."}
    ],
    "SD_01_INTRO_BIGO": [
        {"q": "Berapa kompleksitas waktu (Big O) dari algoritma Binary Search?", "a": "O(log n) karena data terus dibagi dua pada setiap langkah pencarian."},
        {"q": "Mana yang lebih cepat antara O(n log n) dan O(n^2) untuk data besar?", "a": "O(n log n) jauh lebih cepat dan efisien dibandingkan O(n^2)."}
    ],
    "SD_03_LINKED_LIST": [
        {"q": "Apa keunggulan Linked List dibandingkan dengan Array konvensional?", "a": "Alokasi memori dinamis (fleksibel) dan proses insert/delete elemen lebih efisien (O(1)) tanpa menggeser elemen lain."},
        {"q": "Apa fungsi dari pointer 'Next' pada simpul (Node) Linked List?", "a": "Menyimpan alamat memori simpul berikutnya dalam rantai Linked List."}
    ],
    "SD_06_TREE_BST": [
        {"q": "Apa sifat utama dari BST (Binary Search Tree)?", "a": "Nilai semua node di anak kiri selalu lebih kecil dari node induk, dan nilai semua node di anak kanan selalu lebih besar dari node induk."},
        {"q": "Urutan penelusuran (traversal) apa yang menghasilkan output data BST terurut?", "a": "Inorder traversal (Kiri - Induk - Kanan)."}
    ]
}

def get_flashcards(topic_id: str):
    return FLASHCARDS_DB.get(topic_id, [
        {"q": f"Jelaskan prinsip utama konsep '{topic_id}'?", "a": "Prinsip utama materi ini dapat dipelajari secara interaktif bersama Smart AI AI Tutor di ruang chat."},
        {"q": f"Bagaimana penerapan konsep '{topic_id}'?", "a": "Anda dapat mencoba latihan pemrograman, kuis, atau menanyakan contoh implementasi di ruang obrolan."}
    ])
