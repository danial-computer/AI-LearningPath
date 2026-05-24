# 🎤 Exploratory Data Analysis (EDA) Dataset OULAD
**Untuk Presentasi Dosen — Mata Kuliah Reasoning & Planning dalam AI**

---

> [!TIP]
> **Cara Menggunakan Naskah Ini:** 
> - Teks biasa adalah apa yang Anda ucapkan. 
> - Teks di dalam tanda kurung siku `[ ... ]` adalah instruksi aksi (seperti memindah slide atau menunjuk grafik).
> - Sesuaikan gaya bahasa agar senatural mungkin dengan cara bicara Anda.

---

## 💡 Slide 1: Pembukaan & Judul Proyek
**[Tampilkan Slide Judul: AI Learning Path Chatbot & Analisis EDA OULAD]**

"Selamat pagi/siang Bapak/Ibu Dosen. Hari ini saya akan mempresentasikan *progress* dari proyek pembuatan **AI Learning Path Chatbot**, sebuah sistem rekomendasi belajar adaptif. 

Namun, sebelum AI bisa memberikan rekomendasi yang akurat dan etis, kita harus memahami terlebih dahulu data yang akan dipelajari oleh model kita. Oleh karena itu, fokus utama presentasi saya hari ini adalah tahap fondasi dari sistem ini, yaitu **Exploratory Data Analysis (EDA)** atau Analisis Data Eksploratif."

---

## 📊 Slide 2: Mengapa EDA Penting untuk Proyek Ini?
**[Tampilkan Slide: Tujuan EDA]**

"Mengapa EDA ini sangat krusial dalam proyek sistem berbasis AI? Dalam konteks *Reasoning and Planning*, algoritma kita hanya akan sebaik data yang ia proses. 

Saya melakukan EDA ini untuk menjawab beberapa pertanyaan fundamental:
1. Pertama, seberapa bersih data yang kita miliki?
2. Kedua, faktor apa saja yang paling memengaruhi kelulusan mahasiswa? Apakah nilai kuis, atau tingkat interaksi digital mereka?
3. Dan yang paling penting: **Apakah data historis ini memiliki bias atau diskriminasi?** Jika iya, sistem AI kita berpotensi mewarisi bias tersebut saat memberikan rekomendasi. EDA inilah yang akan mengungkap hal itu."

---

## 📂 Slide 3: Gambaran Dataset OULAD
**[Tampilkan Slide: Arsitektur / ER Diagram Dataset OULAD]**

"Dataset yang saya gunakan adalah **OULAD (Open University Learning Analytics Dataset)**. Ini adalah dataset publik dari Inggris yang mencatat histori belajar dari sekitar 32 ribu mahasiswa.

Dataset ini tidak hanya satu tabel, melainkan terdiri dari **7 file CSV yang saling terhubung** secara relasional, mulai dari data modul kursus, demografi mahasiswa, skor tugas, riwayat pendaftaran, hingga yang paling besar adalah data **VLE (Virtual Learning Environment)**. Data VLE ini mencatat lebih dari 10 juta log interaksi klik mahasiswa saat mengakses materi belajar.

Melalui *notebook* yang saya kerjakan, saya telah mengekstrak, membersihkan, dan menganalisis ketujuh dataset ini menjadi satu kesatuan."

---

## 📈 Slide 4: Temuan Kunci #1 — VLE Engagement (Interaksi Digital)
**[Tampilkan Slide: Grafik/Boxplot antara Total Klik VLE dan Hasil Akhir]**

"Masuk ke bagian hasil temuan, temuan pertama yang sangat menonjol adalah **kekuatan VLE Engagement sebagai prediktor kelulusan**.

*[Tunjuk ke arah grafik boxplot VLE vs Hasil]*
Bisa dilihat di sini, mahasiswa yang berhasil (lulus dengan predikat Pass atau Distinction) memiliki jumlah total klik dan hari aktif yang jauh melampaui mereka yang gagal (Fail) atau yang putus studi (Withdrawn). 

Selain itu, analisis deret waktu (temporal) menunjukkan bahwa mahasiswa yang berpotensi *dropout* mengalami **penurunan tajam dalam interaksi klik beberapa minggu sebelum mereka benar-benar berhenti**. Ini adalah wawasan yang sangat berharga. Artinya, AI kita nanti bisa menggunakan jeda interaksi ini sebagai *trigger* untuk memberikan intervensi dini."

---

## ⚖️ Slide 5: Temuan Kunci #2 — Evaluasi Keadilan dan Bias
**[Tampilkan Slide: Grafik Disparate Impact Ratio & IMD Band]**

"Temuan kunci kedua adalah aspek etika data. Menggunakan *Four-Fifths Rule* untuk menghitung **Disparate Impact Ratio**, saya mengaudit data ini untuk mencari potensi diskriminasi struktural.

*[Tunjuk grafik IMD Band / Indeks Deprivasi]*
Hasilnya menunjukkan bahwa status sosial-ekonomi (yang diukur lewat kolom `IMD Band` atau Indeks Deprivasi) sangat memengaruhi kelulusan. Mahasiswa dari daerah dengan tingkat kemiskinan tinggi memiliki tingkat kelulusan yang jauh lebih rendah dibandingkan mahasiswa dari daerah sejahtera. Bahkan skor rasionya berada di bawah batas ambang *fairness* 0.8.

Ini adalah **fakta yang mengusik**, di mana sistem pendidikan historis tidak sepenuhnya adil. Temuan ini memvalidasi urgensi mengapa proyek AI chatbot ini nantinya harus dilengkapi dengan mekanisme **Ethical Guardrails** dan intervensi khusus untuk kelompok rentan."

---

## 🚀 Slide 6: Relevansi EDA dengan Arsitektur AI Chatbot
**[Tampilkan Slide: Flowchart dari EDA ke Pipeline AI]**

"Sebagai penutup, bagaimana hasil EDA komprehensif ini saya transformasikan menjadi arsitektur AI yang utuh?

1. Pertama, data 20 tipe aktivitas belajar yang saya temukan di EDA menjadi *node-node* dalam pembentukan **Knowledge Graph** untuk kurikulum.
2. Kedua, korelasi kuat antara ketepatan waktu pengumpulan dan nilai, saya jadikan parameter awal (P-init, P-learn) untuk algoritma **Bayesian Knowledge Tracing (pyBKT)**.
3. Ketiga, bias sosial-ekonomi yang kita temukan tadi, menjadi motivasi utama saya menerapkan fitur **Socratic Guard dan Human Override** di dalam AI. AI tidak hanya mengevaluasi buta berdasarkan nilai, tapi dirancang untuk mendeteksi anomali pada mahasiswa rentan.

Seluruh 30 fitur agregat dari EDA ini telah saya ekspor ke dalam satu *master dataframe* yang siap digunakan untuk *engine* rekomendasi selanjutnya."

---

## 🏁 Slide 7: Penutup
**[Tampilkan Slide: Q&A / Terima Kasih]**

"Kesimpulannya, tahap EDA ini berhasil mengonversi jutaan baris log data mentah menjadi wawasan pedagogis yang bermakna, sekaligus mengungkap bias bawaan data. Fondasi ini memastikan bahwa AI Learning Path yang dikembangkan tidak sekadar algoritma buta, melainkan sistem yang adaptif, transparan, dan adil.

Terima kasih atas perhatiannya. Demikian *progress* proyek saya, dan saya persilakan jika ada pertanyaan atau masukan."
