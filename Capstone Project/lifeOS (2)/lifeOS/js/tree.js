/**
 * LifeOS – tree.js
 * Data Structure: N-ary Tree used for Goal Management.
 *
 * Each goal is a GoalNode. Goals can have unlimited children (sub-goals).
 * Multiple root goals are supported via a virtual root container.
 *
 * Structure example:
 *   Become a Software Engineer
 *     ├── Learn DSA
 *     │   ├── Arrays
 *     │   └── Trees
 *     └── Build Projects
 */

class GoalNode {
    /**
     * @param {string} id
     * @param {string} title
     * @param {string} description
     * @param {string|null} parentId
     */
    constructor(id, title, description = '', parentId = null) {
        this.id          = id;
        this.title       = title;
        this.description = description;
        this.parentId    = parentId;
        this.completed   = false;
        this.createdAt   = new Date().toISOString();
        /** @type {GoalNode[]} */
        this.children    = [];
    }
}

class GoalTree {
    constructor() {
        /** @type {GoalNode[]} Top-level goals (virtual roots) */
        this._roots = [];
    }

    // ─────────────────────────────────────────────
    // Core Tree Operations
    // ─────────────────────────────────────────────

    /**
     * Add a new top-level (root) goal.
     * @param {string} id
     * @param {string} title
     * @param {string} description
     * @returns {GoalNode}
     */
    addRoot(id, title, description = '') {
        const node = new GoalNode(id, title, description, null);
        this._roots.push(node);
        return node;
    }

    /**
     * Add a child goal under an existing node.
     * @param {string} parentId
     * @param {string} id
     * @param {string} title
     * @param {string} description
     * @returns {GoalNode|null}
     */
    addChild(parentId, id, title, description = '') {
        const parent = this.findNode(parentId);
        if (!parent) return null;
        const node = new GoalNode(id, title, description, parentId);
        parent.children.push(node);
        return node;
    }

    /**
     * Find a node anywhere in the tree using DFS.
     * @param {string} id
     * @returns {GoalNode|null}
     */
    findNode(id) {
        for (const root of this._roots) {
            const found = this._dfsFind(root, id);
            if (found) return found;
        }
        return null;
    }

    /** @private */
    _dfsFind(node, id) {
        if (String(node.id) === String(id)) return node;
        for (const child of node.children) {
            const found = this._dfsFind(child, id);
            if (found) return found;
        }
        return null;
    }

    /**
     * Delete a node (and its entire subtree) by id.
     * @param {string|number} id
     * @returns {boolean}
     */
    deleteNode(id) {
        // Check roots
        const rootIdx = this._roots.findIndex(r => String(r.id) === String(id));
        if (rootIdx !== -1) {
            this._roots.splice(rootIdx, 1);
            return true;
        }
        // Check children
        for (const root of this._roots) {
            if (this._dfsDelete(root, id)) return true;
        }
        return false;
    }

    /** @private */
    _dfsDelete(node, id) {
        const idx = node.children.findIndex(c => String(c.id) === String(id));
        if (idx !== -1) {
            node.children.splice(idx, 1);
            return true;
        }
        for (const child of node.children) {
            if (this._dfsDelete(child, id)) return true;
        }
        return false;
    }

    /**
     * Update a node's title, description, or completed status.
     * @param {string} id
     * @param {Object} updates
     * @returns {boolean}
     */
    updateNode(id, updates) {
        const node = this.findNode(id);
        if (!node) return false;
        if (updates.title       !== undefined) node.title       = updates.title;
        if (updates.description !== undefined) node.description = updates.description;
        if (updates.completed   !== undefined) node.completed   = updates.completed;
        return true;
    }

    /**
     * Calculate the completion percentage of a goal node
     * (based on its children; leaf nodes are 100% if completed, 0% if not).
     * @param {GoalNode} node
     * @returns {number} 0–100
     */
    calculateProgress(node) {
        if (!node) return 0;
        if (node.completed) return 100;
        if (node.children.length === 0) return node.completed ? 100 : 0;
        const sum = node.children.reduce((acc, c) => acc + this.calculateProgress(c), 0);
        return Math.round(sum / node.children.length);
    }

    // ─────────────────────────────────────────────
    // Traversal
    // ─────────────────────────────────────────────

    /**
     * Flatten the tree to an array (DFS pre-order).
     * Each item includes a `depth` field for indentation.
     * @returns {Array<{node: GoalNode, depth: number}>}
     */
    toArray() {
        const result = [];
        for (const root of this._roots) {
            this._dfsList(root, 0, result);
        }
        return result;
    }

    /** @private */
    _dfsList(node, depth, result) {
        result.push({ node, depth });
        for (const child of node.children) {
            this._dfsList(child, depth + 1, result);
        }
    }

    /**
     * Return root nodes only.
     * @returns {GoalNode[]}
     */
    getRoots() {
        return [...this._roots];
    }

    /**
     * Total count of all goals (all nodes).
     * @returns {number}
     */
    count() {
        return this.toArray().length;
    }

    /**
     * Count of completed goals.
     * @returns {number}
     */
    completedCount() {
        return this.toArray().filter(({ node }) => node.completed).length;
    }

    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────

    /**
     * Serialize the tree to a plain object array for LocalStorage.
     * @returns {Object[]}
     */
    serialize() {
        return this._roots.map(r => this._serializeNode(r));
    }

    /** @private */
    _serializeNode(node) {
        return {
            id:          node.id,
            title:       node.title,
            description: node.description,
            parentId:    node.parentId,
            completed:   node.completed,
            createdAt:   node.createdAt,
            children:    node.children.map(c => this._serializeNode(c)),
        };
    }

    /**
     * Restore the tree from serialized data.
     * @param {Object[]} arr
     */
    deserialize(arr) {
        this._roots = Array.isArray(arr) ? arr.map(o => this._deserializeNode(o)) : [];
    }

    /** @private */
    _deserializeNode(obj) {
        const node         = new GoalNode(obj.id, obj.title, obj.description, obj.parentId);
        node.completed     = obj.completed || false;
        node.createdAt     = obj.createdAt || new Date().toISOString();
        node.children      = (obj.children || []).map(c => this._deserializeNode(c));
        return node;
    }

    /**
     * Clear all goals.
     */
    clear() {
        this._roots = [];
    }
}
