export interface OrderedMenu {
  id: number;
  parentId?: number;
  title: string;
  name?: string;
  path?: string;
  children?: OrderedMenu[];
}

export function siblingOrders(tree: OrderedMenu[]): Map<number, number[]> {
  const result = new Map<number, number[]>();
  function visit(nodes: OrderedMenu[], parentId: number) {
    result.set(
      parentId,
      nodes.map(node => node.id)
    );
    for (const node of nodes) {
      if (node.children?.length) visit(node.children, node.id);
    }
  }
  visit(tree, 0);
  return result;
}

export function changedOrders(
  tree: OrderedMenu[],
  initial: Map<number, number[]>
) {
  return [...siblingOrders(tree)]
    .filter(
      ([parentId, ids]) => ids.join(",") !== initial.get(parentId)?.join(",")
    )
    .map(([parentId, ids]) => ({
      parentId,
      ids,
      expectedIds: initial.get(parentId) ?? []
    }));
}

export function isHome(node: OrderedMenu) {
  return node.name === "Home" || node.path === "/";
}

export function canDrop(
  dragged: OrderedMenu,
  target: OrderedMenu,
  type: string
) {
  return (
    type !== "inner" &&
    !isHome(dragged) &&
    !(isHome(target) && type === "prev") &&
    Number(dragged.parentId ?? 0) === Number(target.parentId ?? 0)
  );
}
