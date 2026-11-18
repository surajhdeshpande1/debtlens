"""Fix playbooks: step-by-step guidance for repairing each kind of technical debt.

A playbook describes how to fix one *pattern* of debt (an unshared connection pool, missing timeouts, no cache in
front of a hot page, …): the steps, how to verify the fix, the risks, and references. Every debt item is matched to
one playbook automatically by weighted keyword rules over its title, description, root cause and category. The rules
are deterministic and explainable: the match reports which terms it found. No language model is involved.

Each playbook also carries two load factors used by the load-spike simulation:

capacity     share of a module's capacity lost while a debt of this kind is open (e.g. a shared pool or a missing
             index means the module saturates at lower traffic);
resilience   how much more easily the module fails when something it depends on fails (e.g. no timeout or circuit
             breaker means a slow dependency takes the caller down with it).

Projects can edit any built-in playbook or add their own (stored in the project settings); the edited version then
drives both the guidance and the simulation.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from . import text as T


@dataclass(frozen=True)
class Playbook:
    key: str
    title: str
    problem: str
    keywords: tuple[str, ...]
    steps: tuple[str, ...]
    verify: tuple[str, ...]
    risks: tuple[str, ...] = ()
    references: tuple[tuple[str, str], ...] = ()
    categories: tuple[str, ...] = ()
    capacity: float = 0.0
    resilience: float = 0.0
    builtin: bool = True

    def to_dict(self) -> dict:
        d = asdict(self)
        d["references"] = [{"title": t, "url": u} for t, u in self.references]
        for k in ("keywords", "steps", "verify", "risks", "categories"):
            d[k] = list(d[k])
        return d

    @classmethod
    def from_dict(cls, d: dict, builtin: bool = False) -> "Playbook":
        refs = []
        for r in d.get("references") or []:
            if isinstance(r, dict) and r.get("url"):
                refs.append((str(r.get("title") or r["url"]), str(r["url"])))
            elif isinstance(r, (list, tuple)) and len(r) == 2:
                refs.append((str(r[0]), str(r[1])))
        return cls(
            key=str(d["key"]), title=str(d.get("title") or d["key"]), problem=str(d.get("problem") or ""),
            keywords=tuple(str(k).lower() for k in d.get("keywords") or ()), steps=tuple(str(s) for s in d.get("steps") or ()),
            verify=tuple(str(s) for s in d.get("verify") or ()), risks=tuple(str(s) for s in d.get("risks") or ()),
            references=tuple(refs), categories=tuple(str(c).upper() for c in d.get("categories") or ()),
            capacity=_clamp(d.get("capacity", 0.0), 0.0, 0.6), resilience=_clamp(d.get("resilience", 0.0), 0.0, 0.6),
            builtin=builtin)


def _clamp(v, lo: float, hi: float) -> float:
    try:
        return round(max(lo, min(hi, float(v))), 3)
    except (TypeError, ValueError):
        return lo


AZ = "https://learn.microsoft.com/en-us/azure/architecture/patterns/"

LIBRARY: tuple[Playbook, ...] = (
    Playbook(
        key="pool-isolation", title="Isolate connection pools (bulkheads)",
        problem="User-facing requests and background jobs share one pool of connections or workers, so a slow job "
                "can starve the requests users are waiting on.",
        keywords=("connection pool", "pool", "bulkhead", "batch job", "batch jobs", "pool exhausted", "queuepool",
                  "shared pool", "connections"),
        categories=("ARCHITECTURAL", "INFRASTRUCTURE"),
        steps=(
            "Measure first: log pool size, connections in use and wait time per caller (API vs batch) for a few days, "
            "so the fix has a baseline.",
            "Create separate pools (or engines) for user-facing traffic and for batch or reporting jobs, each with its "
            "own size limit.",
            "Size them so that the API pool plus the batch pool plus some headroom stays below the database's "
            "connection limit.",
            "Give the batch pool a statement timeout and the API pool a short checkout timeout, so callers fail fast "
            "instead of queueing.",
            "Move long-running reports to a read replica or an off-peak schedule where possible.",
            "Alert on pool wait time and on 'pool exhausted' errors, separately for each pool.",
            "Load-test user traffic while a batch job runs and confirm the user-facing latency stays flat.",
        ),
        verify=("User-facing latency stays normal while batch jobs run.",
                "No 'pool exhausted' or connection-timeout errors from the user-facing pool for 30 days."),
        risks=("A batch pool that is too small makes jobs slower; schedule them off-peak.",
               "The total number of connections must stay within the database limit."),
        references=(("Bulkhead pattern (Azure Architecture Center)", AZ + "bulkhead"),
                    ("SQLAlchemy connection pooling", "https://docs.sqlalchemy.org/en/20/core/pooling.html")),
        capacity=0.30, resilience=0.10),
    Playbook(
        key="timeouts", title="Put a timeout on every remote call",
        problem="Calls to a database, cache or external service have no deadline, so one slow dependency ties up "
                "workers until the whole service stops responding.",
        keywords=("!timeout", "!timeouts", "timed out", "deadline", "hang", "hangs", "stuck", "slow dependency",
                  "session ttl", "otp", "expires"),
        categories=("CODE_SMELL", "INFRASTRUCTURE"),
        steps=(
            "List every outbound call in the module: database, cache, HTTP, queue, file and third-party SDK.",
            "Set connect and read timeouts on each, based on the dependency's measured p99 latency plus a margin.",
            "Make timeouts configurable per environment instead of hard-coding them.",
            "Return a clear error (or a fallback) when a timeout fires, and log the dependency name and duration.",
            "Make sure each caller's timeout is shorter than its own caller's, so the deadlines nest.",
            "Test by slowing the dependency down (a proxy or fault injection) and check the service stays responsive.",
        ),
        verify=("A slow dependency produces fast, logged timeout errors instead of a stalled service.",
                "Thread or worker pools never fill up while a dependency is slow."),
        risks=("Timeouts that are too short cause false failures; start from measured latencies.",),
        references=(("Timeouts, retries and backoff with jitter (AWS Builders' Library)",
                     "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"),
                    ("Addressing cascading failures (Google SRE book)",
                     "https://sre.google/sre-book/addressing-cascading-failures/")),
        capacity=0.10, resilience=0.30),
    Playbook(
        key="circuit-breaker", title="Add a circuit breaker and a fallback",
        problem="When a dependency fails, the module keeps calling it, piling up slow failures instead of stopping "
                "early and degrading gracefully.",
        keywords=("circuit breaker", "breaker", "fallback", "failover", "fail over", "degrade", "graceful",
                  "acquirer", "outage of"),
        categories=("ARCHITECTURAL",),
        steps=(
            "Wrap calls to the dependency in a circuit breaker with closed, open and half-open states.",
            "Open the circuit after a threshold of failures or timeouts in a short window; fail fast while it is open.",
            "Decide the fallback for each call: a secondary provider, cached data, a queued retry, or a clear message.",
            "Let a few trial calls through in the half-open state and close the circuit when they succeed.",
            "Expose the breaker state as a metric and alert when it opens.",
            "Test by making the dependency fail and confirm users get the fallback within a second or two.",
        ),
        verify=("A failing dependency opens the circuit and users get the fallback quickly.",
                "The circuit closes again on its own when the dependency recovers."),
        risks=("A fallback that hides errors can mask data problems; log every fallback.",),
        references=(("Circuit Breaker pattern (Azure Architecture Center)", AZ + "circuit-breaker"),),
        capacity=0.0, resilience=0.35),
    Playbook(
        key="retry-backoff", title="Retry safely: backoff, jitter and limits",
        problem="Failed calls are retried immediately and without limit, so a small outage turns into a retry storm "
                "that multiplies the load on a struggling service.",
        keywords=("retry", "retries", "backoff", "back-off", "rate limit", "rate-limit", "throttle", "throttling",
                  "retry loop", "retry storm", "jitter"),
        categories=("CODE_SMELL", "ARCHITECTURAL"),
        steps=(
            "Find every retry loop, including hidden ones in SDKs and HACK comments.",
            "Use exponential backoff with jitter and a maximum number of attempts.",
            "Retry only errors that are temporary (timeouts, 429, 503); never retry validation errors.",
            "Rate-limit outgoing calls per client or merchant so one tenant cannot flood a dependency.",
            "Make the retried operation idempotent, or include an idempotency key.",
            "Record the attempt count in logs and alert when retries spike.",
        ),
        verify=("During a dependency outage the outgoing request rate stays bounded.",
                "Retries stop after the configured limit and the error is reported once."),
        risks=("Retries without idempotency can duplicate payments or messages.",),
        references=(("Retry pattern (Azure Architecture Center)", AZ + "retry"),
                    ("Timeouts, retries and backoff with jitter (AWS Builders' Library)",
                     "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/")),
        capacity=0.15, resilience=0.20),
    Playbook(
        key="idempotency", title="Make the operation idempotent",
        problem="The same request, event or callback can arrive twice (retries, redelivery), and processing it twice "
                "creates duplicates or wrong balances.",
        keywords=("!idempotent", "!idempotency", "duplicate", "duplicates", "dedup", "de-duplication", "exactly once",
                  "twice", "delivery log", "callback", "consumer", "redelivery"),
        categories=("ARCHITECTURAL", "CODE_SMELL"),
        steps=(
            "Choose an idempotency key for the operation: a client request id, an event id or a natural business key.",
            "Store processed keys with their result in a table with a unique constraint.",
            "On a repeat, return the stored result instead of processing again.",
            "Do the key insert and the business change in one transaction.",
            "Expire old keys after a retention period long enough for every retry window.",
            "Test by sending the same request or event twice, including concurrently.",
        ),
        verify=("Replaying the same request or event produces exactly one effect.",
                "No duplicate records appear after a forced redelivery."),
        risks=("Choosing a key that is not truly unique silently drops legitimate requests.",),
        references=(("Making retries safe with idempotent APIs (AWS Builders' Library)",
                     "https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/"),),
        capacity=0.05, resilience=0.10),
    Playbook(
        key="durable-queue", title="Move slow work to a durable queue",
        problem="Work that could happen later (messages, notifications, integrations) runs synchronously or sits in an "
                "in-memory queue, so bursts block users and a restart loses messages.",
        keywords=("queue", "queued", "asynchronous", "async", "message", "messages", "durable", "in-memory",
                  "notification", "notifications", "sms", "worker"),
        categories=("ARCHITECTURAL", "INFRASTRUCTURE"),
        steps=(
            "Identify the work users do not need to wait for and the messages that must not be lost.",
            "Publish that work to a durable queue (a broker, or a database outbox table) inside the same transaction.",
            "Process it with workers that acknowledge only after success, with retries and a dead-letter queue.",
            "Add priorities so urgent messages (OTP, critical alerts) overtake bulk messages.",
            "Make the consumers idempotent, because messages can be delivered more than once.",
            "Monitor queue depth and age, and alert when they grow.",
        ),
        verify=("A burst of requests is absorbed by the queue; user requests stay fast.",
                "Restarting a worker loses no messages."),
        risks=("Asynchronous work needs visible status, or users cannot tell what happened.",),
        references=(("Queue-Based Load Leveling pattern (Azure Architecture Center)", AZ + "queue-based-load-leveling"),),
        capacity=0.25, resilience=0.20),
    Playbook(
        key="cache-precompute", title="Cache or precompute hot reads",
        problem="Every request recomputes or re-queries the same expensive result, so the module collapses when many "
                "users ask for it at once.",
        keywords=("precompute", "precomputed", "cached", "serve cached", "cache-aside", "materialized",
                  "summary tables", "summary table", "pre-render", "hot page", "result pages"),
        categories=("ARCHITECTURAL",),
        steps=(
            "Find the reads that dominate load during peaks (from logs or the database's slow-query log).",
            "Precompute results that change rarely (results, reports, catalog pages) when the data changes, not per "
            "request.",
            "Serve them from a cache or a static page, with a clear expiry or explicit invalidation.",
            "Protect against a stampede: one request refreshes an expired entry while others get the old copy.",
            "Warm the cache before a known peak (results day, sale start).",
            "Load-test the peak scenario with the cache in place.",
        ),
        verify=("At peak traffic the database load stays flat while page views rise.",
                "Users never see stale data beyond the agreed expiry."),
        risks=("Stale caches show wrong data; invalidate on every write path.",),
        references=(("Cache-Aside pattern (Azure Architecture Center)", AZ + "cache-aside"),),
        capacity=0.40, resilience=0.05),
    Playbook(
        key="cache-invalidation", title="Invalidate caches on every change",
        problem="A cache is not cleared when the underlying data changes, so users see stale or revoked data.",
        keywords=("invalidate", "invalidation", "stale", "rotation", "revocation", "revoked", "ttl", "cache"),
        categories=("CODE_SMELL", "SECURITY_DEBT"),
        steps=(
            "List every cached item and every code path that changes its source data.",
            "Delete or update the cache entry in each of those write paths, after the write commits.",
            "Use short expiry times for security-sensitive entries such as keys and permissions.",
            "Version cache keys when the data format changes.",
            "Test: change the data and confirm the next read returns the new value.",
        ),
        verify=("Rotated or revoked credentials stop working immediately.",
                "Changed data is visible on the next read."),
        risks=("Invalidating too broadly can cause a load spike on the database.",),
        references=(("Cache-Aside pattern (Azure Architecture Center)", AZ + "cache-aside"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="query-indexing", title="Index the slow queries",
        problem="A frequent query scans a large table because no index matches its filter and sort order.",
        keywords=("index", "indexes", "composite index", "slow query", "full table scan", "query plan", "explain"),
        categories=("CODE_SMELL", "INFRASTRUCTURE"),
        steps=(
            "Find the query in the slow-query log and run EXPLAIN on it.",
            "Design a composite index whose leading columns match the equality filters, followed by the sort column.",
            "Create the index online, or in a maintenance window for large tables.",
            "Re-run EXPLAIN and confirm the index is used and the scanned rows drop.",
            "Remove indexes that duplicate the new one.",
        ),
        verify=("The query's latency drops and EXPLAIN shows an index range scan.",),
        risks=("Every index slows writes slightly; do not add indexes that no query uses.",),
        references=(("MySQL optimization and indexes",
                     "https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html"),),
        capacity=0.25, resilience=0.0),
    Playbook(
        key="pagination-archival", title="Paginate and archive large histories",
        problem="Screens and APIs load an entire history at once, and the table keeps growing.",
        keywords=("!paginate", "pagination", "archive", "archival", "partition", "offset", "unbounded"),
        categories=("CODE_SMELL", "INFRASTRUCTURE"),
        steps=(
            "Add keyset pagination (WHERE id < last_seen ORDER BY id DESC LIMIT n) to the list API and screen.",
            "Show recent data by default and let users ask for older pages.",
            "Move old rows to an archive table or partition on a schedule.",
            "Keep summaries for old data so reports do not need the raw rows.",
            "Check every query on the table still has a usable index.",
        ),
        verify=("Response time no longer grows with the size of the history.",),
        references=(("We need tool support for keyset pagination (Use The Index, Luke)",
                     "https://use-the-index-luke.com/no-offset"),),
        capacity=0.25, resilience=0.0),
    Playbook(
        key="batching", title="Batch writes into fewer transactions",
        problem="Bulk updates are written one row and one round trip at a time, so a large job holds locks and "
                "connections for a long time.",
        keywords=("batch writes", "batch write", "bulk", "one transaction", "row by row", "n+1", "round trip",
                  "batch attendance", "batch saves"),
        categories=("CODE_SMELL",),
        steps=(
            "Group the writes into batches of a few hundred rows with a multi-row INSERT or UPDATE.",
            "Wrap each batch in one transaction and commit between batches.",
            "Replace per-row lookups (N+1 queries) with one query per batch.",
            "Make the job restartable from the last committed batch.",
            "Measure the job's duration and lock time before and after.",
        ),
        verify=("The bulk job finishes much faster and no longer blocks user requests.",),
        risks=("Very large batches hold locks longer; tune the batch size.",),
        capacity=0.20, resilience=0.0),
    Playbook(
        key="concurrency-control", title="Control concurrent updates",
        problem="Two users can update the same record at once (a slot, a stock unit, a marks sheet), so the last write "
                "wins and data is lost or double-booked under load.",
        keywords=("lock", "locking", "row-level lock", "optimistic", "version column", "race", "concurrent",
                  "concurrency", "reserve", "holds", "oversell", "double booking", "double-booked", "slot"),
        categories=("CODE_SMELL", "ARCHITECTURAL"),
        steps=(
            "Identify the record being contended and the operation that must be atomic.",
            "Use a conditional update or SELECT … FOR UPDATE for short critical sections such as slot reservation.",
            "Use optimistic locking (a version column checked on update) for long edits such as marks sheets.",
            "For stock, reserve with an expiring hold at checkout and release it on timeout.",
            "Return a clear 'someone else changed this' message and let the user retry.",
            "Test with many concurrent requests against the same record.",
        ),
        verify=("A concurrency test never produces a double booking, oversell or lost update.",),
        risks=("Long-held locks reduce throughput; keep locked sections short.",),
        references=(("Optimistic Offline Lock (Martin Fowler)",
                     "https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html"),),
        capacity=0.15, resilience=0.05),
    Playbook(
        key="replica-fallback", title="Handle replica lag safely",
        problem="Reads go to a replica that can lag behind the primary, and nothing notices when it does.",
        keywords=("replica", "replication", "lag", "primary", "read replica", "stale reads"),
        categories=("INFRASTRUCTURE",),
        steps=(
            "Measure replica lag continuously and alert above a threshold.",
            "Route reads that must be fresh (just after a write) to the primary.",
            "Automatically fall back to the primary when lag exceeds the threshold.",
            "Show users a clear status when data may be delayed.",
        ),
        verify=("When lag exceeds the threshold, reads switch to the primary and an alert fires.",),
        capacity=0.10, resilience=0.20),
    Playbook(
        key="load-testing", title="Load-test the peak before it happens",
        problem="Nobody knows how much traffic the module can take, so the first real peak is the test.",
        keywords=("load test", "load tests", "load-test", "stress test", "flash-sale", "flash sale", "capacity test",
                  "concurrency tests"),
        categories=("TEST_DEBT",),
        steps=(
            "Write down the expected peak: requests per second, mix of operations and duration.",
            "Script the user journey (browse, add to cart, pay; or log in, open results) with a load-testing tool.",
            "Run against a staging copy with production-sized data, ramping up to twice the expected peak.",
            "Record where it breaks first (CPU, connections, locks, a dependency) and fix that bottleneck.",
            "Repeat until the target holds with headroom, and keep the script for every release.",
        ),
        verify=("The system holds twice the expected peak in staging without errors.",),
        references=(("k6 load testing documentation", "https://grafana.com/docs/k6/latest/"),
                    ("Handling overload (Google SRE book)", "https://sre.google/sre-book/handling-overload/")),
        capacity=0.10, resilience=0.0),
    Playbook(
        key="test-coverage", title="Cover the risky behaviour with tests",
        problem="Behaviour that has already broken in production has no automated test, so it can break again "
                "unnoticed.",
        keywords=("test suite", "unit tests", "contract tests", "tests for", "regression tests", "test cases",
                  "coverage", "untested", "edge cases"),
        categories=("TEST_DEBT",),
        steps=(
            "Turn each past incident on this code into a failing test that reproduces it.",
            "Cover the boundaries: cut-off times, empty inputs, maximum sizes, partial failures.",
            "For interfaces with other systems, add contract tests that pin the message format.",
            "Run the tests in CI on every push and block merges when they fail.",
            "Track which incidents now have a regression test.",
        ),
        verify=("Every incident linked to this debt has a test that would have caught it.",),
        references=(("The Practical Test Pyramid (Martin Fowler)",
                     "https://martinfowler.com/articles/practical-test-pyramid.html"),
                    ("Contract Test (Martin Fowler)", "https://martinfowler.com/bliki/ContractTest.html")),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="time-and-calendar", title="Use one clock and one calendar",
        problem="Dates, cut-offs and holidays are computed in different places, time zones or calendars, so results "
                "differ around day boundaries.",
        keywords=("timezone", "time zone", "asia/kolkata", "ist", "utc", "cut-off", "cutoff", "calendar",
                  "day-boundary", "day boundary", "midnight", "holiday", "date"),
        categories=("CODE_SMELL",),
        steps=(
            "Store timestamps in UTC and convert to the business time zone only for business rules and display.",
            "Use a named time zone (for example Asia/Kolkata) from the standard library, never a fixed offset.",
            "Keep one shared calendar of working days and holidays and read it everywhere.",
            "Write tests for the minutes around midnight, cut-off times and holidays.",
        ),
        verify=("Tests around the cut-off and midnight pass in every time zone the servers might run in.",),
        references=(("Python zoneinfo", "https://docs.python.org/3/library/zoneinfo.html"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="configuration", title="Move rules and thresholds into configuration",
        problem="Business thresholds and rules are hard-coded, so every change needs a code release.",
        keywords=("configuration", "configurable", "config", "hard-coded", "hardcoded", "thresholds", "threshold",
                  "rules", "tie-break", "per-category"),
        categories=("CODE_SMELL",),
        steps=(
            "List the hard-coded values and who needs to change them.",
            "Move them to versioned configuration with validation and defaults.",
            "Log the configuration version used by each decision.",
            "Add tests for the default values and for invalid configuration.",
        ),
        verify=("A rule change no longer needs a code change, and invalid values are rejected.",),
        references=(("The Twelve-Factor App: Config", "https://12factor.net/config"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="single-source", title="Give each rule a single home",
        problem="The same calculation is implemented in several places, and the copies drift apart.",
        keywords=("centralise", "centralize", "shared", "single source", "duplicated", "rounding", "conversion",
                  "grade", "sgpa", "rules", "service"),
        categories=("CODE_SMELL", "ARCHITECTURAL"),
        steps=(
            "Find every copy of the calculation (search the code base for the formula and its constants).",
            "Write one well-tested function or service for it.",
            "Replace the copies one at a time, comparing old and new outputs on real data.",
            "Delete the old copies and add a lint or review rule against new ones.",
        ),
        verify=("Every caller uses the shared implementation and outputs match on historical data.",),
        references=(("Refactoring catalog (Martin Fowler)", "https://refactoring.com/catalog/"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="reconciliation", title="Reconcile with the source of truth",
        problem="Two systems keep their own copy of a status (payments and orders, bank and fees, stock and returns), "
                "and nothing checks that they agree.",
        keywords=("!reconciliation", "reconcile", "mismatch", "out of sync", "status", "validation job", "nightly",
                  "ledger", "stock ledger", "replay"),
        categories=("ARCHITECTURAL",),
        steps=(
            "Name the source of truth for each status.",
            "Write a scheduled job that compares the two records and lists differences.",
            "Fix differences automatically where the rule is clear; queue the rest for a person.",
            "Alert when the number of differences grows.",
        ),
        verify=("The daily reconciliation report shows zero unexplained differences.",),
        capacity=0.0, resilience=0.05),
    Playbook(
        key="access-control", title="Enforce access control on the server",
        problem="Who may read or change data is checked in the interface (or not at all) instead of on every server "
                "endpoint.",
        keywords=("authentication", "authorization", "authorisation", "ownership", "ownership checks", "role checks",
                  "permission", "open rules", "server-side", "security"),
        categories=("SECURITY_DEBT",),
        steps=(
            "List every endpoint and the role or ownership it requires.",
            "Check identity and permission on the server for each request, denying by default.",
            "Check ownership of the specific record (not just the role) for read and write.",
            "Add tests that call each endpoint as the wrong user and expect 403.",
            "Log denied requests and review them.",
        ),
        verify=("Automated tests show every endpoint refuses users without permission.",),
        references=(("OWASP Authorization Cheat Sheet",
                     "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="audit-trail", title="Record an audit trail",
        problem="Sensitive changes (merges, marks, money) leave no record of who changed what and when.",
        keywords=("audit", "audit log", "audit trail", "history of changes", "who changed"),
        categories=("SECURITY_DEBT",),
        steps=(
            "Decide which changes must be auditable and what each record must hold: who, when, before, after, why.",
            "Write the audit record in the same transaction as the change.",
            "Make audit records append-only for normal users.",
            "Add a screen or report to search the trail.",
        ),
        verify=("Every sensitive change in the test suite produces exactly one audit record.",),
        references=(("OWASP Logging Cheat Sheet",
                     "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="documentation", title="Write down the decision or procedure",
        problem="Knowledge needed to operate or change the system lives only in people's heads.",
        keywords=("document", "documentation", "!runbook", "specify", "specification", "architecture document",
                  "readme", "procedure", "design system"),
        categories=("DOCUMENTATION",),
        steps=(
            "Write the decision or procedure as a short record: context, decision, consequences.",
            "Link it from the code that implements it and from the on-call runbook.",
            "Have someone who did not write it follow it once, and fix what was unclear.",
            "Review it whenever the code it describes changes.",
        ),
        verify=("A new team member can follow the document without help.",),
        references=(("Architectural Decision Records", "https://adr.github.io/"),),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="data-quality", title="Capture structured, validated data",
        problem="Important data is captured as free text or matched loosely, so later steps make wrong decisions.",
        keywords=("structured", "free text", "matching", "patient matching", "validation", "codes", "icd-10",
                  "transliteration", "multilingual", "unit conversion", "units", "constraint", "constraint-checked"),
        categories=("CODE_SMELL", "ARCHITECTURAL"),
        steps=(
            "Define the structured fields and allowed values (a code list, units, formats).",
            "Validate at the point of entry and show users clear errors.",
            "Migrate existing free-text data in batches, flagging rows that need a person.",
            "Use the structured fields in every downstream rule.",
        ),
        verify=("New records pass validation and downstream rules no longer parse free text.",),
        capacity=0.0, resilience=0.0),
    Playbook(
        key="refactor", title="Refactor in small, tested steps",
        problem="The code works but is hard to change safely.",
        keywords=("refactor", "cleanup", "clean up", "simplify", "extract", "remove", "deprecated", "legacy"),
        categories=("CODE_SMELL",),
        steps=(
            "Write characterisation tests that pin the current behaviour.",
            "Make one small structural change at a time, running the tests after each.",
            "Ship each step separately behind the same behaviour.",
            "Delete dead code and comments that no longer apply.",
        ),
        verify=("Behaviour is unchanged (tests pass) and the change that motivated the refactor is now easy.",),
        references=(("Refactoring catalog (Martin Fowler)", "https://refactoring.com/catalog/"),),
        capacity=0.0, resilience=0.0),
)

BY_KEY = {p.key: p for p in LIBRARY}
FALLBACK = "refactor"
MIN_SCORE = 3.5  # below this the evidence is too thin and the generic refactoring playbook is used
_WORD = re.compile(r"[a-z0-9]+(?:[-/][a-z0-9]+)*")


def library(overrides: dict | None = None) -> dict[str, Playbook]:
    """Built-in playbooks with a project's edits applied and its own playbooks added."""
    out = dict(BY_KEY)
    for key, d in (overrides or {}).items():
        if not isinstance(d, dict):
            continue
        base = out.get(key)
        merged = {**(base.to_dict() if base else {}), **d, "key": key}
        out[key] = Playbook.from_dict(merged, builtin=False)
    return out


