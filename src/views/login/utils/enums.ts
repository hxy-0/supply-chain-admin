import { $t } from "@/plugins/i18n";

const operates = [
  { title: $t("login.pureCodeLogin"), page: 1 },
  { title: $t("login.pureRegister"), page: 3 }
];

const thirdParty = [
  {
    title: $t("login.pureWeChatLogin"),
    icon: "wechat",
    color: "#07C160"
  },
  {
    title: $t("login.pureAlipayLogin"),
    icon: "alipay",
    color: "#1677FF"
  },
  {
    title: $t("login.pureQQLogin"),
    icon: "qq",
    color: "#12B7F5"
  },
  {
    title: $t("login.pureGitHubLogin"),
    icon: "github",
    color: "#181717"
  }
];

export { operates, thirdParty };
