const path = require('path');
const dotenv = require('dotenv');

// Ponto único de carregamento do .env. Resolve sempre a partir da raiz do
// monorepo (2 níveis acima deste arquivo: apps/api/src/shared/ -> raiz),
// independente de onde o processo Node foi iniciado (cwd de apps/api,
// cwd da raiz, worker em processo separado, etc).
//
// Qualquer entrypoint (server.js, migrate.js, jobs/index.js, scripts futuros)
// deve dar `require('../shared/env')` (ajustando o caminho relativo) em vez de
// chamar `require('dotenv').config()` diretamente — ver .cursor/rules/project.mdc.

const ENV_PATH = path.resolve(__dirname, '..', '..', '..', '..', '.env');
dotenv.config({ path: ENV_PATH });

module.exports = { ENV_PATH };
