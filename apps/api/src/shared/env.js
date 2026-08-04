const path = require('path');

// Carrega o .env da raiz do monorepo (não o cwd do workspace apps/api).
// shared/ -> src/ -> api/ -> apps/ -> raiz
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
