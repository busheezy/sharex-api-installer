import { Injectable, OnModuleInit } from '@nestjs/common';

import * as inquirer from 'inquirer';

import { customAlphabet } from 'nanoid';
import { nolookalikes } from 'nanoid-dictionary';

const nanoid = customAlphabet(nolookalikes, 8);

import { join } from 'node:path';
import { copyFile, writeFile, ensureDir, readFile } from 'fs-extra';
import { EnvVars, Prompt } from './app.types';

import template from 'lodash.template';

import Bluebird from 'bluebird';

const outputPath = join(process.cwd(), 'output');

const caddyFilePath = join(process.cwd(), 'src-cfgs', 'Caddyfile');
const caddyOutputFolderPath = join(outputPath, 'docker', 'caddy');
const caddyOutputFilePath = join(caddyOutputFolderPath, 'Caddyfile');

const composePath = join(process.cwd(), 'src-cfgs', 'docker-compose.yaml');
const composeOutputPath = join(outputPath, 'docker-compose.yaml');

const envFilePath = join(outputPath, '.env');

const sxcuFolderpath = join(process.cwd(), 'src-cfgs', 'sxcu');

@Injectable()
export class AppService implements OnModuleInit {
  async onModuleInit() {
    await this.makeSureDirsExist();

    const envVars = this.envVars;
    await this.startApiQuestions(envVars);

    await this.createCaddyFile(envVars);
    await this.createEnvFile(envVars);
    await this.createComposeFile();
    await this.createSxcuFiles(envVars);
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

  async makeSureDirsExist() {
    await ensureDir(caddyOutputFolderPath);
    await ensureDir(join(outputPath, 'sxcu'));
  }

  async createComposeFile() {
    await copyFile(composePath, composeOutputPath);
  }

  async createSxcuFiles(envVars: EnvVars) {
    const fileNames = ['file', 'image', 'text', 'url'];

    await Bluebird.map(fileNames, async (fileName) => {
      const filePath = join(sxcuFolderpath, `${fileName}.sxcu`);
      const loadedSxcu = await readFile(filePath, 'utf-8');

      const compiled = template(loadedSxcu);

      const outputSxcuFile = compiled({
        MAIN_API_URL: envVars.MAIN_API_URL,
        FRONT_API_URL: envVars.FRONT_API_URL,
        API_KEY: envVars.API_KEY,
      });

      const outputSxcuPath = join(outputPath, 'sxcu', `${fileName}.sxcu`);

      await writeFile(outputSxcuPath, outputSxcuFile);
    });
  }
}
