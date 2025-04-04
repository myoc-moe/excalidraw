const { execSync } = require("child_process");

const excalidrawDir = `${__dirname}/../packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const publish = () => {
  try {
    console.info("Publishing the package...");
    execSync(`yarn --cwd ${excalidrawDir} publish`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const release = () => {
  publish();
  console.info(`Published ${pkg.version}!`);
};

release();