def _text(debt: dict, cause: str | None) -> tuple[str, str]:
    title = T.normalize(debt.get("title") or "")
    body = " ".join(T.normalize(x) for x in (debt.get("description") or "", cause or "") if x)
    return title, body


def _hits(term: str, text: str) -> int:
    if " " in term or "-" in term or "/" in term:
        return text.count(term)
    return sum(1 for w in _WORD.findall(text) if w == term or (len(term) > 4 and w.startswith(term)))


def match(debt: dict, cause: str | None = None, lib: dict[str, Playbook] | None = None) -> dict:
    """Pick the playbook for one debt item. Returns key, score and the terms that matched."""
    lib = lib or BY_KEY
    title, body = _text(debt, cause)
    cat = (debt.get("category") or "").upper()
    best = None
    for pb in lib.values():
        score, found = 0.0, []
        for raw in pb.keywords:
            term = raw.lstrip("!")
            weight = 3.0 if (raw.startswith("!") or " " in term or "-" in term) else 1.0
            n_title, n_body = _hits(term, title), _hits(term, body)
            if n_title or n_body:
                score += weight * (2.0 * min(n_title, 2) + min(n_body, 3))
                found.append(term)
        if score and cat and cat in pb.categories:
            score += 1.0
        if score and (best is None or score > best[0] + 1e-9):
            best = (score, pb.key, found)
    if best is None or best[0] < MIN_SCORE:
        fb = lib.get(FALLBACK) or BY_KEY[FALLBACK]
        return {"key": fb.key, "score": 0.0, "matched": [], "confident": False}
    return {"key": best[1], "score": round(best[0], 1), "matched": best[2][:6], "confident": best[0] >= 4.0}


