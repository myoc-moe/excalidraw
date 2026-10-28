const fs = require("fs");
const path = require("path");

const { execSync } = require("child_process");

const updateChangelog = require("./updateChangelog");

// skipping utils for now, as it has independent release process
const PACKAGES = [
  "common",
  "fractional-indexing",
  "math",
  "element",
  "excalidraw",
];
const PACKAGES_DIR = path.resolve(__dirname, "../packages");
const RELEASE_DIST_DIR = path.resolve(__dirname, "../release-dist");
const GITHUB_RELEASES_URL =
  "https://github.com/myoc-moe/excalidraw/releases/download";

/**
 * Returns the arguments for the release script.
 *
 * Usage examples:
 * - yarn release --help                          -> prints this help message
 * - yarn release                                 -> publishes `@myoc` packages with "test" tag and "-[hash]" version suffix
 * - yarn release --tag=test                      -> same as above
 * - yarn release --tag=next                      -> publishes `@myoc` packages with "next" tag and version "-[hash]" suffix
 * - yarn release --tag=next --non-interactive    -> skips interactive prompts (runs on CI/CD), otherwise same as above
 * - yarn release --tag=next --github             -> packs `@myoc` packages into `release-dist/` for a GitHub release, without publishing
 *   (test/next versions look like "0.21.1-next-abc1234": the patch after the newest stable release, plus the commit hash)
 * - yarn release --tag=latest --version=0.19.0   -> publishesy
 *  `@excalidraw` packages with "latest" tag and version "0.19.0" & prepares changelog for the release
 *
 * @returns [tag, version, nonInteractive, github]
 */
const getArguments = () => {
  let tag = "test";
  let version = "";
  let nonInteractive = false;
  let github = false;

  for (const argument of process.argv.slice(2)) {
    if (/--help/.test(argument)) {
      console.info(`Available arguments:
  --tag=<tag>                                    -> (optional) "test" (default), "next" for auto release, "latest" for stable release
  --version=<version>                            -> (optional) for "next" and "test", (required) for "latest" i.e. "0.19.0"
  --non-interactive                              -> (optional) disables interactive prompts
  --github                                       -> (optional) packs tarballs into release-dist/ for a GitHub release, does not publish to npm`);

      console.info(`\nUsage examples:
  - yarn release                                 -> publishes \`@myoc\` packages with "test" tag and "-[hash]" version suffix
  - yarn release --tag=test                      -> same as above
  - yarn release --tag=next                      -> publishes \`@myoc\` packages with "next" tag and version "-[hash]" suffix
  - yarn release --tag=next --non-interactive    -> skips interactive prompts (runs on CI/CD), otherwise same as above
  - yarn release --tag=next --github             -> packs \`@myoc\` packages into release-dist/ for a GitHub release (runs on CI/CD)
  - yarn release --tag=latest --version=0.19.0   -> publishes \`@myoc\` packages with "latest" tag and version "0.19.0" & prepares changelog for the release`);

      process.exit(0);
    }

    if (/--tag=/.test(argument)) {
      tag = argument.split("=")[1];
    }

    if (/--version=/.test(argument)) {
      version = argument.split("=")[1];
    }

    if (/--non-interactive/.test(argument)) {
      nonInteractive = true;
    }

    if (/--github/.test(argument)) {
      github = true;
    }
  }

  if (tag !== "latest" && tag !== "next" && tag !== "test") {
    console.error(`Unsupported tag "${tag}", use "latest", "next" or "test".`);
    process.exit(1);
  }

  if (github && tag !== "next") {
    console.error(
      `Only "next" snapshots go to GitHub releases, don't pass --github with "${tag}"!`,
    );
    process.exit(1);
  }

  if (tag === "latest" && !version) {
    console.error("Pass the version to make the latest stable release!");
    process.exit(1);
  }

  if (!version) {
    // snapshot version: the patch after the newest stable release, plus the
    // commit hash, so it sorts above every stable version it builds on
    const excalidrawPackageVersion = require(getPackageJsonPath(
      "excalidraw",
    )).version;

    const hash = getShortCommitHash();

    if (!excalidrawPackageVersion.includes(hash)) {
      const base = maxStableVersion(
        excalidrawPackageVersion,
        getPublishedLatestVersion(),
      );
      version = `${bumpPatch(base)}-${tag}-${hash}`;
    } else {
      // ensuring idempotency
      version = excalidrawPackageVersion;
    }
  }

  console.info(`Running with tag "${tag}" and version "${version}"...`);

  return [tag, version, nonInteractive, github];
};

