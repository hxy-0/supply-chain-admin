export interface Axis {
  attributeId: string | number;
  valueIds: (string | number)[];
}
/** 保留表单属性顺序，各属性值按字典顺序排列。 */
export function orderAxisValues(
  axes: Axis[],
  values: Record<
    string,
    { attributeValueId: string | number; sortOrder: number }[]
  >
): Axis[] {
  return axes.map(axis => {
    const orders = new Map(
      (values[String(axis.attributeId)] ?? []).map(value => [
        String(value.attributeValueId),
        value.sortOrder
      ])
    );
    return {
      ...axis,
      valueIds: [...axis.valueIds].sort(
        (left, right) =>
          (orders.get(String(left)) ?? 0) - (orders.get(String(right)) ?? 0) ||
          (BigInt(left) < BigInt(right)
            ? -1
            : BigInt(left) > BigInt(right)
              ? 1
              : 0)
      )
    };
  });
}
export function signatures(axes: Axis[], limit = 200): string[] {
  for (const axis of axes) {
    if (!/^[1-9]\d*$/.test(String(axis.attributeId)))
      throw new Error("请选择销售属性");
    if (axis.valueIds.some(id => !/^[1-9]\d*$/.test(String(id))))
      throw new Error("属性值无效");
  }
  const ordered = [...axes].sort((a, b) =>
    BigInt(a.attributeId) < BigInt(b.attributeId) ? -1 : 1
  );
  if (
    new Set(ordered.map(axis => String(axis.attributeId))).size !== axes.length
  )
    throw new Error("销售属性不能重复");
  let combinations = [""];
  for (const axis of axes) {
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
  return combinations.map(signature =>
    signature
      .split(";")
      .filter(Boolean)
      .sort((a, b) =>
        BigInt(a.split("=")[0]) < BigInt(b.split("=")[0]) ? -1 : 1
      )
      .join(";")
  );
}

/** 编码按销售属性顺序拼接，签名仍按属性 ID 规范化。 */
export function skuCode(
  productCode: string,
  signature: string,
  axes: Axis[],
  values: Record<
    string,
    { attributeValueId: string | number; valueCode: string }[]
  >,
  index: number
): string {
  const selected = new Map(
    signature
      .split(";")
      .filter(Boolean)
      .map(pair => pair.split("=")) as [string, string][]
  );
  const parts = [productCode.trim()];
  if (!parts[0]) throw new Error("请先填写 SPU 编码");
  for (const axis of axes) {
    const id = String(axis.attributeId);
    const code = values[id]
      ?.find(value => String(value.attributeValueId) === selected.get(id))
      ?.valueCode.trim();
    if (!code) throw new Error("所选销售属性值缺少编码");
    parts.push(code);
  }
  parts.push(String(index + 1).padStart(3, "0"));
  const code = parts.join("-");
  if (code.length > 64)
    throw new Error(
      "生成的 SKU 编码不能超过 64 个字符，请缩短 SPU 或属性值编码"
    );
  return code;
}

/** 拖动后只重排序号，其他 SKU 资料跟随规格保留。 */
export function renumberSkus<
  T extends { skuCode?: string; sortOrder?: number }
>(skus: T[]): T[] {
  return skus.map((sku, index) => ({
    ...sku,
    sortOrder: index,
    skuCode: sku.skuCode?.replace(
      /-\d{3}$/,
      `-${String(index + 1).padStart(3, "0")}`
    )
  }));
}
