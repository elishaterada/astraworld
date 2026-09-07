CREATE SCHEMA IF NOT EXISTS astraworld;
CREATE TABLE IF NOT EXISTS astraworld.schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS astraworld.worlds (
 namespace text NOT NULL, id uuid NOT NULL, metadata jsonb NOT NULL,
 owner_token text, epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0), revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 state jsonb, digest text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(namespace,id), CHECK(jsonb_typeof(metadata)='object'), CHECK(state IS NULL OR jsonb_typeof(state)='object')
);
CREATE UNIQUE INDEX IF NOT EXISTS worlds_invite ON astraworld.worlds(namespace,(metadata->>'invite'));
CREATE TABLE IF NOT EXISTS astraworld.members (
 namespace text NOT NULL, world_id uuid NOT NULL, id uuid NOT NULL,
 token_hash text NOT NULL CHECK(length(token_hash)=64), name text NOT NULL, character text NOT NULL CHECK(character IN ('fern','ember','iris','hazel')),
 spawn_index integer NOT NULL CHECK(spawn_index BETWEEN 0 AND 7),
 PRIMARY KEY(namespace,world_id,id), UNIQUE(namespace,world_id,spawn_index), UNIQUE(namespace,world_id,token_hash),
 FOREIGN KEY(namespace,world_id) REFERENCES astraworld.worlds(namespace,id)
);
CREATE TABLE IF NOT EXISTS astraworld.commands (
 namespace text NOT NULL, world_id uuid NOT NULL, actor_id uuid NOT NULL, stream text NOT NULL CHECK(stream IN ('gather','companion')),
 seq bigint NOT NULL CHECK(seq>0), request_hash text NOT NULL, result jsonb NOT NULL, revision bigint NOT NULL,
 PRIMARY KEY(namespace,world_id,actor_id,stream,seq), FOREIGN KEY(namespace,world_id,actor_id) REFERENCES astraworld.members(namespace,world_id,id)
);
CREATE TABLE IF NOT EXISTS astraworld.outbox (
 namespace text NOT NULL, world_id uuid NOT NULL, revision bigint NOT NULL, payload jsonb NOT NULL,
 published_at timestamptz, PRIMARY KEY(namespace,world_id,revision),
 FOREIGN KEY(namespace,world_id) REFERENCES astraworld.worlds(namespace,id)
);
INSERT INTO astraworld.schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
