#!/usr/bin/env python3
"""SysDash backend (stdlib only) — serves index.html and /metrics.json.
Windows metrics via wmic/tasklist/ctypes; no third-party deps."""
import ctypes
import csv
import io
import json
import os
import platform
import shutil
import socket
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8777
HERE = os.path.dirname(os.path.abspath(__file__))


def _wmic(args):
    try:
        return subprocess.run(["wmic"] + args, capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return ""


def cpu_percent():
    for line in _wmic(["cpu", "get", "loadpercentage", "/value"]).splitlines():
        line = line.strip()
        if line.startswith("LoadPercentage="):
            try:
                return float(line.split("=", 1)[1])
            except ValueError:
                return None
    return None


def mem_info():
    free = total = None
    for line in _wmic(["OS", "get", "FreePhysicalMemory,TotalVisibleMemorySize", "/value"]).splitlines():
        line = line.strip()
        if line.startswith("FreePhysicalMemory="):
            free = int(line.split("=")[1] or 0)
        elif line.startswith("TotalVisibleMemorySize="):
            total = int(line.split("=")[1] or 0)
    if free and total:
        used = total - free
        return {"used_mb": round(used / 1024), "total_mb": round(total / 1024),
                "percent": round(used / total * 100, 1)}
    return {"used_mb": None, "total_mb": None, "percent": None}


def disk_info():
    try:
        u = shutil.disk_usage("C:\\")
        return {"used_gb": round(u.used / 1e9, 1), "total_gb": round(u.total / 1e9, 1),
                "percent": round(u.used / u.total * 100, 1)}
    except Exception:
        return {"used_gb": None, "total_gb": None, "percent": None}


def uptime_sec():
    try:
        return int(ctypes.windll.kernel32.GetTickCount64() / 1000)
    except Exception:
        return None


def top_processes(n=8):
    # wmic returns WorkingSetSize in bytes -> locale-proof (no thousands separators)
    procs = []
    try:
        out = _wmic(["process", "get", "Name,ProcessId,WorkingSetSize", "/format:csv"])
        for line in out.splitlines():
            line = line.strip()
            if not line or line.startswith("Node"):
                continue
            parts = line.split(",")
            if len(parts) >= 4:
                name, pid, wss = parts[-3], parts[-2], parts[-1]
                try:
                    mem_mb = round(int(wss) / (1024 * 1024), 1)
                except ValueError:
                    continue
                if name and mem_mb:
                    procs.append({"name": name, "pid": pid, "mem_mb": mem_mb})
        procs.sort(key=lambda p: p["mem_mb"] or 0, reverse=True)
    except Exception:
        pass
    return procs[:n]


def metrics():
    return {"hostname": socket.gethostname(), "platform": platform.platform(),
            "uptime_sec": uptime_sec(), "cpu_percent": cpu_percent(),
            "mem": mem_info(), "disk": disk_info(),
            "top_processes": top_processes(), "ts": int(time.time())}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/metrics.json"):
            self._send(200, "application/json", json.dumps(metrics()).encode())
        else:
            try:
                with open(os.path.join(HERE, "index.html"), "rb") as f:
                    self._send(200, "text/html; charset=utf-8", f.read())
            except FileNotFoundError:
                self._send(404, "text/plain", b"index.html missing")


if __name__ == "__main__":
    print(f"SysDash serving on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
