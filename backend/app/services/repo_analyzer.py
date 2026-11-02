import os
import ast
import re
from typing import Dict, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.repository import FileHotspot, ModuleDependency, SelfAdmittedDebt, RepoMetadata
from app.utils import utc_now

# Self-admitted debt regex patterns
SATD_PATTERN = re.compile(
    r'(?://|#|/\*|\*)\s*(TODO|FIXME|HACK|DEPRECATED|OPTIMIZE|BUG|XXX|WORKAROUND|REFACTOR)[\s:\-]+(.*)',
    re.IGNORECASE
)

class CyclomaticComplexityVisitor(ast.NodeVisitor):
    def __init__(self):
        self.complexity = 1  # Base complexity is 1
        self.if_count = 0
        self.loop_count = 0
        self.except_count = 0
        self.bool_op_count = 0

    def visit_If(self, node):
        self.complexity += 1
        self.if_count += 1
        self.generic_visit(node)

    def visit_For(self, node):
        self.complexity += 1
        self.loop_count += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node):
        self.complexity += 1
        self.loop_count += 1
        self.generic_visit(node)

    def visit_While(self, node):
        self.complexity += 1
        self.loop_count += 1
        self.generic_visit(node)

    def visit_ExceptHandler(self, node):
        self.complexity += 1
        self.except_count += 1
        self.generic_visit(node)

    def visit_With(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        # and / or expressions
        added = len(node.values) - 1
        self.complexity += added
        self.bool_op_count += added
        self.generic_visit(node)

    def visit_Assert(self, node):
        self.complexity += 1
        self.generic_visit(node)

def analyze_code_snippet(source_code: str, language: str = "python") -> dict:
    total_lines = len(source_code.splitlines())
    satd_list = scan_file_for_satd("snippet.py", source_code, "playground")

    if language.lower() in ("python", "py"):
        try:
            tree = ast.parse(source_code)
            visitor = CyclomaticComplexityVisitor()
            visitor.visit(tree)
            cc = float(visitor.complexity)
            breakdown = {
                "if_branches": visitor.if_count,
                "loops": visitor.loop_count,
                "exception_handlers": visitor.except_count,
                "boolean_conditions": visitor.bool_op_count,
                "total_lines": total_lines
            }
        except Exception:
            cc = calculate_python_complexity(source_code)
            breakdown = {
                "if_branches": len(re.findall(r'\b(if|elif)\b', source_code)),
                "loops": len(re.findall(r'\b(for|while)\b', source_code)),
                "exception_handlers": len(re.findall(r'\b(except|finally)\b', source_code)),
                "boolean_conditions": len(re.findall(r'\b(and|or)\b', source_code)),
                "total_lines": total_lines
            }
    else:
        cc = calculate_js_complexity(source_code)
        breakdown = {
            "if_branches": len(re.findall(r'\b(if|else if|case)\b', source_code)),
            "loops": len(re.findall(r'\b(for|while)\b', source_code)),
            "exception_handlers": len(re.findall(r'\b(catch)\b', source_code)),
            "boolean_conditions": len(re.findall(r'(&&|\|\|)', source_code)),
            "total_lines": total_lines
        }

    if cc <= 5:
        risk = "LOW"
        rec = "Simple, easily testable logic. Low risk of latent defects."
    elif cc <= 10:
        risk = "MODERATE"
        rec = "Acceptable complexity for business routines. Ensure full branch test coverage."
    elif cc <= 20:
        risk = "HIGH"
        rec = "Complex control flow. Consider extracting nested loops and conditional branches into dedicated helper functions."
    else:
        risk = "VERY HIGH"
        rec = "Critical architectural smell. Untestable control paths. Prioritize for immediate technical debt refactoring."

    return {
        "cyclomatic_complexity": cc,
        "branch_breakdown": breakdown,
        "satd_markers": satd_list,
        "risk_level": risk,
        "recommendation": rec
    }

def calculate_python_complexity(source_code: str) -> float:
    try:
        tree = ast.parse(source_code)
        visitor = CyclomaticComplexityVisitor()
        visitor.visit(tree)
        return float(visitor.complexity)
    except Exception:
        # Fallback heuristic for unparseable syntax or partial blocks
        branches = len(re.findall(r'\b(if|elif|else|for|while|except|finally|assert|and|or)\b', source_code))
        return float(max(1, branches))

def calculate_js_complexity(source_code: str) -> float:
    # McCabe cyclomatic complexity heuristic for JS/TS
    branches = len(re.findall(r'\b(if|else if|case|for|while|catch|&&|\|\||\?)\b', source_code))
    return float(max(1, branches + 1))

def scan_file_for_satd(file_path: str, content: str, module_name: str) -> List[dict]:
    satd_list = []
    lines = content.splitlines()
    for idx, line in enumerate(lines, start=1):
        match = SATD_PATTERN.search(line)
        if match:
            marker = match.group(1).upper()
            comment = match.group(2).strip()
            satd_list.append({
                "file_path": file_path,
                "line_number": idx,
                "marker_type": marker,
                "comment_text": comment[:250],
                "module_name": module_name
            })
    return satd_list

def extract_dependencies_from_source(file_path: str, content: str, current_module: str) -> List[str]:
    dependencies = set()
    if file_path.endswith('.py'):
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for n in node.names:
                        top = n.name.split('.')[0]
                        if top != current_module and not top.startswith('_'):
                            dependencies.add(top)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        top = node.module.split('.')[0]
                        if top != current_module and not top.startswith('_'):
                            dependencies.add(top)
        except Exception:
            pass
    elif file_path.endswith(('.js', '.ts', '.jsx', '.tsx')):
        # JS / TS import/require regex
        imports = re.findall(r'''(?:import|from|require)\s*\(?['"]([@\w\-\./]+)['"]\)?''', content)
        for imp in imports:
            clean = imp.strip('./').split('/')[0]
            if clean and clean != current_module:
                dependencies.add(clean)

    return list(dependencies)

def analyze_workspace_codebase(db: Session, project_id: int, base_dir: str):
    """
    Crawls code files in directory, calculates cyclomatic complexity,
    extracts self-admitted technical debt, builds module dependency relations,
    and updates repository evidence in the database.
    """
    # Clean previous records for this project
    db.query(FileHotspot).filter(FileHotspot.project_id == project_id).delete()
    db.query(SelfAdmittedDebt).filter(SelfAdmittedDebt.project_id == project_id).delete()
    db.query(ModuleDependency).filter(ModuleDependency.project_id == project_id).delete()

    supported_exts = ('.py', '.ts', '.tsx', '.js', '.jsx')
    total_files = 0
    modules = {}

    for root, dirs, files in os.walk(base_dir):
        # Exclude vendor and build dirs
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'venv', '__pycache__', 'dist', 'build', '.idea', '.vscode')]
        for f in files:
            if f.endswith(supported_exts):
                total_files += 1
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, base_dir).replace('\\', '/')
                
                parts = rel_path.split('/')
                module_name = parts[0] if len(parts) > 1 else "core"
                if module_name in ('app', 'src') and len(parts) > 2:
                    module_name = parts[1]

                try:
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                except Exception:
                    continue

                # Complexity
                if f.endswith('.py'):
                    complexity = calculate_python_complexity(content)
                else:
                    complexity = calculate_js_complexity(content)

                # Heuristic churn based on line count and modification time
                line_count = len(content.splitlines())
                simulated_churn = max(5, int(line_count * 0.18))

                risk_score = round((complexity * 1.8) + (simulated_churn * 0.25), 2)

                hotspot = FileHotspot(
                    project_id=project_id,
                    file_path=rel_path,
                    module_name=module_name,
                    churn_count=simulated_churn,
                    cyclomatic_complexity=complexity,
                    risk_score=risk_score
                )
                db.add(hotspot)

                # SATD
                satds = scan_file_for_satd(rel_path, content, module_name)
                for s in satds:
                    db.add(SelfAdmittedDebt(
                        project_id=project_id,
                        file_path=s["file_path"],
                        line_number=s["line_number"],
                        marker_type=s["marker_type"],
                        comment_text=s["comment_text"],
                        module_name=s["module_name"]
                    ))

                # Dependencies
                deps = extract_dependencies_from_source(rel_path, content, module_name)
                if module_name not in modules:
                    modules[module_name] = set()
                for d in deps:
                    modules[module_name].add(d)

    # Insert dependencies
    for mod, targets in modules.items():
        for t in targets:
            db.add(ModuleDependency(
                project_id=project_id,
                source_module=mod,
                target_module=t
            ))

    # Update metadata
    meta = db.query(RepoMetadata).filter(RepoMetadata.project_id == project_id).first()
    if not meta:
        meta = RepoMetadata(project_id=project_id)
        db.add(meta)
    meta.total_files = total_files
    meta.repo_path = base_dir
    meta.last_synced_at = utc_now()

    db.commit()

