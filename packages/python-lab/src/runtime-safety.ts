export const CAPABILITY_BOOTSTRAP = String.raw`
import importlib.abc as _latent_importlib_abc
import os as _latent_os
import sys as _latent_sys

class _LatentBlockedModuleFinder(_latent_importlib_abc.MetaPathFinder):
    _blocked_roots = frozenset(("js", "micropip", "pyodide", "pyodide_js"))
    def find_spec(self, fullname, path=None, target=None):
        root = fullname.split(".", 1)[0]
        if root in self._blocked_roots:
            raise ImportError(f"{fullname} is unavailable in this curated browser runtime")
        return None

if not any(type(finder).__name__ == "_LatentBlockedModuleFinder" for finder in _latent_sys.meta_path):
    _latent_sys.meta_path.insert(0, _LatentBlockedModuleFinder())

# Pyodide bootstraps these modules before package loading. Remove every cached
# bridge after curated packages load so the import guard cannot be bypassed via
# sys.modules. This includes pyodide.code.run_js/eval_code, pyodide.ffi,
# pyodide_js, and the js facade itself.
for _latent_name in tuple(_latent_sys.modules):
    if _latent_name.split(".", 1)[0] in {"js", "micropip", "pyodide", "pyodide_js"}:
        _latent_sys.modules.pop(_latent_name, None)

_LATENT_WRITE_ROOTS = ("/workspace", "/tmp")
_LATENT_WRITE_FLAGS = (
    getattr(_latent_os, "O_WRONLY", 1)
    | getattr(_latent_os, "O_RDWR", 2)
    | getattr(_latent_os, "O_CREAT", 64)
    | getattr(_latent_os, "O_TRUNC", 512)
    | getattr(_latent_os, "O_APPEND", 1024)
)

def _latent_inside_write_root(path):
    try:
        resolved = _latent_os.path.realpath(_latent_os.fspath(path))
    except (TypeError, ValueError):
        return True
    return any(resolved == root or resolved.startswith(root + "/") for root in _LATENT_WRITE_ROOTS)

def _latent_audit(event, args):
    if event == "open" and args:
        path = args[0]
        mode = args[1] if len(args) > 1 else None
        flags = args[2] if len(args) > 2 else 0
        writes = (isinstance(mode, str) and any(flag in mode for flag in "wax+")) or (isinstance(flags, int) and bool(flags & _LATENT_WRITE_FLAGS))
        if writes and not _latent_inside_write_root(path):
            raise PermissionError("Python Lab permits writes only inside /workspace and /tmp")
    if event in {"os.system", "os.posix_spawn", "subprocess.Popen", "socket.connect", "socket.bind"}:
        raise PermissionError(f"Python Lab blocks host capability: {event}")

if not getattr(_latent_sys, "_latent_audit_installed", False):
    _latent_sys.addaudithook(_latent_audit)
    _latent_sys._latent_audit_installed = True

if "/workspace" not in _latent_sys.path:
    _latent_sys.path.insert(0, "/workspace")
_latent_os.chdir("/workspace")
`;

export const CAPABILITY_SELF_CHECK = String.raw`
import builtins as _latent_check_builtins
import json as _latent_check_json
import sys as _latent_check_sys

_latent_check_blocked = {}
for _latent_check_name in ("js", "micropip", "pyodide", "pyodide.code", "pyodide.ffi", "pyodide_js"):
    try:
        __import__(_latent_check_name)
        _latent_check_blocked[_latent_check_name] = False
    except ImportError:
        _latent_check_blocked[_latent_check_name] = True

_latent_check_aliases = any(
    hasattr(_latent_check_builtins, name)
    for name in ("run_js", "eval_js", "eval_code", "eval_code_async")
)
_latent_check_cached_bridge = any(
    name.split(".", 1)[0] in {"js", "micropip", "pyodide", "pyodide_js"}
    for name in _latent_check_sys.modules
)
_latent_check_json.dumps({
    "importsBlocked": all(_latent_check_blocked.values()),
    "aliasesRemoved": not _latent_check_aliases,
    "bridgesRemoved": not _latent_check_cached_bridge,
}, separators=(",", ":"))
`;
