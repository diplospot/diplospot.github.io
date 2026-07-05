const fs = require('fs');
const path = require('path');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');

const COPY_FILES = [
  'manifest.json',
  'favicon-16.png',
  'favicon-32.png',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
];

const INLINE_SCRIPTS = ['ofm_codes.js', 'app.js', 'sw-register.js'];

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const file of COPY_FILES) {
    fs.copyFileSync(path.join(SRC, file), path.join(DIST, file));
  }

  // Minify sw.js
  const swJs = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8');
  const minifiedSwJs = (await minifyJs(swJs)).code;
  fs.writeFileSync(path.join(DIST, 'sw.js'), minifiedSwJs);

  const css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
  const minifiedCss = new CleanCSS({}).minify(css).styles;

  const js = INLINE_SCRIPTS
    .map(file => fs.readFileSync(path.join(SRC, file), 'utf8'))
    .join('\n');
  const minifiedJs = (await minifyJs(js)).code;

  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

  const cssLinkPattern = /<link\s+rel="stylesheet"\s+href="style\.css">/;
  const scriptTagsPattern = /<script\s+src="ofm_codes\.js"><\/script>\s*<script\s+src="app\.js"><\/script>\s*<script\s+src="sw-register\.js"><\/script>/;
  if (!cssLinkPattern.test(html)) throw new Error('build.js: stylesheet <link> not found in src/index.html');
  if (!scriptTagsPattern.test(html)) throw new Error('build.js: script tags not found in src/index.html');

  html = html.replace(cssLinkPattern, `<style>${minifiedCss}</style>`);
  html = html.replace(scriptTagsPattern, `<script>${minifiedJs}</script>`);

  const minifiedHtml = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  });

  fs.writeFileSync(path.join(DIST, 'index.html'), minifiedHtml);

  console.log('Built dist/index.html (%d bytes)', Buffer.byteLength(minifiedHtml));
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
