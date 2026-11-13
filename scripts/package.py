"""Create a reproducible source archive, excluding dependencies and device data."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
output = root.parent / f'Nuzul_Android_v{version}.zip'
roots = ['App.tsx', 'package.json', 'package-lock.json', 'app.json',
         'eas.json', 'tsconfig.json', '.gitignore', '.nvmrc', 'README.md',
         'CHANGELOG.md', 'src', 'tests', 'assets', 'docs', 'scripts', '.github']
files = []
for entry in roots:
    path = root / entry
    if path.is_file():
        files.append(path)
    elif path.is_dir():
        files.extend(p for p in path.rglob('*') if p.is_file()
                     and '__pycache__' not in p.parts and p.suffix not in {'.pyc', '.db', '.nuzul'})
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(files):
        relative = Path('nuzul-app') / path.relative_to(root)
        info = ZipInfo(relative.as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
with ZipFile(output) as archive:
    if archive.testzip():
        raise RuntimeError('Archive verification failed')
print(f'{output}\n{len(files)} files, {output.stat().st_size} bytes')
