const { Pool } = require("pg");

class Cache {
    constructor(connectionString, isLocal) {
        this.pool = new Pool({ 
            connectionString: connectionString,
            ssl: isLocal ? false : { rejectUnauthorized: false }
        });
    }

    async init() {
        const query = "CREATE TABLE IF NOT EXISTS cache (" + 
            "id SERIAL PRIMARY KEY, " + 
            "created_at TIMESTAMP WITHOUT TIME ZONE, " + 
            "url TEXT UNIQUE, " + 
            "body TEXT)";
        
        await this.pool.query(query);
    }

    async clean(before) {
        const client = await this.pool.connect();
        const query = "DELETE FROM cache WHERE created_at < $1";
        
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

    async find(url) {
        const client = await this.pool.connect();
        const query = "SELECT body FROM cache WHERE url = $1";

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

    async insert(url, body) {
        const client = await this.pool.connect();
        const query = "INSERT INTO cache(created_at, url, body) VALUES($1, $2, $3)";
        const now = new Date().toISOString();
        
        try {
            await client.query(query, [now, url, body]);
        }
        finally {
            client.release()
        }
    }
}

module.exports = { Cache: Cache };