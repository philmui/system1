#!/usr/bin/env python3
"""Register bundled fonts for local librsvg/Pango exports without installing them."""
from pathlib import Path
from html import escape
import argparse
import json
from fontTools.ttLib import TTFont

ROOT=Path(__file__).resolve().parent.parent
p=argparse.ArgumentParser();p.add_argument('directory');args=p.parse_args()
target=Path(args.directory).resolve();fonts=target/'fonts';cache=target/'cache'
fonts.mkdir(parents=True,exist_ok=True);cache.mkdir(exist_ok=True)
files=[ROOT/'assets/fonts/Manrope.woff2',ROOT/'assets/fonts/IBMPlexMono.woff2',
       *sorted((ROOT/'assets/fonts-v5').glob('*.woff2'))]
for source in files:
    face=TTFont(source);face.flavor=None;face.save(fonts/(source.stem+'.ttf'))
system=next((f for f in [Path('/opt/homebrew/etc/fonts/fonts.conf'),Path('/etc/fonts/fonts.conf')] if f.exists()),None)
include=f'<include>{escape(str(system))}</include>' if system else ''
config=target/'fonts.conf'
config.write_text('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig>'+include+
    f'<dir>{escape(str(fonts))}</dir><cachedir>{escape(str(cache))}</cachedir>'+
    '<alias><family>Manrope</family><prefer><family>Manrope ExtraLight</family></prefer></alias>'+
    '<alias><family>Plex</family><prefer><family>IBM Plex Mono</family></prefer></alias></fontconfig>')
print(json.dumps({'fontconfig':str(config),'fonts':[f.name for f in files]},indent=2))
