CREATE TABLE organizations (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    organization_ids JSON NOT NULL,
    group_ids JSON NOT NULL,
    role_ids JSON NOT NULL,
    identity_provider VARCHAR(100) NULL,
    external_subject VARCHAR(512) NULL,
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY users_email_unique (email),
    UNIQUE KEY users_external_identity_unique (identity_provider, external_subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSON NOT NULL,
    UNIQUE KEY roles_name_unique (organization_id, name),
    CONSTRAINT roles_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_groups (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    member_ids JSON NOT NULL,
    role_ids JSON NOT NULL,
    UNIQUE KEY user_groups_name_unique (organization_id, name),
    CONSTRAINT user_groups_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    KEY sessions_expiry_idx (expires_at),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE workspaces (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    root_path VARCHAR(2048) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    KEY workspaces_organization_idx (organization_id),
    CONSTRAINT workspaces_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT workspaces_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    prompt MEDIUMTEXT NOT NULL,
    status ENUM('queued', 'running', 'completed', 'failed', 'cancelled') NOT NULL,
    agent_ids JSON NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    KEY tasks_workspace_idx (workspace_id, created_at),
    CONSTRAINT tasks_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT tasks_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_events (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    type ENUM('status', 'message', 'file_change', 'error') NOT NULL,
    data JSON NOT NULL,
    created_at DATETIME(3) NOT NULL,
    KEY task_events_task_idx (task_id, created_at),
    CONSTRAINT task_events_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE checkpoints (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    label VARCHAR(120) NOT NULL,
    files LONGTEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    KEY checkpoints_workspace_idx (workspace_id, created_at),
    CONSTRAINT checkpoints_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT checkpoints_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
