import csv
import json
import os
import re
import urllib.request
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = ROOT / "datasets/esa-anomaly-dataset/data/mission1-subset/ESA-Mission1"
PAPER_URL = "https://arxiv.org/abs/1802.04431"
NASA_DATASET_URL = (
    "https://www.kaggle.com/datasets/patrickfleith/"
    "nasa-anomaly-detection-dataset-smap-msl")
ESA_DATASET_URL = "https://zenodo.org/records/15237121"


def _markdown_passages(path, title, source_url):
    if not path.is_file():
        return []

    passages = []
    section = "Overview"
    lines = []
    in_code = False

    def flush():
        text = " ".join(line.strip() for line in lines if line.strip())
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) >= 60:
            passages.append({
                "source_title": title,
                "section": section,
                "source_path": path.relative_to(ROOT).as_posix(),
                "source_url": source_url,
                "passage": text[:2400],
            })

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        heading = re.match(r"^#{1,6}\s+(.+?)\s*#*\s*$", line)
        if heading:
            flush()
            lines = []
            section = heading.group(1)
        else:
            lines.append(line)
    flush()
    return passages


@lru_cache(maxsize=2)
def load_knowledge_index():
    passages = []
    sources = [
        (ROOT / "README.md", "Space03 README",
         "https://github.com/sanchittttttt/Space03/blob/main/README.md"),
        (ROOT / "docs/SPACE-03 Team Handoff Satellite Health Anomaly Detection.md",
         "SPACE-03 Team Handoff",
         "https://github.com/sanchittttttt/Space03/blob/main/docs/"),
        (ROOT / "docs/anomaly-detection-glossary.md",
         "Satellite Anomaly Detection Glossary",
         "https://github.com/sanchittttttt/Space03/blob/main/docs/anomaly-detection-glossary.md"),
    ]
    for path, title, source_url in sources:
        source_passages = _markdown_passages(path, title, source_url)
        for passage in source_passages:
            if path.name.startswith("SPACE-03 Team Handoff"):
                anchor = re.sub(r"[^a-z0-9 -]", "", passage["section"].lower())
                passage["source_url"] = source_url + "SPACE-03%20Team%20Handoff%20Satellite%20Health%20Anomaly%20Detection.md#" + re.sub(r"\s+", "-", anchor).strip("-")
        passages.extend(source_passages)

    passages.extend([
        {
            "source_title": "Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding",
            "section": "Abstract",
            "source_path": None,
            "source_url": PAPER_URL,
            "passage": (
                "The paper describes LSTM prediction of spacecraft telemetry "
                "and a complementary unsupervised, nonparametric approach "
                "for thresholding prediction errors on expert-labeled SMAP "
                "satellite and MSL rover data. A detector flag indicates "
                "unusual telemetry behavior; it does not identify a physical "
                "cause or guarantee advance warning."),
        },
        {
            "source_title": "NASA Anomaly Detection Dataset SMAP & MSL",
            "section": "About this file",
            "source_path": None,
            "source_url": NASA_DATASET_URL,
            "passage": (
                "The dataset contains expert-labeled telemetry anomaly data "
                "from SMAP and the Mars Science Laboratory rover. Point "
                "anomalies may be detected without temporal context; "
                "contextual anomalies depend on sequence behavior. The "
                "channels are anonymized and labels identify time ranges, "
                "not physical root causes."),
        },
        {
            "source_title": "ESA Anomaly Dataset",
            "section": "Mission 1 labels and anomaly taxonomy",
            "source_path": "datasets/esa-anomaly-dataset/data/mission1-subset/ESA-Mission1/labels.csv",
            "source_url": ESA_DATASET_URL,
            "passage": (
                "ESA Mission 1 labels associate event IDs with channels and "
                "timestamp intervals. The anomaly taxonomy supplies "
                "documented category, locality, dimensionality, and length. "
                "A similar labeled event is contextual evidence only and "
                "does not prove the same cause."),
        },
    ])

    if not passages:
        return [], None, None
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True,
                                 stop_words="english")
    matrix = vectorizer.fit_transform(
        [passage["passage"] for passage in passages])
    return passages, vectorizer, matrix


def retrieve_knowledge(query, limit=4, min_relevance=0.035):
    passages, vectorizer, matrix = load_knowledge_index()
    if vectorizer is None or not query.strip():
        return []

    similarities = cosine_similarity(
        vectorizer.transform([query]), matrix).ravel()
    ranked = np.argsort(similarities)[::-1]
    results = []
    for index in ranked:
        relevance = float(similarities[index])
        if relevance < min_relevance or len(results) >= limit:
            break
        result = dict(passages[int(index)])
        result["citation_id"] = "S{}".format(len(results) + 1)
        result["relevance"] = round(relevance, 4)
        results.append(result)
    return results


