export interface EnvVars {
  FRONT_API_URL: string;
  API_KEY: string;
  DB_HOST: string;
  DB_PORT: string;
  DB_DATABASE: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  TYPES_URL: string;
  MAIN_API_URL: string;
  VITE_APP_API_URL: string;
  GENERATE_API: string;
}

export enum Prompt {
  MAIN_API_URL = 'main_api_url',
  FRONT_API_URL = 'typegen_api_url',
  API_KEY = 'api_key',
}
