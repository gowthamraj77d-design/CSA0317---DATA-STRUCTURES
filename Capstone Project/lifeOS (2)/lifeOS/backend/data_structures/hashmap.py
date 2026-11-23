"""
LifeOS Backend – Hash Map Data Structure
Data Structure: Hash Map (Key-Value Storage with O(1) Lookup)
Purpose: Universal Search Indexing Across Tasks, Goals, Sub-Goals, Notes, and Activities
"""

from typing import List, Dict, Any, Optional

class HashMap:
    """
    HashMap implementation providing O(1) constant time set, get, has, and delete.
    Used as the underlying data structure for universal search indexing.
    """
    def __init__(self):
        self._buckets: Dict[str, Dict[str, Any]] = {}

    def set(self, key: str, value: Dict[str, Any]) -> None:
        """Insert or update a key-value entry in O(1) time."""
        self._buckets[key] = value

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve a value by key in O(1) time."""
        return self._buckets.get(key)

    def has(self, key: str) -> bool:
        """Check if key exists in O(1) time."""
        return key in self._buckets

    def delete(self, key: str) -> bool:
        """Delete an entry by key in O(1) time."""
        if key in self._buckets:
            del self._buckets[key]
            return True
        return False

    def clear(self) -> None:
        """Remove all entries from HashMap."""
        self._buckets.clear()

    def size(self) -> int:
        """Return total number of items in HashMap."""
        return len(self._buckets)

    def values(self) -> List[Dict[str, Any]]:
        """Return all values stored in HashMap."""
        return list(self._buckets.values())

    def keys(self) -> List[str]:
        """Return all keys stored in HashMap."""
        return list(self._buckets.keys())


class SearchIndex:
    """
    Universal Search Index built on top of the HashMap data structure.
    Indexes items with unique keys (e.g. task_1, goal_2, note_5, act_10).
    """
    def __init__(self):
        self._hash_map = HashMap()

    def index(self, item_type: str, item_id: Any, title: str, body: str = '', metadata: Optional[Dict[str, Any]] = None) -> None:
        """Index an item into the HashMap with formatted search text."""
        key = f"{item_type}_{item_id}"
        meta = metadata or {}
        entry = {
            'key': key,
            'id': item_id,
            'type': item_type,
            'title': title or '',
            'body': body or '',
            'metadata': meta,
            '_search_text': f"{title} {body} {item_type}".lower()
        }
        self._hash_map.set(key, entry)

    def remove(self, item_type: str, item_id: Any) -> bool:
        """Remove an item from HashMap index in O(1) time."""
        key = f"{item_type}_{item_id}"
        return self._hash_map.delete(key)

    def search(self, query: str, filter_type: str = 'ALL') -> List[Dict[str, Any]]:
        """
        Search indexed entries matching query.
        Supports category filtering (TASKS, GOALS, NOTES, ACTIVITY).
        Ranks title matches higher than body matches.
        """
        q = query.strip().lower()
        if not q:
            return []

        results = []
        for item in self._hash_map.values():
            t = item['type']
            # Filter checks
            if filter_type == 'TASKS' and t != 'task':
                continue
            if filter_type == 'GOALS' and t not in ('goal', 'subgoal'):
                continue
            if filter_type == 'NOTES' and t != 'note':
                continue
            if filter_type == 'ACTIVITY' and t != 'activity':
                continue

            if q in item['_search_text']:
                title_match = q in item['title'].lower()
                score = 2 if title_match else 1
                result_item = dict(item)
                result_item['_score'] = score
                results.append(result_item)

        return sorted(results, key=lambda x: x['_score'], reverse=True)

    def size(self) -> int:
        return self._hash_map.size()

    def clear(self) -> None:
        self._hash_map.clear()
