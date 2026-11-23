"""
LifeOS Backend – Stack Data Structure
Data Structure: Stack (LIFO - Last In, First Out)
Purpose: Activity History & Audit Logging
"""

from typing import List, Dict, Any, Optional

class ActivityStack:
    """
    ActivityStack stores user activities in LIFO order.
    The top of the stack (index 0) always contains the most recent activity.
    """
    def __init__(self, max_size: int = 250):
        self._data: List[Dict[str, Any]] = []
        self._max_size = max_size

    def push(self, activity: Dict[str, Any]) -> None:
        """Push a new activity onto the top of the stack (LIFO)."""
        self._data.insert(0, activity) # Index 0 is TOP of stack
        if len(self._data) > self._max_size:
            self._data.pop() # Remove oldest item at bottom of stack

    def pop(self) -> Optional[Dict[str, Any]]:
        """Remove and return the top (newest) activity from the stack."""
        if self.is_empty():
            return None
        return self._data.pop(0)

    def peek(self) -> Optional[Dict[str, Any]]:
        """View the top activity without removing it."""
        if self.is_empty():
            return None
        return self._data[0]

    def is_empty(self) -> bool:
        """Check whether the stack is empty."""
        return len(self._data) == 0

    def size(self) -> int:
        """Return total number of activities on the stack."""
        return len(self._data)

    def clear(self) -> None:
        """Clear all activities from the stack."""
        self._data = []

    def to_list(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return activities from TOP (newest) to BOTTOM (oldest)."""
        return list(self._data[:limit]) if limit else list(self._data)
