/**
 * LifeOS – hashmap.js
 * Data Structure: Hash Map used for Universal Search Indexing & Fast Information Retrieval.
 *
 * A Hash Map provides O(1) time complexity for lookup, insertion, and deletion of indexed items.
 * Items indexed include: Tasks (task_*), Goals (goal_*), Sub-goals (subgoal_*), Notes (note_*), and Activities (act_*).
 */

class HashMap {
    constructor() {
        /** @type {Map<string, Object>} Internal key-value storage */
        this._buckets = new Map();
    }

    // ─────────────────────────────────────────────
    // Core Hash Map Operations (O(1))
    // ─────────────────────────────────────────────

    /**
     * Set – Insert or update a key-value pair in the Hash Map.
     * @param {string} key   – Unique identifier (e.g. 'task_123', 'goal_456', 'note_789')
     * @param {Object} value – Indexed item object
     */
    set(key, value) {
        this._buckets.set(key, value);
    }

    /**
     * Get – Retrieve a value by key in O(1) time.
     * @param {string} key
     * @returns {Object|undefined}
     */
    get(key) {
        return this._buckets.get(key);
    }

    /**
     * Has – Check if a key exists in the Hash Map in O(1) time.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this._buckets.has(key);
    }

    /**
     * Delete – Remove a key-value pair from the Hash Map in O(1) time.
     * @param {string} key
     * @returns {boolean} true if element existed and was removed
     */
    delete(key) {
        return this._buckets.delete(key);
    }

    /**
     * Clear – Remove all elements from the Hash Map.
     */
    clear() {
        this._buckets.clear();
    }

    /**
     * Size – Return the total number of entries in the Hash Map.
     * @returns {number}
     */
    size() {
        return this._buckets.size;
    }

    /**
     * Values – Return all values stored in the Hash Map.
     * @returns {IterableIterator<Object>}
     */
    values() {
        return this._buckets.values();
    }

    /**
     * Keys – Return all keys stored in the Hash Map.
     * @returns {IterableIterator<string>}
     */
    keys() {
        return this._buckets.keys();
    }
}

/**
 * Universal Search Index class built on top of the HashMap data structure.
 */
class SearchIndex {
    constructor() {
        /** @type {HashMap} HashMap instance for fast O(1) indexing */
        this._hashMap = new HashMap();
    }

    /**
     * Index or update an item in the HashMap.
     * @param {string} type     – 'task' | 'goal' | 'subgoal' | 'note' | 'activity'
     * @param {string} id       – Unique ID key (e.g., 'task_101')
     * @param {string} title    – Primary title text
     * @param {string} body     – Secondary content or description text
     * @param {Object} metadata – Additional metadata (priority, date, category, status)
     */
    index(type, id, title, body = '', metadata = {}) {
        const key = id;
        this._hashMap.set(key, {
            key,
            id,
            type,
            title: title || '',
            body: body || '',
            metadata,
            _searchText: `${title} ${body} ${type}`.toLowerCase(),
        });
    }

    /**
     * Delete an item from the search index using Hash Map deletion.
     * @param {string} id
     * @returns {boolean}
     */
    remove(id) {
        return this._hashMap.delete(id);
    }

    /**
     * Check if item exists in search index.
     * @param {string} id
     * @returns {boolean}
     */
    has(id) {
        return this._hashMap.has(id);
    }

    /**
     * Get item by id.
     * @param {string} id
     * @returns {Object|undefined}
     */
    get(id) {
        return this._hashMap.get(id);
    }

    /**
     * Search indexed items using query matching and relevance scoring.
     * @param {string} query
     * @param {string} [filterType='ALL'] – 'ALL' | 'TASKS' | 'GOALS' | 'NOTES' | 'ACTIVITY'
     * @returns {Array<Object>}
     */
    search(query, filterType = 'ALL') {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const results = [];

        for (const item of this._hashMap.values()) {
            // Apply category filter if not 'ALL'
            if (filterType === 'TASKS' && item.type !== 'task') continue;
            if (filterType === 'GOALS' && item.type !== 'goal' && item.type !== 'subgoal') continue;
            if (filterType === 'NOTES' && item.type !== 'note') continue;
            if (filterType === 'ACTIVITY' && item.type !== 'activity') continue;

            if (!item._searchText.includes(q)) continue;

            // Relevance scoring: title matches score higher than body matches
            const titleMatch = item.title.toLowerCase().includes(q);
            const score = titleMatch ? 2 : 1;

            results.push({
                ...item,
                _score: score,
            });
        }

        // Sort results by score descending
        return results.sort((a, b) => b._score - a._score);
    }

    /**
     * Total count of indexed entries.
     * @returns {number}
     */
    size() {
        return this._hashMap.size();
    }

    /**
     * Clear index.
     */
    clear() {
        this._hashMap.clear();
    }
}
