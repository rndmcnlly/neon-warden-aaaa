#!/bin/zsh
# Side-by-sides: ours left, comparator right, both 640x360 letterboxed.
# Run from research/2026-10-28-level-design/.
set -e
FONT=/System/Library/Fonts/Helvetica.ttc
pair() { # out ours comp label
  magick \( "$2" -resize 640x360 -background '#111' -gravity center -extent 640x360 \) \
         \( "$3" -resize 640x360 -background '#111' -gravity center -extent 640x360 \) \
         +append -font $FONT -pointsize 16 -fill white -gravity north \
         -splice 0x26 -annotate +0+4 "$4" -quality 82 "side/$1.jpg"
}
pair 01-set-dressing-sky-force   ours/s1-8.jpg   comparators/sky-force-4.jpg         "ours: sector 1 (Outer Drift)  |  Sky Force Reloaded"
pair 02-lane-walls-silvergun     ours/s1-70.jpg  comparators/radiant-silvergun-2.jpg "ours: sector 1, wave entry  |  Radiant Silvergun"
pair 03-track-thumper            ours/s1-8.jpg   comparators/thumper-0.jpg           "ours: sector 1  |  Thumper (track as telegraph)"
pair 04-landmark-ex-zodiac       ours/s1-70.jpg  comparators/ex-zodiac-6.jpg         "ours: sector 1  |  Ex-Zodiac (landmark set piece)"
pair 05-boss-arena-returnal      ours/s3-90.jpg  comparators/returnal-3.jpg          "ours: Warden  |  Returnal (bullet wall in a lit arena)"
pair 06-structure-ikaruga        ours/s1-8.jpg   comparators/ikaruga-0.jpg           "ours: sector 1  |  Ikaruga (structure scale)"
pair 07-tunnel-rez               ours/s1-70.jpg  comparators/rez-3.jpg               "ours: sector 1  |  Rez Infinite (tunnel landmark)"
pair 08-megastructure-cygni      ours/s1-8.jpg   comparators/cygni-4.jpg             "ours: sector 1  |  CYGNI (megastructure foreground)"
ls side
