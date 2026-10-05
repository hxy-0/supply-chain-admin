import type { Category, Id } from "@/api/pms";
import type { CascaderOption } from "element-plus";

export interface CategoryOption extends CascaderOption {
  value: Id;
  label: string;
  disabled?: boolean;
  children?: CategoryOption[];
}

/** Preserve the existing category hierarchy for native Element Plus cascaders. */
export function categoryOptions(
  categories: Category[],
  options: { enabledOnly?: boolean; excludeId?: Id; maxLevel?: number } = {}
): CategoryOption[] {
  const children = new Map<string, Category[]>();
  for (const category of categories) {
    const parent = String(category.parentCid ?? 0);
    const siblings = children.get(parent) ?? [];
    siblings.push(category);
    children.set(parent, siblings);
  }
  function build(
    parent: string,
    depth: number,
    hidden: boolean
  ): CategoryOption[] {
    if (depth > (options.maxLevel ?? 3)) return [];
    return (children.get(parent) ?? [])
      .filter(category => String(category.catId) !== String(options.excludeId))
      .map(category => {
        const disabled =
          hidden || (options.enabledOnly && category.isShow !== 1);
        const descendants = build(
          String(category.catId),
          depth + 1,
          !!disabled
        );
        return {
          value: category.catId,
          label: category.name,
          disabled: !!disabled,
          ...(descendants.length ? { children: descendants } : {})
        };
      });
  }
  return build("0", 1, false);
}
