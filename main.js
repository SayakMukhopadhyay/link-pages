import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { Liquid } from "liquidjs";
import { parse } from "yaml";
import { Plugin } from "./plugins/Plugin.js";

const engine = new Liquid();

// Load config.yaml
let config;
if (existsSync("config.yaml")) {
  config = parse(readFileSync("config.yaml", "utf8"));
} else {
  throw new Error("Error: config.yaml not found.");
}

const settings = config || {};

const sourceDir = `./themes/${settings.theme || "default"}`;
const destinationDir = `${settings.output || "./dist/"}`;

// Clean _output folder
if (existsSync(destinationDir)) {
  readdirSync(destinationDir).forEach((file) => {
    if (
      file !== "." &&
      file !== ".." &&
      file !== "AUTO_GEN_FOLDER_DO_NOT_EDIT_FILE_HERE"
    ) {
      const filePath = join(destinationDir, file);
      if (lstatSync(filePath).isFile()) {
        unlinkSync(filePath);
      }
    }
  });
} else {
  mkdirSync(destinationDir, { recursive: true });
}

// Copy all files and directories while preserving the structure
/**
 * @param {string} src
 * @param {string} dest
 */
function copyRecursiveSync(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyRecursiveSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  });
}

copyRecursiveSync(sourceDir, destinationDir);

/**
 * @param {string} pluginFileName
 * @param {*} values
 *
 * @returns {Promise<Plugin>}
 */
async function createPluginObject(pluginFileName, values) {
  const pluginModule = await import(`./plugins/${pluginFileName}.js`);
  const classes = Object.values(pluginModule);

  for (const pluginClass of classes) {
    if (pluginClass.prototype instanceof Plugin) {
      return new pluginClass(values);
    }
  }
}

settings.vars = {};
if (settings.plugins) {
  for (const plugin of settings.plugins) {
    const pluginFileName = Object.keys(plugin)[0];
    if (existsSync(`./plugins/${pluginFileName}.js`)) {
      const pluginObject = await createPluginObject(
        pluginFileName,
        Object.values(plugin),
      );
      settings.vars[pluginFileName] = await pluginObject.execute();
    }
  }
}

const renderLinks = (links) => {
  for (const link of links) {
    const index = links.indexOf(link);

    links[index].icon = engine.parseAndRenderSync(link.icon, settings);
    links[index].url = engine.parseAndRenderSync(link.url, settings);
    links[index].title = engine.parseAndRenderSync(link.title, settings);
    link.text
      ? (links[index].text = engine.parseAndRenderSync(link.text, settings))
      : null;
  }
};

if (settings.links) {
  renderLinks(settings.links);
}

if (settings.socials) {
  renderLinks(settings.socials);
}

settings.title = engine.parseAndRenderSync(settings.title, settings);
settings.footer = engine.parseAndRenderSync(settings.footer, settings);
settings.tagline = engine.parseAndRenderSync(settings.tagline, settings);
settings.name = engine.parseAndRenderSync(settings.name, settings);

const templateFile = join(destinationDir, "index.html");
if (!existsSync(templateFile)) {
  throw new Error(`Error: ${templateFile} file not found.`);
}

const templateContent = readFileSync(templateFile, "utf8");

const renderedContent = engine.parseAndRenderSync(templateContent, settings);

writeFileSync(templateFile, renderedContent);
