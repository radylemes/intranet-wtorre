require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'intranet',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || 'intranet_wtorre';
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await connection.query(sql);
    console.log(`Migration aplicada: ${file}`);
  }

  await connection.end();
  console.log('Migrations aplicadas com sucesso.');
}

migrate().catch((err) => {
  console.error('Erro na migration:', err.message);
  process.exit(1);
});
