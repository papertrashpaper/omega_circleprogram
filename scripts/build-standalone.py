from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
engine = (root / 'engine.js').read_text().replace('export ', '')
app = (root / 'app.js').read_text().split('\n', 1)[1]
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>' + css + '</style>')
html = html.replace('<script type="module" src="./app.js"></script>', '<script type="module">\n' + engine + '\n' + app + '\n</script>')
(root / 'standalone.html').write_text(html)
