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
            "count INT, " + 
            "body TEXT);";
        
        if (this.isLocal) {
            query = "DROP TABLE IF EXISTS feed_cache;" + query;
        }
        
        await this.pool.query(query);
    }

    public async clean(before: string): Promise<number> {
        const client = await this.pool.connect();
        const query = "DELETE FROM feed_cache WHERE created_at < $1;";
        
        let rowCount = 0;

        try {
            const r = await client.query(query, [before]);

            rowCount = r.rowCount;
        }
        finally {
            client.release()
        }

        return rowCount;
    }

    public async find(url: string): Promise<{ body: string, count: number }> {
        const client = await this.pool.connect();
        const query = "SELECT body, count FROM feed_cache WHERE url = $1;";

        let body = null;
        let count = 0;

        try {
            const r = await client.query(query, [url]);

            if (r && r.rows[0]) {
                body = r.rows[0].body;
                count = r.rows[0].count;
            }
        }
        finally {
            client.release()
        }

        return { body: body, count: count };
    }

    public async insert(url: string, count: number, body: string): Promise<void> {
        const client = await this.pool.connect();
        const query = "INSERT INTO feed_cache(created_at, url, count, body) VALUES($1, $2, $3, $4);";
        const now = new Date().toISOString();
        
        try {
            await client.query(query, [now, url, count, body]);
        }
        finally {
            client.release()
        }
    }
}