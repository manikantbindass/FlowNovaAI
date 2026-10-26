CREATE TABLE workspace (
 id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL
);
CREATE TABLE membership (
 actor VARCHAR(200) NOT NULL, workspace_id VARCHAR(36) NOT NULL REFERENCES workspace(id),
 role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER','ADMIN','EDITOR','VIEWER')),
 PRIMARY KEY (actor, workspace_id)
);
CREATE TABLE workflow (
 id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL REFERENCES workspace(id),
 name VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL, graph TEXT NOT NULL,
 revision INTEGER NOT NULL, published_version INTEGER NOT NULL DEFAULT 0,
 updated_at BIGINT NOT NULL, updated_by VARCHAR(200) NOT NULL,
 UNIQUE(id, workspace_id)
);
CREATE INDEX workflow_workspace ON workflow(workspace_id, updated_at);
CREATE TABLE workflow_version (
 workflow_id VARCHAR(36) NOT NULL, workspace_id VARCHAR(36) NOT NULL,
 version INTEGER NOT NULL, graph TEXT NOT NULL, created_at BIGINT NOT NULL, created_by VARCHAR(200) NOT NULL,
 PRIMARY KEY(workflow_id, version),
 FOREIGN KEY(workflow_id, workspace_id) REFERENCES workflow(id, workspace_id)
);
CREATE TABLE execution (
 id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL, workflow_id VARCHAR(36) NOT NULL,
 version INTEGER NOT NULL, status VARCHAR(20) NOT NULL, input TEXT NOT NULL,
 created_at BIGINT NOT NULL, started_at BIGINT, finished_at BIGINT, lease_until BIGINT,
 claim_token VARCHAR(36), attempt INTEGER NOT NULL DEFAULT 0, created_by VARCHAR(200) NOT NULL,
 idempotency_key VARCHAR(100) NOT NULL, error VARCHAR(300),
 FOREIGN KEY(workflow_id, workspace_id) REFERENCES workflow(id, workspace_id),
 FOREIGN KEY(workflow_id, version) REFERENCES workflow_version(workflow_id, version),
 UNIQUE(workspace_id, idempotency_key)
);
CREATE INDEX execution_queue ON execution(status, lease_until, created_at);
CREATE INDEX execution_workspace ON execution(workspace_id, created_at);
CREATE TABLE node_execution (
 execution_id VARCHAR(36) NOT NULL REFERENCES execution(id), node_id VARCHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL, output TEXT NOT NULL, started_at BIGINT NOT NULL, finished_at BIGINT NOT NULL,
 PRIMARY KEY(execution_id, node_id)
);
CREATE TABLE execution_event (
 id VARCHAR(36) PRIMARY KEY, execution_id VARCHAR(36) NOT NULL REFERENCES execution(id),
 created_at BIGINT NOT NULL, node_id VARCHAR(64), kind VARCHAR(30) NOT NULL, message VARCHAR(300) NOT NULL
);
CREATE INDEX event_execution ON execution_event(execution_id, created_at);
CREATE TABLE audit_log (
 id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL REFERENCES workspace(id),
 actor VARCHAR(200) NOT NULL, action VARCHAR(40) NOT NULL, resource_id VARCHAR(36) NOT NULL, created_at BIGINT NOT NULL
);