const validatePackageName = (packageName) => {
  if (!PACKAGES.includes(packageName)) {
    console.error(`Package "${packageName}" not found!`);
    process.exit(1);
  }
};

const getPackageJsonPath = (packageName) => {
  validatePackageName(packageName);
  return path.resolve(PACKAGES_DIR, packageName, "package.json");
};

const readPackageJson = (packageName) =>
  JSON.parse(fs.readFileSync(getPackageJsonPath(packageName), "utf-8"));

const updatePackageJsons = (nextVersion) => {
  const packageJsons = new Map();

  for (const packageName of PACKAGES) {
    const pkg = readPackageJson(packageName);

    pkg.version = nextVersion;

    if (pkg.dependencies) {
      for (const dependencyName of PACKAGES) {
        const myocName = `@myoc/${dependencyName}`;
        const excalidrawName = `@excalidraw/${dependencyName}`;

        if (pkg.dependencies[myocName]) {
          pkg.dependencies[myocName] = nextVersion;
        }

        if (pkg.dependencies[excalidrawName]) {
          pkg.dependencies[excalidrawName] = nextVersion;
        }
      }
    }

    packageJsons.set(packageName, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  // modify once, to avoid inconsistent state
  for (const packageName of PACKAGES) {
    const content = packageJsons.get(packageName);
    fs.writeFileSync(getPackageJsonPath(packageName), content, "utf-8");
  }
};

const snapshotDependencies = () => {
  const snapshot = new Map();

  for (const packageName of PACKAGES) {
    const pkg = readPackageJson(packageName);
    snapshot.set(
      packageName,
      pkg.dependencies ? { ...pkg.dependencies } : null,
    );
  }

  return snapshot;
};

const restoreDependencies = (snapshot) => {
  const packageJsons = new Map();

  for (const packageName of PACKAGES) {
    const pkg = readPackageJson(packageName);
    const deps = snapshot.get(packageName);
    pkg.dependencies = deps ? { ...deps } : undefined;
    packageJsons.set(packageName, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  for (const packageName of PACKAGES) {
    const content = packageJsons.get(packageName);
    fs.writeFileSync(getPackageJsonPath(packageName), content, "utf-8");
  }
};

const getTarballName = (packageName, version) =>
  `myoc-${packageName}-${version}.tgz`;

const getGithubTarballUrl = (packageName, version) =>
  `${GITHUB_RELEASES_URL}/v${version}/${getTarballName(packageName, version)}`;

// github: internal dependencies point to the tarballs of the same GitHub
// release, so consumers pin only the packages they import
const applyPublishAliases = (nextVersion, github) => {
  const packageJsons = new Map();

  for (const packageName of PACKAGES) {
    const pkg = readPackageJson(packageName);

    if (pkg.dependencies) {
      for (const dependencyName of PACKAGES) {
        const myocName = `@myoc/${dependencyName}`;
        const excalidrawName = `@excalidraw/${dependencyName}`;
        const aliasVersion = github
          ? getGithubTarballUrl(dependencyName, nextVersion)
          : `npm:@myoc/${dependencyName}@${nextVersion}`;

        if (pkg.dependencies[myocName] || pkg.dependencies[excalidrawName]) {
          delete pkg.dependencies[myocName];
          pkg.dependencies[excalidrawName] = aliasVersion;
        }
      }
    }

    packageJsons.set(packageName, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  for (const packageName of PACKAGES) {
    const content = packageJsons.get(packageName);
    fs.writeFileSync(getPackageJsonPath(packageName), content, "utf-8");
  }
};

const getPublishedLatestVersion = () => {
  try {
    return execSync("npm view @myoc/excalidraw dist-tags.latest")
      .toString()
      .trim();
  } catch {
    return "0.0.0";
  }
};

const parseStableVersion = (version) =>
  version.split("-")[0].split(".").map(Number);

const maxStableVersion = (a, b) => {
  const [pa, pb] = [parseStableVersion(a), parseStableVersion(b)];
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return (pa[i] > pb[i] ? pa : pb).join(".");
    }
  }
  return pa.join(".");
};

const bumpPatch = (version) => {
  const [major, minor, patch] = parseStableVersion(version);
  return `${major}.${minor}.${patch + 1}`;
};

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const askToCommit = (tag, nextVersion) => {
  if (tag !== "latest") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "Would you like to commit these changes to git? (Y/n): ",
      (answer) => {
        rl.close();

        if (answer.toLowerCase() === "y") {
          execSync(`git add -u`);
          execSync(
            `git commit -m "chore: release @myoc/excalidraw@${nextVersion} 🎉"`,
          );
        } else {
          console.warn(
            "Skipping commit. Don't forget to commit manually later!",
          );
        }

        resolve();
      },
    );
  });
};

const buildPackages = () => {
  console.info("Running yarn install...");
  execSync(`yarn --frozen-lockfile`, { stdio: "inherit" });

  console.info("Removing existing build artifacts...");
  execSync(`yarn rm:build`, { stdio: "inherit" });

  for (const packageName of PACKAGES) {
    console.info(`Building "@myoc/${packageName}"...`);
    execSync(`yarn run build:esm`, {
      cwd: path.resolve(PACKAGES_DIR, packageName),
      stdio: "inherit",
    });
  }
};

const askToPublish = (tag, version) => {
  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "Would you like to publish these changes to npm? (Y/n): ",
      (answer) => {
        rl.close();

        if (answer.toLowerCase() === "y") {
          publishPackages(tag, version);
        } else {
          console.info("Skipping publish.");
        }

        resolve();
      },
    );
  });
};

