const path = require("path");
const fs = require("fs");

const { build } = require("esbuild");

const includeGifWorker = process.argv.includes("--gif-worker");

// contains all dependencies bundled inside
const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  format: "esm",
  entryPoints: includeGifWorker
    ? ["src/index.ts", "src/gif.worker.ts"]
    : ["src/index.ts"],
  entryNames: "[name]",
  assetNames: "[dir]/[name]",
  alias: {
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
  external: [
    "@excalidraw/common",
    "@excalidraw/element",
    "@excalidraw/math",
    "@excalidraw/fractional-indexing",
  ],
});

function buildDev(config) {
  return build({
    ...config,
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
}

function buildProd(config) {
  return build({
    ...config,
    minify: true,
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
}

const createESMRawBuild = async () => {
  // development unminified build with source maps
  await buildDev(getConfig("dist/dev"));
  if (includeGifWorker) {
    fs.copyFileSync(
      require.resolve("@discourse/gif/codec/pkg/squoosh_gif_bg.wasm"),
      path.resolve("dist/dev/squoosh_gif_bg.wasm"),
    );
  }

  // production minified build without sourcemaps
  await buildProd(getConfig("dist/prod"));
  if (includeGifWorker) {
    fs.copyFileSync(
      require.resolve("@discourse/gif/codec/pkg/squoosh_gif_bg.wasm"),
      path.resolve("dist/prod/squoosh_gif_bg.wasm"),
    );
  }
};

(async () => {
  await createESMRawBuild();
})();
