#!/bin/sh
# Usage: sheet.sh <reel.mp4> <t0 seconds> <out.jpg> <cols> <offset>...
# Grabs one 400 px frame per offset (seconds after t0), tiles them in order.
set -e
reel=$1; t0=$2; out=$3; cols=$4; shift 4
dir=$(mktemp -d); i=0
for dt in "$@"; do
  t=$(python3 -c "print(max(0, $t0 + $dt))")
  ffmpeg -loglevel error -y -ss "$t" -i "$reel" -frames:v 1 -vf scale=400:-1 \
    "$dir/$(printf %02d $i).jpg"
  i=$((i + 1))
done
rows=$(( (i + cols - 1) / cols ))
ffmpeg -loglevel error -y -i "$dir/%02d.jpg" -vf "tile=${cols}x${rows}" \
  -frames:v 1 "$out"
rm -r "$dir"
