"""
LifeOS Backend – Queue Data Structure
Data Structure: Queue (FIFO - First In, First Out)
Purpose: Task Scheduling & Processing Order
"""

from typing import List, Dict, Any, Optional

class TaskQueue:
    """
    TaskQueue handles task scheduling in FIFO order.
    The front of the queue represents the highest priority task for immediate execution.
    """
    def __init__(self, max_size: int = 500):
        self._items: List[Dict[str, Any]] = []
        self._max_size = max_size

    def enqueue(self, task: Dict[str, Any]) -> None:
        """Add a task to the rear of the queue."""
        self._items.append(task)
        if len(self._items) > self._max_size:
            self._items.pop(0)

    def dequeue(self) -> Optional[Dict[str, Any]]:
        """Remove and return the task at the front of the queue."""
        if self.is_empty():
            return None
        return self._items.pop(0)

    def peek(self) -> Optional[Dict[str, Any]]:
        """View the task at the front of the queue without removing it."""
        if self.is_empty():
            return None
        return self._items[0]

    def is_empty(self) -> bool:
        """Check whether the queue is empty."""
        return len(self._items) == 0

    def size(self) -> int:
        """Return total number of tasks in queue."""
        return len(self._items)

    def clear(self) -> None:
        """Clear all items from the queue."""
        self._items = []

    def to_list(self) -> List[Dict[str, Any]]:
        """Return queue items in FIFO order (Front to Rear)."""
        return list(self._items)

    def remove_by_id(self, task_id: Any) -> bool:
        """Remove a task by ID from the queue."""
        initial_len = len(self._items)
        self._items = [t for t in self._items if str(t.get('id')) != str(task_id)]
        return len(self._items) < initial_len

    def update_by_id(self, task_id: Any, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a task's fields by ID."""
        for t in self._items:
            if str(t.get('id')) == str(task_id):
                t.update(updates)
                return t
        return None
