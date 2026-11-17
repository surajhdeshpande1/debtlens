"""DebtLens — Developer Incident & Technical Debt Management.

One analytics engine (``debtlens.core``) shared by three front doors:

* ``debtlens.api``  – the Flask REST API behind the website (deployed on Vercel)
* ``debtlens.cli``  – the ``debtlens`` command-line tool for engineers and CI
* ``public/``       – the plain HTML/CSS/JS website
"""

__version__ = "2.0.0"
APP_NAME = "DebtLens"
APP_TAGLINE = "Developer Incident & Technical Debt Management"
