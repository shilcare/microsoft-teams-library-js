const fs = require('fs');
const cp = require("child_process");
const util = require("util");

let packageJsonPath = './package.json';
const EXIT_CODE_FATAL_ERROR = 5;

const exec = util.promisify(cp.exec);

function getPackageJson() {
  if (fs.existsSync(packageJsonPath)) {
    return JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }));
  }
  console.log('FATAL ERROR: package.json path could not be found in the file system.');
  process.exitCode = EXIT_CODE_FATAL_ERROR;
  return;
}

/**
 * Gets the file content in JSON format from the given file path. Exits with the exit code of
 * fatal error without returning a value if the given file path does not show a valid path to a
 * JSON file within the system.
 * @param {string} filePath Path to the desired file.
 * @returns The file content in JSON format.
 */
function getFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
    } catch (error) {
      console.log(JSON.stringify(error));
    }
  } else {
    console.log(`FATAL ERROR: file path ${filePath} could not be found in the file system.`);
  }
  process.exitCode = EXIT_CODE_FATAL_ERROR;
  return;
}

function savePackageJson(packageJson) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson));
}

/**
 * Gets the current version of this package specified in the package.json.
 * @param {any} packageJson The object that contains the content of this project's package.json.
 * @returns the version of this package specified in the package.json.
 */
function getPkgJsonVersion(packageJson) {
  if (!packageJson.version) {
    console.log('FATAL ERROR: a version was not found in the package.json.');
    process.exitCode = EXIT_CODE_FATAL_ERROR;
    return;
  } else {
    return packageJson.version;
  }
}

/**
 * Gets the prefix of the given version where prefix is defined as the major.minor.patch
 * version before any dashes are added.
 * @param {string} version The whole version to parse and find the prefix from.
 * @returns The prefix of the given version. If there are no dashes in the given version, the
 * prefix and the version will be the same.
 */
function getPrefix(version) {
  const dashIndex = version.indexOf('-');
  if (dashIndex == -1) {
    return version;
  } else {
    return version.substring(0, dashIndex);
  }
}

/**
 * Uses the given current dev version and latest production version to generate and return
 * the number of the new dev version. The new dev version numbers are 0-index based.
 * @param {string} devVer The version currently tagged dev.
 * @param {string} latestVer The version currently tagged latest. This version should never have a dash.
 * @returns Just the number of the suffix of the next dev version. i.e. 1.10.0-dev.<dev suffix number to be returned>
 */
function getDevSuffixNum(devVer, latestVer) {
  // if there is no dev version returned, make the first one
  if (devVer === undefined) {
    return 0;
  }
  // there is a dev version returned, so grab the devSuffix from it and increment.
  const devIndex = devVer.indexOf('-dev.') + '-dev.'.length;
  if (devIndex === -1) {
    throw new Error(
      `The dev tagged release \'${devVer}\'in the feed is not named properly and does not contain \'-dev\'. Please resolve this first.`,
    );
  }
  const devSuffixNum = parseInt(devVer.substring(devIndex));
  if (devSuffixNum === NaN) {
    throw new Error(
      `The dev tagged release \'${devVer}\'in the feed is not named properly and contains a non-number character after \'-dev.\'. Please resolve this first.`,
    );
  }

  const newDevSuffixNum = devSuffixNum + 1;
  const latestPrefix = latestVer;
  const devPrefix = getPrefix(devVer);
  const latestPatch = parseInt(latestPrefix.substring(latestPrefix.lastIndexOf('.') + 1));
  const devPrefixPatch = parseInt(devPrefix.substring(devPrefix.lastIndexOf('.') + 1));
  // If the current devPrefix is already higher than the latest version's prefix, there has already been a dev version
  // released after a production version, so we'll need to just bump the dev suffix by one.
  if (latestPatch + 1 === devPrefixPatch) {
    return newDevSuffixNum;
  // If the current devPrefix is the same as the latest version's prefix, it means there hasn't been a dev version
  // released since the production release. Set the dev suffix as 0.
  } else if (latestPrefix === devPrefix) {
    return 0;
  } else {
    throw new Error(
      `Inconsistent tags in npm feed. There shouldn't be a dev version that differs from the latest 
      version by more than one patch version. latest version is ${latestVer} while dev version is 
      ${devVer}. Please resolve this issue in the npm feed first.`,
    );
  }
}

(async () => {
  const packageJson = getPackageJson();

  // get package version from package.json
  let currVersion = getPkgJsonVersion(packageJson);
  console.log('package.json version: ' + currVersion);

  // Find version tagged dev
  const { devStdout, ignore } = await exec(`npm view @microsoft/teams-js version --tag dev`);
  const newDevSuffix = getDevSuffixNum(devStdout, currVersion);
  console.log('dev version suffix number: ' + newDevSuffix);

  const [major, minor, patch] = currVersion.split('.');
  let newDevPrefix = '';

  if (devStdout !== undefined && getPrefix(devStdout) === currVersion) {
    newDevPrefix = currVersion;
  } else {
    newDevPrefix = `${major}.${minor}.${parseInt(patch) + 1}`;
  }

  // append the suffix to form a new version
  const newVersion = newDevPrefix + '-dev.' + newDevSuffix;

  console.log('new version: ' + newVersion);

  // update package.json with the new version
  packageJson.version = newVersion;

  savePackageJson(packageJson);
})();
