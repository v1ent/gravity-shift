"""Builds index.html: concatenates src/*.js (in name order) into shell.html.
Usage:  python3 build.py"""
import glob, os
here = os.path.dirname(os.path.abspath(__file__))
src = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(here, 'src', '*.js'))))
html = open(os.path.join(here, 'shell.html'), encoding='utf-8').read().replace('/*__SCRIPT__*/', src)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(html)
print(len(html), 'bytes -> index.html')
