"""All API blueprints, mounted under /api/v1."""

from . import auth, debts, evidence, incidents, intelligence, meta, playbooks, projects, reports, sandbox, simulate

ALL = [meta.bp, auth.bp, sandbox.bp, projects.bp, incidents.bp, debts.bp, playbooks.bp, intelligence.bp, simulate.bp,
       evidence.bp, reports.bp]
