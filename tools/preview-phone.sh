#!/bin/bash
set -euo pipefail
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUILD_DIR="$PROJECT_DIR/build/bytedance-mini-game"
CLIENT_KEY=mgzkv9i9tmnq8v3w
case "${1:-}" in ''|--background) ;; *) echo 'Usage: preview-phone.sh [--background]'; exit 2;; esac
# Finder launches do not always inherit the Node/NVM path from interactive shells.
if ! command -v ttmg >/dev/null 2>&1; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin/ttmg; do
    if [ -x "$candidate" ]; then export PATH="$(dirname "$candidate"):$PATH"; fi
  done
fi
command -v ttmg >/dev/null 2>&1 || { echo '找不到 ttmg，请先安装 TikTok CLI。'; exit 1; }
command -v node >/dev/null 2>&1 || { echo '找不到 Node.js。'; exit 1; }
mkdir -p "$PROJECT_DIR/.ttmg"
if [ -d "$BUILD_DIR" ]; then
  cd "$BUILD_DIR"
  sessions=$(ttmg dev session list --format json)
  ids=$(printf '%s' "$sessions" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);for(const x of j.sessions||[])if(x.running&&x.clientKey===process.argv[1])console.log(x.sessionId)})' "$CLIENT_KEY")
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    echo "停止当前游戏的旧调试会话：$id"
    ttmg dev session stop "$id" --format json
  done <<< "$ids"
fi
cd "$PROJECT_DIR"
echo '正在重新构建真机测试包，请稍候……'
BUILD_LOG="$PROJECT_DIR/.ttmg/phone-build.log"
if ! "$PROJECT_DIR/tools/build-release.sh" --preview > "$BUILD_LOG" 2>&1; then
  echo "构建失败，未启动旧包。完整日志：$BUILD_LOG"
  tail -n 60 "$BUILD_LOG"
  exit 1
fi
echo '测试构建及包检查通过。正在生成新的真机调试二维码……'
cd "$BUILD_DIR"
if [ "${1:-}" = --background ]; then
  exec ttmg dev --client-key "$CLIENT_KEY" --mode client-preview --update-mode manual --record-logs --background --no-open --format json
else
  echo '请扫描本次二维码；保持此终端打开。结束调试按 Ctrl+C。'
  echo '修改游戏后再次运行本脚本，即可重新打包并生成二维码。'
  exec ttmg dev --client-key "$CLIENT_KEY" --mode client-preview --update-mode manual --record-logs
fi
