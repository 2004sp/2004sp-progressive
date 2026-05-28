import { DatabaseConnection } from 'kysely';
import { DatabaseSync } from 'node:sqlite';

/**
 * Config for the SQLite dialect.
 */
export interface BunSqliteDialectConfig {
    /**
     * A node:sqlite DatabaseSync instance.
     */
    database: DatabaseSync;

    /**
     * Called once when the first query is executed.
     */
    onCreateConnection?: (connection: DatabaseConnection) => Promise<void>;
}
