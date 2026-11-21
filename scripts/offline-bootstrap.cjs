/* Offline bootstrap: cache tarballs only; no network or install scripts. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const npmGlobalRoot =
  process.env.NPM_MODULE_ROOT ||
  require('node:child_process').execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const npmRequire = createRequire(path.join(npmGlobalRoot, 'npm/package.json'));
const cacache = npmRequire('cacache'),
  semver = npmRequire('semver'),
  tar = npmRequire('tar');
const cache = process.env.NPM_OFFLINE_CACHE || path.join(process.env.HOME, '.npm/_cacache');
const root = path.resolve(__dirname, '..'),
  modules = path.join(root, 'node_modules');
const requested = {
  react: '19.2.7',
  'react-dom': '19.2.7',
  '@mui/material': '5.18.0',
  '@emotion/react': '11.14.0',
  '@emotion/styled': '11.14.1',
  vite: '5.4.21',
  '@vitejs/plugin-react': '4.7.0',
  typescript: '5.9.3',
  '@types/react': '19.2.18',
  '@types/react-dom': '19.2.3',
  '@types/node': '25.9.3',
  firebase: '11.10.0',
  'firebase-admin': '13.10.0',
  'firebase-functions': '6.6.0',
};
const catalog = new Map(),
  installed = new Map(),
  skipped = new Set();
const packuments = new Map();
async function cachedMetadata(name) {
  if (packuments.has(name)) return packuments.get(name);
  for (const encoded of [name.replace('/', '%2f'), name]) {
    try {
      const value = JSON.parse(
        (
          await cacache.get(cache, 'make-fetch-happen:request-cache:https://registry.npmjs.org/' + encoded)
        ).data.toString(),
      );
      packuments.set(name, value);
      return value;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw Error(`Cached registry metadata missing: ${name}`);
}
async function completeLock() {
  const file = path.join(root, 'package-lock.json');
  const lock = JSON.parse(await fs.readFile(file, 'utf8'));
  let added = 0;
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location.includes('node_modules/') || entry.link) continue;
    const name = entry.name || location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const meta = (await cachedMetadata(name)).versions[entry.version];
    if (!meta?.dist?.integrity) throw Error(`Integrity unavailable for ${name}@${entry.version}`);
    entry.resolved = meta.dist.tarball;
    entry.integrity = meta.dist.integrity;
  }
  for (const [location, entry] of Object.entries(lock.packages)) {
    for (const [name, range] of Object.entries(entry.optionalDependencies || {})) {
      const target = 'node_modules/' + name;
      if (lock.packages[target]) continue;
      const data = await cachedMetadata(name);
      const version = semver.maxSatisfying(Object.keys(data.versions), range);
      if (!version) throw Error(`Optional metadata unavailable: ${name}@${range}`);
      const meta = data.versions[version];
      const optional = {
        version,
        resolved: meta.dist.tarball,
        integrity: meta.dist.integrity,
        optional: true,
      };
      if (entry.dev) optional.dev = true;
      for (const field of [
        'name',
        'license',
        'cpu',
        'os',
        'libc',
        'engines',
        'dependencies',
        'optionalDependencies',
        'peerDependencies',
        'peerDependenciesMeta',
        'bin',
      ])
        if (meta[field] !== undefined) optional[field] = meta[field];
      if (meta.scripts && (meta.scripts.install || meta.scripts.preinstall || meta.scripts.postinstall))
        optional.hasInstallScript = true;
      lock.packages[target] = optional;
      added++;
    }
  }
  await fs.writeFile(file, JSON.stringify(lock, null, 2) + '\n');
  console.log(
    `Completed lockfile integrity for installed packages; added ${added} optional platform packages.`,
  );
}
async function linkWorkspaces() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  for (const pattern of manifest.workspaces || []) {
    if (!pattern.endsWith('/*')) continue;
    const base = path.join(root, pattern.slice(0, -2));
    for (const folder of await fs.readdir(base)) {
      const dir = path.join(base, folder),
        p = await moduleManifest(dir);
      if (!p?.name) continue;
      const target = path.join(modules, p.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      try {
        await fs.symlink(path.relative(path.dirname(target), dir), target);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }
}
async function moduleManifest(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}
async function manifest(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}
function supports(values, current) {
  return (
    !values ||
    (!values.includes('!' + current) && (values.every((v) => v.startsWith('!')) || values.includes(current)))
  );
}
async function extract(name, version, dir) {
  const key = catalog.get(name)?.get(version);
  if (!key) throw Error(`Not cached: ${name}@${version}`);
  const result = await cacache.get(cache, key);
  await fs.mkdir(dir, { recursive: true });
  await pipeline(Readable.from([result.data]), tar.x({ cwd: dir, strip: 1 }));
  return manifest(dir);
}
function select(name, range) {
  return semver.maxSatisfying([...(catalog.get(name)?.keys() || [])], range, { includePrerelease: true });
}
async function nearest(name, from) {
  let at = from;
  while (at.startsWith(root)) {
    const dir = path.join(at, 'node_modules', name),
      p = await manifest(dir);
    if (p) return { dir, p };
    if (at === root) break;
    at = path.dirname(at);
  }
  return null;
}
async function bins(dir, p) {
  const entries = typeof p.bin === 'string' ? { [p.name.split('/').pop()]: p.bin } : p.bin || {};
  const binRoot = path.join(dir.slice(0, dir.lastIndexOf('node_modules') + 'node_modules'.length), '.bin');
  await fs.mkdir(binRoot, { recursive: true });
  for (const [name, file] of Object.entries(entries)) {
    const target = path.join(dir, file);
    await fs.chmod(target, 0o755);
    try {
      await fs.symlink(path.relative(binRoot, target), path.join(binRoot, name));
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}
async function dependencies(dir, p) {
  const deps = { ...p.dependencies };
  for (const name of Object.keys(p.optionalDependencies || {})) delete deps[name];
  for (const [name, spec] of Object.entries(deps)) await install(name, spec, dir);
  for (const [name, spec] of Object.entries(p.optionalDependencies || {}))
    await install(name, spec, dir, true);
  for (const [name, spec] of Object.entries(p.peerDependencies || {}))
    if (!p.peerDependenciesMeta?.[name]?.optional) await install(name, spec, dir);
  await bins(dir, p);
}
async function install(name, range, from = root, optional = false) {
  const found = await nearest(name, from);
  if (
    found &&
    (semver.satisfies(found.p.version, range, { includePrerelease: true }) ||
      requested[name] === found.p.version)
  )
    return found;
  const version = select(name, range);
  if (!version) {
    if (optional) {
      skipped.add(`${name}@${range}`);
      return;
    }
    throw Error(`No cached version satisfies ${name}@${range} (required by ${from})`);
  }
  const rootPackage = await manifest(path.join(modules, name));
  const dir = rootPackage ? path.join(from, 'node_modules', name) : path.join(modules, name);
  if (installed.has(dir)) return installed.get(dir);
  const p = await extract(name, version, dir);
  if (!supports(p.os, process.platform) || !supports(p.cpu, process.arch)) {
    await fs.rm(dir, { recursive: true, force: true });
    if (optional) return;
    throw Error(`Unsupported platform: ${name}@${version}`);
  }
  installed.set(dir, { dir, p });
  await dependencies(dir, p);
  return { dir, p };
}
(async () => {
  if (process.argv.includes('--complete-lock')) {
    await completeLock();
    await linkWorkspaces();
    return;
  }
  const entries = await cacache.ls(cache);
  for (const key of Object.keys(entries)) {
    const match = key.match(
      /https:\/\/registry\.npmjs\.org\/((?:@[^/]+\/)?[^/]+)\/-\/[^/]+-(\d+\.\d+\.\d+(?:-[^/]+)?)\.tgz$/,
    );
    if (match) {
      const [, name, version] = match;
      if (!semver.valid(version)) continue;
      if (!catalog.has(name)) catalog.set(name, new Map());
      catalog.get(name).set(version, key);
    }
  }
  await fs.mkdir(modules, { recursive: true });
  for (const [name, version] of Object.entries(requested))
    await extract(name, version, path.join(modules, name));
  for (const [name] of Object.entries(requested)) {
    const dir = path.join(modules, name),
      p = await manifest(dir);
    installed.set(dir, { dir, p });
    await dependencies(dir, p);
  }
  await linkWorkspaces();
  console.log(
    `Offline bootstrap ready: ${installed.size} packages; ${skipped.size} unavailable optional packages skipped.`,
  );
  console.log(
    Object.entries(requested)
      .map(([n, v]) => `${n}@${v}`)
      .join('\n'),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
