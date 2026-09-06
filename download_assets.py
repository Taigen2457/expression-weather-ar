"""Restore pinned MediaPipe runtime assets; verify every file against SHA-256."""
from pathlib import Path
from urllib.request import urlopen
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent

def restore(verify_only=False):
    manifest = json.loads((ROOT / 'vendor-manifest.json').read_text())
    for item in manifest:
        target = ROOT / 'vendor' / item['path']
        valid = target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == item['sha256']
        if valid:
            print('OK', item['path'])
            continue
        if verify_only:
            raise RuntimeError('Missing or invalid asset: ' + item['path'])
        print('Downloading', item['path'])
        with urlopen(item['url'], timeout=90) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise RuntimeError('SHA-256 mismatch: ' + item['path'])
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + '.tmp')
        temporary.write_bytes(data)
        temporary.replace(target)
    print('All assets verified. Run: python3 -m http.server 8000')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    restore(parser.parse_args().verify_only)
