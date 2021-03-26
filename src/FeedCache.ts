import { Pool } from "pg";

export class FeedCache {
    private pool: Pool;
    private isLocal: boolean;

    constructor(connectionString: string, isLocal: boolean) {
        this.isLocal = isLocal;
        this.pool = new Pool({ 
            connectionString: connectionString,
            ssl: isLocal ? false : { rejectUnauthorized: false }
        });
    }

    public async init(): Promise<void> {
        let query = "CREATE TABLE IF NOT EXISTS feed_cache (" + 
            "id SERIAL PRIMARY KEY, " + 
            "created_at TIMESTAMP WITHOUT TIME ZONE, " + 
            "url TEXT UNIQUE, " + 
            "body TEXT);";
        
        if (this.isLocal) {
            query = "DROP TABLE IF EXISTS feed_cache;" + query;
        }
        
        await this.pool.query(query);
    }

    public async clean(before: string): Promise<number> {
        const client = await this.pool.connect();
        const query = "DELETE FROM feed_cache WHERE created_at < $1;";
        
        let count = 0;

        try {
            const r = await client.query(query, [before]);

            count = r.rowCount;
        }
        finally {
            client.release()
        }

        return count;
    }

    public async find(url: string): Promise<string> {
        const client = await this.pool.connect();
        const query = "SELECT body FROM feed_cache WHERE url = $1;";

        let result = null;

        try {
            const r = await client.query(query, [url]);

            result = r && r.rows[0] && r.rows[0].body;
        }
        finally {
            client.release()
        }

        return result;
    }

    public async insert(url: string, body: string): Promise<void> {
        const client = await this.pool.connect();
        const query = "INSERT INTO feed_cache(created_at, url, body) VALUES($1, $2, $3);";
        const now = new Date().toISOString();
        
        try {
            await client.query(query, [now, url, body]);
        }
        finally {
            client.release()
        }
    }
}