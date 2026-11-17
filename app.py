"""Vercel entry point: the Flask application object is named ``app``."""

from debtlens.api import create_app

app = create_app()
