declare namespace NodeJS {
    export interface ProcessEnv {
        DATABASE_URL: string;
        PORT: string;
        KEEP_CACHE: string;
        TEXT_MODE: string;
        DEBUG: string;
        STYLE: string;
        HEADERS: string;
        IS_LOCAL: string;
    }
}