def assign(debts: list[dict], causes: dict | None = None, lib: dict[str, Playbook] | None = None,
           chosen: dict | None = None) -> dict:
    """Playbook per debt id: an explicit choice (``chosen[debt_id]``) wins over the automatic match."""
    lib = lib or BY_KEY
    causes = causes or {}
    chosen = chosen or {}
    out = {}
    for d in debts:
        pick = chosen.get(d["id"]) or d.get("playbook")
        if pick and pick in lib:
            out[d["id"]] = {"key": pick, "score": None, "matched": [], "confident": True, "chosen": True}
        else:
            out[d["id"]] = {**match(d, causes.get(d.get("root_cause_id")), lib), "chosen": False}
    return out


def load_factors(debts: list[dict], assignment: dict, lib: dict[str, Playbook] | None = None) -> dict:
    """(capacity, resilience) per debt id, from its playbook."""
    lib = lib or BY_KEY
    out = {}
    for d in debts:
        pb = lib.get(assignment.get(d["id"], {}).get("key")) or BY_KEY[FALLBACK]
        out[d["id"]] = (pb.capacity, pb.resilience)
    return out


def for_debt(debt: dict, pb: Playbook, incidents: list[dict] | None = None, cause: str | None = None) -> dict:
    """The playbook made specific to one debt item: its context and a final check on its own incidents."""
    d = pb.to_dict()
    verify = list(d["verify"])
    incs = [i for i in incidents or [] if i]
    if incs:
        keys = ", ".join(i["key"] for i in incs[:4]) + (" …" if len(incs) > 4 else "")
        verify.append(f"No recurrence of the linked incidents ({keys}); DebtLens flags any new similar incident in "
                      f"module {debt.get('module')} as a regression.")
    d["verify"] = verify
    d["context"] = {"debt_key": debt.get("key"), "module": debt.get("module"), "root_cause": cause,
                    "incidents": [{"key": i["key"], "title": i.get("title"), "severity": i.get("severity")}
                                  for i in incs]}
    return d


