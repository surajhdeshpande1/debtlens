import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN
from typing import List, Tuple, Optional
from datetime import datetime

from app.config import settings
from app.models.incident import Incident
from app.models.causal import CauseNode

class HybridSimilarityEngine:
    def __init__(self, alpha: float = settings.SIMILARITY_ALPHA):
        self.alpha = alpha  # Weight for lexical vs semantic
        self.tfidf_vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words='english',
            min_df=1
        )
        # Subword/char n-gram vectorizer models semantic morphological similarity
        self.subword_vectorizer = TfidfVectorizer(
            analyzer='char_wb',
            ngram_range=(3, 5),
            min_df=1
        )

    def compute_lexical_similarity(self, texts: List[str]) -> np.ndarray:
        if len(texts) < 2:
            return np.ones((len(texts), len(texts)))
        tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
        return cosine_similarity(tfidf_matrix)

    def compute_semantic_similarity(self, texts: List[str]) -> np.ndarray:
        """
        Computes semantic similarity. Uses character-level n-gram subword embeddings
        which capture root semantic stems, morphological variations, and technical identifiers
        in a fast, zero-GPU/zero-network CPU-resident format.
        """
        if len(texts) < 2:
            return np.ones((len(texts), len(texts)))
        subword_matrix = self.subword_vectorizer.fit_transform(texts)
        return cosine_similarity(subword_matrix)

    def compute_hybrid_matrix(self, texts: List[str]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if len(texts) == 0:
            return np.empty((0, 0)), np.empty((0, 0)), np.empty((0, 0))
        if len(texts) == 1:
            one = np.ones((1, 1))
            return one, one, one

        lex_sim = self.compute_lexical_similarity(texts)
        sem_sim = self.compute_semantic_similarity(texts)
        hybrid = (self.alpha * lex_sim) + ((1.0 - self.alpha) * sem_sim)
        return hybrid, lex_sim, sem_sim

    def find_similar_incidents(
        self,
        target_incident: Incident,
        candidate_incidents: List[Incident],
        threshold: float = 0.20,
        top_k: int = 5
    ) -> List[dict]:
        if not candidate_incidents:
            return []

        all_incidents = [target_incident] + candidate_incidents
        texts = [f"{inc.title}. {inc.description} (module: {inc.affected_module})" for inc in all_incidents]

        hybrid_matrix, lex_matrix, sem_matrix = self.compute_hybrid_matrix(texts)

        results = []
        target_idx = 0
        for i, inc in enumerate(candidate_incidents, start=1):
            score = float(hybrid_matrix[target_idx, i])
            lex_score = float(lex_matrix[target_idx, i])
            sem_score = float(sem_matrix[target_idx, i])

            if score >= threshold:
                results.append({
                    "incident_id": inc.id,
                    "incident_number": inc.incident_number,
                    "title": inc.title,
                    "severity": inc.severity,
                    "status": inc.status,
                    "affected_module": inc.affected_module,
                    "similarity_score": round(score, 3),
                    "lexical_score": round(lex_score, 3),
                    "semantic_score": round(sem_score, 3)
                })

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:top_k]

    def detect_regressions(
        self,
        incidents: List[Incident],
        tau: float = settings.REGRESSION_THRESHOLD
    ) -> List[dict]:
        """
        Incident i is a regression of resolved incident j when:
        1. sim(i, j) >= tau
        2. both affect the same module
        3. i occurs after the recorded resolution time of j
        """
        regressions = []
        resolved_incidents = [inc for inc in incidents if inc.status == "RESOLVED" and inc.resolved_at is not None]
        active_incidents = [inc for inc in incidents if inc.status in ["OPEN", "INVESTIGATING"]]

        if not resolved_incidents or not active_incidents:
            return regressions

        all_incidents = active_incidents + resolved_incidents
        texts = [f"{inc.title} {inc.description}" for inc in all_incidents]
        hybrid_matrix, _, _ = self.compute_hybrid_matrix(texts)

        n_active = len(active_incidents)
        for i, new_inc in enumerate(active_incidents):
            for j, res_inc in enumerate(resolved_incidents):
                matrix_j = n_active + j
                sim_score = float(hybrid_matrix[i, matrix_j])

                # Check module match and timing
                if (
                    sim_score >= tau
                    and new_inc.affected_module.lower() == res_inc.affected_module.lower()
                    and new_inc.reported_at > res_inc.resolved_at
                ):
                    days_delta = (new_inc.reported_at - res_inc.resolved_at).total_seconds() / 86400.0
                    regressions.append({
                        "new_incident_id": new_inc.id,
                        "new_incident_number": new_inc.incident_number,
                        "new_incident_title": new_inc.title,
                        "resolved_incident_id": res_inc.id,
                        "resolved_incident_number": res_inc.incident_number,
                        "resolved_incident_title": res_inc.title,
                        "affected_module": new_inc.affected_module,
                        "similarity": round(sim_score, 3),
                        "resolved_at": res_inc.resolved_at,
                        "reported_at": new_inc.reported_at,
                        "days_to_recurrence": round(max(0.1, days_delta), 1)
                    })

        return regressions

    def cluster_root_causes(self, causes: List[CauseNode], eps: float = 0.50, min_samples: int = 2) -> List[dict]:
        """
        Root causes are clustered by DBSCAN over cosine distance,
        isolating one-off incidents as noise (cluster -1).
        """
        if len(causes) < 2:
            return []

        texts = [f"{c.description} {c.category}" for c in causes]
        _, _, sem_matrix = self.compute_hybrid_matrix(texts)
        
        # Convert cosine similarity to cosine distance bounded [0, 2]
        dist_matrix = np.clip(1.0 - sem_matrix, 0.0, 2.0)

        db = DBSCAN(eps=eps, min_samples=min_samples, metric="precomputed")
        labels = db.fit_predict(dist_matrix)

        clusters_dict = {}
        for idx, label in enumerate(labels):
            cid = int(label)
            if cid not in clusters_dict:
                clusters_dict[cid] = []
            clusters_dict[cid].append(causes[idx].description)

        cluster_results = []
        for cid, items in clusters_dict.items():
            is_noise = (cid == -1)
            title = f"Noise (Unclustered Singletons)" if is_noise else f"Root Cause Cluster #{cid + 1}: {items[0][:40]}..."
            cluster_results.append({
                "cluster_id": cid,
                "cause_count": len(items),
                "theme_title": title,
                "causes": items,
                "is_noise": is_noise
            })

        # Put real clusters first, noise at the end
        cluster_results.sort(key=lambda x: (x["is_noise"], -x["cause_count"]))
        return cluster_results

similarity_engine = HybridSimilarityEngine()

