const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');
const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_REPO_URL = 'https://github.com/diplospot/diplospot.github.io';

const COPY_FILES = [
  'manifest.json',
  'favicon-16.png',
  'favicon-32.png',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
];

const INLINE_SCRIPTS = ['ofm_codes.js', 'app.js', 'info-panel.js', 'sw-register.js'];

const CSS_LINK_PATTERN = /<link\s+rel="stylesheet"\s+href="style\.css">/;

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT }).toString().trim();
}

function getBuildInfo() {
  let commit = 'unknown';
  let repoUrl = DEFAULT_REPO_URL;
  try {
    commit = git(['rev-parse', 'HEAD']);
  } catch (e) {}
  try {
    repoUrl = git(['config', '--get', 'remote.origin.url'])
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '');
  } catch (e) {}
  return { commit, repoUrl, builtAt: new Date().toISOString() };
}

// Builds one HTML page: inlines its <script src> tags and stylesheet link,
// minifies the result, and writes it to every path in outputPaths.
async function buildPage(htmlFile, scripts, scriptPattern, minifiedCss, outputPaths, extraReplacements) {
  const js = scripts
    .map(file => fs.readFileSync(path.join(SRC, file), 'utf8'))
    .join('\n');
  const minifiedJs = (await minifyJs(js)).code;

  let html = fs.readFileSync(path.join(SRC, htmlFile), 'utf8');

  if (!CSS_LINK_PATTERN.test(html)) throw new Error(`build.js: stylesheet <link> not found in src/${htmlFile}`);
  if (!scriptPattern.test(html)) throw new Error(`build.js: script tags not found in src/${htmlFile}`);

  for (const [pattern, replacement] of extraReplacements || []) {
    html = html.replace(pattern, replacement);
  }

  html = html.replace(CSS_LINK_PATTERN, `<style>${minifiedCss}</style>`);
  html = html.replace(scriptPattern, `<script>${minifiedJs}</script>`);

  const minifiedHtml = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  });

  for (const outputPath of outputPaths) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, minifiedHtml);
  }

  const relativePaths = outputPaths.map(outputPath => path.relative(path.join(__dirname, '..'), outputPath));
  console.log('Built %s (%d bytes)', relativePaths.join(' & '), Buffer.byteLength(minifiedHtml));
}

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

  const buildInfo = getBuildInfo();
  const scriptTagsPattern = /<script\s+src="ofm_codes\.js"><\/script>\s*<script\s+src="app\.js"><\/script>\s*<script\s+src="info-panel\.js"><\/script>\s*<script\s+src="sw-register\.js"><\/script>/;
  await buildPage('index.html', INLINE_SCRIPTS, scriptTagsPattern, minifiedCss, [
    path.join(DIST, 'index.html'),
  ], [
    [/"__BUILD_INFO__"/, JSON.stringify(buildInfo)],
  ]);

  const mapScriptPattern = /<script\s+src="map\.js"><\/script>/;
  await buildPage('map.html', ['map.js'], mapScriptPattern, minifiedCss, [
    path.join(DIST, 'map.html'),
    path.join(DIST, 'map', 'index.html'),
  ]);
}

if (require.main === module) {
  build().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { build };
