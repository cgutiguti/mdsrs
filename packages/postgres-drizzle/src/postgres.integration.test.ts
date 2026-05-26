import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, describe } from 'vitest';
import { describeSrsStoreConformance } from '../../store/test/conformance.js';
import { createPostgresDrizzleStore, migrations, schema } from './index.js';

const connectionString = process.env.MDSRS_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres('createPostgresDrizzleStore integration', () => {
	const schemaName = `mdsrs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	let adminPool: pg.Pool;
	let pool: pg.Pool;

	beforeAll(async () => {
		if (!connectionString) throw new Error('MDSRS_POSTGRES_URL is required.');

		adminPool = new pg.Pool({ connectionString });
		await adminPool.query(`CREATE SCHEMA "${schemaName}"`);

		pool = new pg.Pool({
			connectionString,
			options: `-c search_path=${schemaName}`
		});
		await pool.query(await readFile(migrations.initial, 'utf8'));
	});

	afterAll(async () => {
		await pool?.end();
		if (adminPool) {
			await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
			await adminPool.end();
		}
	});

	describeSrsStoreConformance('createPostgresDrizzleStore', {
		createStore: () => createPostgresDrizzleStore(drizzle(pool, { schema })),
		reset: async () => {
			await pool.query('TRUNCATE TABLE "mdsrs_reviews", "mdsrs_cards" RESTART IDENTITY CASCADE');
		}
	});
});
