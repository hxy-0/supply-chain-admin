import "./reset.css";
import dayjs from "dayjs";
import roleForm from "../form/role.vue";
import editForm from "../form/index.vue";
import { message } from "@/utils/message";
import passwordForm from "../form/password.vue";
import { usePublicHooks } from "../../hooks";

import { addDialog } from "@/components/ReDialog";
import type { PaginationProps } from "@pureadmin/table";
import type { FormItemProps, RoleFormItemProps } from "../utils/types";
import { getKeyList, deviceDetection } from "@pureadmin/utils";
import {
  saveSystemUser,
  setUserEnable,
  deleteSystemUsers,
  resetSystemPassword,
  setSystemAvatar,
  setUserRoles,
  getRoleIds,
  getUserList,
  getAllRoleList
} from "@/api/system";
import { ElMessageBox } from "element-plus";
import { type Ref, h, ref, toRaw, computed, reactive, onMounted } from "vue";

export function useUser(tableRef: Ref) {
  const form = reactive({
    username: "",
    isEnable: ""
  });
  const formRef = ref();
  const ruleFormRef = ref();
  const dataList = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const selectedNum = ref(0);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });
  const columns: TableColumnList = [
    {
      label: "勾选列", // 如果需要表格多选，此处label必须设置
      type: "selection",
      fixed: "left",
      reserveSelection: true // 数据刷新后保留选项
    },
    {
      label: "用户编号",
      prop: "id",
      width: 90
    },
    {
      label: "用户头像",
      prop: "avatar",
      slot: "avatar",
      width: 90
    },
    {
      label: "登录账号",
      prop: "username",
      minWidth: 130
    },
    {
      label: "用户昵称",
      prop: "nickname",
      minWidth: 130
    },
    {
      label: "性别",
      prop: "sex",
      minWidth: 90,
      slot: "sex"
    },
    {
      label: "状态",
      prop: "isEnable",
      minWidth: 90,
      slot: "status"
    },
    {
      label: "创建时间",
      minWidth: 90,
      prop: "createTime",
      formatter: ({ createTime }) =>
        dayjs(createTime).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ];
  const buttonClass = computed(() => {
    return [
      "h-5!",
      "reset-margin",
      "text-gray-500!",
      "dark:text-white!",
      "dark:hover:text-primary!"
    ];
  });
  // 重置的新密码
  const pwdForm = reactive({
    newPwd: ""
  });
  const roleOptions = ref([]);

  async function onChange({ row, index }) {
    try {
      await ElMessageBox.confirm(
        `确认${row.isEnable === 0 ? "停用" : "启用"}用户 ${row.username}？`,
        "系统提示",
        { type: "warning" }
      );
      switchLoadMap.value[index] = { loading: true };
      await setUserEnable(row.id, row.isEnable);
      message("用户状态已更新", { type: "success" });
    } catch {
      row.isEnable = row.isEnable === 0 ? 1 : 0;
    } finally {
      switchLoadMap.value[index] = { loading: false };
    }
  }
  async function handleDelete(row) {
    await deleteSystemUsers([row.id]);
    message("用户已删除", { type: "success" });
    await onSearch();
  }
  function handleSizeChange(val: number) {
    pagination.pageSize = val;
    pagination.currentPage = 1;
    onSearch();
  }
  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    onSearch();
  }
  /** 当CheckBox选择项发生变化时会触发该事件 */
  function handleSelectionChange(val) {
    selectedNum.value = val.length;
    // 重置表格高度
    tableRef.value.setAdaptive();
  }

  /** 取消选择 */
  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  /** 批量删除 */
  async function onbatchDel() {
    // 返回当前选中的行
    const curSelected = tableRef.value.getTableRef().getSelectionRows();
    await deleteSystemUsers(getKeyList(curSelected, "id"));
    message(`已删除用户编号为 ${getKeyList(curSelected, "id")} 的数据`, {
      type: "success"
    });
    tableRef.value.getTableRef().clearSelection();
    onSearch();
  }

  async function onSearch() {
    loading.value = true;
    try {
      const { data } = await getUserList({
        ...toRaw(form),
        isEnable: form.isEnable === "" ? null : Number(form.isEnable),
        pageNum: pagination.currentPage,
        pageSize: pagination.pageSize
      });
      dataList.value = data.records;
      pagination.total = data.total;
      pagination.currentPage = data.current;
      pagination.pageSize = data.size;
    } finally {
      loading.value = false;
    }
  }
  const resetForm = formEl => {
    if (!formEl) {
      return;
    }
    formEl.resetFields();
    pagination.currentPage = 1;
    onSearch();
  };

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}用户`,
      props: {
        formInline: {
          title,
          nickname: row?.nickname ?? "",
          username: row?.username ?? "",
          password: row?.password ?? "",
          sex: row?.sex ?? 2,
          isEnable: row?.isEnable ?? 1,
          remark: row?.remark ?? ""
        }
      },
      width: "46%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(`您${title}了用户名称为${curData.username}的这条数据`, {
            type: "success"
          });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }
        FormRef.validate(async valid => {
          if (valid) {
            await saveSystemUser(row?.id, curData);
            chores();
          }
        });
      }
    });
  }

  async function handleUpload(row) {
    try {
      const { value } = await ElMessageBox.prompt(
        "请输入头像图片的 http/https 地址",
        "修改头像",
        {
          inputValue: row.avatar || "",
          inputPattern: /^https?:\/\/\S+$/,
          inputErrorMessage: "请输入有效图片地址"
        }
      );
      await setSystemAvatar(row.id, value);
      message("头像已更新", { type: "success" });
      await onSearch();
    } catch {
      /* 取消或接口错误，保留原头像。 */
    }
  }

  /** 重置密码 */
  function handleReset(row) {
    addDialog({
      title: `重置 ${row.username} 用户的密码`,
      width: "30%",
      draggable: true,
      closeOnClickModal: false,
      fullscreen: deviceDetection(),
      contentRenderer: () =>
        h(passwordForm, { ref: ruleFormRef, model: pwdForm }),
      closeCallBack: () => (pwdForm.newPwd = ""),
      beforeSure: done => {
        ruleFormRef.value.getRef().validate(async valid => {
          if (valid) {
            await resetSystemPassword(row.id, pwdForm.newPwd);
            message(`已成功重置 ${row.username} 用户的密码`, {
              type: "success"
            });
            done(); // 关闭弹框
            onSearch(); // 刷新表格数据
          }
        });
      }
    });
  }

  /** 分配角色 */
  async function handleRole(row) {
    // 选中的角色列表
    const ids = (await getRoleIds({ userId: row.id })).data ?? [];
    addDialog({
      title: `分配 ${row.username} 用户的角色`,
      props: {
        formInline: {
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          roleOptions: roleOptions.value ?? [],
          ids
        }
      },
      width: "400px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: async (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        await setUserRoles(row.id, curData.ids);
        message("用户角色已保存", { type: "success" });
        done(); // 关闭弹框
      }
    });
  }

  onMounted(async () => {
    await onSearch();
    roleOptions.value = (await getAllRoleList()).data ?? [];
  });

  return {
    switchLoadMap,
    switchStyle,
    onChange,
    form,
    loading,
    columns,
    dataList,
    selectedNum,
    pagination,
    buttonClass,
    deviceDetection,
    onSearch,
    resetForm,
    onbatchDel,
    openDialog,
    handleDelete,
    handleUpload,
    handleReset,
    handleRole,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
