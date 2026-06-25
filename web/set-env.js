const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');
const apiUrl = process.env.API_URL || 'https://laviagiusta-backend.onrender.com';

const envConfigFile = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}/api/v1',
  baseUrl: '${apiUrl}'
};
`;

// Check if directory exists
const dir = path.join(__dirname, 'src', 'environments');
if (!fs.existsSync(dir)){
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(targetPath, envConfigFile);
console.log(`Production environment generated at ${targetPath} with API URL: ${apiUrl}`);
