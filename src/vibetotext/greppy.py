"""Greppy semantic search integration."""

import re
import subprocess
from typing import List, Tuple
from pathlib import Path


# Default codebase path (will be configurable later)
DEFAULT_CODEBASE = "/Users/dylan/Desktop/projects/datafeeds"

# Try to import greppy directly (keeps model warm)
_greppy_search = None
_greppy_available = None  # None = not checked yet

def _init_greppy():
    """Initialize greppy import (lazy load to avoid import overhead at startup)."""
    global _greppy_search, _greppy_available
    if _greppy_available is None:
        try:
            from greppy import store as greppy_store
            _greppy_search = greppy_store.search
            _greppy_available = True
            print("[GREPPY] Using direct import (model stays warm)")
        except ImportError as e:
            _greppy_available = False
            print(f"[GREPPY] Direct import failed ({e}), falling back to subprocess")
    return _greppy_available


def search_files(query: str, limit: int = 10, codebase: str = None) -> List[Tuple[str, int]]:
    """
    Search for relevant files using Greppy semantic search.

    Args:
        query: The search query
        limit: Maximum number of files to return
        codebase: Path to the codebase (defaults to DEFAULT_CODEBASE)

    Returns:
        List of (filepath, line_number) tuples
    """
    if codebase is None:
        codebase = DEFAULT_CODEBASE

    # Try direct import first (keeps model warm)
    if _init_greppy():
        return _search_direct(query, limit, codebase)
    else:
        return _search_subprocess(query, limit, codebase)


def _search_direct(query: str, limit: int, codebase: str) -> List[Tuple[str, int]]:
    """Search using direct greppy import (faster, model stays warm)."""
    try:
        results = _greppy_search(Path(codebase), query, limit=limit)

        files = []
        seen_files = set()

        for result in results:
            filepath = result.get('file_path', '')
            line_num = result.get('start_line', 1)

            if filepath and filepath not in seen_files:
                seen_files.add(filepath)
                files.append((filepath, line_num))

        return files[:limit]
    except Exception as e:
        print(f"[GREPPY] Direct search failed: {e}")
        return []


def _search_subprocess(query: str, limit: int, codebase: str) -> List[Tuple[str, int]]:
    """Fallback: search using subprocess (slower, model reloads each time)."""
    try:
        result = subprocess.run(
            ["greppy", "search", "-n", str(limit), "-p", codebase, query],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            return []

        files = []
        seen_files = set()

        # Join all lines and split by score pattern (handles line wrapping)
        output = result.stdout.replace('\n', '')
        results = re.split(r'\(score: -?\d+\.\d+\)', output)

        for result_text in results:
            if not result_text.strip():
                continue

            match = re.search(r'(/[^:]+):(\d+):', result_text)
            if match:
                filepath = match.group(1)
                line_num = int(match.group(2))

                if filepath not in seen_files:
                    seen_files.add(filepath)
                    files.append((filepath, line_num))

        return files[:limit]

    except subprocess.TimeoutExpired:
        return []
    except FileNotFoundError:
        return []


def read_file_content(filepath: str, max_lines: int = 500) -> str:
    """
    Read file content, truncating if too long.

    Args:
        filepath: Path to the file
        max_lines: Maximum lines to read

    Returns:
        File content as string
    """
    try:
        path = Path(filepath)
        if not path.exists():
            return ""

        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()[:max_lines]

        content = ''.join(lines)
        if len(lines) == max_lines:
            content += f"\n... (truncated at {max_lines} lines)"

        return content
    except Exception:
        return ""


def format_files_for_context(files: List[Tuple[str, int]], max_lines_per_file: int = 200) -> str:
    """
    Format files into a context string for pasting.

    Args:
        files: List of (filepath, line_number) tuples
        max_lines_per_file: Max lines to include per file

    Returns:
        Formatted string with file contents
    """
    if not files:
        return ""

    parts = []
    for filepath, line_num in files:
        content = read_file_content(filepath, max_lines=max_lines_per_file)
        if content:
            # Use relative path if possible
            try:
                rel_path = Path(filepath).relative_to(Path.home())
                display_path = f"~/{rel_path}"
            except ValueError:
                display_path = filepath

            parts.append(f"### {display_path}\n```\n{content}\n```")

    if not parts:
        return ""

    return "\n\n" + "\n\n".join(parts)
