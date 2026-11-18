#!/bin/bash
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$ROOT/tools/preview-phone.sh"
result=$?
if [ "$result" -ne 0 ] && [ "$result" -ne 130 ]; then
  echo "启动未完成（退出码 $result），请查看上方提示。"
fi
read -r -p '按回车关闭窗口……' _
exit "$result"
