import { Injectable, OnModuleInit } from '@nestjs/common';

import * as inquirer from 'inquirer';

import { customAlphabet } from 'nanoid';
import { nolookalikes } from 'nanoid-dictionary';

const nanoid = customAlphabet(nolookalikes, 8);

import { join } from 'node:path';
import { writeFile, ensureDir, readFile } from 'fs-extra';
import { EnvVars, Prompt } from './app.types';

import { template as templateWithStrip } from 'dot';

import Bluebird from 'bluebird';

const outputPath = join(process.cwd(), 'output');

const caddyFilePath = join(process.cwd(), 'src-cfgs', 'Caddyfile');
const caddyOutputFolderPath = join(outputPath, 'docker', 'caddy');
const caddyOutputFilePath = join(caddyOutputFolderPath, 'Caddyfile');

const composePath = join(process.cwd(), 'src-cfgs', 'docker-compose.yaml');
const composeOutputPath = join(outputPath, 'docker-compose.yaml');

const envFilePath = join(outputPath, '.env');

const sxcuFolderpath = join(process.cwd(), 'src-cfgs', 'sxcu');

const template = (templateString: string) => {
  return templateWithStrip(templateString, {
    strip: false,
  });
};

@Injectable()
export class AppService implements OnModuleInit {
  async onModuleInit() {
    const envVars = this.envVars;
    await this.startApiQuestions(envVars);

    await ensureDir(join(outputPath));
    await this.createEnvFile(envVars);

    await ensureDir(join(outputPath, 'sxcu'));
    await this.createSxcuFiles(envVars);

    const port = await this.startWebServerQuestions();
    await this.createComposeFile(port);

    if (!port) {
      await ensureDir(caddyOutputFolderPath);
      await this.createCaddyFile(envVars);
    }
  }

  async startApiQuestions(envVars: EnvVars) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: Prompt.MAIN_API_URL,
        message: 'What is the URL of your api?',
        default: envVars.MAIN_API_URL,
      },
      {
        type: 'input',
        name: Prompt.FRONT_API_URL,
        message: 'What is the URL of your paste site?',
        default: envVars.FRONT_API_URL,
      },
      {
        type: 'input',
        name: Prompt.API_KEY,
        message: 'What do you want your API key to be?',
        default: envVars.API_KEY,
      },
    ]);

    envVars.VITE_APP_API_URL = answers[Prompt.MAIN_API_URL];
    envVars.MAIN_API_URL = answers[Prompt.MAIN_API_URL];
    envVars.FRONT_API_URL = answers[Prompt.FRONT_API_URL];
    envVars.API_KEY = answers[Prompt.API_KEY];
  }

  async startWebServerQuestions(): Promise<number | false> {
    const promptUsingOwnWebServer = await inquirer.prompt([
      {
        type: 'confirm',
        name: Prompt.USING_OWN_WEB_SERVER,
        message: 'Are you using your own web server?',
        default: false,
      },
    ]);

    const usingOwnWebServer =
      promptUsingOwnWebServer[Prompt.USING_OWN_WEB_SERVER];

    if (!usingOwnWebServer) {
      return false;
    }

    const promptPort = await inquirer.prompt([
      {
        type: 'number',
        name: Prompt.OWN_WEB_SERVER_PORT,
        message: 'What port would you like to expose?',
        default: 3000,
      },
    ]);

    return promptPort[Prompt.OWN_WEB_SERVER_PORT] as number;
  }

  randomString() {
    return nanoid();
  }

  get envVars(): EnvVars {
    return {
      FRONT_API_URL: 'http://paste.localhost',
      API_KEY: this.randomString(),
      DB_HOST: 'db',
      DB_PORT: '5432',
      DB_DATABASE: 'postgres',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: this.randomString(),
      TYPES_URL: 'http://api:3000/docs-json',
      MAIN_API_URL: 'http://share.localhost',
      VITE_APP_API_URL: 'http://share.localhost',
      GENERATE_API: 'true',
    };
  }

  buildEnvVarsFileSz(envVars: EnvVars): string {
    let output = '';

    const keys = Object.keys(envVars);

    keys.forEach((key) => {
      const value = envVars[key];

      output = `${output}${key}=${value}\n`;
    });

    return output;
  }

  async createCaddyFile(envVars: EnvVars) {
    const inputCaddyFile = await readFile(caddyFilePath, 'utf-8');

    const compiled = template(inputCaddyFile);

    const outputCaddyString = compiled({
      MAIN_API_URL: envVars.MAIN_API_URL,
      FRONT_API_URL: envVars.FRONT_API_URL,
    });

    await writeFile(caddyOutputFilePath, outputCaddyString);
  }

  async createEnvFile(envVars: EnvVars) {
    const envFileSz = this.buildEnvVarsFileSz(envVars);
    await writeFile(envFilePath, envFileSz);
  }

  async createComposeFile(port: number | false) {
    const loadedSrcComposeFile = await readFile(composePath, 'utf-8');
    const outputComposeFile = template(loadedSrcComposeFile)({ port });

    await writeFile(composeOutputPath, outputComposeFile);
  }

  async createSxcuFiles(envVars: EnvVars) {
    const fileNames = ['file', 'image', 'text', 'url'];

    await Bluebird.mapSeries(fileNames, async (fileName) => {
      const filePath = join(sxcuFolderpath, `${fileName}.sxcu`);
      const loadedSxcu = await readFile(filePath, 'utf-8');

      const outputSxcuFile = template(loadedSxcu)({
        MAIN_API_URL: envVars.MAIN_API_URL,
        FRONT_API_URL: envVars.FRONT_API_URL,
        API_KEY: envVars.API_KEY,
      });

      const outputSxcuPath = join(outputPath, 'sxcu', `${fileName}.sxcu`);

      await writeFile(outputSxcuPath, outputSxcuFile);
    });
  }
}
