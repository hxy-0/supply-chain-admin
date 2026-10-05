import editForm from "../form.vue";
import { handleTree } from "@/utils/tree";
import { message } from "@/utils/message";
import { getMenuList, saveSystemMenu, deleteSystemMenu } from "@/api/system";
import { transformI18n } from "@/plugins/i18n";
import { addDialog } from "@/components/ReDialog";
import { reactive, ref, onMounted, h } from "vue";
import type { FormItemProps } from "../utils/types";

import { cloneDeep, isAllEmpty, deviceDetection } from "@pureadmin/utils";

export function useMenu() {
  const form = reactive({
    title: ""
  });

  const formRef = ref();
  const dataList = ref([]);
  const loading = ref(true);

  const getMenuType = (type, text = false) => {
    switch (type) {
      case 0:
        return text ? "菜单" : "primary";
      case 1:
        return text ? "iframe" : "warning";
      case 2:
        return text ? "外链" : "danger";
      case 3:
        return text ? "按钮" : "info";
    }
  };

  const columns: TableColumnList = [
    {
      label: "菜单名称",
      prop: "title",
      align: "left",
      slot: "title"
    },
    {
      label: "菜单类型",
      prop: "menuType",
      width: 100,
      slot: "menuType"
    },
    {
      label: "路由路径",
      prop: "path"
    },
    {
      label: "组件路径",
      prop: "component",
      formatter: ({ path, component }) =>
        isAllEmpty(component) ? path : component
    },
    {
      label: "权限标识",
      prop: "auths"
    },
    {
      label: "排序",
      prop: "rank",
      width: 100
    },
    {
      label: "隐藏",
      prop: "showLink",
      formatter: ({ showLink }) => (showLink ? "否" : "是"),
      width: 100
    },
    {
      label: "操作",
      fixed: "right",
      width: 210,
      slot: "operation"
    }
  ];

  function handleSelectionChange(val) {
    console.log("handleSelectionChange", val);
  }

  function resetForm(formEl) {
    if (!formEl) {
      return;
    }
    formEl.resetFields();
    onSearch();
  }

  async function onSearch() {
    loading.value = true;
    try {
      const { code, data } = await getMenuList();
      if (code === 0) {
        let newData = data;
        if (!isAllEmpty(form.title)) {
          newData = newData.filter(item =>
            transformI18n(item.title).includes(form.title)
          );
        }
        dataList.value = handleTree(newData);
      }
    } catch {
      // 请求层已显示错误，保留现有列表供用户重试。
    } finally {
      loading.value = false;
    }
  }

  function formatHigherMenuOptions(treeList) {
    if (!treeList || !treeList.length) {
      return;
    }
    const newTreeList = [];
    for (let i = 0; i < treeList.length; i++) {
      treeList[i].title = transformI18n(treeList[i].title);
      formatHigherMenuOptions(treeList[i].children);
      newTreeList.push(treeList[i]);
    }
    return newTreeList;
  }

  function findMenuById(treeList, id: number) {
    for (const item of treeList ?? []) {
      if (item.id === id) return item;
      const found = findMenuById(item.children, id);
      if (found) return found;
    }
  }

  function editableRoutePath(path: string, parentId: number) {
    if (!path || !parentId) return path ?? "";
    const parentPath = findMenuById(dataList.value, parentId)?.path?.replace(
      /\/$/,
      ""
    );
    const prefix = parentPath ? `${parentPath}/` : "";
    return prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
  }

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}菜单`,
      props: {
        formInline: {
          menuType: row?.menuType ?? 0,
          higherMenuOptions: formatHigherMenuOptions(
            cloneDeep(dataList.value).filter(
              item =>
                item.menuType !== 3 &&
                item.id !== (row as FormItemProps & { id?: number })?.id
            )
          ),
          parentId: row?.parentId ?? 0,
          title: row?.title ?? "",
          name: row?.name ?? "",
          path: editableRoutePath(row?.path ?? "", row?.parentId ?? 0),
          component: row?.component ?? "",
          rank: row?.rank ?? 99,
          redirect: row?.redirect ?? "",
          icon: row?.icon ?? "",
          extraIcon: row?.extraIcon ?? "",
          transitionName: row?.transitionName ?? "",
          enterTransition: row?.enterTransition ?? "",
          leaveTransition: row?.leaveTransition ?? "",
          activePath: row?.activePath ?? "",
          auths: row?.auths ?? "",
          frameSrc: row?.frameSrc ?? "",
          frameLoading: row?.frameLoading ?? true,
          keepAlive: row?.keepAlive ?? false,
          hiddenTag: row?.hiddenTag ?? false,
          fixedTag: row?.fixedTag ?? false,
          showLink: row?.showLink ?? true,
          showParent: row?.showParent ?? false
        }
      },
      width: "45%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(
            `您${title}了菜单名称为${transformI18n(curData.title)}的这条数据`,
            {
              type: "success"
            }
          );
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }
        FormRef.validate(async valid => {
          if (valid) {
            await saveSystemMenu(
              (row as FormItemProps & { id?: number })?.id,
              curData
            );
            chores();
          }
        });
      }
    });
  }

  async function handleDelete(row) {
    await deleteSystemMenu(row.id);
    message(`您删除了菜单名称为${transformI18n(row.title)}的这条数据`, {
      type: "success"
    });
    onSearch();
  }

  onMounted(() => {
    onSearch();
  });

  return {
    getMenuType,
    form,
    loading,
    columns,
    dataList,
    /** 搜索 */
    onSearch,
    /** 重置 */
    resetForm,
    /** 新增、修改菜单 */
    openDialog,
    /** 删除菜单 */
    handleDelete,
    handleSelectionChange
  };
}
