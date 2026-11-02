import os
os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
