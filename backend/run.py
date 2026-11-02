import os
import sys

# Ensure virtualenv packages are discoverable by any Python interpreter
site_packages = os.path.join(os.path.dirname(__file__), "venv", "Lib", "site-packages")
if os.path.exists(site_packages) and site_packages not in sys.path:
    sys.path.insert(0, site_packages)

os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
