# Timing Listening scripts against the audio

Books print audioscripts without times. These two Python scripts give every script line its
start time, so the app's audioscript follows the audio (line and word highlighting).

1. `pip install pocketsphinx` (it ships an English model; nothing else is downloaded).
2. For each part, recognise the speech with word timings (about 2 minutes per part; set
   `OMP_THREAD_LIMIT=1` when running several at once):

   ```sh
   ffmpeg -i public/media/audio/b19t1-p1.<hash>.mp3 -ac 1 -ar 16000 -f s16le /tmp/align/b19t1-p1.raw
   python3 tools/align/recognize.py /tmp/align/b19t1-p1.raw /tmp/align/b19t1-p1.json
   ```

3. Write the test JSON with the script text exactly as printed (any start times), then:

   ```sh
   ALIGN_DIR=/tmp/align python3 tools/align/fill_times.py content/tests/<test>.json
   npm run validate
   ```

`fill_times.py` matches runs of three or more words between the script and what was heard, sets
each line's start from its first word (interpolating where words weren't recognised), skips the
announcer's introduction, and prints how much matched. Spot-check a few lines; if a recording
starts its dialogue unusually (Cambridge 19 Test 1 Part 1 does), fix those lines by hand.
