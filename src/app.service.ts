import { Injectable, OnModuleInit } from "@nestjs/common";

import inquirer from "inquirer";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

const nanoid = customAlphabet(nolookalikes, 32);

import { join } from "node:path";
import { writeFile, ensureDir, readFile } from "fs-extra";
import { EnvVars, Prompt } from "./app.types";

import { template as templateWithStrip, templateSettings } from "dot";

import Bluebird from "bluebird";
import { open, readdir } from "node:fs/promises";

const outputPath = join(process.cwd(), "output");

const caddyFilePath = join(process.cwd(), "src-cfgs", "Caddyfile");
const caddyOutputFolderPath = join(outputPath, "docker", "caddy");
const caddyOutputFilePath = join(caddyOutputFolderPath, "Caddyfile");

const composePath = join(process.cwd(), "src-cfgs", "docker-compose.yaml");
const composeOutputPath = join(outputPath, "docker-compose.yaml");

const envFilePath = join(outputPath, ".env");

const sxcuFolderpath = join(process.cwd(), "src-cfgs", "sxcu");

const template = (templateString: string) => {
  return templateWithStrip(templateString, {
    ...templateSettings,
    strip: false,
  });
};

async function writePrivateFile(path: string, content: string) {
  const file = await open(path, "w", 0o600);
  try {
    await file.chmod(0o600);
    await file.writeFile(content);
  } finally {
    await file.close();
  }
}

@Injectable()
export class AppService implements OnModuleInit {
  async onModuleInit() {
    const isDirEmpty = await this.isOutputDirEmpty();
    if (!isDirEmpty) {
      const overwrite = await this.startOverwriteQuestion();
      if (!overwrite) {
        return;
      }
    }

    const envVars = this.envVars;
    await this.startApiQuestions(envVars);

    await ensureDir(outputPath);
    await this.createEnvFile(envVars);

    const sxcuOutputPath = join(outputPath, "sxcu");
    await ensureDir(sxcuOutputPath);
    await this.createSxcuFiles(envVars);

    const port = await this.startWebServerQuestions();
    await this.createComposeFile(port);

    if (!port) {
      await ensureDir(caddyOutputFolderPath);
      await this.createCaddyFile(envVars);
    }

    console.log("Files have been created.");
  }

  async isOutputDirEmpty(): Promise<boolean> {
    await ensureDir(outputPath);
    const dir = await readdir(outputPath);

    return dir.length === 0;
  }

  async startOverwriteQuestion() {
    const promptOverwriteOutput = await inquirer.prompt([
      {
        type: "confirm",
        name: Prompt.OVERWRITE_OUTPUT,
        message: "Output directory is not empty. Output anyways?",
        default: false,
      },
    ]);

    return promptOverwriteOutput[Prompt.OVERWRITE_OUTPUT] as boolean;
  }

  async startApiQuestions(envVars: EnvVars) {
    const answers = await inquirer.prompt<
      Record<Prompt.MAIN_API_URL | Prompt.FRONT_API_URL | Prompt.API_KEY, string>
    >([
      {
        type: "input",
        name: Prompt.MAIN_API_URL,
        message: "What is the URL of your api?",
        default: envVars.MAIN_API_URL,
        validate: this.validateUrl,
        filter: (value: string) => value.replace(/\/$/, ""),
      },
      {
        type: "input",
        name: Prompt.FRONT_API_URL,
        message: "What is the URL of your paste site?",
        default: envVars.FRONT_API_URL,
        validate: this.validateUrl,
        filter: (value: string) => value.replace(/\/$/, ""),
      },
      {
        type: "password",
        mask: "*",
        name: Prompt.API_KEY,
        message: "What do you want your API key to be? Leave blank to generate one.",
        validate: (value: string) => {
          const apiKey = value || envVars.API_KEY;
          return this.validateSecret(apiKey);
        },
      },
    ]);

    envVars.VITE_APP_API_URL = "/api";
    envVars.MAIN_API_URL = answers[Prompt.MAIN_API_URL];
    envVars.FRONT_API_URL = answers[Prompt.FRONT_API_URL];
    const apiKey = answers[Prompt.API_KEY] || envVars.API_KEY;
    envVars.API_KEY = apiKey;
  }

