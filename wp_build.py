#!/usr/bin/env python3
"""wp_build.py — assemble index.html for the MTS tower live wallpaper from
wp_sceneart.js (subagent A), wp_actors.js (subagent B) and wp_main.js (engine).
Missing module files are simply omitted (engine falls back to built-in stubs)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "/home/wallpaper/index.html"


def read(name):
    p = os.path.join(HERE, name)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""


def main():
    sprites = read("wp_sprites.js")
    sceneart = read("wp_sceneart.js")
    actors = read("wp_actors.js")
    engine = read("wp_main.js")
    html = (
        "<!DOCTYPE html>\n<html lang=\"ru\"><head><meta charset=\"UTF-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\">\n"
        "<title>MTS Tower Live Wallpaper</title>\n<style>\n"
        "  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0b1020}\n"
        "  #c{display:block;position:fixed;inset:0;width:100vw;height:100vh}\n"
        "</style></head><body>\n<canvas id=\"c\"></canvas>\n"
        "<script>/* sprite atlas (base64) */\n" + sprites + "\n</script>\n"
        "<script>/* scene art (sprites) */\n" + sceneart + "\n</script>\n"
        "<script>/* actors (sprites) */\n" + actors + "\n</script>\n"
        "<script>/* engine (main) */\n" + engine + "\n</script>\n"
        "</body></html>"
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(html)
    print("wrote", OUT, len(html), "bytes; sceneart=%d actors=%d" % (len(sceneart), len(actors)))


if __name__ == "__main__":
    main()
