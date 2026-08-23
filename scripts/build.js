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
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
];

const INLINE_SCRIPTS = ['ofm_codes.js', 'app.js', 'sw-logs.js', 'info-panel.js', 'sw-register.js'];

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
async function buildPage(htmlFile, scripts, scriptPattern, minifiedCss, outputPaths) {
  const js = scripts
    .map(file => fs.readFileSync(path.join(SRC, file), 'utf8'))
    .join('\n');
  const minifiedJs = (await minifyJs(js)).code;

  let html = fs.readFileSync(path.join(SRC, htmlFile), 'utf8');

  if (!CSS_LINK_PATTERN.test(html)) throw new Error(`build.js: stylesheet <link> not found in src/${htmlFile}`);
  if (!scriptPattern.test(html)) throw new Error(`build.js: script tags not found in src/${htmlFile}`);

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

  const buildInfo = getBuildInfo();

  // Minify sw.js
  const swJs = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8');
  const minifiedSwJs = (await minifyJs(swJs)).code;
  fs.writeFileSync(path.join(DIST, 'sw.js'), minifiedSwJs);

  // Generate buildinfo.js: a small standalone file both the page and the
  // service worker fetch independently to detect when a new build is live.
  fs.writeFileSync(path.join(DIST, 'buildinfo.js'), 'self.BUILD_INFO=' + JSON.stringify(buildInfo) + ';\n');

  const css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
  const minifiedCss = new CleanCSS({}).minify(css).styles;

  const scriptTagsPattern = /<script\s+src="ofm_codes\.js"><\/script>\s*<script\s+src="app\.js"><\/script>\s*<script\s+src="sw-logs\.js"><\/script>\s*<script\s+src="info-panel\.js"><\/script>\s*<script\s+src="sw-register\.js"><\/script>/;
  await buildPage('index.html', INLINE_SCRIPTS, scriptTagsPattern, minifiedCss, [
    path.join(DIST, 'index.html'),
  ]);

  const mapScriptPattern = /<script\s+src="map\.js"><\/script>/;
  await buildPage('map.html', ['map.js'], mapScriptPattern, minifiedCss, [
    path.join(DIST, 'map.html'),
    path.join(DIST, 'map', 'index.html'),
  ]);

  const logsScriptPattern = /<script\s+src="sw-logs\.js"><\/script>\s*<script\s+src="logs\.js"><\/script>/;
  await buildPage('logs.html', ['sw-logs.js', 'logs.js'], logsScriptPattern, minifiedCss, [
    path.join(DIST, 'logs.html'),
    path.join(DIST, 'logs', 'index.html'),
  ]);
}

if (require.main === module) {
  build().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { build };