def validate_custom(d: dict) -> dict:
    """Clean a playbook submitted by a tech lead (raises ValueError on bad input)."""
    key = re.sub(r"[^a-z0-9-]+", "-", str(d.get("key") or d.get("title") or "").lower()).strip("-")[:40]
    if not key:
        raise ValueError("a playbook needs a key or a title")
    title = str(d.get("title") or "").strip()[:120]
    steps = [str(s).strip()[:400] for s in d.get("steps") or [] if str(s).strip()][:15]
    if not title or not steps:
        raise ValueError("a playbook needs a title and at least one step")
    out = {
        "key": key, "title": title, "problem": str(d.get("problem") or "").strip()[:500], "steps": steps,
        "verify": [str(s).strip()[:300] for s in d.get("verify") or [] if str(s).strip()][:8],
        "risks": [str(s).strip()[:300] for s in d.get("risks") or [] if str(s).strip()][:8],
        "keywords": [str(s).strip().lower()[:40] for s in d.get("keywords") or [] if str(s).strip()][:20],
        "categories": [str(s).strip().upper()[:30] for s in d.get("categories") or [] if str(s).strip()][:6],
        "capacity": _clamp(d.get("capacity", 0.0), 0.0, 0.6), "resilience": _clamp(d.get("resilience", 0.0), 0.0, 0.6),
        "references": [{"title": str(r.get("title") or r.get("url"))[:120], "url": str(r["url"])[:300]}
                       for r in d.get("references") or [] if isinstance(r, dict) and
                       str(r.get("url") or "").startswith(("https://", "http://"))][:6],
    }
    return out