  async startWebServerQuestions(): Promise<number | false> {
    const promptUsingOwnWebServer = await inquirer.prompt([
      {
        type: "confirm",
        name: Prompt.USING_OWN_WEB_SERVER,
        message: "Are you using your own web server?",
        default: false,
      },
    ]);

    const usingOwnWebServer = promptUsingOwnWebServer[Prompt.USING_OWN_WEB_SERVER];

    if (!usingOwnWebServer) {
      return false;
    }

    const promptPort = await inquirer.prompt([
      {
        type: "number",
        name: Prompt.OWN_WEB_SERVER_PORT,
        message: "What port would you like to expose?",
        default: 3000,
        validate: this.validatePort,
      },
    ]);

    return promptPort[Prompt.OWN_WEB_SERVER_PORT] as number;
  }

  validateUrl(value: string): true | string {
    try {
      const url = new URL(value);
      const isHttp = url.protocol === "http:" || url.protocol === "https:";
      const origin = url.origin;
      const normalized = value.replace(/\/$/, "");

      if (isHttp && normalized === origin) {
        return true;
      }
    } catch {
      return "Enter a valid HTTP or HTTPS origin, such as https://share.example.com.";
    }

    return "Use an HTTP or HTTPS origin without a path, query, or credentials.";
  }

  validateSecret(value: string): true | string {
    const isSafe = /^[A-Za-z0-9_-]+$/.test(value);
    return isSafe || "Use letters, numbers, underscores, and hyphens for the API key.";
  }

  validatePort(value: number): true | string {
    const isInteger = Number.isInteger(value);
    const isValid = isInteger && value >= 1 && value <= 65535;
    return isValid || "Enter a whole-number port between 1 and 65535.";
  }

  randomString() {
    return nanoid();
  }

  get envVars(): EnvVars {
    const API_KEY = this.randomString();
    const DB_PASSWORD = this.randomString();

    return {
      FRONT_API_URL: "http://paste.localhost",
      API_KEY,
      DB_HOST: "db",
      DB_PORT: "5432",
      DB_DATABASE: "postgres",
      DB_USERNAME: "postgres",
      DB_PASSWORD,
      TYPES_URL: "http://api:3000/docs-json",
      MAIN_API_URL: "http://share.localhost",
      VITE_APP_API_URL: "/api",
      GENERATE_API: "true",
    };
  }

  buildEnvVarsFileSz(envVars: EnvVars): string {
    const entries = Object.entries(envVars);
    const lines = entries.map(([key, value]) => `${key}='${value}'`);
    const output = lines.join("\n");
    return `${output}\n`;
  }

  async createCaddyFile(envVars: EnvVars) {
    const inputCaddyFile = await readFile(caddyFilePath, "utf-8");

    const compiled = template(inputCaddyFile);

    const { MAIN_API_URL, FRONT_API_URL } = envVars;
    const outputCaddyString = compiled({ MAIN_API_URL, FRONT_API_URL });

    await writeFile(caddyOutputFilePath, outputCaddyString);
  }

  async createEnvFile(envVars: EnvVars) {
    const envFileSz = this.buildEnvVarsFileSz(envVars);
    await writePrivateFile(envFilePath, envFileSz);
  }

  async createComposeFile(port: number | false) {
    const loadedSrcComposeFile = await readFile(composePath, "utf-8");
    const compiled = template(loadedSrcComposeFile);
    const outputComposeFile = compiled({ port });

    await writeFile(composeOutputPath, outputComposeFile);
  }

  async createSxcuFiles(envVars: EnvVars) {
    const fileNames = ["file", "image", "text", "url"];

    await Bluebird.mapSeries(fileNames, async (fileName) => {
      const filePath = join(sxcuFolderpath, `${fileName}.sxcu`);
      const loadedSxcu = await readFile(filePath, "utf-8");

      const compiled = template(loadedSxcu);
      const { MAIN_API_URL, FRONT_API_URL, API_KEY } = envVars;
      const outputSxcuFile = compiled({ MAIN_API_URL, FRONT_API_URL, API_KEY });

      const outputSxcuPath = join(outputPath, "sxcu", `${fileName}.sxcu`);

      await writePrivateFile(outputSxcuPath, outputSxcuFile);
    });
  }
}