@lru_cache(maxsize=4)
def load_case_index(data_dir):
    directory = Path(data_dir)
    labels_path = directory / "labels.csv"
    taxonomy_path = directory / "anomaly_types.csv"
    if not labels_path.is_file() or not taxonomy_path.is_file():
        return [], None, None

    with taxonomy_path.open(newline="", encoding="utf-8") as taxonomy_file:
        taxonomy = {row["ID"]: row for row in csv.DictReader(taxonomy_file)}

    documents = []
    metadata = []
    with labels_path.open(newline="", encoding="utf-8") as labels_file:
        for row in csv.DictReader(labels_file):
            category = taxonomy.get(row["ID"], {})
            try:
                start = datetime.fromisoformat(
                    row["StartTime"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(
                    row["EndTime"].replace("Z", "+00:00"))
                duration_seconds = max(0.0, (end - start).total_seconds())
            except (TypeError, ValueError):
                duration_seconds = None

            channel = row["Channel"]
            anomaly_type = category.get("Category", "unknown")
            locality = category.get("Locality", "unknown") or "unknown"
            dimensionality = (category.get("Dimensionality", "unknown")
                               or "unknown")
            duration_band = (
                "short point event" if duration_seconds is not None and
                duration_seconds == 0 else
                "longer interval event" if duration_seconds is not None and
                duration_seconds > 0 else "unknown duration event")
            documents.append("{} {} {} {}".format(
                channel, anomaly_type, locality, duration_band))
            metadata.append({
                "anomaly_id": row["ID"],
                "channel": channel,
                "category": anomaly_type,
                "locality": locality,
                "dimensionality": dimensionality,
                "start_time": row["StartTime"],
                "end_time": row["EndTime"],
                "duration_seconds": duration_seconds,
                "source_title": "ESA Anomaly Dataset",
                "section": "Mission 1 labels and anomaly taxonomy",
                "source_path": "labels.csv; anomaly_types.csv",
                "source_url": ESA_DATASET_URL,
            })

    if not documents:
        return [], None, None
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True,
                                 stop_words="english")
    matrix = vectorizer.fit_transform(documents)
    return metadata, vectorizer, matrix


def retrieve_references(channel_group, detector, interval_length_steps,
                        triage_label, data_dir=None, limit=3):
    directory = Path(data_dir or os.getenv("ESA_DATA_DIR", DEFAULT_DATA_DIR))
    metadata, vectorizer, matrix = load_case_index(str(directory.resolve()))
    if vectorizer is None:
        return []

    length_band = ("short point" if interval_length_steps <= 1 else
                   "longer interval")
    query = "{} {} {} interval {} steps triage {}".format(
        channel_group, detector, length_band, interval_length_steps,
        triage_label)
    query_vector = vectorizer.transform([query])
    similarities = cosine_similarity(query_vector, matrix).ravel()
    order = np.argsort(similarities)[::-1]
    results = []
    for index in order:
        if similarities[index] < 0.025 or len(results) >= limit:
            break
        results.append({
            **metadata[int(index)],
            "citation_id": "C{}".format(len(results) + 1),
            "relevance": round(float(similarities[index]), 4),
        })
    return results


def summarize_report(report):
    anomaly_count = len(report["anomalies"])
    total_anomaly_count = report.get("total_anomaly_intervals", anomaly_count)
    if total_anomaly_count and anomaly_count:
        sentences = [
            "{} flagged interval(s) were found on {} (showing {} on this page).".format(
                total_anomaly_count, report["channel"], anomaly_count),
            "The latest returned interval has score {:.4f} against threshold {:.4f}.".format(
                report["anomalies"][-1]["anomaly_score"],
                report["threshold"]),
            "The recent telemetry trend is {}.".format(
                report["recent_temporal_trend"]["direction"]),
        ]
    elif total_anomaly_count:
        sentences = [
            "{} flagged interval(s) were found on {}; use the offset parameter to view event pages.".format(
                total_anomaly_count, report["channel"]),
            "The recent telemetry trend is {}.".format(
                report["recent_temporal_trend"]["direction"]),
        ]
    else:
        sentences = [
            "No windows crossed the anomaly threshold for {}.".format(
                report["channel"]),
            "The recent telemetry trend is {}.".format(
                report["recent_temporal_trend"]["direction"]),
        ]

    if report["retrieved_references"]:
        reference = report["retrieved_references"][0]
        sentences.append(
            "The closest labeled reference is {} ({}) on {}, relevance {:.2f}; "
            "this is context, not evidence of a shared cause [{}].".format(
                reference["anomaly_id"], reference["category"],
                reference["channel"], reference["relevance"],
                reference["citation_id"]))
    if report.get("knowledge_sources"):
        reference = report["knowledge_sources"][0]
        sentences.append("Relevant guidance is in {} [{}].".format(
            reference["section"], reference["citation_id"]))
    return " ".join(sentences)


def generate_summary(report):
    endpoint = os.getenv("RAG_CHAT_COMPLETIONS_URL")
    api_key = os.getenv("RAG_API_KEY")
    model_name = os.getenv("RAG_MODEL")
    if not endpoint or not api_key or not model_name:
        return summarize_report(report), "local_template"

    prompt = {
        "model": model_name,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Summarize only the supplied structured telemetry report "
                    "and retrieved references. Do not infer a root cause or "
                        "treat anomaly scores as probabilities. Mention uncertainty "
                        "and cite sources only by their supplied citation IDs."),
            },
            {"role": "user", "content": json.dumps(report)},
        ],
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(prompt).encode("utf-8"),
        headers={
            "Authorization": "Bearer {}".format(api_key),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            result = json.load(response)
        summary = result["choices"][0]["message"]["content"].strip()
        if summary:
            return summary, "configured_llm"
    except (KeyError, IndexError, TypeError, ValueError, OSError):
        pass
    return summarize_report(report), "local_template_fallback"


def answer_question(question, detection_context=None):
    context = detection_context or {}
    query_context = " ".join(str(context.get(key, "")) for key in (
        "channel_group", "detector", "interval_length_steps", "triage_label"))
    question_terms = question
    if context.get("anomaly_score") is not None:
        question_terms += (
            " Isolation Forest score score_samples threshold flagged when "
            "score is lower than threshold, not probability")
    sources = retrieve_knowledge(
        "{} {}".format(question_terms, query_context))
    if not sources:
        return {
            "answer": "No supporting documentation found in the configured sources.",
            "recommendations": [],
            "recommendation_status": (
                "No approved spacecraft maintenance procedures are indexed; "
                "no operational recommendation is provided."),
            "sources": [],
            "retrieval_status": "no_supporting_documentation",
            "generation": "local_retrieval",
        }

    citations = " ".join(
        "[{}] {} — {}".format(source["citation_id"],
                              source["source_title"], source["section"])
        for source in sources)
    answer = "Relevant documented context: {} Sources: {}".format(
        " ".join("[{}] {}".format(source["citation_id"], source["passage"])
                 for source in sources), citations)
    anomaly_score = context.get("anomaly_score")
    threshold = context.get("threshold")
    if anomaly_score is not None and threshold is not None:
        rule_source = next((source for source in sources
                            if source["section"] ==
                            "Prediction error and threshold"), None)
        citation = (" [{}]".format(rule_source["citation_id"])
                    if rule_source else "")
        if anomaly_score < threshold:
            reason = ("The supplied model score {:.6f} is below its threshold "
                      "{:.6f}, so this window was flagged.".format(
                          anomaly_score, threshold))
        else:
            reason = ("The supplied model score {:.6f} is not below its "
                      "threshold {:.6f}, so this window was not flagged.".format(
                          anomaly_score, threshold))
        answer = reason + citation + " " + answer
    generation = "local_retrieval"

    endpoint = os.getenv("RAG_CHAT_COMPLETIONS_URL")
    api_key = os.getenv("RAG_API_KEY")
    model_name = os.getenv("RAG_MODEL")
    if endpoint and api_key and model_name:
        payload = {
            "model": model_name,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Answer using only the supplied source passages. Cite "
                        "claims with their exact [S#] citation IDs. Never infer "
                        "what an anonymized channel measures or a failure cause. "
                        "Do not give spacecraft operating procedures unless a "
                        "source passage explicitly documents them. If sources "
                        "do not support an answer, say so."),
                },
                {
                    "role": "user",
                    "content": json.dumps({
                        "question": question,
                        "detection_context": context,
                        "sources": sources,
                    }),
                },
            ],
        }
        request = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": "Bearer {}".format(api_key),
                     "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                generated = json.load(response)
            content = generated["choices"][0]["message"]["content"].strip()
            if content:
                answer = content
                generation = "configured_llm"
        except (KeyError, IndexError, TypeError, ValueError, OSError):
            generation = "local_retrieval_fallback"

    return {
        "answer": answer,
        "recommendations": [],
        "recommendation_status": (
            "No approved spacecraft maintenance procedures are indexed; "
            "no operational recommendation is provided."),
        "sources": sources,
        "retrieval_status": "grounded_sources_found",
        "generation": generation,
    }