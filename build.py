"""Builds index.html: concatenates src/*.js (in name order) into shell.html.
Usage:  python3 build.py"""
import glob, os
here = os.path.dirname(os.path.abspath(__file__))
src = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(here, 'src', '*.js'))))
html = open(os.path.join(here, 'shell.html'), encoding='utf-8').read().replace('/*__SCRIPT__*/', src)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(html)
print(len(html), 'bytes -> index.html')

# ---- viewer.html: the same game code plus the motion / pose viewer (viewer/)
vsrc = src + '\n' + open(os.path.join(here, 'viewer', 'viewer.js'), encoding='utf-8').read()
vhtml = open(os.path.join(here, 'shell.html'), encoding='utf-8').read().replace('/*__SCRIPT__*/', 'window.VIEWER=true;\n' + vsrc)
vhtml = vhtml.replace('<title>', '<title>Viewer — ', 1).replace('<body>', '<body>' + open(os.path.join(here, 'viewer', 'viewer_ui.html'), encoding='utf-8').read(), 1)
open(os.path.join(here, 'viewer.html'), 'w', encoding='utf-8').write(vhtml)
print(len(vhtml), 'bytes -> viewer.html')
