# Running DebtLens on your own laptop (offline demo)

Use this when there is no internet in the lab, or as a backup during the viva. You get the same website
as on Vercel, served from your laptop with **MySQL 8** as the database.

## What you need

- Windows 10/11 (macOS and Linux work the same way, but use `python3` and `source .venv/bin/activate`)
- **Python 3.10 or newer.** From python.org, with “Add python.exe to PATH” ticked
- **MySQL 8 Server.** Already installed; remember the `root` password
- The code: `git clone https://github.com/surajhdeshpande1/debtlens` then `git checkout v2`. Or download the ZIP of the `v2` branch.

## One-time setup (about 5 minutes, needs internet once)

Open **Command Prompt** in the repository folder and run:

```bat
scripts\windows\setup.bat
```

It will:

1. create a virtual environment `.venv` and install the dependencies,
2. create the MySQL database `debtlens` and user `debtlens` (it asks for your MySQL root password),
3. download the MiniLM model (23 MB) into your user cache, so semantic similarity works offline.

If the `mysql` command is not found, open **MySQL Workbench**, connect as root, and run:

```sql
CREATE DATABASE IF NOT EXISTS debtlens CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'debtlens'@'localhost' IDENTIFIED BY 'debtlens';
GRANT ALL PRIVILEGES ON debtlens.* TO 'debtlens'@'localhost';
FLUSH PRIVILEGES;
```

DebtLens creates its own tables the first time it starts. To see them in Workbench, open the `debtlens` schema.
[db/schema.sql](../db/schema.sql) lists them too.

## Every time

```bat
scripts\windows\start.bat
```

The browser opens **http://localhost:8000**. Stop the server with `Ctrl+C`. No MySQL? Use `scripts\windows\start-sqlite.bat`.

## Before the viva

- Open each scenario once, and register your team (**Create a team**). Then use **Team & settings → Create demo team** to make one login per role, all with a password you choose.
- Check that the footer of the Home page says *MiniLM sentence embeddings + TF-IDF*. If it says *char n-gram fallback*, run `python -m debtlens model download` while you still have internet.
- The terminal tool works in the same `.venv`: `python -m debtlens demo fintech`, `python -m debtlens plan -s college --budget 40`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Access denied for user 'debtlens'` | Run the SQL above again, or set `DATABASE_URL` to your own user: `set DATABASE_URL=mysql+pymysql://root:YOURPASS@localhost:3306/debtlens` before `start.bat` |
| `Can't connect to MySQL server` | Start the **MySQL80** service (Services app → MySQL80 → Start) |
| Port 8000 busy | `python -m debtlens serve --port 8080 --db "%DATABASE_URL%"` |
| Website shows old data | Each sandbox is a private copy; use **Reset** in the top bar |
