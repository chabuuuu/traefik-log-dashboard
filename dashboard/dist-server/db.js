"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDB = getDB;
exports.getAllAgents = getAllAgents;
exports.getAgentById = getAgentById;
exports.addAgent = addAgent;
exports.updateAgent = updateAgent;
exports.deleteAgent = deleteAgent;
exports.getSelectedAgentId = getSelectedAgentId;
exports.setSelectedAgentId = setSelectedAgentId;
exports.getSelectedAgent = getSelectedAgent;
exports.syncEnvAgents = syncEnvAgents;
exports.bulkImportAgents = bulkImportAgents;
exports.serializeAgent = serializeAgent;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path_1.default.join(DATA_DIR, 'dashboard.db');
let db;
function getDB() {
    if (!db) {
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}
function initSchema() {
    const d = getDB();
    d.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      configured_url TEXT,
      token TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'user',
      location TEXT NOT NULL DEFAULT 'on-site',
      number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'checking',
      description TEXT,
      tags TEXT,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS selected_agent (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      agent_id TEXT,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    INSERT OR IGNORE INTO selected_agent (id, agent_id) VALUES (1, NULL);
  `);
}
// --- Agent CRUD ---
function getAllAgents() {
    return getDB().prepare('SELECT * FROM agents ORDER BY number ASC').all();
}
function getAgentById(id) {
    return getDB().prepare('SELECT * FROM agents WHERE id = ?').get(id);
}
function addAgent(agent) {
    const d = getDB();
    const maxRow = d.prepare('SELECT MAX(number) as maxNum FROM agents').get();
    const nextNumber = (maxRow?.maxNum ?? 0) + 1;
    const id = `agent-${String(nextNumber).padStart(3, '0')}`;
    const stmt = d.prepare(`
    INSERT INTO agents (id, name, url, configured_url, token, source, location, number, status, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checking', ?, ?)
  `);
    stmt.run(id, agent.name, agent.url, agent.configured_url ?? null, agent.token ?? '', agent.source ?? 'user', agent.location ?? 'on-site', nextNumber, agent.description ?? null, agent.tags ? JSON.stringify(agent.tags) : null);
    return getAgentById(id);
}
function updateAgent(id, updates) {
    const existing = getAgentById(id);
    if (!existing)
        return null;
    // Don't allow updating env agents' core fields
    if (existing.source === 'env') {
        // Only allow status and last_seen updates for env agents
        const allowed = ['status', 'last_seen'];
        const filtered = {};
        for (const key of allowed) {
            if (key in updates)
                filtered[key] = updates[key];
        }
        if (Object.keys(filtered).length === 0)
            return existing;
        updates = filtered;
    }
    const setClauses = [];
    const values = [];
    const columnMap = {
        name: 'name',
        url: 'url',
        configuredUrl: 'configured_url',
        configured_url: 'configured_url',
        token: 'token',
        location: 'location',
        status: 'status',
        description: 'description',
        tags: 'tags',
        lastSeen: 'last_seen',
        last_seen: 'last_seen',
    };
    for (const [key, val] of Object.entries(updates)) {
        const col = columnMap[key];
        if (!col)
            continue;
        setClauses.push(`${col} = ?`);
        if (col === 'tags' && Array.isArray(val)) {
            values.push(JSON.stringify(val));
        }
        else if (val instanceof Date) {
            values.push(val.toISOString());
        }
        else {
            values.push(val ?? null);
        }
    }
    if (setClauses.length === 0)
        return existing;
    values.push(id);
    getDB().prepare(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return getAgentById(id) ?? null;
}
function deleteAgent(id) {
    const existing = getAgentById(id);
    if (!existing || existing.source === 'env')
        return false;
    const result = getDB().prepare('DELETE FROM agents WHERE id = ? AND source != ?').run(id, 'env');
    // If deleted agent was selected, clear selection
    if (result.changes > 0) {
        const selected = getSelectedAgentId();
        if (selected === id) {
            setSelectedAgentId(null);
        }
    }
    return result.changes > 0;
}
// --- Selected Agent ---
function getSelectedAgentId() {
    const row = getDB().prepare('SELECT agent_id FROM selected_agent WHERE id = 1').get();
    return row?.agent_id ?? null;
}
function setSelectedAgentId(agentId) {
    getDB().prepare('UPDATE selected_agent SET agent_id = ? WHERE id = 1').run(agentId);
}
function getSelectedAgent() {
    const selectedId = getSelectedAgentId();
    const agents = getAllAgents();
    if (selectedId) {
        const found = agents.find(a => a.id === selectedId);
        if (found)
            return found;
    }
    // Fallback to first agent
    return agents[0] ?? null;
}
// --- Env Agent Sync ---
function syncEnvAgents() {
    const agentUrl = (process.env.AGENT_URL || process.env.AGENT_API_URL || '').replace(/\/+$/, '');
    const agentToken = process.env.AGENT_API_TOKEN || process.env.AGENT_TOKEN || '';
    if (!agentUrl && !agentToken)
        return;
    const d = getDB();
    const ENV_AGENT_ID = 'agent-env-default';
    const existing = getAgentById(ENV_AGENT_ID);
    if (existing) {
        // Update URL and token from env
        d.prepare(`
      UPDATE agents SET url = ?, configured_url = ?, token = ? WHERE id = ?
    `).run(agentUrl || existing.url, agentUrl || existing.configured_url, agentToken, ENV_AGENT_ID);
    }
    else {
        // Insert env agent with number 0 so it sorts first
        d.prepare(`
      INSERT INTO agents (id, name, url, configured_url, token, source, location, number, status)
      VALUES (?, 'Default Agent', ?, ?, ?, 'env', 'on-site', 0, 'checking')
    `).run(ENV_AGENT_ID, agentUrl, agentUrl, agentToken);
    }
    // Auto-select if nothing selected
    const selected = getSelectedAgentId();
    if (!selected) {
        setSelectedAgentId(ENV_AGENT_ID);
    }
}
// --- Bulk import (for localStorage migration) ---
function bulkImportAgents(agents) {
    const d = getDB();
    let imported = 0;
    const insert = d.prepare(`
    INSERT OR IGNORE INTO agents (id, name, url, configured_url, token, source, location, number, status, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checking', ?, ?)
  `);
    const txn = d.transaction(() => {
        for (const agent of agents) {
            // Skip env agents — they're managed by syncEnvAgents
            if (agent.source === 'env' || agent.id?.startsWith('agent-env-'))
                continue;
            const maxRow = d.prepare('SELECT MAX(number) as maxNum FROM agents').get();
            const nextNumber = (maxRow?.maxNum ?? 0) + 1;
            const id = agent.id || `agent-${String(nextNumber).padStart(3, '0')}`;
            const result = insert.run(id, agent.name, agent.url, agent.configuredUrl ?? null, agent.token ?? '', 'user', agent.location ?? 'on-site', agent.number ?? nextNumber, agent.description ?? null, agent.tags ? JSON.stringify(agent.tags) : null);
            if (result.changes > 0)
                imported++;
        }
    });
    txn();
    return imported;
}
// --- Serialize for API response ---
function serializeAgent(row) {
    return {
        id: row.id,
        name: row.name,
        url: row.url,
        configuredUrl: row.configured_url ?? undefined,
        token: row.token,
        source: row.source,
        location: row.location,
        number: row.number,
        status: row.status,
        description: row.description ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        lastSeen: row.last_seen ?? undefined,
    };
}
