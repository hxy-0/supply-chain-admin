export interface Axis {
  attributeId: string | number;
  valueIds: (string | number)[];
}
export function signatures(axes: Axis[], limit = 200): string[] {
  const ordered = [...axes].sort((a, b) =>
    BigInt(a.attributeId) < BigInt(b.attributeId) ? -1 : 1
  );
  if (
    new Set(ordered.map(axis => String(axis.attributeId))).size !== axes.length
  )
    throw new Error("销售属性不能重复");
  let combinations = [""];
  for (const axis of ordered) {
    if (!axis.valueIds.length) throw new Error("请选择每个销售属性的属性值");
    const values = [...new Set(axis.valueIds.map(String))];
    if (combinations.length * values.length > limit)
      throw new Error(`规格组合最多 ${limit} 个，请减少选择`);
    combinations = combinations.flatMap(prefix =>
      values.map(
        value => `${prefix ? prefix + ";" : ""}${axis.attributeId}=${value}`
      )
    );
  }
  return combinations;
}
