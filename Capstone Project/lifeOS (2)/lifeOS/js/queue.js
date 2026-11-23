/**
 * LifeOS – queue.js
 * Data Structure: Queue (FIFO) used for Task Scheduling.
 *
 * Tasks are enqueued when created and dequeued when completed/deleted.
 * The order of tasks reflects their scheduling order.
 */

class TaskQueue {
    constructor() {
        /** @type {Array<Object>} Internal storage array */
        this._data = [];
    }

    // ─────────────────────────────────────────────
    // Core Queue Operations
    // ─────────────────────────────────────────────

    /**
     * Enqueue – Add a task to the back of the queue.
     * @param {Object} task
     */
    enqueue(task) {
        this._data.push(task);
    }

    /**
     * Dequeue – Remove and return the front task.
     * @returns {Object|null}
     */
    dequeue() {
        if (this.isEmpty()) return null;
        return this._data.shift();
    }

    /**
     * Peek – View the front task without removing it.
     * @returns {Object|null}
     */
    peek() {
        return this.isEmpty() ? null : this._data[0];
    }

    /**
     * Check whether the queue is empty.
     * @returns {boolean}
     */
    isEmpty() {
        return this._data.length === 0;
    }

    /**
     * Return the number of items in the queue.
     * @returns {number}
     */
    size() {
        return this._data.length;
    }

    // ─────────────────────────────────────────────
    // Extended Operations
    // ─────────────────────────────────────────────

    /**
     * Find a task by its id without removing it.
     * @param {string|number} id
     * @returns {Object|null}
     */
    findById(id) {
        return this._data.find(t => String(t.id) === String(id)) || null;
    }

    /**
     * Remove a specific task by id (random removal from queue).
     * @param {string|number} id
     * @returns {boolean} true if removed
     */
    removeById(id) {
        const index = this._data.findIndex(t => String(t.id) === String(id));
        if (index === -1) return false;
        this._data.splice(index, 1);
        return true;
    }

    /**
     * Update a task in-place by id.
     * @param {string} id
     * @param {Object} updates – partial update object
     * @returns {boolean}
     */
    updateById(id, updates) {
        const task = this.findById(id);
        if (!task) return false;
        Object.assign(task, updates);
        return true;
    }

    /**
     * Return a shallow copy of all tasks in queue order.
     * @returns {Array<Object>}
     */
    toArray() {
        return [...this._data];
    }

    /**
     * Serialize queue to a plain array for LocalStorage.
     * @returns {Array<Object>}
     */
    serialize() {
        return this._data;
    }

    /**
     * Restore queue from a plain array (e.g., from LocalStorage).
     * @param {Array<Object>} arr
     */
    deserialize(arr) {
        this._data = Array.isArray(arr) ? [...arr] : [];
    }

    /**
     * Clear the queue.
     */
    clear() {
        this._data = [];
    }
}
