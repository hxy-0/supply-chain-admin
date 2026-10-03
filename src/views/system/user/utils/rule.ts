import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { isPhone, isEmail } from "@pureadmin/utils";
export const formRules = reactive<FormRules>({
  nickname: [{ required: true, message: "请输入昵称", trigger: "blur" }],
  username: [
    {
      required: true,
      validator: (_rule, value, done) => {
        if (isPhone(value) || isEmail(value)) {
          done();
        } else {
          done(new Error("请输入手机号或邮箱"));
        }
      },
      trigger: "blur"
    }
  ],
  password: [
    { required: true, min: 8, message: "密码至少 8 位", trigger: "blur" }
  ]
});
