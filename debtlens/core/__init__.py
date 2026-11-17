"""DebtLens analytics engine.

Pure Python (no NumPy / scikit-learn / NetworkX at runtime) so the same code runs
inside a Vercel function, in the CLI on an engineer's laptop and in CI.  Every
algorithm is verified against a reference library in ``tests/``.

Modules
-------
text         tokenisation, char n-grams, cause normalisation
tfidf        TF-IDF vectoriser + cosine similarity
embeddings   all-MiniLM-L6-v2 sentence embeddings via ONNX Runtime (optional)
similarity   hybrid incident similarity, regression detection
clustering   DBSCAN over cosine distance, cluster themes
graph        degree / betweenness centrality (Brandes), blast radius, topo sort
economics    principal, interest, break-even and risk of each debt item
optimiser    precedence-constrained 0/1 knapsack (tree DP, branch & bound)
simulation   what-if, Monte Carlo sprint forecast, failure-cascade injection
mining       git history mining, complexity, TODO/FIXME markers, imports
ingest       error-log parsing, CSV/JSON import, GitHub issues
evaluation   precision@k, MRR, purity, ARI, regression F1
engine       glue: run the whole analysis over a project snapshot
scenarios    bundled industry datasets
"""
