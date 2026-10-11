"""Fill listening script start times in a test JSON from pocketsphinx word timings.

Usage: python3 -I fill_times.py content/tests/<test>.json
For each listening section, loads align/<audio stem>.json (from recognize.py), matches the
script's words to the recognised words, and sets each line's `start` to when its first word is
spoken (interpolated between matched words when that word itself wasn't recognised).
"""
import difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
path = sys.argv[1]
manifest = json.load(open(os.path.join(os.path.dirname(path), '..', 'media-manifest.json')))
durations = {f['path']: f.get('durationSec') for f in manifest['files']}
test = json.load(open(path))

def tokens(text):
    text = text.lower().replace('’', "'").replace('‘', "'")
    return [w.replace("'", '') for w in re.findall(r"[a-z0-9']+", text)]

for sid, section in sorted(test['sections'].items()):
    if section.get('kind') != 'listening':
        continue
    stem = section['audio'].rsplit('/', 1)[-1].split('.')[0]
    rec_path = os.path.join(os.environ.get('ALIGN_DIR', HERE), stem + '.json')
    if not os.path.exists(rec_path):
        print(f'{sid}: no recognition for {stem} yet')
        continue
    rec = json.load(open(rec_path))
    rec_tokens = [w['w'].replace("'", '').lower() for w in rec]
    duration = durations.get(section['audio']) or section['durationSec']
    book, first = [], []
    for line in section['script']:
        first.append(len(book))
        book.extend(tokens(line['text']))
    sm = difflib.SequenceMatcher(None, book, rec_tokens, autojunk=False)
    anchors = {}
    for a, b, size in sm.get_matching_blocks():
        if size < 3:
            continue
        for k in range(size):
            anchors[a + k] = rec[b + k]['s']
    keys = sorted(anchors)
    # The announcer's introduction paraphrases the opening ("You will hear a teaching assistant
    # …"). A short run of matches followed by a long silence before the next match is that
    # introduction, not the dialogue: drop it.
    while len(keys) > 1:
        run = 1
        while run < len(keys) and anchors[keys[run]] - anchors[keys[run - 1]] < 8:
            run += 1
        if run >= len(keys) or run >= 15 or anchors[keys[run]] - anchors[keys[run - 1]] < 20:
            break
        for k in keys[:run]:
            del anchors[k]
        keys = keys[run:]
    def time_at(i):
        if i in anchors:
            return anchors[i]
        before = [k for k in keys if k < i]
        after = [k for k in keys if k > i]
        if before and after:
            ia, ib = before[-1], after[0]
            return anchors[ia] + (i - ia) / (ib - ia) * (anchors[ib] - anchors[ia])
        if after:
            return max(0.0, anchors[after[0]] - (after[0] - i) * 0.35)
        if before:
            return anchors[before[-1]] + (i - before[-1]) * 0.35
        return i * 0.35
    prev = -1.0
    for line, f in zip(section['script'], first):
        t = round(max(0.0, time_at(min(f, max(len(book) - 1, 0))) - 0.15), 1)
        if t <= prev:
            t = round(prev + 0.1, 1)
        t = min(t, round(duration - 0.2, 1))
        line['start'] = t
        prev = t
    section['durationSec'] = duration
    ratio = len(anchors) / max(len(book), 1)
    print(f'{sid}: {stem} {len(section["script"])} lines, {ratio:.0%} of words matched, '
          f'first line at {section["script"][0]["start"]}s, last at {section["script"][-1]["start"]}s of {duration}s')

with open(path, 'w') as fh:
    json.dump(test, fh, indent=2, ensure_ascii=False)
    fh.write('\n')
