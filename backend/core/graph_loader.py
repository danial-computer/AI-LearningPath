import os
import json
import networkx as nx

# ─── Helper: Memuat Silabus & NetworkX DAG ───
def load_syllabus_graph(course_name: str):
    filename = {
        "Database": "praktikum_database.json",
        "Orarkom": "praktikum_orarkom.json",
        "Struktur Data": "praktikum_strukdat.json"
    }.get(course_name)

    if not filename:
        return None, []

    paths = [
        os.path.join("silabus", filename),
        os.path.join("..", "silabus", filename),
        os.path.join("AI-LearningPath", "silabus", filename),
        filename
    ]

    syllabus_data = []
    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    syllabus_data = json.load(f)
                break
            except Exception as e:
                print(f"Error reading syllabus file {path}: {e}")

    if not syllabus_data:
        return None, []

    G = nx.DiGraph()
    for topic in syllabus_data:
        G.add_node(topic["id"], **topic)

    for topic in syllabus_data:
        for prereq in topic.get("prerequisites", []):
            if G.has_node(prereq):
                G.add_edge(prereq, topic["id"])

    return G, syllabus_data

# ─── Helper: Rekomendasi Topik Selanjutnya ───
def get_next_topic(session):
    if not session.graph:
        return None

    if session.override_active and session.override_node:
        override_id = session.override_node
        for topic in session.syllabus:
            if topic["id"] == override_id:
                return topic

    for topic in session.syllabus:
        tid = topic["id"]
        if session.mastery.get(tid, 0.0) >= 0.8:
            continue

        prereqs = list(session.graph.predecessors(tid))
        all_prereqs_met = True
        for p in prereqs:
            if session.mastery.get(p, 0.0) < 0.8:
                all_prereqs_met = False
                break

        if all_prereqs_met:
            return topic

    return None
