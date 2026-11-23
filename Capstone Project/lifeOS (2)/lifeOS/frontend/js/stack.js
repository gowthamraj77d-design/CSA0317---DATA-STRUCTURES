/**
 * LifeOS – stack.js
 * Data Structure: Stack (LIFO) used for Activity History & Productivity Tracking.
 *
 * Operations:
 * - push(activity): Adds activity to the top of the stack (LIFO)
 * - pop(): Removes and returns the top activity
 * - peek(): Returns the top activity without removing it
 * - isEmpty(): Returns true if stack has no elements
 * - size(): Returns number of activities on stack
 * - clear(): Empties the stack
 * - toArray(limit): Returns stack items from TOP (newest) to BOTTOM (oldest)
 * - serialize(): Formats data for LocalStorage
 * - deserialize(arr): Restores data from LocalStorage
 */

class ActivityStack {
    constructor(maxSize = 250) {
        /** @type {Array<Object>} Internal storage array representing the stack */
        this._data = [];
        /** Maximum items allowed on stack before oldest are pruned */
        this._maxSize = maxSize;
    }

    // ─────────────────────────────────────────────
    // Core Stack Operations (LIFO)
    // ─────────────────────────────────────────────

    /**
     * Push – Add a new activity onto the top of the stack.
     * @param {Object} activity { id, action, type, description, message, timestamp, icon, date, time }
     */
    push(activity) {
        // TOP of stack is stored at index 0 for easy LIFO retrieval
        this._data.unshift(activity);
        if (this._data.length > this._maxSize) {
            this._data.pop(); // Remove oldest item from bottom of stack
        }
    }

    /**
     * Pop – Remove and return the top (most recent) activity from the stack.
     * @returns {Object|null}
     */
    pop() {
        if (this.isEmpty()) return null;
        return this._data.shift();
    }

    /**
     * Peek – View the top (most recent) activity without removing it.
     * @returns {Object|null}
     */
    peek() {
        return this.isEmpty() ? null : this._data[0];
    }

    /**
     * Check if the stack is empty.
     * @returns {boolean}
     */
    isEmpty() {
        return this._data.length === 0;
    }

    /**
     * Return the total number of items currently on the stack.
     * @returns {number}
     */
    size() {
        return this._data.length;
    }

    /**
     * Clear all elements from the stack.
     */
    clear() {
        this._data = [];
    }

    // ─────────────────────────────────────────────
    // Helper & Persistence Operations
    // ─────────────────────────────────────────────

    /**
     * Return stack items from top (newest) to bottom (oldest).
     * @param {number} [limit] – Optional number of items to slice
     * @returns {Array<Object>}
     */
    toArray(limit) {
        return limit ? this._data.slice(0, limit) : [...this._data];
    }

    /**
     * Serialize stack data for LocalStorage.
     * @returns {Array<Object>}
     */
    serialize() {
        return this._data;
    }

    /**
     * Deserialize stack data from LocalStorage.
     * @param {Array<Object>} arr
     */
    deserialize(arr) {
        this._data = Array.isArray(arr) ? [...arr] : [];
    }
}
