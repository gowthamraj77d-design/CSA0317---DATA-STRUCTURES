"""
LifeOS Backend – Tree Data Structure
Data Structure: Tree (N-ary Goal Hierarchy)
Purpose: Hierarchical Goal Management & Automated Sub-Goal Progress Recalculation
"""

from typing import List, Dict, Any, Optional

class GoalNode:
    """Node representing a Goal or Sub-Goal in the GoalTree hierarchy."""
    def __init__(self, goal_id: Any, title: str, description: str = '', parent_id: Optional[Any] = None, status: str = 'Active', progress: float = 0.0):
        self.id = goal_id
        self.title = title
        self.description = description
        self.parent_id = parent_id
        self.status = status
        self.progress = float(progress or 0.0)
        self.children: List['GoalNode'] = []

    def to_dict(self, depth: int = 0) -> Dict[str, Any]:
        """Serialize GoalNode and recursively include child goals."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description or '',
            'parent_id': self.parent_id,
            'status': self.status,
            'progress': round(self.progress, 1),
            'completed': self.status == 'Completed' or self.progress >= 100.0,
            'depth': depth,
            'children': [child.to_dict(depth + 1) for child in self.children]
        }


class GoalTree:
    """
    GoalTree manages the hierarchical relationship between main goals and sub-goals.
    Calculates progress recursively up the tree.
    """
    def __init__(self):
        self.roots: List[GoalNode] = []
        self._nodes_map: Dict[Any, GoalNode] = {}

    def add_node(self, goal_id: Any, title: str, description: str = '', parent_id: Optional[Any] = None, status: str = 'Active', progress: float = 0.0) -> GoalNode:
        """Add a new goal or sub-goal node to the tree hierarchy."""
        node = GoalNode(goal_id, title, description, parent_id, status, progress)
        self._nodes_map[goal_id] = node

        if parent_id and parent_id in self._nodes_map:
            parent = self._nodes_map[parent_id]
            parent.children.append(node)
            self.calculate_progress(parent_id)
        else:
            self.roots.append(node)

        return node

    def find_node(self, goal_id: Any) -> Optional[GoalNode]:
        """Find a node by ID in O(1) time using the node index map."""
        return self._nodes_map.get(goal_id)

    def delete_node(self, goal_id: Any) -> bool:
        """Delete a node and its entire subtree from the hierarchy."""
        node = self.find_node(goal_id)
        if not node:
            return False

        if node.parent_id and node.parent_id in self._nodes_map:
            parent = self._nodes_map[node.parent_id]
            parent.children = [c for c in parent.children if c.id != goal_id]
            self.calculate_progress(node.parent_id)
        else:
            self.roots = [r for r in self.roots if r.id != goal_id]

        self._recursive_remove(node)
        return True

    def _recursive_remove(self, node: GoalNode) -> None:
        for child in node.children:
            self._recursive_remove(child)
        if node.id in self._nodes_map:
            del self._nodes_map[node.id]

    def calculate_progress(self, goal_id: Any) -> float:
        """
        Recursively compute progress for a node based on its child sub-goals.
        Leaf nodes return 100.0 if Completed, else their own progress.
        Non-leaf nodes return the average of all children's progress.
        """
        node = self.find_node(goal_id)
        if not node:
            return 0.0

        if not node.children:
            if node.status in ('Completed', 'completed'):
                node.progress = 100.0
            return node.progress

        total_child_progress = sum(self.calculate_progress(c.id) for c in node.children)
        node.progress = total_child_progress / len(node.children)

        if node.progress >= 100.0:
            node.status = 'Completed'

        return node.progress

    def update_ancestors(self, goal_id: Any) -> None:
        """Propagate progress updates upward to ancestor nodes."""
        node = self.find_node(goal_id)
        while node and node.parent_id and node.parent_id in self._nodes_map:
            parent = self._nodes_map[node.parent_id]
            self.calculate_progress(parent.id)
            node = parent

    def traversal(self) -> List[Dict[str, Any]]:
        """Return full tree structure as a list of root node dicts."""
        return [root.to_dict() for root in self.roots]

    def count(self) -> int:
        """Return total count of nodes in tree."""
        return len(self._nodes_map)