const publishPackages = (tag, version) => {
  for (const packageName of PACKAGES) {
    // npm, not yarn: trusted publishing (OIDC) from CI needs npm >= 11.5.1
    execSync(`npm publish --tag ${tag}`, {
      cwd: path.resolve(PACKAGES_DIR, packageName),
      stdio: "inherit",
    });

    console.info(
      `Published "@myoc/${packageName}@${tag}" with version "${version}"! 🎉`,
    );
  }
};

const packPackages = (version) => {
  fs.rmSync(RELEASE_DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(RELEASE_DIST_DIR, { recursive: true });

  for (const packageName of PACKAGES) {
    execSync(`npm pack --pack-destination "${RELEASE_DIST_DIR}"`, {
      cwd: path.resolve(PACKAGES_DIR, packageName),
      stdio: "inherit",
    });

    const tarballPath = path.resolve(
      RELEASE_DIST_DIR,
      getTarballName(packageName, version),
    );
    if (!fs.existsSync(tarballPath)) {
      console.error(`Expected tarball "${tarballPath}" not found!`);
      process.exit(1);
    }

    console.info(`Packed "@myoc/${packageName}" with version "${version}"!`);
  }

  // read by the release workflow to name the GitHub release
  fs.writeFileSync(path.resolve(RELEASE_DIST_DIR, "VERSION"), version, "utf-8");
};

/** main */
(async () => {
  const [tag, version, nonInteractive, github] = getArguments();

  const dependenciesSnapshot = snapshotDependencies();

  buildPackages();

  if (tag === "latest") {
    await updateChangelog(version);
  }

  updatePackageJsons(version);
  applyPublishAliases(version, github);

  if (github) {
    packPackages(version);
  } else if (nonInteractive) {
    publishPackages(tag, version);
  } else {
    await askToPublish(tag, version);
  }

  restoreDependencies(dependenciesSnapshot);

  if (!nonInteractive) {
    await askToCommit(tag, version);
  }
})();
