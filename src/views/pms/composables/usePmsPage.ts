import { ref } from "vue";
import type { PageResult } from "@/api/tms";

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}

/** Discard stale results when filters or pagination change during a request. */
export function usePmsPage<T>(fetchPage: () => Promise<PageResult<T>>) {
  const rows = ref<T[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const failure = ref("");
  let sequence = 0;
  async function load() {
    const current = ++sequence;
    loading.value = true;
    failure.value = "";
    try {
      const page = await fetchPage();
      if (current !== sequence) return;
      rows.value = page.records;
      total.value = Number(page.total);
    } catch (error) {
      if (current === sequence) failure.value = errorMessage(error);
    } finally {
      if (current === sequence) loading.value = false;
    }
  }
  return { rows, total, loading, failure, load };
}
