# Usage: python3 recognize.py audio.raw out.json — word timings from pocketsphinx's recogniser.
import json, sys, time
from pocketsphinx import Decoder
raw, out = sys.argv[1], sys.argv[2]
data = open(raw, 'rb').read()
d = Decoder(samprate=16000)
words = []
t0 = time.time()
# Decode in 20 s chunks so one long utterance doesn't blow up the search.
step = 16000 * 2 * 20
for off in range(0, len(data), step):
    d.start_utt(); d.process_raw(data[off:off + step], full_utt=True); d.end_utt()
    base = off / (16000 * 2)
    for seg in d.seg():
        w = seg.word
        if w.startswith('<') or w.startswith('['): continue
        words.append({'w': w.split('(')[0], 's': round(base + seg.start_frame / 100, 2), 'e': round(base + seg.end_frame / 100, 2)})
json.dump(words, open(out, 'w'))
print(len(words), 'words in', round(time.time() - t0, 1), 's')
