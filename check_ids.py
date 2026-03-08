import re

def check_missing(html_file, js_file):
    print(f"Checking {html_file} against {js_file}")
    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()
    with open(js_file, 'r', encoding='utf-8') as f:
        js = f.read()

    ids = re.findall(r'id="([^"]+)"', html)
    required_ids = re.findall(r'getElementById\(([\'"])([^\'"]+)\1\)', js)
    required_ids = [r[1] for r in required_ids]

    missing = set()
    for req in required_ids:
        if req not in ids:
            missing.add(req)

    print("Missing IDs:", missing)

check_missing('index.html', 'js/app.js')
check_missing('thinkme.html', 'js/thinkme.js')
