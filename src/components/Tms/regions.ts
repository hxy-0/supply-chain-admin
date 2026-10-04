import areaData from "china-area-data";
interface RegionOption {
  [key: string]: unknown;
  value: string;
  label: string;
  children?: RegionOption[];
}
const data = areaData as Record<string, Record<string, string>>;
export const regionOptions: RegionOption[] = Object.entries(data["86"]).map(
  ([provinceCode, province]) => ({
    value: province,
    label: province,
    children: Object.entries(data[provinceCode] || {}).map(
      ([cityCode, city]) => ({
        value: city === "市辖区" || city === "县" ? province : city,
        label: city === "市辖区" || city === "县" ? province : city,
        children: Object.entries(data[cityCode] || {}).map(([, district]) => ({
          value: district,
          label: district
        }))
      })
    )
  })
);
