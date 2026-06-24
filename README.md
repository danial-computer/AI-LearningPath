# 🎓 AI Learning Path & Smart AI Chatbot

This system is an **AI-Powered Adaptive Learning Platform** that integrates educational data mining (OULAD), Spaced Repetition algorithms (FSRS), Bayesian Knowledge Tracing (pyBKT), and a **Smart AI Chatbot** protected by **Ethical Guardrails**.

The project is built with a modern decoupled architecture:
- **Notebooks**: Exploratory Data Analysis (EDA), Curriculum Modeling (Knowledge Graph), Knowledge Tracing (pyBKT), and predictive modeling using a **Random Forest Classifier** for student dropout prediction.
- **Backend**: Python API powered by FastAPI.
- **Frontend**: Interactive, responsive web interface built with Next.js and Tailwind CSS.

---

## 🛠️ Prerequisites

Before starting the installation, ensure you have the following installed on your computer:
- [Git](https://git-scm.com/)
- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js (v18 LTS or above)](https://nodejs.org/) & npm

---

## 🚀 Step-by-Step Installation Guide

### 1. Clone the Repository
Open your Terminal or Command Prompt and run:
```bash
git clone https://github.com/danial-computer/ai-learning-path.git
cd ai-learning-path
```

> **Dataset Note:** The raw dataset (OULAD) is not included in this repository due to its large size (>100MB). If you wish to rerun the Jupyter Notebooks inside the `notebook/` directory, please download the OULAD dataset separately and place it inside the `dataset/` directory at the root level.

---

### 2. Setup Backend (FastAPI Python)

The backend handles the AI logic, database storage, session management, and coordinates the LLM RAG chatbot.

1. Open a new terminal window and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a Python Virtual Environment (recommended to avoid dependency conflicts):
   ```bash
   python -m venv venv
   ```
3. Activate the Virtual Environment:
   - **Windows:** `venv\Scripts\activate`
   - **Mac/Linux:** `source venv/bin/activate`
4. Install all python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the backend development server:
   ```bash
   uvicorn main:app --reload
   ```
   *The backend server is now running at **http://localhost:8000***

---

### 3. Setup Frontend (Next.js React)

The frontend provides an interactive user interface (UI) for the students.

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install all Node.js dependencies:
   ```bash
   npm install
   ```
3. Run the frontend development server:
   ```bash
   npm run dev
   ```
   *The web application is now running at **http://localhost:3000***

---

## 📁 Key Directory Structure

```text
Project root/
 ┣ 📂 backend/        # FastAPI API Server (AI Logic & Chatbot Handler)
 ┣ 📂 frontend/       # Next.js Web UI (Dashboard & Chat Interface)
 ┣ 📂 notebook/       # Jupyter Notebook files (EDA, ML Models, pyBKT)
 ┣ 📂 silabus/        # JSON files for Course Curriculum DAGs
 ┗ 📜 README.md       # Setup documentation (this file)
```

---

## 🤖 Connecting the LLM (Gemini API)
*Note: By default, the chatbot in this repository runs in mock/simulation mode.*

To enable the live, production-grade Gemini AI Smart Tutor:
1. Obtain an API Key from the Google AI Studio (Gemini).
2. Configure your API key(s) in the `.env` file inside the `backend/` folder once the full integration is set up.

---
*Designed and developed as part of the Reasoning & Planning in AI course project.*
