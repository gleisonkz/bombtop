"""Extract source cells and cache complete PixelLab pose responses only."""
import base64
import concurrent.futures
import json
import os
from pathlib import Path
import random
import time

from PIL import Image
import requests

ROOT = Path(__file__).resolve().parents[4]
INPUTS = Path(__file__).resolve().parent
SKELETONS = INPUTS.parent / 'skeletons'
COUNTS = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]


def successful(value):
    if isinstance(value, dict):
        return bool(value.get('keypoints')) or any(successful(v) for v in value.values())
    if isinstance(value, list):
        return any(successful(v) for v in value)
    return False


def estimate(job):
    name, path = job
    target = SKELETONS / f'pose-{name}.json'
    if target.exists():
        try:
            if successful(json.loads(target.read_text())):
                return name, 'cached'
        except (ValueError, OSError):
            pass
    payload = {'image': {'type': 'base64', 'base64': base64.b64encode(path.read_bytes()).decode('ascii')}}
    for attempt in range(5):
        try:
            response = requests.post(
                'https://api.pixellab.ai/v2/estimate-skeleton', json=payload,
                headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY']}, timeout=120)
            if response.status_code == 429 or response.status_code >= 500:
                if attempt < 4:
                    try:
                        delay = float(response.headers.get('Retry-After', '0'))
                    except ValueError:
                        delay = 0
                    time.sleep(min(60, max(delay, 2 ** attempt * 2)) + random.random())
                    continue
            if response.status_code != 200:
                return name, f'error HTTP {response.status_code}'
            data = response.json()
            if not successful(data):
                return name, 'error missing keypoints'
            temporary = target.with_suffix('.tmp')
            temporary.write_text(json.dumps(data, indent=2), encoding='utf-8')
            temporary.replace(target)
            return name, 'saved'
        except (requests.Timeout, requests.ConnectionError):
            if attempt == 4:
                return name, 'error timeout/connection after 5 attempts'
            time.sleep(min(30, 2 ** attempt * 2) + random.random())
        except (ValueError, OSError):
            return name, 'error response JSON or file operation'
    return name, 'error retries exhausted'


def main():
    INPUTS.mkdir(parents=True, exist_ok=True)
    SKELETONS.mkdir(parents=True, exist_ok=True)
    jobs = []
    with Image.open(ROOT / 'apps/client/public/sprites/goku.png') as sheet:
        assert sheet.size == (146 * 9, 192 * 18)
        for row, count in enumerate(COUNTS):
            for col in range(count):
                name = f'r{row:02d}-c{col:02d}'
                path = INPUTS / f'{name}.png'
                sheet.crop((col * 146, row * 192, (col + 1) * 146, (row + 1) * 192)).save(path)
                jobs.append((name, path))
    with Image.open(ROOT / 'apps/client/public/sprites/goku-lobby.png') as sheet:
        assert sheet.height == 207 and sheet.width >= 128 * 8
        for col in range(8):
            name = f'lobby-{col}'
            path = INPUTS / f'{name}.png'
            sheet.crop((col * 128, 0, (col + 1) * 128, 207)).save(path)
            jobs.append((name, path))
    assert len(jobs) == 116
    totals = {'saved': 0, 'cached': 0, 'errors': 0}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for index, (name, result) in enumerate(pool.map(estimate, jobs), 1):
            if result.startswith('error'):
                totals['errors'] += 1
                print(name, result, flush=True)
            else:
                totals[result] += 1
            if index % 6 == 0 or index == len(jobs):
                print(json.dumps({'completed': index, 'total': len(jobs), **totals}), flush=True)
    return totals['errors']


if __name__ == '__main__':
    raise SystemExit(bool(main()))
