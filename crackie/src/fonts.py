"""Lädt die freien Schriften (SIL Open Font License) über die Google-Fonts-API und wandelt sie in TTF um.
    python fonts.py <out_dir>
Montserrat ExtraBold/Bold (Untertitel, Titel) und Press Start 2P (Pixel-Look für Szenentitel/Logo)."""
import io, os, re, sys, urllib.request
from fontTools.ttLib import TTFont

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
WANT = {
    'Montserrat-ExtraBold.ttf': 'Montserrat:wght@800',
    'Montserrat-Bold.ttf': 'Montserrat:wght@700',
    'PressStart2P.ttf': 'Press+Start+2P',
}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()


def main(out):
    os.makedirs(out, exist_ok=True)
    for name, fam in WANT.items():
        dst = os.path.join(out, name)
        if os.path.exists(dst):
            continue
        css = get(f'https://fonts.googleapis.com/css2?family={fam}&display=swap').decode()
        # Block mit lateinischen Zeichen (inkl. Umlaute) wählen
        blocks = re.findall(r'/\* ([a-z\-]+) \*/\s*@font-face\s*{([^}]*)}', css)
        src = None
        for sub, body in blocks:
            if sub == 'latin':
                src = re.search(r'url\((https://[^)]+)\)', body).group(1)
        if src is None:
            src = re.search(r'url\((https://[^)]+)\)', css).group(1)
        f = TTFont(io.BytesIO(get(src)))
        f.flavor = None
        f.save(dst)
        print('Schrift:', dst)


if __name__ == '__main__':
    main(sys.argv[1])
