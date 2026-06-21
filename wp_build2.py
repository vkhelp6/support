#!/usr/bin/env python3
"""wp_build2.py — assemble the photo-scene live wallpaper (index.html) from
wp_hero.js (embedded day/night scenes) + wp_photo.js (engine)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "/home/wallpaper/index.html"

def read(name):
    p = os.path.join(HERE, name)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""

def main():
    hero = read("wp_hero.js")
    engine = read("wp_photo.js")
    html = (
        "<!DOCTYPE html>\n<html lang=\"ru\"><head><meta charset=\"UTF-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\">\n"
        "<title>MTS Tower Live Wallpaper</title>\n<style>\n"
        "  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0b1020}\n"
        "  #c{display:block;position:fixed;inset:0;width:100vw;height:100vh}\n"
        "</style></head><body>\n<canvas id=\"c\"></canvas>\n"
        "<script>/* hero scenes (day/night) */\n" + hero + "\n</script>\n"
        "<script>/* engine */\n" + engine + "\n</script>\n"
        "</body></html>"
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(html)
    print("wrote", OUT, len(html), "bytes; hero=%d engine=%d" % (len(hero), len(engine)))

if __name__ == "__main__":
    main()
